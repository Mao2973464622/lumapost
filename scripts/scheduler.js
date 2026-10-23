#!/usr/bin/env node
/**
 * scheduler.js — 内置定时调度器 (v5.0)
 *
 * 解决原项目「Web UI 里的时间只是摆设，必须靠 crontab」的问题。
 * 由 web-server 启动，每 30 秒对表一次；配置改动无需重启。
 *
 * 触发动作：
 *   - fetch: node scripts/fetch-news-ai.js --period=<slot>
 *   - send : node scripts/send-mail.js --period=<slot>  (若存在)
 */

const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SLOTS = ['morning', 'noon', 'afternoon', 'evening'];

let store = null;
try { store = require('./config-store'); } catch (e) { store = null; }

const state = {
  timer: null,
  running: false,
  lastFired: {},      // 'morning@2026-10-23' -> true
  lastTick: null,
  log: [],            // 最近触发记录
};

function log(msg, level) {
  const line = { time: new Date().toISOString(), level: level || 'info', msg: msg };
  state.log.unshift(line);
  if (state.log.length > 100) state.log.length = 100;
  const tag = level === 'error' ? '[scheduler][ERROR]' : '[scheduler]';
  console.log(tag + ' ' + msg);
}

function nowHHMM(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function todayKey(d) {
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

function runScript(script, args) {
  return new Promise((resolve) => {
    let out = '';
    let child;
    try {
      child = spawn(process.execPath, [path.join(ROOT, 'scripts', script)].concat(args || []), {
        cwd: ROOT,
        env: process.env,
      });
    } catch (e) {
      return resolve({ ok: false, error: e.message });
    }
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { out += d.toString(); });
    child.on('error', (e) => resolve({ ok: false, error: e.message }));
    child.on('close', (code) => resolve({ ok: code === 0, code: code, output: out.slice(-500) }));
  });
}

function writeTempData(data) {
  return data;
}

async function fire(slot) {
  if (state.running) {
    log('上一轮任务仍在执行，跳过 ' + slot, 'warn');
    return;
  }
  state.running = true;
  const cfg = store ? store.getAll() : {};
  const delivery = (cfg.delivery && cfg.delivery[slot]) || { fetch: true, send: false };

  log('触发时段任务: ' + slot);

  try {
    if (delivery.fetch !== false) {
      if (store) store.addHistory('fetchHistory', { title: '定时抓取 · ' + slot, status: '运行中' });
      const r = await runScript('fetch-news-ai.js', ['--period=' + slot]);
      log('抓取 ' + slot + ' ' + (r.ok ? '完成' : '失败: ' + (r.error || r.code)));
      if (store) {
        store.addHistory('fetchHistory', {
          title: '定时抓取 · ' + slot,
          status: r.ok ? '完成' : '失败',
          error: r.ok ? undefined : (r.error || '退出码 ' + r.code),
        });
      }
    }

    if (delivery.send === true) {
      // send-mail.js 若不存在，runScript 会自然失败，不阻断后续
      const r = await runScript('send-mail.js', ['--period=' + slot]);
      if (store) {
        store.addHistory('sendHistory', {
          title: '定时发送 · ' + slot,
          status: r.ok ? '完成' : '失败',
          error: r.ok ? undefined : (r.error || '退出码 ' + r.code),
        });
      }
      log('发送 ' + slot + ' ' + (r.ok ? '完成' : '跳过/失败'));
    }
  } catch (e) {
    log('任务异常: ' + e.message, 'error');
  } finally {
    state.running = false;
  }
}

function tick() {
  state.lastTick = new Date().toISOString();
  if (!store) return;

  const cfg = store.getAll();
  if (!cfg.app || cfg.app.autoSchedule !== true) return;

  const d = new Date();
  const hhmm = nowHHMM(d);
  const key = todayKey(d);

  for (const slot of SLOTS) {
    const target = (cfg.schedule || {})[slot];
    if (!target || target !== hhmm) continue;
    const stamp = slot + '@' + key;
    if (state.lastFired[stamp]) continue;
    state.lastFired[stamp] = true;
    fire(slot);
  }

  // 清理 2 天前的触发记录，避免无限增长
  const cutoff = todayKey(new Date(Date.now() - 2 * 86400000));
  for (const k of Object.keys(state.lastFired)) {
    if (k.split('@')[1] < cutoff) delete state.lastFired[k];
  }
}

function start() {
  if (state.timer) return;
  state.timer = setInterval(tick, 30000);
  intervalGuard();
  log('调度器已启动（30 秒轮询）');
}

function intervalGuard() {
  if (state.timer.unref) state.timer.unref();
}

function stop() {
  if (state.timer) { clearInterval(state.timer); state.timer = null; }
  log('调度器已停止');
}

function status() {
  let cfg = {};
  try { cfg = store ? store.getAll() : {}; } catch (e) { cfg = {}; }
  return {
    running: !!state.timer,
    enabled: !!(cfg.app && cfg.app.autoSchedule),
    runningTask: state.running,
    lastTick: state.lastTick,
    schedule: cfg.schedule || {},
    delivery: cfg.delivery || {},
    recentLog: state.log.slice(0, 20),
  };
}

module.exports = { start, stop, status, fire, SLOTS };
