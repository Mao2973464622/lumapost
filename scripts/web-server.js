#!/usr/bin/env node
/**
 * web-server.js — LumaPost Web UI 服务器 (v5.0)
 *
 * 关键改进:
 *   1. 所有业务模块统一读 config/app.json（不再只认环境变量）
 *   2. 内置调度器，Web UI 里配置的时间真正生效
 *   3. 监听地址可配置（127.0.0.1 / 0.0.0.0）
 *   4. POST /api/config 带字段校验与类型收敛
 *   5. 模型拉取支持传入临时 apiKey / baseUrl
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

let configStore, aiProvider, scheduler;
try {
  configStore = require('./config-store');
  aiProvider = require('./ai-provider');
  scheduler = require('./scheduler');
} catch (e) {
  console.error('[fatal] 缺少必要模块:', e.message);
  process.exit(1);
}

const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const ROOT = path.resolve(__dirname, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/* ---------------- helpers ---------------- */

function sendJSON(res, data, status) {
  res.writeHead(status || 200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(data));
}

function sendError(res, msg, status) {
  sendJSON(res, { error: msg, success: false }, status || 500);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c) => {
      body += c.toString();
      if (body.length > 2e6) { req.destroy(); reject(new Error('请求体过大')); }
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { reject(new Error('无效的 JSON 请求体')); }
    });
    req.on('error', reject);
  });
}

function str(v, max) {
  if (v === undefined || v === null) return '';
  return String(v).slice(0, max || 500);
}

function bool(v, def) {
  if (v === undefined) return def;
  return v === true || v === 'true' || v === 1 || v === '1';
}

function num(v, def, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  if (min !== undefined && n < min) return min;
  if (max !== undefined && n > max) return max;
  return n;
}

/**
 * 校验并收敛前端提交的配置，防止脏数据写入 app.json
 */
function sanitizeConfig(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;

  if (input.ai && typeof input.ai === 'object') {
    out.ai = {
      provider: str(input.ai.provider, 40).toLowerCase() || 'deepseek',
      apiKey: str(input.ai.apiKey, 400),
      model: str(input.ai.model, 120),
      baseUrl: str(input.ai.baseUrl, 300),
      timeout: num(input.ai.timeout, 60000, 3000, 600000),
      maxTokens: num(input.ai.maxTokens, 4096, 64, 2000000),
      temperature: num(input.ai.temperature, 0.7, 0, 2),
    };
  }

  if (input.mail && typeof input.mail === 'object') {
    out.mail = {
      provider: str(input.mail.provider, 40).toLowerCase() || 'qq',
      user: str(input.mail.user, 200),
      pass: str(input.mail.pass, 400),
      from: str(input.mail.from, 200),
      to: str(input.mail.to, 400),
      smtpHost: str(input.mail.smtpHost, 200),
      smtpPort: num(input.mail.smtpPort, 0, 0, 65535),
      smtpSecure: bool(input.mail.smtpSecure, true),
      theme: ['minimal', 'dark', 'paper'].indexOf(str(input.mail.theme)) >= 0 ? str(input.mail.theme) : 'minimal',
    };
  }

  if (input.weather && typeof input.weather === 'object') {
    out.weather = {
      lat: str(input.weather.lat, 20),
      lon: str(input.weather.lon, 20),
      city: str(input.weather.city, 60),
    };
  }

  if (input.app && typeof input.app === 'object') {
    out.app = {
      port: num(input.app.port, 3000, 1, 65535),
      host: str(input.app.host, 60) || '127.0.0.1',
      language: str(input.app.language, 20) || 'zh-CN',
      theme: str(input.app.theme, 20) || 'auto',
      autoSchedule: bool(input.app.autoSchedule, false),
    };
  }

  if (input.sections && Array.isArray(input.sections.enabled)) {
    out.sections = { enabled: input.sections.enabled.slice(0, 50).map((s) => str(s, 30)) };
  }

  if (input.sources && typeof input.sources === 'object') {
    const rss = Array.isArray(input.sources.rss) ? input.sources.rss : [];
    out.sources = {
      enableRss: bool(input.sources.enableRss, true),
      rss: rss.slice(0, 40).map((s) => ({
        name: str(s && s.name, 60),
        url: str(s && s.url, 400),
        category: str(s && s.category, 30) || 'news',
        enabled: bool(s && s.enabled, true),
      })),
    };
  }

  if (input.enhance && typeof input.enhance === 'object') {
    const known = ['juejin','csdn','v2ex','zhihu','weibo','douyin','bilibili','tieba','36kr','sspai','ithome','thepaper','toutiao'];
    const types = Array.isArray(input.enhance.hotTypes)
      ? input.enhance.hotTypes.filter((t) => known.indexOf(String(t)) >= 0).slice(0, 20)
      : known;
    out.enhance = {
      enableHotboard: bool(input.enhance.enableHotboard, true),
      hotTypes: types,
      steam: bool(input.enhance.steam, true),
      epic: bool(input.enhance.epic, true),
      stocks: bool(input.enhance.stocks, true),
      trending: bool(input.enhance.trending, true),
    };
  }

  if (input.schedule && typeof input.schedule === 'object') {
    const re = /^([01]\d|2[0-3]):([0-5]\d)$/;
    out.schedule = {};
    for (const k of ['morning', 'noon', 'afternoon', 'evening']) {
      const v = str(input.schedule[k], 5);
      out.schedule[k] = re.test(v) ? v : '06:00';
    }
  }

  if (input.delivery && typeof input.delivery === 'object') {
    out.delivery = {};
    for (const k of ['morning', 'noon', 'afternoon', 'evening']) {
      const d = input.delivery[k] || {};
      out.delivery[k] = { fetch: bool(d.fetch, true), send: bool(d.send, false) };
    }
  }

  return out;
}

