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
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const SLOTS = ['morning', 'noon', 'afternoon', 'evening'];
const STATE_FILE = path.join(ROOT, 'data', 'scheduler-state.json');

let store = null;
try { store = require('./config-store'); } catch (e) { store = null; }

const state = {
  timer: null,
  running: false,
  lastFired: {},      // 'morning@2026-10-28@06:00' -> ISO 时间（落盘，重启不重复触发）
  lastTick: null,
  lastResult: null,   // 最近一次执行结果（供 UI 展示）
  log: [],            // 最近触发记录
};

/* ---- v10.5.0：触发状态持久化，解决「重启后同一分钟重复发信」 ---- */
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const j = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      if (j && j.lastFired && typeof j.lastFired === 'object') state.lastFired = j.lastFired;
    }
  } catch (e) { console.warn('[scheduler] 状态读取失败:', e.message); }
}

function saveState() {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = STATE_FILE + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ lastFired: state.lastFired, savedAt: new Date().toISOString() }, null, 2), 'utf8');
    fs.renameSync(tmp, STATE_FILE);
  } catch (e) { console.warn('[scheduler] 状态写入失败:', e.message); }
}

function log(msg, level) {
  const line = { time: new Date().toISOString(), level: level || 'info', msg: msg };
  state.log.unshift(line);
  if (state.log.length > 100) state.log.length = 100;
  const tag = level === 'error' ? '[scheduler][ERROR]' : '[scheduler]';
  console.log(tag + ' ' + msg);
}

function pad(n) { return String(n).padStart(2, '0'); }

function nowHHMM(d) {
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
}

/**
 * v10.5.0 修复：旧实现 (y + '-' + (m+1) + '-' + day) 未补零，
 * 导致与 cutoff 做字符串比较时 '2026-10-9' > '2026-10-28' 判真，过期记录永不清理。
 * 现在键格式统一为 'slot@YYYY-MM-DD@HH:mm'，日期可安全字典序比较。
 */
function fireKey(d, slot, hhmm) {
  return slot + '@' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '@' + hhmm;
}

function datePartOf(key) {
  const parts = String(key).split('@');
  return parts[1] || '';
}

function runScript(script, args, timeoutMs) {
  return new Promise((resolve) => {
    let out = '';
    let child;
    let settled = false;
    // v10.5.0：超时可通过 SCHEDULER_TIMEOUT_MS 配置，默认 15 分钟
    const TIMEOUT_MS = Number(timeoutMs || process.env.SCHEDULER_TIMEOUT_MS) || 15 * 60 * 1000;
    let timer = null;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(result);
    };

    try {
      child = spawn(process.execPath, [path.join(ROOT, 'scripts', script)].concat(args || []), {
        cwd: ROOT,
        env: process.env,
      });
    } catch (e) {
      return finish({ ok: false, error: e.message });
    }

    timer = setTimeout(() => {
      log('脚本 ' + script + ' 超时（' + (TIMEOUT_MS / 60000) + ' 分钟），强制终止', 'error');
      try { child.kill('SIGKILL'); } catch (e) { /* noop */ }
      finish({ ok: false, error: '执行超时（' + (TIMEOUT_MS / 60000) + ' 分钟）', output: out.slice(-800) });
    }, TIMEOUT_MS);

    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { out += d.toString(); });
    child.on('error', (e) => finish({ ok: false, error: e.message }));
    child.on('close', (code) => finish({ ok: code === 0, code: code, output: out.slice(-800) }));
  });
}

async function fire(slot, opts) {
  opts = opts || {};
  if (state.running) {
    log('上一轮任务仍在执行，跳过 ' + slot, 'warn');
    return { ok: false, skipped: true, reason: '上一轮任务仍在执行' };
  }
  state.running = true;
  const cfg = store ? store.getAll() : {};
  const delivery = (cfg.delivery && cfg.delivery[slot]) || { fetch: true, send: false };
  const t0 = Date.now();
  const result = { slot: slot, startedAt: new Date().toISOString(), fetch: null, send: null };

  log('触发时段任务: ' + slot);

  try {
    if (delivery.fetch !== false) {
      if (store) store.addHistory('fetchHistory', { title: '定时抓取 · ' + slot, status: '运行中', trigger: opts.manual ? '手动' : '定时' });
      const r = await runScript('fetch-news-ai.js', ['--period=' + slot]);
      // v10.5.0：抓取子进程自己会写结果；这里只在子进程未落历史时补一条，避免重复
      const summary = fetchSummary(slot);
      log('抓取 ' + slot + ' ' + (r.ok ? '完成' : '失败: ' + (r.error || '退出码 ' + r.code))
        + (summary ? ' · ' + summary : ''));
      result.fetch = { ok: r.ok, code: r.code, error: r.ok ? undefined : (r.error || '退出码 ' + r.code), detail: summary };
      if (!r.ok && store) {
        store.addHistory('fetchHistory', {
          title: '定时抓取 · ' + slot,
          status: '失败',
          error: r.error || ('退出码 ' + r.code),
          output: (r.output || '').slice(-200),
        });
      }
    }

    // v10.5.0：抓取失败时不再发送（旧逻辑会照发旧 HTML）
    const fetchOk = delivery.fetch === false || (result.fetch && result.fetch.ok);
    if (delivery.send === true && fetchOk) {
      const r = await runScript('send-mail.js', ['--period=' + slot]);
      result.send = { ok: r.ok, code: r.code, error: r.ok ? undefined : (r.error || '退出码 ' + r.code) };
      log('发送 ' + slot + ' ' + (r.ok ? '完成' : '失败: ' + (r.error || '退出码 ' + r.code)));
    } else if (delivery.send === true && !fetchOk) {
      result.send = { ok: false, skipped: true, reason: '抓取未成功，已阻止发送过期/降级内容' };
      log('跳过发送 ' + slot + '：抓取未成功', 'warn');
    }
  } catch (e) {
    log('任务异常: ' + e.message, 'error');
    result.error = e.message;
  } finally {
    state.running = false;
    result.durationMs = Date.now() - t0;
    result.finishedAt = new Date().toISOString();
    state.lastResult = result;
    saveState();
  }
  return result;
}

