#!/usr/bin/env node
/**
 * config-store.js — 本地配置文件持久化 (v5.0)
 *
 * 设计要点:
 *   1. 单一数据源: config/app.json
 *   2. 环境变量作为「兜底覆盖层」
 *   3. 写入后 mtime 变更自动失效缓存，无需重启服务
 *   4. 原子写入（临时文件 + rename），防止断电损坏
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_DIR = path.join(ROOT, 'config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'app.json');

const DEFAULT_CONFIG = {
  version: (function () {
    // v10.5.0：版本号单一来源 = package.json（旧版在 6 处各写各的：
    // package 10.4.1 / 注释 v4.0 / meta.version '3.0' / 横幅 v10.4.0 / Docker v4.1 / README v2.0）
    try { return require('../package.json').version; } catch (e) { return '0.0.0'; }
  })(),

  ai: {
    provider: 'deepseek',
    apiKey: '',
    model: '',
    baseUrl: '',
    timeout: 60000,
    maxTokens: 4096,
    temperature: 0.7,
  },

  mail: {
    provider: 'qq',
    user: '',
    pass: '',
    from: '',
    to: '',
    smtpHost: '',
    smtpPort: 0,
    smtpSecure: true,
    theme: 'minimal',   // 10 套预设之一，或 'custom'
    customTheme: {
      name: '我的主题',
      brand1: '#6366F1', brand2: '#8B5CF6', brand3: '#A855F7',
      bg: '#F5F7FC', card: '#FFFFFF', cardBorder: '#E8ECF3',
      ink: '#0F172A', ink2: '#334155', ink3: '#64748B', ink4: '#94A3B8',
      line: '#E8ECF3', accent: '#6366F1', footerText: '#94A3B8',
      fontFamily: 'sans',
      tlrdBg: '#FFFBEB', tlrdBd: '#FDE68A', tlrdTx: '#78350F', tlrdLb: '#B45309',
    },
  },

  weather: { lat: '28.20', lon: '112.97', city: '湖南长沙' },

  app: {
    port: 3000,
    host: '127.0.0.1',
    language: 'zh-CN',
    theme: 'auto',
    autoSchedule: false,
    // v10.6.0：Web UI 已移除，不再需要 adminToken / allowLan / corsAllowOrigin / secretKey
  },

  sections: {
    enabled: ['ai', 'hardware', 'github', 'news', 'games', 'finance', 'auto', 'internet', 'life', 'space'],
  },

  sources: (function () {
    let rec = [];
    try {
      const cat = require('./sources-catalog');
      rec = cat.getRecommended(2).map(function (s) {
        return { name: s.name, url: s.url, category: s.category, enabled: true };
      });
    } catch (e) { rec = []; }
    return { enableRss: true, rss: rec };
  })(),

  search: {
    engine: 'bing',      // bing | google | baidu | ddg
    aiSearch: true,      // 是否同时用大模型搜索
    useForNews: false,   // 抓取时是否把搜索结果并入
  },

  // v10.5.0：邮件内容预算（防止超出 Gmail 102KB 截断线）
  email: {
    itemsTotal: 40,
    itemsPerSection: 5,
    headlineCount: 3,
    trendCount: 5,
    titleChars: 120,
    summaryChars: 150,
    commentaryChars: 640,
    quicknoteChars: 120,
    maxHtmlKB: 92,
    showHeadlines: true,
    showCommentary: true,
    showStocks: true,
    showTrends: true,
    showCharts: true,
    showToc: true,
    showQuote: true,
    subjectPrefix: '✨ LumaPost · 光影邮报',
    plainTextAlternative: true,
    listUnsubscribe: true,
  },

  // 增强数据源（融合自 daily-news）
  enhance: {
    enableHotboard: true,   // 中文热榜总开关
    hotTypes: [             // 启用的热榜平台
      'juejin', 'csdn', 'v2ex', 'zhihu', 'weibo', 'douyin',
      'bilibili', 'tieba', '36kr', 'sspai', 'ithome', 'thepaper', 'toutiao',
    ],
    steam: true,            // Steam 特惠/新品/热销
    epic: true,             // Epic 限时免费
    stocks: true,           // A 股指数
    trending: true,         // GitHub Trending
  },

  schedule: {
    morning: '06:00',
    noon: '12:00',
    afternoon: '17:30',
    evening: '21:00',
  },

  delivery: {
    morning: { fetch: true, send: true },
    noon: { fetch: true, send: true },
    afternoon: { fetch: true, send: true },
    evening: { fetch: true, send: true },
  },

  history: { fetchHistory: [], sendHistory: [] },   // 兼容旧字段；v10.5 起实际写入 data/history.json
  updatedAt: new Date().toISOString(),
};

let _cache = null;
let _mtime = 0;
let _histCache = null;

function ensureDir() {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

/* ---- v10.5.0：运行时历史与配置分离（配置不再被运行噪声反复重写） ---- */
const DATA_DIR = path.join(ROOT, 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

function readHistoryFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(HISTORY_FILE)) {
      const j = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
      if (j && typeof j === 'object') {
        return {
          fetchHistory: Array.isArray(j.fetchHistory) ? j.fetchHistory : [],
          sendHistory: Array.isArray(j.sendHistory) ? j.sendHistory : [],
        };
      }
    }
  } catch (e) { /* 损坏则重置 */ }
  // 首次：从旧 app.json 迁移，避免历史记录丢失
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const legacy = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      if (legacy && legacy.history) {
        return {
          fetchHistory: Array.isArray(legacy.history.fetchHistory) ? legacy.history.fetchHistory : [],
          sendHistory: Array.isArray(legacy.history.sendHistory) ? legacy.history.sendHistory : [],
        };
      }
    }
  } catch (e) { /* ignore */ }
  return { fetchHistory: [], sendHistory: [] };
}

