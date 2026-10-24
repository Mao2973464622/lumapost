#!/usr/bin/env node
/**
 * rss-fetcher.js — RSS/Atom 抓取引擎 (v5.1)
 *
 * 纯手写 XML 解析，零第三方依赖。
 * 支持 RSS 2.0 / Atom / RDF(RSS 1.0) / JSON Feed。
 */

const https = require('https');
const http = require('http');

/* ---------------- 网络 ---------------- */

function httpGet(url, opts) {
  opts = opts || {};
  const depth = opts._depth || 0;
  const timeout = opts.timeout || 12000;

  return new Promise((resolve, reject) => {
    if (depth > 5) return reject(new Error('重定向次数过多'));
    let lib;
    try {
      lib = new URL(url).protocol === 'http:' ? http : https;
    } catch (e) {
      return reject(new Error('无效 URL: ' + url));
    }

    const req = lib.get(url, {
      timeout: timeout,
      rejectUnauthorized: false,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LumaPostBot/5.1; +https://github.com/Mao2973464622/lumapost)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, application/json, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    }, (res) => {
      if ([301, 302, 303, 307, 308].indexOf(res.statusCode) >= 0 && res.headers.location) {
        res.destroy();
        let next;
        try { next = new URL(res.headers.location, url).toString(); }
        catch (e) { return reject(new Error('重定向地址无效')); }
        return resolve(httpGet(next, Object.assign({}, opts, { _depth: depth + 1 })));
      }
      if (res.statusCode >= 400) {
        res.destroy();
        return reject(new Error('HTTP ' + res.statusCode));
      }
      const chunks = [];
      let size = 0;
      res.on('data', (c) => {
        size += c.length;
        if (size > 8 * 1024 * 1024) { res.destroy(); return reject(new Error('响应过大')); }
        chunks.push(c);
      });
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    });

    req.on('error', (e) => reject(new Error(e.code || e.message)));
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
  });
}

/* ---------------- XML 工具 ---------------- */

// 用 fromCharCode 构造键名，避免源码中直接出现裸引号实体导致解析歧义
const ENTITIES = (function () {
  const amp = String.fromCharCode(38);
  const map = {};
  map[amp + 'lt;'] = '<';
  map[amp + 'gt;'] = '>';
  map[amp + 'amp;'] = '&';
  map[amp + 'quot;'] = String.fromCharCode(34);
  map[amp + 'apos;'] = String.fromCharCode(39);
  map[amp + '#39;'] = String.fromCharCode(39);
  map[amp + 'nbsp;'] = ' ';
  return map;
})();

function decodeEntities(s) {
  if (!s) return '';
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(?:#(\d+)|#x([0-9a-fA-F]+)|([a-zA-Z]+));/g, (m, dec, hex, name) => {
      if (dec) return String.fromCodePoint(parseInt(dec, 10));
      if (hex) return String.fromCodePoint(parseInt(hex, 16));
      return ENTITIES[m] !== undefined ? ENTITIES[m] : m;
    });
}