/** 读取本次抓取的 meta，写入日志/历史，便于判断是否降级 */
function fetchSummary(slot) {
  try {
    const fs2 = require('fs');
    const f = path.join(ROOT, 'data', slot + '-latest.json');
    if (!fs2.existsSync(f)) return '';
    const m = (JSON.parse(fs2.readFileSync(f, 'utf8')).meta) || {};
    return 'aiMode=' + (m.aiMode === false ? 'false(降级)' : 'true')
      + ' · 条数=' + (m.itemCount || '?')
      + ' · 解读覆盖率=' + (m.commentaryCoverage || '?')
      + ' · 质量=' + (m.quality || '?');
  } catch (e) { return ''; }
}

function tick() {
  state.lastTick = new Date().toISOString();
  if (!store) return;

  const cfg = store.getAll();
  if (!cfg.app || cfg.app.autoSchedule !== true) return;

  const d = new Date();
  const hhmm = nowHHMM(d);
  // v10.7.0：移除可配置的「补跑窗口」。改为固定 1 分钟容差：
  // 30 秒轮询本身保证不会错过整分，1 分钟容差足以覆盖 tick 抖动，
  // 又不会因为服务晚启动 5 分钟就补发一封「过时」的早报。
  const GRACE_MIN = 1;
  const nowMin = d.getHours() * 60 + d.getMinutes();

  for (const slot of SLOTS) {
    const target = (cfg.schedule || {})[slot];
    if (!target || !/^\d{2}:\d{2}$/.test(target)) continue;
    const tp = target.split(':');
    const targetMin = Number(tp[0]) * 60 + Number(tp[1]);
    if (Number.isNaN(targetMin)) continue;
    const diff = nowMin - targetMin;
    if (diff < 0 || diff >= GRACE_MIN) continue;

    const stamp = fireKey(d, slot, target);
    if (state.lastFired[stamp]) continue;
    state.lastFired[stamp] = new Date().toISOString();
    saveState();
    if (diff > 0) log(slot + ' 计划 ' + target + '，当前 ' + hhmm + '，补跑触发');
    fire(slot);
  }

  // 清理 3 天前的触发记录（键内日期已补零，可安全字典序比较）
  const cutoff = (function (x) {
    return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate());
  })(new Date(Date.now() - 3 * 86400000));
  let dirty = false;
  for (const k of Object.keys(state.lastFired)) {
    if (datePartOf(k) < cutoff) { delete state.lastFired[k]; dirty = true; }
  }
  if (dirty) saveState();
}

function start() {
  if (state.timer) return;
  loadState();
  state.timer = setInterval(tick, 30000);
  intervalGuard();
  log('调度器已启动（30 秒轮询，容差 1 分钟）');
}

function intervalGuard() {
  if (state.timer.unref) state.timer.unref();
}

function stop() {
  if (state.timer) { clearInterval(state.timer); state.timer = null; }
  log('调度器已停止');
}

/** 下一次预计触发（用于 UI 显示"下次发送"） */
function nextRun() {
  let cfg = {};
  try { cfg = store ? store.getAll() : {}; } catch (e) { return null; }
  if (!cfg.app || cfg.app.autoSchedule !== true) return null;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const sched = cfg.schedule || {};
  let best = null;
  for (const slot of SLOTS) {
    const t = sched[slot];
    if (!t || !/^\d{2}:\d{2}$/.test(t)) continue;
    const p = t.split(':');
    const m = Number(p[0]) * 60 + Number(p[1]);
    if (m > nowMin) {
      if (!best || m < best.minutes) best = { slot: slot, at: t, minutes: m };
    }
  }
  if (!best) {
    // 今天已全部过去 → 明天最早的一个
    let earliest = null;
    for (const slot of SLOTS) {
      const t = sched[slot];
      if (!t || !/^\d{2}:\d{2}$/.test(t)) continue;
      const p = t.split(':');
      const m = Number(p[0]) * 60 + Number(p[1]);
      if (!earliest || m < earliest.minutes) earliest = { slot: slot, at: t, minutes: m };
    }
    if (!earliest) return null;
    best = { slot: earliest.slot, at: earliest.at, minutes: earliest.minutes, day: '明天' };
  }
  const remain = best.minutes - nowMin + (best.day ? 1440 : 0);
  const rh = Math.floor(remain / 60), rm = Math.round(remain % 60);
  return { slot: best.slot, at: best.at, day: best.day || '今天', inMinutes: Math.round(remain), human: (rh > 0 ? rh + ' 小时 ' : '') + rm + ' 分钟后' };
}

function status() {
  let cfg = {};
  try { cfg = store ? store.getAll() : {}; } catch (e) { cfg = {}; }
  return {
    running: !!state.timer,
    enabled: !!(cfg.app && cfg.app.autoSchedule),
    runningTask: state.running,
    lastTick: state.lastTick,
    lastResult: state.lastResult,
    nextRun: nextRun(),
    schedule: cfg.schedule || {},
    delivery: cfg.delivery || {},
    firedToday: Object.keys(state.lastFired).filter(function (k) {
      const d = new Date();
      const today = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      return datePartOf(k) === today;
    }),
    recentLog: state.log.slice(0, 20),
  };
}

module.exports = { start, stop, status, fire, SLOTS, nextRun, runScript, tick, fireKey, loadState, saveState };
