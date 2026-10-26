#!/usr/bin/env node
/**
 * send-mail.js — 邮件发送脚本 (v10.4)
 *
 * 供内置调度器与命令行调用：
 *   node scripts/send-mail.js --period=morning
 *
 * 流程：
 *   1. 定位 data/<period>-latest.json（若不存在，尝试 all-latest.json）
 *   2. 若 HTML 缺失或比 JSON 旧 → 调用 gen-html.js 重新生成
 *   3. 通过 mail-provider 发送
 *   4. 写入 sendHistory
 *
 * 成功 exit 0，失败 exit 1（调度器据此记录状态）。
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const SLOTS = ['morning', 'noon', 'afternoon', 'evening'];
const SLOT_CN = {
  morning: '早报',
  noon: '午报',
  afternoon: '午后速递',
  evening: '晚间总结',
};

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach((a) => {
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      args[k] = v || true;
    }
  });
  return args;
}

function fail(msg) {
  console.error('❌ ' + msg);
  process.exit(1);
}

function ok(msg) {
  console.log('✅ ' + msg);
}

(async () => {
  const args = parseArgs();
  let period = String(args.period || 'morning');
  if (SLOTS.indexOf(period) < 0) {
    // all / 未知值 → 归到 morning
    period = 'morning';
  }

  let store;
  try {
    store = require('./config-store');
  } catch (e) {
    fail('config-store 不可用: ' + e.message);
  }

  const cfg = store.getAll();
  const subjectPrefix = cfg.mail.subjectPrefix || 'LumaPost 光影邮报';

  // 1. 数据文件（严格匹配本时段；不回落 all-latest，避免用过期数据发送）
  let dataFile = path.join(DATA_DIR, period + '-latest.json');
  if (!fs.existsSync(dataFile)) {
    fail('该时段暂无数据（' + period + '-latest.json 不存在）。'
      + ' 为避免发送过期内容，本脚本不回退到 all-latest.json，请先抓取。');
  }

  const htmlFile = path.join(DATA_DIR, period + '-email.html');
  const dataMtime = fs.statSync(dataFile).mtimeMs;
  const htmlExists = fs.existsSync(htmlFile);

  // 2. 生成 HTML（若缺失或过期）
  if (!htmlExists || fs.statSync(htmlFile).mtimeMs < dataMtime) {
    console.log('📄 生成 HTML 邮件...');
    const gen = spawnSync(
      process.execPath,
      [
        path.join(ROOT, 'scripts', 'gen-html.js'),
        '--data-file=' + dataFile,
        '--output=' + htmlFile,
      ],
      { cwd: ROOT, timeout: 120000, encoding: 'utf8' }
    );
    if (gen.stdout) process.stdout.write(gen.stdout);
    if (gen.error || gen.status !== 0) {
      fail('gen-html 失败: ' + ((gen.stderr || gen.error && gen.error.message) || '退出码 ' + gen.status).toString().slice(0, 200));
    }
    if (!fs.existsSync(htmlFile)) fail('gen-html 未产出文件');
  } else {
    console.log('📄 HTML 已是最新，直接发送');
  }

  const html = fs.readFileSync(htmlFile, 'utf8');
  if (!html || html.length < 1000) fail('HTML 内容异常（过小）');

  // 3. 收件人
  const to = (typeof args.to === 'string' && args.to) || cfg.mail.to || cfg.mail.user;
  if (!to) fail('未配置收件邮箱（mail.to / mail.user 均为空）');

  const subject = subjectPrefix + ' · ' + (SLOT_CN[period] || period) + ' · ' +
    new Date().toLocaleDateString('zh-CN');

  // 4. 发送
  let mailProvider;
  try {
    mailProvider = require('./mail-provider');
  } catch (e) {
    try { store.addHistory('sendHistory', { title: subject, status: '失败', error: 'mail-provider 加载失败: ' + e.message }); } catch (err) { /* noop */ }
    fail('mail-provider 加载失败: ' + e.message);
  }

  console.log('📮 发送到 ' + to + ' ...');
  try {
    const r = await mailProvider.send({
      from: cfg.mail.from || cfg.mail.user,
      to: to,
      subject: subject,
      html: html,
    });
    ok('邮件发送成功  MessageID: ' + (r.messageId || ''));
    try { store.addHistory('sendHistory', { title: subject, status: '完成', to: to }); } catch (err) { /* noop */ }
    process.exit(0);
  } catch (e) {
    try { store.addHistory('sendHistory', { title: subject, status: '失败', error: String(e.message).slice(0, 200), to: to }); } catch (err) { /* noop */ }
    fail('发送失败: ' + String(e.message).slice(0, 300));
  }
})().catch((e) => fail('未捕获异常: ' + e.message));