function stripTags(s) {
  return decodeEntities(String(s || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}

/** 取第一个匹配标签的内文 */
function tagText(xml, ...names) {
  for (const n of names) {
    const re = new RegExp('<' + n + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + n + '>', 'i');
    const m = xml.match(re);
    if (m) {
      const v = decodeEntities(m[1]).trim();
      if (v) return v;
    }
    // 自闭合或属性形式（atom link）
    const re2 = new RegExp('<' + n + '\\s[^>]*href=["\']([^"\']+)["\'][^>]*/?>', 'i');
    const m2 = xml.match(re2);
    if (m2) return m2[1];
  }
  return '';
}

/** 取所有匹配块 */
function tagBlocks(xml, name) {
  const out = [];
  const re = new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + name + '>', 'gi');
  let m;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}

function atomLink(block) {
  // <link rel="alternate" href="..." /> 优先
  const re = /<link\b([^>]*)\/?>/gi;
  let m;
  let fallback = '';
  while ((m = re.exec(block)) !== null) {
    const attrs = m[1];
    const href = (attrs.match(/href=["']([^"']+)["']/i) || [])[1];
    if (!href) continue;
    const rel = (attrs.match(/rel=["']([^"']+)["']/i) || [])[1];
    if (!rel || rel === 'alternate') return href;
    if (!fallback) fallback = href;
  }
  return fallback;
}

/* ---------------- 解析器 ---------------- */

function parseRss(xml) {
  const items = [];
  const blocks = tagBlocks(xml, 'item').length ? tagBlocks(xml, 'item') : tagBlocks(xml, 'entry');
  for (const b of blocks) {
    const title = stripTags(tagText(b, 'title'));
    let link = tagText(b, 'link', 'guid', 'id');
    if (!link || !/^https?:/i.test(link)) {
      const alt = atomLink(b);
      if (alt) link = alt;
    }
    const desc = stripTags(tagText(b, 'description', 'summary', 'content:encoded', 'content'));
    const dateRaw = tagText(b, 'pubDate', 'published', 'updated', 'dc:date');
    const author = stripTags(tagText(b, 'author', 'dc:creator', 'name'));
    const cats = tagBlocks(b, 'category').map(c => stripTags(c)).filter(Boolean);

    if (!title && !link) continue;
    const ts = dateRaw ? Date.parse(dateRaw) : NaN;
    items.push({
      title: title || '(无标题)',
      link: link || '',
      summary: desc.slice(0, 600),
      publishedAt: Number.isNaN(ts) ? null : new Date(ts).toISOString(),
      author: author,
      categories: cats,
    });
  }
  return items;
}

function parseJsonFeed(text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { return []; }
  let arr = null;
  if (Array.isArray(data)) arr = data;
  else if (data && typeof data === 'object') {
    // 常见容器键，含嵌套 data
    const direct = ['items', 'articles', 'lives', 'results', 'entries', 'list', 'data'];
    for (const k of direct) {
      if (Array.isArray(data[k])) { arr = data[k]; break; }
    }
    // data.items / data.list 这类嵌套一层
    if (!arr && data.data && typeof data.data === 'object') {
      for (const k of direct) {
        if (Array.isArray(data.data[k])) { arr = data.data[k]; break; }
      }
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr.map((it) => {
    if (!it || typeof it !== 'object') return null;
    const title = it.title || it.name || it.content_text || it.content || '';
    const link = it.url || it.link || it.external_url || it.id || '';
    const desc = it.summary || it.description || it.content_text || it.content || it.content_html || '';
    const ts = it.date_published || it.published_at || it.publishedAt || it.created_at || it.display_time || it.time;
    let iso = null;
    if (ts) {
      const n = typeof ts === 'number' ? (ts > 2e9 ? ts : ts * 1000) : Date.parse(ts);
      if (!Number.isNaN(n)) iso = new Date(n).toISOString();
    }
    return {
      title: stripTags(title).slice(0, 300) || '(无标题)',
      link: String(link || ''),
      summary: stripTags(desc).slice(0, 600),
      publishedAt: iso,
      author: it.author ? (typeof it.author === 'string' ? it.author : (it.author.name || '')) : '',
      categories: Array.isArray(it.tags) ? it.tags.slice(0, 5) : [],
    };
  }).filter(Boolean);
}

/**
 * 抓取并解析单个源
 * @returns {Promise<{items:Array, error?:string}>}
 */
async function fetchFeed(source, opts) {
  opts = opts || {};
  const url = typeof source === 'string' ? source : source.url;
  const name = (typeof source === 'object' && source.name) || url;
  try {
    const text = await httpGet(url, { timeout: opts.timeout || 12000 });
    if (!text || text.length < 50) return { items: [], error: '响应内容过短' };

    let items = [];
    const trimmed = text.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      items = parseJsonFeed(trimmed);
    } else if (/<rss|<feed|<rdf:RDF/i.test(text.slice(0, 2000))) {
      items = parseRss(text);
    } else {
      return { items: [], error: '不是有效的 RSS/Atom/JSON Feed' };
    }

    items = items
      .filter((it) => it && it.title && it.title !== '(无标题)')
      .slice(0, opts.limit || 30);

    return { items, name };
  } catch (e) {
    return { items: [], error: e.message, name };
  }
}

/**
 * 并发抓取多个源
 * @param {Array} sources
 * @param {object} opts { concurrency, limit, timeout, onProgress }
 */
async function fetchAll(sources, opts) {
  opts = opts || {};
  const concurrency = opts.concurrency || 6;
  const list = (sources || []).filter(s => s && (s.url || typeof s === 'string'));
  const results = [];
  let idx = 0;
  let done = 0;

  async function worker() {
    while (idx < list.length) {
      const my = idx++;
      const src = list[my];
      const r = await fetchFeed(src, opts);
      results[my] = {
        name: (typeof src === 'object' ? src.name : src.url) || ('源' + my),
        url: typeof src === 'object' ? src.url : src,
        category: (typeof src === 'object' && src.category) || 'news',
        count: r.items.length,
        items: r.items,
        error: r.error || null,
      };
      done++;
      if (opts.onProgress) {
        try { opts.onProgress(done, list.length, results[my]); } catch (e) { /* noop */ }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, list.length || 1) }, worker));
  return results;
}

/**
 * 按分类聚合，去重后按时间排序
 */
function aggregate(results, opts) {
  opts = opts || {};
  const limit = opts.limit || 20;
  const seen = new Set();
  const byCat = {};
  let all = [];

  for (const r of results || []) {
    if (!r || !r.items) continue;
    const cat = r.category || 'news';
    if (!byCat[cat]) byCat[cat] = [];
    for (const it of r.items) {
      const key = (it.link || '') + '|' + it.title.slice(0, 40);
      if (seen.has(key)) continue;
      seen.add(key);
      const enriched = Object.assign({}, it, { source: r.name, category: cat });
      byCat[cat].push(enriched);
      all.push(enriched);
    }
  }

  all.sort((a, b) => (Date.parse(b.publishedAt || 0) || 0) - (Date.parse(a.publishedAt || 0) || 0));
  for (const k of Object.keys(byCat)) {
    byCat[k].sort((a, b) => (Date.parse(b.publishedAt || 0) || 0) - (Date.parse(a.publishedAt || 0) || 0));
  }

  return { all: all.slice(0, limit * 4), byCategory: byCat, total: all.length };
}

module.exports = { fetchFeed, fetchAll, aggregate, parseRss, parseJsonFeed, stripTags, decodeEntities, httpGet };

/* ---------------- CLI ---------------- */
if (require.main === module) {
  const arg = process.argv[2];
  (async () => {
    let sources;
    if (arg === '--catalog') {
      sources = require('./sources-catalog').CATALOG.slice(0, 8);
    } else if (arg) {
      sources = [{ name: arg, url: arg, category: 'news' }];
    } else {
      console.log('用法: node rss-fetcher.js <rss-url> | --catalog');
      process.exit(0);
    }
    console.log('抓取 ' + sources.length + ' 个源...\n');
    const res = await fetchAll(sources, {
      concurrency: 4,
      limit: 3,
      onProgress: (d, t, r) => {
        console.log((r.error ? 'FAIL ' : 'OK   ') + r.name + (r.error ? '  ' + r.error : '  ' + r.count + ' 条'));
      },
    });
    const agg = aggregate(res, { limit: 3 });
    console.log('\n聚合总计: ' + agg.total + ' 条');
    console.log('分类: ' + Object.keys(agg.byCategory).map(k => k + '(' + agg.byCategory[k].length + ')').join(', '));
    console.log('\n最新 5 条:');
    agg.all.slice(0, 5).forEach((it) => console.log('  [' + it.category + '] ' + it.title.slice(0, 50) + ' — ' + it.source));
  })().catch(e => { console.error(e); process.exit(1); });
}