function getHistory() {
  if (_histCache) return _histCache;
  _histCache = readHistoryFile();
  return _histCache;
}

function writeHistory(h) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = HISTORY_FILE + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(h, null, 2), 'utf8');
    fs.renameSync(tmp, HISTORY_FILE);
    _histCache = h;
    return true;
  } catch (e) {
    console.error('[history] 写入失败:', e.message);
    return false;
  }
}

function deepMerge(target, source) {
  const result = Array.isArray(target) ? target.slice() : Object.assign({}, target);
  if (!source || typeof source !== 'object') return result;
  for (const key of Object.keys(source)) {
    const sv = source[key];
    if (sv && typeof sv === 'object' && !Array.isArray(sv)) {
      result[key] = deepMerge(result[key] || {}, sv);
    } else {
      result[key] = sv;
    }
  }
  return result;
}

function clone(o) { return JSON.parse(JSON.stringify(o)); }

/** 读取配置（mtime 变化则重新加载，外部改文件也能感知） */
function readConfig() {
  ensureDir();
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const st = fs.statSync(CONFIG_FILE);
      if (_cache && st.mtimeMs === _mtime) return _cache;
      _mtime = st.mtimeMs;
      const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      _cache = deepMerge(clone(DEFAULT_CONFIG), parsed);
      // v10.5.0：app.json 里残留的旧版本号一律以 package.json 为准（自动收敛，无需手动改）
      if (_cache.version !== DEFAULT_CONFIG.version) {
        _cache.version = DEFAULT_CONFIG.version;
        _save(_cache);
      }
      return _cache;
    }
  } catch (e) {
    console.warn('[config] 读取失败，使用默认配置:', e.message);
  }
  _cache = clone(DEFAULT_CONFIG);
  _save(_cache);
  return _cache;
}

function _save(config) {
  ensureDir();
  config.updatedAt = new Date().toISOString();
  // v10.5.0：临时文件名带 pid，避免多进程（Web + 抓取子进程）互相覆盖
  const tmp = CONFIG_FILE + '.' + process.pid + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(config, null, 2), 'utf8');
    fs.renameSync(tmp, CONFIG_FILE);
    _cache = config;
    _mtime = fs.statSync(CONFIG_FILE).mtimeMs;
    return true;
  } catch (e) {
    console.error('[config] 写入失败:', e.message);
    try { fs.unlinkSync(tmp); } catch (err) { /* ignore */ }
    return false;
  }
}

function saveConfig(config) { return _save(config); }

function get(key) {
  return key.split('.').reduce(function (v, k) { return v == null ? v : v[k]; }, readConfig());
}

function set(key, value) {
  const config = readConfig();
  const keys = key.split('.');
  let obj = config;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!obj[keys[i]] || typeof obj[keys[i]] !== 'object') obj[keys[i]] = {};
    obj = obj[keys[i]];
  }
  obj[keys[keys.length - 1]] = value;
  return _save(config);
}

function update(updates) { return _save(deepMerge(readConfig(), updates)); }

/** 支持 "ai.apiKey" 点路径批量更新 */
function updatePaths(pathMap) {
  const config = readConfig();
  for (const key of Object.keys(pathMap || {})) {
    const keys = key.split('.');
    let obj = config;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]] || typeof obj[keys[i]] !== 'object') obj[keys[i]] = {};
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = pathMap[key];
  }
  return _save(config);
}

function getAll() { return readConfig(); }
function reset() { _cache = null; _mtime = 0; return _save(clone(DEFAULT_CONFIG)); }

function addHistory(type, record) {
  // v10.5.0：历史改写 data/history.json，不再污染 config/app.json
  const h = getHistory();
  if (!Array.isArray(h[type])) h[type] = [];
  h[type].unshift(Object.assign({}, record, { time: new Date().toISOString() }));
  if (h[type].length > 50) h[type] = h[type].slice(0, 50);
  return writeHistory(h);
}