function readLatestNews() {
  const files = ['morning', 'noon', 'afternoon', 'evening'].map((p) => p + '-latest.json');
  let latest = null;
  let latestTime = 0;
  for (const f of files) {
    const fp = path.join(DATA_DIR, f);
    try {
      if (fs.existsSync(fp)) {
        const st = fs.statSync(fp);
        if (st.mtimeMs > latestTime) {
          latestTime = st.mtimeMs;
          latest = JSON.parse(fs.readFileSync(fp, 'utf8'));
        }
      }
    } catch (e) { /* 跳过损坏文件 */ }
  }
  return latest || { headline: [], sections: [] };
}

/* ---------------- API ---------------- */

async function handleAPI(req, res) {
  const u = url.parse(req.url, true);
  const p = u.pathname;
  const m = req.method;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (m === 'OPTIONS') { res.writeHead(204); return res.end(); }

  try {
    /* ---- 配置 ---- */
    if (p === '/api/config' && m === 'GET') {
      const all = configStore.getAll();
      // 不回传明文密钥，用掩码代替；前端提交时若仍为掩码则保留原值
      const safe = JSON.parse(JSON.stringify(all));
      if (safe.ai && safe.ai.apiKey) safe.ai.apiKeyMask = '••••••••';
      if (safe.mail && safe.mail.pass) safe.mail.passMask = '••••••••';
      return sendJSON(res, safe);
    }

    if (p === '/api/config' && m === 'POST') {
      const body = await parseBody(req);
      const clean = sanitizeConfig(body);
      // 若前端回传的是掩码，保留原值
      if (clean.ai && clean.ai.apiKey === '••••••••') delete clean.ai.apiKey;
      if (clean.mail && clean.mail.pass === '••••••••') delete clean.mail.pass;
      const ok = configStore.update(clean);
      return sendJSON(res, { success: ok, config: configStore.getAll() });
    }

    if (p === '/api/config/validate' && m === 'GET') {
      return sendJSON(res, configStore.validate());
    }

    if (p === '/api/config/reset' && m === 'POST') {
      const ok = configStore.reset();
      return sendJSON(res, { success: ok });
    }

    if (p === '/api/config/history' && m === 'DELETE') {
      configStore.clearHistory();
      return sendJSON(res, { success: true });
    }

    if (p === '/api/config/history' && m === 'GET') {
      const c = configStore.getAll();
      return sendJSON(res, c.history || { fetchHistory: [], sendHistory: [] });
    }

    /* ---- 提供商 / 模型 ---- */
    if (p === '/api/providers' && m === 'GET') {
      return sendJSON(res, { providers: aiProvider.listProviders() });
    }

    if (p === '/api/models' && m === 'GET') {
      try {
        const models = await aiProvider.listModels(null, {
          apiKey: u.query.apiKey,
          baseUrl: u.query.baseUrl,
        });
        return sendJSON(res, { models });
      } catch (e) {
        return sendJSON(res, {
          models: e.staticFallback || [],
          error: e.message,
          fallback: true,
        });
      }
    }

    if (p.indexOf('/api/models/') === 0 && m === 'GET') {
      const providerKey = p.split('/')[3];
      try {
        const models = await aiProvider.listModels(providerKey, {
          apiKey: u.query.apiKey,
          baseUrl: u.query.baseUrl,
        });
        return sendJSON(res, { provider: providerKey, models });
      } catch (e) {
        return sendJSON(res, {
          provider: providerKey,
          models: e.staticFallback || [],
          error: e.message,
          fallback: true,
        });
      }
    }

    /* ---- 测试 ---- */
    if (p === '/api/test-ai' && m === 'POST') {
      const body = await parseBody(req);
      const t0 = Date.now();
      const result = await aiProvider.chat(
        [{ role: 'user', content: body.message || '你好，请只回复四个字：连接成功' }],
        { model: body.model, temperature: Number(body.temperature) || 0.7, maxTokens: 120 }
      );
      const cfg = aiProvider.getConfig();
      return sendJSON(res, {
        success: true,
        message: result,
        provider: cfg.providerName,
        model: cfg.model,
        latencyMs: Date.now() - t0,
      });
    }

    if (p === '/api/test-mail' && m === 'POST') {
      const body = await parseBody(req);
      const mailProvider = require('./mail-provider');
      const cfg = configStore.getAll();
      const to = body.to || cfg.mail.to || cfg.mail.user;
      if (!to) return sendError(res, '未设置收件邮箱', 400);
      const t0 = Date.now();
      const result = await mailProvider.send({
        to: to,
        subject: 'LumaPost 邮件测试',
        html: '<div style="font-family:sans-serif;padding:24px"><h2>测试成功</h2>'
          + '<p>如果你看到这封邮件，说明 LumaPost 邮件服务配置正确。</p>'
          + '<p style="color:#888;font-size:12px">发送时间：' + new Date().toLocaleString('zh-CN') + '</p></div>',
      });
      return sendJSON(res, { success: true, result: result, to: to, latencyMs: Date.now() - t0 });
    }

    /* ---- 抓取 ---- */
    if (p === '/api/fetch' && m === 'POST') {
      const body = await parseBody(req);
      const period = body.period || 'all';
      const { spawn } = require('child_process');
      const child = spawn(process.execPath, ['scripts/fetch-news-ai.js', '--period=' + period], {
        cwd: ROOT, detached: true, stdio: 'ignore',
      });
      child.unref();
      configStore.addHistory('fetchHistory', {
        title: (period === 'all' ? '全时段' : period) + '新闻抓取',
        status: '运行中',
      });
      return sendJSON(res, { success: true, message: '已启动 ' + period + ' 抓取' });
    }

    if (p === '/api/news/latest' && m === 'GET') {
      return sendJSON(res, readLatestNews());
    }

    /* ---- 预览 ---- */
    if (p.indexOf('/api/preview/') === 0 && m === 'GET') {
      const period = p.split('/')[3];
      const valid = ['morning', 'noon', 'afternoon', 'evening'];
      if (valid.indexOf(period) < 0) return sendError(res, '无效的时段', 400);

      const dataFile = path.join(DATA_DIR, period + '-latest.json');
      const htmlFile = path.join(DATA_DIR, period + '-email.html');

      if (!fs.existsSync(dataFile)) {
        return sendJSON(res, { error: '该时段暂无数据，请先执行一次抓取', code: 'NO_DATA' }, 404);
      }

      if (fs.existsSync(htmlFile)) {
        const ds = fs.statSync(dataFile);
        const hs = fs.statSync(htmlFile);
        if (hs.mtimeMs >= ds.mtimeMs) {
          const html = fs.readFileSync(htmlFile, 'utf8');
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          return res.end(html);
        }
      }

      try {
        const { spawnSync } = require('child_process');
        spawnSync(process.execPath, ['scripts/gen-html.js',
          '--data-file=' + dataFile, '--output=' + htmlFile], { cwd: ROOT, timeout: 30000 });
        if (fs.existsSync(htmlFile)) {
          const html = fs.readFileSync(htmlFile, 'utf8');
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          return res.end(html);
        }
      } catch (e) { /* fallthrough */ }
      return sendError(res, '生成预览失败');
    }

    /* ---- 调度器 ---- */
    if (p === '/api/scheduler' && m === 'GET') {
      return sendJSON(res, scheduler.status());
    }

    if (p === '/api/scheduler/trigger' && m === 'POST') {
      const body = await parseBody(req);
      const slot = body.slot || 'morning';
      if (scheduler.SLOTS.indexOf(slot) < 0) return sendError(res, '无效的时段', 400);
      scheduler.fire(slot);
      return sendJSON(res, { success: true, message: '已手动触发 ' + slot });
    }

    /* ---- 系统信息 ---- */
    if (p === '/api/system' && m === 'GET') {
      const cfg = configStore.getAll();
      let nodeVer = process.version;
      let plat = process.platform + ' ' + process.arch;
      let mem = null;
      try { mem = process.memoryUsage(); } catch (e) {}
      return sendJSON(res, {
        version: cfg.version,
        node: nodeVer,
        platform: plat,
        uptimeSec: Math.round(process.uptime()),
        memoryMB: mem ? Math.round(mem.rss / 1048576) : null,
        configFile: configStore.CONFIG_FILE,
        configExists: fs.existsSync(configStore.CONFIG_FILE),
        listen: { host: process.env.HOST || cfg.app.host, port: process.env.PORT || cfg.app.port },
        autoSchedule: !!cfg.app.autoSchedule,
        updatedAt: cfg.updatedAt,
      });
    }

    /* ---- 信息源 ---- */
    if (p === '/api/sources' && m === 'GET') {
      const cfg = configStore.getAll();
      return sendJSON(res, cfg.sources || { rss: [], enableRss: false });
    }

    if (p === '/api/sources' && m === 'POST') {
      const body = await parseBody(req);
      const clean = sanitizeConfig({ sources: body }).sources;
      if (!clean) return sendError(res, '无效的信息源配置', 400);
      configStore.update({ sources: clean });
      return sendJSON(res, { success: true, sources: clean });
    }

    /* ---- 内置源目录 ---- */
    if (p === '/api/sources/catalog' && m === 'GET') {
      let catalog;
      try { catalog = require('./sources-catalog'); }
      catch (e) { return sendError(res, '源目录不可用: ' + e.message); }
      return sendJSON(res, {
        catalog: catalog.CATALOG,
        categories: catalog.CATEGORIES,
        engines: catalog.SEARCH_ENGINES,
        total: catalog.CATALOG.length,
      });
    }

    /* ---- 导入内置源 ---- */
    if (p === '/api/sources/import' && m === 'POST') {
      const body = await parseBody(req);
      let catalog;
      try { catalog = require('./sources-catalog'); } catch (e) { return sendError(res, e.message); }

      const mode = body.mode || 'recommended';   // recommended | category | all | keys
      let picked = [];
      if (mode === 'all') {
        picked = catalog.CATALOG.slice();
      } else if (mode === 'category') {
        picked = catalog.getByCategory(body.category || 'ai');
      } else if (mode === 'keys') {
        const set = new Set(body.urls || []);
        picked = catalog.CATALOG.filter(s => set.has(s.url));
      } else {
        picked = catalog.getRecommended(body.perCategory || 2);
      }

      const cfg = configStore.getAll();
      const existing = (cfg.sources && cfg.sources.rss) || [];
      const seen = new Set(existing.map(s => s.url));
      let added = 0;
      const merged = existing.slice();
      for (const s of picked) {
        if (seen.has(s.url)) continue;
        seen.add(s.url);
        merged.push({ name: s.name, url: s.url, category: s.category, enabled: true });
        added++;
      }
      configStore.update({ sources: { enableRss: true, rss: merged } });
      return sendJSON(res, { success: true, added: added, total: merged.length });
    }

    /* ---- 单个源连通性测试 ---- */
    if (p === '/api/sources/test' && m === 'POST') {
      const body = await parseBody(req);
      if (!body.url) return sendError(res, '缺少 url', 400);
      try {
        const rssFetcher = require('./rss-fetcher');
        const t0 = Date.now();
        const r = await rssFetcher.fetchFeed({ name: body.name || body.url, url: body.url }, { limit: 5, timeout: 15000 });
        return sendJSON(res, {
          success: !r.error && r.items.length > 0,
          count: r.items.length,
          error: r.error || null,
          latencyMs: Date.now() - t0,
          sample: r.items.slice(0, 3).map(it => ({ title: it.title, link: it.link })),
        });
      } catch (e) {
        return sendJSON(res, { success: false, error: e.message, count: 0 });
      }
    }

    /* ---- 批量抓取预览（不写盘）---- */
    if (p === '/api/sources/fetch' && m === 'POST') {
      const body = await parseBody(req);
      const cfg = configStore.getAll();
      let list = (cfg.sources && cfg.sources.rss) || [];
      if (Array.isArray(body.urls) && body.urls.length) {
        const set = new Set(body.urls);
        list = list.filter(s => set.has(s.url));
      }
      list = list.filter(s => s.enabled !== false);
      if (!list.length) return sendError(res, '没有启用的信息源', 400);

      try {
        const rssFetcher = require('./rss-fetcher');
        const t0 = Date.now();
        const results = await rssFetcher.fetchAll(list, {
          concurrency: body.concurrency || 8,
          limit: body.limit || 5,
          timeout: 15000,
        });
        const agg = rssFetcher.aggregate(results, { limit: 20 });
        return sendJSON(res, {
          success: true,
          latencyMs: Date.now() - t0,
          stats: {
            total: results.length,
            ok: results.filter(r => !r.error && r.items.length).length,
            failed: results.filter(r => r.error).length,
            items: agg.total,
          },
          byCategory: Object.keys(agg.byCategory).map(k => ({ category: k, count: agg.byCategory[k].length })),
          latest: agg.all.slice(0, 30),
          errors: results.filter(r => r.error).map(r => ({ name: r.name, error: r.error })),
        });
      } catch (e) {
        return sendError(res, '抓取失败: ' + e.message);
      }
    }

    /* ---- 搜索 ---- */
    if (p === '/api/search' && m === 'GET') {
      const q = (u.query.q || '').toString().trim();
      if (!q) return sendError(res, '缺少查询参数 q', 400);
      const mode = (u.query.mode || 'bing').toString();
      const limit = Math.min(Number(u.query.limit) || 10, 30);
      try {
        const ws = require('./web-search');
        const r = await ws.unified(q, {
          mode: mode,
          engine: (u.query.engine || 'bing').toString(),
          limit: limit,
        });
        return sendJSON(res, r);
      } catch (e) {
        return sendError(res, '搜索失败: ' + e.message);
      }
    }

    /* ---- 热榜 / 游戏 / 行情 ---- */
    if (p === '/api/hotboard' && m === 'GET') {
      const types = u.query.types ? String(u.query.types).split(',') : null;
      const limit = Math.min(Number(u.query.limit) || 10, 40);
      try {
        const hot = require('./hotboard');
        if (u.query.type) {
          const r = await hot.fetchHotboard(String(u.query.type), { limit });
          return sendJSON(res, { type: u.query.type, name: r.name, count: r.items.length, items: r.items, error: r.error || null });
        }
        const results = await hot.fetchAllHotboards(types, { limit });
        return sendJSON(res, {
          boards: results.map((r) => ({ type: r.type, name: r.name, category: r.category, count: r.count, error: r.error })),
          total: results.reduce((s, r) => s + r.count, 0),
          available: results.filter((r) => !r.error && r.count > 0).length,
          types: hot.HOTBOARD_TYPES,
        });
      } catch (e) {
        return sendError(res, '热榜抓取失败: ' + e.message);
      }
    }

    if (p === '/api/hotboard/items' && m === 'GET') {
      const limit = Math.min(Number(u.query.limit) || 10, 40);
      try {
        const hot = require('./hotboard');
        const results = await hot.fetchAllHotboards(
          u.query.types ? String(u.query.types).split(',') : null,
          { limit }
        );
        const flat = [];
        results.forEach((r) => {
          if (!r.error) r.items.forEach((it) => flat.push(it));
        });
        return sendJSON(res, { total: flat.length, items: flat, boards: results.length });
      } catch (e) {
        return sendError(res, e.message);
      }
    }

    if (p === '/api/steam' && m === 'GET') {
      try {
        const hot = require('./hotboard');
        const r = await hot.fetchSteam({ limit: Number(u.query.limit) || 10 });
        return sendJSON(res, { count: r.items.length, items: r.items, error: r.error || null });
      } catch (e) { return sendError(res, e.message); }
    }

    if (p === '/api/epic' && m === 'GET') {
      try {
        const hot = require('./hotboard');
        const r = await hot.fetchEpicFree({ limit: Number(u.query.limit) || 15 });
        return sendJSON(res, { count: r.items.length, items: r.items, error: r.error || null });
      } catch (e) { return sendError(res, e.message); }
    }

    if (p === '/api/stocks' && m === 'GET') {
      try {
        const hot = require('./hotboard');
        const codes = u.query.codes ? String(u.query.codes).split(',').map((c) => ({ code: c, name: '' })) : null;
        const r = await hot.fetchStocks({ codes: codes });
        return sendJSON(res, { count: r.items.length, items: r.items, error: r.error || null });
      } catch (e) { return sendError(res, e.message); }
    }

    if (p === '/api/trending' && m === 'GET') {
      try {
        const hot = require('./hotboard');
        const r = await hot.fetchGithubTrending({
          limit: Number(u.query.limit) || 15,
          since: u.query.since || 'daily',
          lang: u.query.lang || '',
        });
        return sendJSON(res, { count: r.items.length, items: r.items, error: r.error || null });
      } catch (e) { return sendError(res, e.message); }
    }

    return sendError(res, 'API 不存在: ' + p, 404);
  } catch (e) {
    console.error('[api] ' + p + ' -> ' + e.message);
    return sendError(res, e.message, 500);
  }
}

