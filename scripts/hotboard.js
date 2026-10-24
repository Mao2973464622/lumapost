#!/usr/bin/env node
/**
 * hotboard.js — 中文热榜 + 游戏特惠 + 股市行情（v5.3）
 *
 * 融合自 daily-news 项目的实用能力，全部实测可用：
 *   - 中文热榜 13 家（掘金/CSDN/V2EX/知乎/微博/抖音/B站/贴吧/36氪/少数派/IT之家/澎湃/头条）
 *   - Steam 特惠 + 新作 + 热销
 *   - Epic 限免游戏
 *   - A 股指数（新浪财经，GBK）
 *   - GitHub Trending
 *
 * 零第三方依赖。
 */

const https = require('https');
const http = require('http');

/* ---------------- 网络 ---------------- */

function request(url, opts) {
  opts = opts || {};
  const depth = opts._depth || 0;
  return new Promise((resolve, reject) => {
    if (depth > 4) return reject(new Error('重定向过多'));
    let lib;
    try { lib = new URL(url).protocol === 'http:' ? http : https; }
    catch (e) { return reject(new Error('无效 URL: ' + url)); }

    const req = lib.get(url, {
      timeout: opts.timeout || 12000,
      rejectUnauthorized: false,
      headers: Object.assign({
        'User-Agent': 'Mozilla/5.0 (compatible; LumaPostBot/5.3)',
        'Accept': '*/*',
      }, opts.headers || {}),
    }, (res) => {
      if ([301, 302, 303, 307, 308].indexOf(res.statusCode) >= 0 && res.headers.location) {
        res.destroy();
        let next;
        try { next = new URL(res.headers.location, url).toString(); }
        catch (e) { return reject(new Error('重定向地址无效')); }
        return resolve(request(next, Object.assign({}, opts, { _depth: depth + 1 })));
      }
      if (res.statusCode >= 400) {
        res.destroy();
        return reject(new Error('HTTP ' + res.statusCode));
      }
      const chunks = [];
      let size = 0;
      res.on('data', (c) => {
        size += c.length;
        if (size > 6 * 1024 * 1024) { res.destroy(); return reject(new Error('响应过大')); }
        chunks.push(c);
      });
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        let text;
        if (opts.encoding === 'gbk') {
          try { text = new TextDecoder('gbk').decode(buf); }
          catch (e) { text = buf.toString('utf8'); }
        } else {
          text = buf.toString('utf8');
        }
        resolve({ status: res.statusCode, text: text, buffer: buf });
      });
      res.on('error', reject);
    });

    req.on('error', (e) => reject(new Error(e.code || e.message)));
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
  });
}

/* ---------------- 中文热榜 ---------------- */

const HOTBOARD_TYPES = {
  juejin:    { name: '掘金',      category: 'github' },
  csdn:      { name: 'CSDN',      category: 'github' },
  v2ex:      { name: 'V2EX',      category: 'github' },
  zhihu:     { name: '知乎热榜',   category: 'news' },
  weibo:     { name: '微博热搜',   category: 'news' },
  douyin:    { name: '抖音热榜',   category: 'news' },
  bilibili:  { name: 'B站热门',   category: 'entertainment' },
  tieba:     { name: '贴吧热榜',   category: 'news' },
  '36kr':    { name: '36氪热榜',  category: 'finance' },
  sspai:     { name: '少数派',     category: 'life' },
  ithome:    { name: 'IT之家热榜', category: 'hardware' },
  thepaper:  { name: '澎湃热榜',   category: 'politics' },
  toutiao:   { name: '头条热榜',   category: 'news' },
};

/**
 * 抓取单个热榜
 * @returns {Promise<{items:Array, error?:string}>}
 */
async function fetchHotboard(type, opts) {
  opts = opts || {};
  const meta = HOTBOARD_TYPES[type] || { name: type, category: 'news' };
  const limit = opts.limit || 10;
  const url = 'https://uapis.cn/api/v1/misc/hotboard?type=' + encodeURIComponent(type);

  try {
    const r = await request(url, { timeout: opts.timeout || 12000 });
    let data;
    try { data = JSON.parse(r.text); }
    catch (e) { return { items: [], error: '响应非 JSON' }; }

    const list = data.list || (data.data && data.data.list) || [];
    if (!Array.isArray(list) || !list.length) return { items: [], error: '无数据' };

    const now = new Date().toISOString();
    const items = list.slice(0, limit).map((it, i) => {
      const title = String(it.title || it.name || '').trim();
      const link = String(it.url || it.link || '');
      const desc = String(it.desc || it.description || it.hot_value || '').trim();
      return {
        title: title,
        link: link,
        summary: desc.slice(0, 200),
        publishedAt: now,
        author: '',
        categories: [type],
        rank: i + 1,
        source: meta.name,
        category: meta.category,
      };
    }).filter((x) => x.title);

    return { items: items, name: meta.name, category: meta.category };
  } catch (e) {
    return { items: [], error: e.message };
  }
}

