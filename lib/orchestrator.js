#!/usr/bin/env node
/**
 * orchestrator.js — 编排层
 * 集中管理「抓取→生成→发送」流水线，CLI 与调度器共用同一套编排，行为一致。
 * 每阶段用 jobstore 记录状态，失败可追踪；通过子进程保持崩溃隔离。
 */
const path = require('path');
const { spawnSync } = require('child_process');
const paths = require('./paths');
const jobs = require('./jobstore');
const log = require('./logger');

/** 时段中文标签 */
const SLOT_CN = {
  morning: '早报', noon: '午报', afternoon: '午后速递', evening: '晚间总结',
};

/** 校验时段名是否合法 */
function validSlot(slot) { return paths.SLOTS.indexOf(slot) >= 0; }

/** 运行子进程脚本（exit 0 视为成功） */
function runScript(script, args, label) {
  log.info('▶ ' + label);
  const r = spawnSync(process.execPath, [path.join(paths.SCRIPTS_DIR, script)].concat(args || []), {
    cwd: paths.ROOT, stdio: 'inherit', env: process.env,
  });
  return r.status === 0;
}

/** 只抓取 */
function runFetch(slot) {
  if (!validSlot(slot)) { log.error('无效时段: ' + slot); return false; }
  jobs.start(slot, 'fetch');
  const ok = runScript('fetch-news-ai.js', ['--period=' + slot], '抓取 ' + slot);
  jobs.finish(slot, 'fetch', ok, ok ? null : '抓取失败（详见上方日志）');
  return ok;
}

/** 只生成邮件 */
function runGen(slot) {
  if (!validSlot(slot)) { log.error('无效时段: ' + slot); return false; }
  jobs.start(slot, 'gen');
  const ok = runScript('gen-html.js', [
    '--data-file=' + paths.dataFile(slot),
    '--output=' + paths.htmlFile(slot),
  ], '生成 ' + slot);
  jobs.finish(slot, 'gen', ok, ok ? null : '生成失败（详见上方日志）');
  return ok;
}

/** 只发送 */
function runSend(slot, opts) {
  opts = opts || {};
  if (!validSlot(slot)) { log.error('无效时段: ' + slot); return false; }
  jobs.start(slot, 'send');
  const args = ['--period=' + slot];
  if (opts.allowDegraded) args.push('--allow-degraded');
  const ok = runScript('send-mail.js', args, '发送 ' + slot);
  jobs.finish(slot, 'send', ok, ok ? null : '发送失败（详见上方日志）');
  return ok;
}

/** 完整流水线：抓取→生成→发送，任一步失败即中止后续（避免发过期内容） */
function runPipeline(slot, opts) {
  opts = opts || {};
  if (!validSlot(slot)) { log.error('无效时段: ' + slot); return false; }
  log.info('=== ' + (SLOT_CN[slot] || slot) + ' 完整流程 ===');
  if (!runFetch(slot)) return false;
  if (!runGen(slot)) return false;
  return runSend(slot, opts);
}

/** 查询某时段任务状态 */
function statusOf(slot) { return jobs.statusOf(slot); }

module.exports = {
  SLOT_CN, validSlot, runFetch, runGen, runSend, runPipeline, statusOf,
};