/* ---------------- static ---------------- */

function serveStatic(req, res) {
  let fp = url.parse(req.url).pathname;
  if (fp === '/') fp = '/index.html';
  const full = path.normalize(path.join(PUBLIC_DIR, fp));
  if (full.indexOf(PUBLIC_DIR) !== 0) {
    res.writeHead(403); return res.end('Forbidden');
  }
  fs.readFile(full, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not Found');
    }
    const ext = path.extname(full).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

/* ---------------- boot ---------------- */

function startServer() {
  const cfg = configStore.getAll();
  const PORT = Number(process.env.PORT) || Number(cfg.app.port) || 3000;
  const HOST = process.env.HOST || cfg.app.host || '127.0.0.1';

  const server = http.createServer((req, res) => {
    const p = url.parse(req.url).pathname;
    if (p.indexOf('/api/') === 0) return handleAPI(req, res);
    return serveStatic(req, res);
  });

  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.error('[fatal] 端口 ' + PORT + ' 已被占用，请修改 config/app.json 的 app.port');
    } else {
      console.error('[fatal] ' + e.message);
    }
    process.exit(1);
  });

  server.listen(PORT, HOST, () => {
    const showHost = HOST === '0.0.0.0' ? '127.0.0.1' : HOST;
    console.log('');
    console.log('  LumaPost Web UI v' + cfg.version);
    console.log('  ------------------------------------------');
    console.log('  本地访问 : http://' + showHost + ':' + PORT);
    if (HOST === '0.0.0.0') console.log('  局域网   : http://<本机IP>:' + PORT);
    console.log('  配置文件 : ' + configStore.CONFIG_FILE);
    console.log('  定时调度 : ' + (cfg.app.autoSchedule ? '已启用' : '已关闭') +
      ' (' + Object.values(cfg.schedule || {}).join(' / ') + ')');
    console.log('  ------------------------------------------');
    console.log('');
    scheduler.start();
  });

  // 优雅退出
  const shutdown = () => {
    try { scheduler.stop(); } catch (e) {}
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return server;
}

if (require.main === module) startServer();

module.exports = { startServer };