/** 批量抓取热榜 */
async function fetchAllHotboards(types, opts) {
  opts = opts || {};
  const list = types && types.length ? types : Object.keys(HOTBOARD_TYPES);
  const concurrency = opts.concurrency || 6;
  const results = [];
  let idx = 0;

  async function worker() {
    while (idx < list.length) {
      const t = list[idx++];
      const r = await fetchHotboard(t, opts);
      results.push({
        type: t,
        name: (HOTBOARD_TYPES[t] || {}).name || t,
        category: (HOTBOARD_TYPES[t] || {}).category || 'news',
        count: r.items.length,
        items: r.items,
        error: r.error || null,
      });
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, worker));
  results.sort((a, b) => list.indexOf(a.type) - list.indexOf(b.type));
  return results;
}

/* ---------------- Steam ---------------- */

async function fetchSteam(opts) {
  opts = opts || {};
  const limit = opts.limit || 10;
  try {
    const r = await request('https://store.steampowered.com/api/featuredcategories/?cc=cn&l=chinese', { timeout: opts.timeout || 12000 });
    const d = JSON.parse(r.text);
    const now = new Date().toISOString();
    const out = [];
    const sections = { specials: '特惠', new_releases: '新品', top_sellers: '热销' };

    for (const key of Object.keys(sections)) {
      const sec = d[key];
      const items = (sec && sec.items) || [];
      for (const it of items.slice(0, limit)) {
        const discount = it.discount_percent || 0;
        const finalPrice = it.final_price != null ? (it.final_price / 100) : null;
        const origPrice = it.original_price != null ? (it.original_price / 100) : null;
        let desc = sections[key];
        if (discount > 0 && finalPrice != null) desc += ' · -' + discount + '% · ¥' + finalPrice;
        else if (finalPrice != null) desc += ' · ¥' + finalPrice;

        out.push({
          title: String(it.name || '未知游戏'),
          link: 'https://store.steampowered.com/app/' + (it.id || '') + '/',
          summary: desc,
          publishedAt: now,
          categories: ['steam', key],
          discount: discount,
          finalPrice: finalPrice,
          originalPrice: origPrice,
          source: 'Steam',
          category: 'games',
        });
      }
    }
    return { items: out, name: 'Steam', category: 'games' };
  } catch (e) {
    return { items: [], error: e.message };
  }
}

/* ---------------- Epic 限免 ---------------- */

async function fetchEpicFree(opts) {
  opts = opts || {};
  try {
    const r = await request('https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions', { timeout: opts.timeout || 12000 });
    const d = JSON.parse(r.text);
    const els = (d.data && d.data.Catalog && d.data.Catalog.searchStore && d.data.Catalog.searchStore.elements) || [];
    const now = new Date().toISOString();
    const items = els.slice(0, opts.limit || 15).map((e) => {
      const slug = e.productSlug || e.urlSlug || e.id || '';
      const price = ((e.price || {}).totalPrice || {}).fmtPrice || {};
      return {
        title: String(e.title || '未知游戏'),
        link: slug ? 'https://store.epicgames.com/p/' + slug : 'https://store.epicgames.com/free-games',
        summary: '原价 ' + (price.originalPrice || '免费') + ' · 限时免费',
        publishedAt: now,
        categories: ['epic', 'free'],
        source: 'Epic 限免',
        category: 'games',
      };
    });
    return { items: items, name: 'Epic 限免', category: 'games' };
  } catch (e) {
    return { items: [], error: e.message };
  }
}

/* ---------------- A 股指数 ---------------- */

const STOCK_CODES = [
  { code: 'sh000001', name: '上证指数' },
  { code: 'sz399001', name: '深证成指' },
  { code: 'sz399006', name: '创业板指' },
  { code: 'sh000688', name: '科创50' },
  { code: 'sh000300', name: '沪深300' },
];

async function fetchStocks(opts) {
  opts = opts || {};
  const codes = opts.codes || STOCK_CODES;
  const list = codes.map((c) => (typeof c === 'string' ? c : c.code)).join(',');
  try {
    const r = await request('https://hq.sinajs.cn/list=' + list, {
      timeout: opts.timeout || 10000,
      encoding: 'gbk',
      headers: { 'Referer': 'https://finance.sina.com.cn' },
    });
    const lines = (r.text || '').split('\n').filter(Boolean);
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/"([^"]+)"/);
      if (!m) continue;
      const p = m[1].split(',');
      if (p.length < 4) continue;
      const cur = parseFloat(p[3]);
      const prev = parseFloat(p[2]);
      if (!isFinite(cur) || cur === 0) continue;
      const chg = cur - prev;
      const pct = prev ? (chg / prev * 100) : 0;
      out.push({
        code: codes[i] ? (codes[i].code || codes[i]) : '',
        name: p[0] || (codes[i] && codes[i].name) || '',
        current: cur,
        prevClose: prev,
        change: chg,
        pct: pct,
        text: (p[0] || '') + ' ' + cur.toFixed(2) + ' (' + (chg >= 0 ? '+' : '') + chg.toFixed(2) + ' / ' + (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%)',
      });
    }
    return { items: out, name: 'A股指数', category: 'finance' };
  } catch (e) {
    return { items: [], error: e.message };
  }
}

