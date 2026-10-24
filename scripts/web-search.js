#!/usr/bin/env node
/**
 * web-search.js — 搜索聚合（v5.1）
 *
 * 三种模式：
 *   1. bing   — 默认，抓取 Bing 搜索结果 HTML（无需 API Key）
 *   2. engine — 指定 bing/google/baidu/ddg
 *   3. ai     — 用大模型 API 搜索/总结（需已配置 AI）
 *
 * 零第三方依赖。
 */

const https = require('https');
const http = require('http');
const { SEARCH_ENGINES } = require('./sources-catalog');

/* ---------------- 网络 ---------------- */

function httpGet(url, opts) {
  opts = opts || {};
  const depth = opts._depth || 0;
  return new Promise((resolve, reject) => {
    if (depth > 4) return reject(new Error('重定向过多'));
    let lib;
    try { lib = new URL(url).protocol === 'http:' ? http : https; }
    catch (e) { return reject(new Error('无效 URL')); }

    const req = lib.get(url, {
      timeout: opts.timeout || 12000,
      rejectUnauthorized: false,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
      },
    }, (res) => {
      if ([301, 302, 303, 307, 308].indexOf(res.statusCode) >= 0 && res.headers.location) {
        res.destroy();
        let next;
        try { next = new URL(res.headers.location, url).toString(); } catch (e) { return reject(new Error('重定向无效')); }
        return resolve(httpGet(next, Object.assign({}, opts, { _depth: depth + 1 })));
      }
      if (res.statusCode >= 400) { res.destroy(); return reject(new Error('HTTP ' + res.statusCode)); }
      let body = '';
      let size = 0;
      res.on('data', (c) => {
        size += c.length;
        if (size > 3 * 1024 * 1024) { res.destroy(); return; }
        body += c.toString('utf8');
      });
      res.on('end', () => resolve(body));
      res.on('error', reject);
    });
    req.on('error', (e) => reject(new Error(e.code || e.message)));
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
  });
}

/* ---------------- HTML 解析 ---------------- */

