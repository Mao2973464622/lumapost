#!/usr/bin/env node
/**
 * config-store.js — 本地配置文件持久化
 */

const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.resolve(__dirname, '..', 'config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'app.json');

const DEFAULT_CONFIG = {
  version: '4.2.0',
  ai: { provider: 'deepseek', apiKey: '', model: '', baseUrl: '', timeout: 60000, maxTokens: 4096, temperature: 0.7 },
  mail: { provider: 'qq', user: '', pass: '', from: '', to: '' },
  weather: { lat: '28.20', lon: '112.97', city: '湖南长沙' },
  app: { port: 3000, language: 'zh-CN', theme: 'auto' },
  sections: { enabled: ['ai', 'hardware', 'github', 'news', 'games', 'finance', 'auto', 'internet', 'life', 'space'] },
  schedule: { morning: '06:00', noon: '12:00', afternoon: '17:30', evening: '21:00' },
  history: { fetchHistory: [], sendHistory: [] },
  updatedAt: new Date().toISOString(),
};

let _cache = null;

function readConfig() {
  if (_cache) return _cache;
  try {
    if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
    if (fs.existsSync(CONFIG_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      _cache = deepMerge(DEFAULT_CONFIG, parsed);
    } else {
      _cache = { ...DEFAULT_CONFIG };
      saveConfig(_cache);
    }
  } catch (e) {
    _cache = { ...DEFAULT_CONFIG };
  }
  return _cache;
}

function saveConfig(config) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
    config.updatedAt = new Date().toISOString();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    _cache = config;
    return true;
  } catch (e) { return false; }
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

function get(key) {
  const config = readConfig();
  return key.split('.').reduce((v, k) => v && v[k], config);
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
  return saveConfig(config);
}

function update(updates) { return saveConfig(deepMerge(readConfig(), updates)); }
function getAll() { return readConfig(); }
function reset() { _cache = { ...DEFAULT_CONFIG, updatedAt: new Date().toISOString() }; return saveConfig(_cache); }

function validate() {
  const c = readConfig();
  const errors = [];
  if (!c.ai.apiKey && !process.env.AI_API_KEY) errors.push('AI API Key 未设置');
  if (!c.mail.user && !process.env.MAIL_USER) errors.push('邮件用户未设置');
  if (!c.mail.pass && !process.env.MAIL_PASS) errors.push('邮件密码未设置');
  return { valid: errors.length === 0, errors };
}

function addHistory(type, record) {
  const config = readConfig();
  if (!config.history[type]) config.history[type] = [];
  config.history[type].unshift({ ...record, time: new Date().toISOString() });
  if (config.history[type].length > 50) config.history[type] = config.history[type].slice(0, 50);
  return saveConfig(config);
}

module.exports = { get, set, update, getAll, reset, validate, addHistory, DEFAULT_CONFIG, CONFIG_FILE };