function clearHistory() {
  return writeHistory({ fetchHistory: [], sendHistory: [] });
}

/**
 * v10.5.0：配置脱敏。任何出网（API 响应 / 日志 / 导出）前必须过一遍，
 * 敏感字段只保留「是否已设置」与掩码，绝不回传明文。
 */
const SECRET_PATHS = ['ai.apiKey', 'mail.pass'];   // v10.6.0：WebUI 已移除，仅这两个仍是机密

function maskValue(v) {
  const s = String(v || '');
  if (!s) return '';
  if (s.length <= 8) return '••••••••';
  return s.slice(0, 3) + '••••••••' + s.slice(-2);
}

function sanitizeForOutput(config) {
  const out = JSON.parse(JSON.stringify(config || {}));
  for (const p of SECRET_PATHS) {
    const keys = p.split('.');
    let obj = out;
    for (let i = 0; i < keys.length - 1 && obj; i++) obj = obj[keys[i]];
    if (!obj) continue;
    const last = keys[keys.length - 1];
    const val = obj[last];
    if (val) {
      obj[last] = '';
      obj[last + 'Set'] = true;
      obj[last + 'Mask'] = maskValue(val);
    } else {
      obj[last + 'Set'] = false;
    }
  }
  return out;
}

/**
 * v10.5.0：运行时可观测状态（调度器 / 最近错误 / 锁），
 * 供 UI 显示真实结果，不再只靠 config 里的历史字段。
 */
function runtimeStatus() {
  const st = { historyCounts: {}, historyFile: HISTORY_FILE, historyExists: fs.existsSync(HISTORY_FILE) };
  try {
    const h = getHistory();
    st.historyCounts.fetch = h.fetchHistory.length;
    st.historyCounts.send = h.sendHistory.length;
    st.lastFetch = h.fetchHistory[0] || null;
    st.lastSend = h.sendHistory[0] || null;
  } catch (e) { st.historyError = e.message; }
  return st;
}

function validate() {
  const c = readConfig();
  const errors = [];
  const warnings = [];

  if (!c.ai.apiKey && !process.env.AI_API_KEY) errors.push('AI API Key 未设置');
  if (c.ai.provider === 'custom' && !c.ai.baseUrl && !process.env.AI_BASE_URL) {
    errors.push('自定义提供商需要填写 Base URL');
  }

  if (!c.mail.user && !process.env.MAIL_USER) errors.push('发件邮箱未设置');
  if (!c.mail.pass && !process.env.MAIL_PASS) errors.push('邮件授权码未设置');
  if (c.mail.provider === 'custom-smtp' && !c.mail.smtpHost) {
    errors.push('自定义 SMTP 需要填写服务器地址');
  }

  const re = /^([01]\d|2[0-3]):([0-5]\d)$/;
  for (const k of Object.keys(c.schedule || {})) {
    if (!re.test(c.schedule[k] || '')) errors.push('时段 ' + k + ' 时间格式无效');
  }

  const port = Number(c.app.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push('端口号无效');

  // v10.6.0：Web UI 已移除，不再校验 adminToken / host 暴露
  if (!(c.sections && Array.isArray(c.sections.enabled) && c.sections.enabled.length)) {
    warnings.push('未启用任何版块');
  }
  const rss = (c.sources && Array.isArray(c.sources.rss)) ? c.sources.rss : [];
  const enabledRss = rss.filter(s => s && s.enabled !== false).length;
  if (c.sources && c.sources.enableRss !== false && enabledRss === 0) {
    warnings.push('RSS 已开启但没有启用的源，抓取将回落到内置热榜/网页源');
  }
  if (Number(c.ai.maxTokens) > 8000) {
    warnings.push('AI maxTokens=' + c.ai.maxTokens + ' 偏高，小上下文模型可能直接报错并触发降级');
  }

  return { valid: errors.length === 0, errors: errors, warnings: warnings };
}

module.exports = {
  get: get, set: set, update: update, updatePaths: updatePaths,
  getAll: getAll, reset: reset, validate: validate,
  addHistory: addHistory, clearHistory: clearHistory,
  getHistory: getHistory, runtimeStatus: runtimeStatus,
  sanitizeForOutput: sanitizeForOutput, maskValue: maskValue, SECRET_PATHS: SECRET_PATHS,
  saveConfig: saveConfig, readConfig: readConfig,
  HISTORY_FILE: HISTORY_FILE,
  DEFAULT_CONFIG: DEFAULT_CONFIG, CONFIG_FILE: CONFIG_FILE, CONFIG_DIR: CONFIG_DIR, ROOT: ROOT,
};