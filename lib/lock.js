#!/usr/bin/env node
/**
 * lock.js — 文件锁模块
 * 提供跨进程互斥锁，防止重复执行；支持 TTL 过期自动清理。
 */
const fs = require('fs');
const paths = require('./paths');

/** 确保锁目录存在 */
function ensureLockDir() {
  if (!fs.existsSync(paths.LOCKS_DIR)) fs.mkdirSync(paths.LOCKS_DIR, { recursive: true });
}

/**
 * 获取锁。成功返回锁文件路径；已被占用且未过期返回 null。
 * @param {string} name 锁名
 * @param {number} [ttl=3600000] 有效期毫秒，默认 1 小时
 */
function acquire(name, ttl = 3600000) {
  ensureLockDir();
  const lockPath = paths.lockPath(name);
  if (fs.existsSync(lockPath)) {
    const age = Date.now() - fs.statSync(lockPath).mtimeMs;
    if (age < ttl) return null;   // 仍被占用
    fs.unlinkSync(lockPath);       // 已过期（进程崩溃遗留）→ 清理
  }
  fs.writeFileSync(lockPath, String(Date.now()));
  return lockPath;
}

/** 释放锁 */
function release(lockPath) {
  if (lockPath && fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
}

/** 检查锁是否被占用 */
function isLocked(name, ttl = 3600000) {
  const lockPath = paths.lockPath(name);
  if (!fs.existsSync(lockPath)) return false;
  return Date.now() - fs.statSync(lockPath).mtimeMs < ttl;
}

module.exports = { acquire, release, isLocked };