function stripTags(s) {
  return String(s || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, String.fromCharCode(39))
    .replace(new RegExp(String.fromCharCode(38) + 'quot;', 'g'), String.fromCharCode(34))
    .replace(new RegExp(String.fromCharCode(38) + '#\\d+;', 'g'), ' ')
    .replace(new RegExp(String.fromCharCode(38) + '\\w+;', 'g'), ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupe(list) {
  const seen = new Set();
  const out = [];
  for (const it of list) {
    const key = (it.url || '') + '|' + (it.title || '').slice(0, 50);
    if (seen.has(key)) continue;
    if (!it.title || it.title.length < 3) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

/** Bing 结果页 */
function parseBing(html) {
  const out = [];
  const re = /<li class="b_algo"[\s\S]*?<\/li>/gi;
  const blocks = html.match(re) || [];
  for (const b of blocks) {
    const t = b.match(/<h2[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!t) continue;
    const snippet = (b.match(/<p[^>]*>([\s\S]*?)<\/p>/i) || [])[1] || '';
    out.push({
      title: stripTags(t[2]),
      url: t[1],
      snippet: stripTags(snippet).slice(0, 300),
      engine: 'bing',
    });
  }
  return out;
}

/** Google 结果页 */
function parseGoogle(html) {
  const out = [];
  const re = /<a href="\/url\?q=([^&"]+)[^"]*"[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    out.push({ title: stripTags(m[2]), url: decodeURIComponent(m[1]), snippet: '', engine: 'google' });
  }
  if (!out.length) {
    const re2 = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
    while ((m = re2.exec(html)) !== null) {
      out.push({ title: stripTags(m[1]), url: '', snippet: '', engine: 'google' });
    }
  }
  return out;
}

/** 百度结果页 */
function parseBaidu(html) {
  const out = [];
  const re = /<h3[^>]*class="[^"]*t[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    out.push({ title: stripTags(m[2]), url: m[1], snippet: '', engine: 'baidu' });
  }
  return out;
}

const PARSERS = { bing: parseBing, google: parseGoogle, baidu: parseBaidu, ddg: parseBing };

/* ---------------- 搜索 API ---------------- */

/**
 * 搜索引擎检索
 * @param {string} query
 * @param {object} opts { engine='bing', limit=10, timeout }
 */
async function search(query, opts) {
  opts = opts || {};
  const engine = (opts.engine || 'bing').toLowerCase();
  const cfg = SEARCH_ENGINES[engine] || SEARCH_ENGINES.bing;
  const url = cfg.url.replace('{q}', encodeURIComponent(query));

  const html = await httpGet(url, { timeout: opts.timeout || 15000 });
  const parser = PARSERS[engine] || parseBing;
  let items = dedupe(parser(html)).slice(0, opts.limit || 10);

  if (!items.length) {
    throw new Error(engine + ' 未解析到结果（可能被反爬拦截，建议改用 AI 搜索模式）');
  }
  return { engine: engine, engineName: cfg.name, query: query, items: items, url: url };
}

/**
 * 大模型搜索：让 AI 基于自身知识 + 实时资讯作答
 * @param {string} query
 * @param {object} opts { model, maxTokens, context }
 */
async function searchByAI(query, opts) {
  opts = opts || {};
  const ai = require('./ai-provider');
  const messages = [
    {
      role: 'system',
      content: '你是一个资讯搜索助手。请针对用户查询给出结构化结果：最多 8 条，每条包含"标题、要点（30字内）、来源（若不确定写"AI 综合"）"。用 JSON 输出，格式：{"results":[{"title":"","summary":"","source":""}]}。只输出 JSON，不要解释。'
    },
    { role: 'user', content: query },
  ];
  const t0 = Date.now();
  const data = await ai.chatJSON(messages, {
    model: opts.model,
    maxTokens: opts.maxTokens || 1200,
    temperature: opts.temperature !== undefined ? opts.temperature : 0.3,
  });
  const arr = Array.isArray(data) ? data : (data.results || data.items || data.data || []);
  const items = (Array.isArray(arr) ? arr : []).map((r) => ({
    title: String(r.title || r.name || '').slice(0, 200),
    url: r.url || r.link || '',
    snippet: String(r.summary || r.desc || r.description || '').slice(0, 300),
    source: r.source || 'AI 综合',
    engine: 'ai',
  })).filter((r) => r.title);
  return { engine: 'ai', engineName: 'AI 搜索', query: query, items: items, latencyMs: Date.now() - t0 };
}

/**
 * 统一入口：mode = 'bing' | 'engine' | 'ai' | 'mixed'
 */
async function unified(query, opts) {
  opts = opts || {};
  const mode = (opts.mode || 'bing').toLowerCase();

  if (mode === 'ai') return searchByAI(query, opts);

  if (mode === 'mixed') {
    const jobs = [
      search(query, { engine: opts.engine || 'bing', limit: opts.limit }).catch((e) => ({ error: e.message, items: [] })),
      searchByAI(query, opts).catch((e) => ({ error: e.message, items: [] })),
    ];
    const [web, aiRes] = await Promise.all(jobs);
    return {
      engine: 'mixed', engineName: '网页 + AI',
      query: query,
      items: dedupe([].concat(web.items || [], aiRes.items || [])).slice(0, opts.limit || 12),
      webError: web.error || null,
      aiError: aiRes.error || null,
    };
  }

  return search(query, { engine: mode === 'engine' ? (opts.engine || 'bing') : mode, limit: opts.limit, timeout: opts.timeout });
}

module.exports = { search, searchByAI, unified, SEARCH_ENGINES, httpGet };

/* ---------------- CLI ---------------- */
if (require.main === module) {
  const q = process.argv.slice(2).join(' ') || '今日科技新闻';
  const mode = process.env.MODE || 'bing';
  (async () => {
    console.log('搜索: "' + q + '"  模式: ' + mode + '\n');
    const r = await unified(q, { mode: mode, limit: 6 });
    console.log('引擎: ' + r.engineName + ' | 结果: ' + r.items.length + ' 条');
    r.items.forEach((it, i) => {
      console.log('\n' + (i + 1) + '. ' + it.title);
      if (it.snippet) console.log('   ' + it.snippet.slice(0, 120));
      if (it.url) console.log('   ' + it.url.slice(0, 100));
    });
  })().catch((e) => { console.error('失败: ' + e.message); process.exit(1); });
}