#!/usr/bin/env node
/**
 * logger.js — 统一日志模块
 * 所有脚本共用一套日志格式，支持分级输出与时间戳。
 */
const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

let currentLevel = LEVELS.info;
let quiet = false;

/** 设置日志级别 */
function setLevel(level) {
  if (level in LEVELS) currentLevel = LEVELS[level];
}

/** 静默模式（true 时只留 error） */
function setQuiet(q) { quiet = !!q; }

/** 生成时间戳：YYYY-MM-DD HH:mm:ss */
function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 写一条日志 */
function write(level, msg, extra) {
  if (quiet && level !== 'error') return;
  if (LEVELS[level] < currentLevel) return;
  const tag = level.toUpperCase().padEnd(5);
  let line = `[${timestamp()}] ${tag} ${msg}`;
  if (extra !== undefined) {
    if (extra instanceof Error) line += `\n[${timestamp()}]        ${extra.stack || extra.message}`;
    else if (typeof extra === 'object') { try { line += ' ' + JSON.stringify(extra); } catch (e) { line += ' ' + String(extra); } }
    else line += ' ' + String(extra);
  }
  process.stderr.write(line + '\n');
}

module.exports = {
  debug: (msg, extra) => write('debug', msg, extra),
  info: (msg, extra) => write('info', msg, extra),
  warn: (msg, extra) => write('warn', msg, extra),
  error: (msg, extra) => write('error', msg, extra),
  setLevel, setQuiet, LEVELS,
};