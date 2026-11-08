#!/usr/bin/env node
/**
 * jobstore.js — 任务状态存储模块
 * 记录每次 fetch/gen/send 的执行状态机（running/success/failed），供追踪与恢复。
 * 与 config-store 的 history 不同：history 记历史事件，jobstore 记当前任务状态。
 */
const fs = require('fs');
const path = require('path');
const paths = require('./paths');

const JOBS_FILE = path.join(paths.DATA_DIR, 'jobs.json'); // 任务状态文件
let _cache = null;

const STATUS = {
  PENDING: 'pending', RUNNING: 'running',
  SUCCESS: 'success', FAILED: 'failed', SKIPPED: 'skipped',
};

/** 读取任务状态文件 */
function read() {
  if (_cache) return _cache;
  try {
    if (fs.existsSync(JOBS_FILE)) {
      const j = JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8'));
      if (j && typeof j === 'object') { _cache = { jobs: j.jobs || {} }; return _cache; }
    }
  } catch (e) { /* 损坏则重置 */ }
  _cache = { jobs: {} };
  return _cache;
}

/** 写入任务状态（原子写：临时文件+rename 防损坏） */
function write(data) {
  try {
    if (!fs.existsSync(paths.DATA_DIR)) fs.mkdirSync(paths.DATA_DIR, { recursive: true });
    const tmp = JOBS_FILE + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, JOBS_FILE);
    _cache = data;
    return true;
  } catch (e) {
    process.stderr.write('[jobstore] 写入失败: ' + e.message + '\n');
    return false;
  }
}

/** 确保某时段的任务容器存在 */
function slotContainer(slot) {
  const data = read();
  if (!data.jobs[slot]) data.jobs[slot] = {};
  return data.jobs[slot];
}

/** 标记任务开始 */
function start(slot, phase) {
  const data = read();
  const sc = slotContainer(slot);
  sc[phase] = {
    status: STATUS.RUNNING, startedAt: new Date().toISOString(),
    finishedAt: null, durationMs: null, ok: null, error: null,
  };
  write(data);
}

/** 标记任务结束 */
function finish(slot, phase, ok, error) {
  const data = read();
  const sc = slotContainer(slot);
  if (!sc[phase]) sc[phase] = { status: STATUS.PENDING };
  sc[phase].status = ok ? STATUS.SUCCESS : STATUS.FAILED;
  sc[phase].finishedAt = new Date().toISOString();
  sc[phase].durationMs = Date.now() - Date.parse(sc[phase].startedAt || Date.now());
  sc[phase].ok = ok;
  sc[phase].error = ok ? null : (error || '未知错误');
  write(data);
}

/** 查询某时段任务状态 */
function statusOf(slot) { return slotContainer(slot); }
/** 查询所有时段任务状态 */
function allStatus() { return read().jobs; }
/** 清除某时段任务状态 */
function clear(slot) {
  const data = read();
  delete data.jobs[slot];
  write(data);
}

module.exports = { STATUS, JOBS_FILE, start, finish, statusOf, allStatus, clear, read };