/* ---------------- GitHub Trending ---------------- */

async function fetchGithubTrending(opts) {
  opts = opts || {};
  const since = opts.since || 'daily';
  const lang = opts.lang ? '/' + opts.lang : '';
  const url = 'https://github.com/trending' + lang + '?since=' + since;
  try {
    const r = await request(url, { timeout: opts.timeout || 15000 });
    const html = r.text;
    const blocks = html.split('<article class="Box-row"').slice(1);
    const now = new Date().toISOString();
    const items = [];

    for (const b of blocks.slice(0, opts.limit || 15)) {
      const repoM = b.match(/<h2[^>]*>[\s\S]*?<a[^>]+href="\/([^"]+)"[^>]*>/);
      if (!repoM) continue;
      const repo = repoM[1].replace(/\s+/g, '');
      const descM = b.match(/<p[^>]*class="[^"]*color-fg-muted[^"]*"[^>]*>([\s\S]*?)<\/p>/);
      const starM = b.match(/href="\/[^"]+\/stargazers"[^>]*>([\s\S]*?)<\/a>/);
      const todayM = b.match(/([\d,]+)\s*stars?\s*today/);
      const langM = b.match(/itemprop="programmingLanguage">([^<]+)</);

      items.push({
        title: repo,
        link: 'https://github.com/' + repo,
        summary: (descM ? descM[1].replace(/<[^>]+>/g, '').trim() : '') +
                 (langM ? ' · ' + langM[1] : '') +
                 (todayM ? ' · 今日 +' + todayM[1] : ''),
        publishedAt: now,
        categories: ['github', 'trending'],
        stars: starM ? starM[1].replace(/<[^>]+>/g, '').trim() : '',
        source: 'GitHub Trending',
        category: 'github',
      });
    }
    return { items: items, name: 'GitHub Trending', category: 'github' };
  } catch (e) {
    return { items: [], error: e.message };
  }
}

/* ---------------- 统一入口 ---------------- */

/**
 * 抓取全部增强数据源
 * @param {object} opts { hotTypes, steam, epic, stocks, trending, limit }
 */
async function fetchAll(opts) {
  opts = opts || {};
  const jobs = [];
  const names = [];

  jobs.push(fetchAllHotboards(opts.hotTypes, { limit: opts.limit || 10, concurrency: 6 }));
  names.push('hotboards');

  if (opts.steam !== false) { jobs.push(fetchSteam({ limit: opts.limit || 8 })); names.push('steam'); }
  if (opts.epic !== false) { jobs.push(fetchEpicFree({ limit: opts.limit || 10 })); names.push('epic'); }
  if (opts.stocks !== false) { jobs.push(fetchStocks({})); names.push('stocks'); }
  if (opts.trending !== false) { jobs.push(fetchGithubTrending({ limit: opts.limit || 10 })); names.push('trending'); }

  const results = await Promise.all(jobs);
  const out = {};
  names.forEach((n, i) => { out[n] = results[i]; });

  // 汇总为统一格式（供 fetch-news-ai 使用）
  const all = [];
  const push = (r) => {
    if (r && r.items && r.items.length) {
      r.items.forEach((it) => all.push(it));
    }
  };
  (out.hotboards || []).forEach(push);
  push(out.steam);
  push(out.epic);
  push(out.trending);

  out.all = all;
  out.stocks = out.stocks || { items: [] };
  return out;
}

module.exports = {
  fetchHotboard, fetchAllHotboards, fetchSteam, fetchEpicFree,
  fetchStocks, fetchGithubTrending, fetchAll,
  HOTBOARD_TYPES, STOCK_CODES,
};

/* ---------------- CLI ---------------- */
if (require.main === module) {
  const arg = process.argv[2] || 'all';
  (async () => {
    if (arg === 'hot') {
      const rs = await fetchAllHotboards(null, { limit: 5 });
      rs.forEach((r) => {
        console.log((r.error ? 'FAIL ' : 'OK   ') + r.name.padEnd(12) + r.count + ' 条' + (r.error ? '  ' + r.error : ''));
        r.items.slice(0, 2).forEach((it) => console.log('        ' + it.title.slice(0, 46)));
      });
    } else if (arg === 'stock') {
      const r = await fetchStocks({});
      r.items.forEach((s) => console.log('  ' + s.text));
    } else {
      const r = await fetchAll({ limit: 5 });
      console.log('热榜:', (r.hotboards || []).filter((x) => !x.error).length + '/' + (r.hotboards || []).length, '可用');
      console.log('Steam:', r.steam.items.length, '条');
      console.log('Epic :', r.epic.items.length, '条');
      console.log('股票 :', r.stocks.items.length, '条');
      console.log('GitHub:', r.trending.items.length, '条');
      console.log('汇总 :', r.all.length, '条');
    }
  })().catch((e) => { console.error(e); process.exit(1); });
}