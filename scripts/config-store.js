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
  version: '7.0.0',

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
  },

  weather: { lat: '28.20', lon: '112.97', city: '湖南长沙' },

  app: {
    port: 3000,
    host: '127.0.0.1',
    language: 'zh-CN',
    theme: 'auto',
    autoSchedule: false,
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

  history: { fetchHistory: [], sendHistory: [] },
  updatedAt: new Date().toISOString(),
};

let _cache = null;
let _mtime = 0;

function ensureDir() {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
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
  const tmp = CONFIG_FILE + '.tmp';
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

  return { valid: errors.length === 0, errors: errors, warnings: warnings };
}

function addHistory(type, record) {
  const config = readConfig();
  if (!config.history[type]) config.history[type] = [];
  config.history[type].unshift(Object.assign({}, record, { time: new Date().toISOString() }));
  if (config.history[type].length > 50) config.history[type] = config.history[type].slice(0, 50);
  return _save(config);
}

function clearHistory() {
  const config = readConfig();
  config.history = { fetchHistory: [], sendHistory: [] };
  return _save(config);
}

module.exports = {
  get: get, set: set, update: update, updatePaths: updatePaths,
  getAll: getAll, reset: reset, validate: validate,
  addHistory: addHistory, clearHistory: clearHistory,
  saveConfig: saveConfig, readConfig: readConfig,
  DEFAULT_CONFIG: DEFAULT_CONFIG, CONFIG_FILE: CONFIG_FILE, CONFIG_DIR: CONFIG_DIR, ROOT: ROOT,
};