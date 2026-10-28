#!/usr/bin/env node
/**
 * cli.js — LumaPost 命令行入口 (v10.6.0)
 *
 * Web UI 已移除，本项目改为「纯 CLI + AI Agent 驱动」。
 * 所有原先通过网页完成的操作，这里都有等价命令，且可被 Agent 直接调用。
 *
 * ── 常用 ──
 *   node scripts/cli.js status                运行状态与健康度
 *   node scripts/cli.js config                查看配置（密钥自动脱敏）
 *   node scripts/cli.js config email          只看某个段
 *   node scripts/cli.js set email.itemsTotal 24
 *   node scripts/cli.js doctor                配置体检
 *   node scripts/cli.js sources               信息源启用情况
 *   node scripts/cli.js sources:enable        启用全部信息源
 *   node scripts/cli.js sections              阅读版块启用情况
 *   node scripts/cli.js sections:enable       启用全部阅读版块
 *
 * ── 运行 ──
 *   node scripts/cli.js run morning           抓取 → 生成 → 发送
 *   node scripts/cli.js fetch morning         只抓取
 *   node scripts/cli.js gen morning           只生成 HTML
 *   node scripts/cli.js send morning          只发送
 *   node scripts/cli.json serve               启动常驻调度器
 *
 * ── 维护 ──
 *   node scripts/cli.js test-ai               测试 AI 通道
 *   node scripts/cli.js test-mail             测试邮件通道
 *   node scripts/cli.js history [n]           最近记录
 *   node scripts/cli.js preview morning       生成可在浏览器打开的预览
 *   node scripts/cli.js reset --yes           重置配置
 */
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SLOTS = ['morning', 'noon', 'afternoon', 'evening'];

const argv = process.argv.slice(2);
const cmd = (argv[0] || 'help').toLowerCase();
const args = argv.slice(1);
const has = (f) => args.indexOf(f) >= 0;

function store() { return require('./config-store'); }

/** v10.7.0：这些配置项是数组，`set` 时按逗号切分 */
const ARRAY_KEYS = [
  'sections.enabled',
  'sources.enhance.hotTypes',
];

function out(s) { process.stdout.write(String(s) + '\n'); }
function line() { out('─'.repeat(58)); }
function slotOf(v, def) {
  const s = String(v || def || 'morning');
  return SLOTS.indexOf(s) >= 0 ? s : (def || 'morning');
}
function run(script, scriptArgs, label) {
  out('▶ ' + label);
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', script)].concat(scriptArgs || []), {
    cwd: ROOT, stdio: 'inherit', env: process.env,
  });
  return r.status === 0;
}

/* ─────────── status ─────────── */
function cmdStatus() {
  const c = store();
  const cfg = c.getAll();
  const hist = c.getHistory();
  const lf = (hist.fetchHistory || [])[0] || null;
  const ls = (hist.sendHistory || [])[0] || null;
  const val = c.validate();

  line();
  out('  LumaPost 光影邮报  v' + cfg.version);
  line();
  out('  配置  ' + c.CONFIG_FILE);
  out('  历史  + ' + c.HISTORY_FILE);
  out('');
  out('  AI      ' + cfg.ai.provider + ' / ' + (cfg.ai.model || '(默认)'));
  out('          后台 ' + (cfg.ai.baseUrl || '-') + '  maxTokens=' + cfg.ai.maxTokens);
  out('  邮件    ' + cfg.mail.provider + ' / ' + (cfg.mail.user || '(未设置)'));
  out('          收件 ' + (cfg.mail.to || cfg.mail.user || '(同发件)'));
  out('  调度    ' + (cfg.app.autoSchedule ? '已开启' : '已关闭') + '  ' +
    SLOTS.map(s => (cfg.schedule || {})[s]).filter(Boolean).join(' / '));
  out('  预算    条数≤' + (cfg.email.itemsTotal || 40) + '  HTML≤' + (cfg.email.maxHtmlKB || 92) + 'KB');
  out('');
  out('  最近抓取  ' + (lf ? (lf.status + ' · ' + (lf.quality || '-') + ' · ' + (lf.items || '?') + '条 · 解读' + (lf.commentary || 0)) : '无记录'));
  out('  最近发送  ' + (ls ? (ls.status + ' · ' + (ls.title || '')) : '无记录'));
  out('');
  out('  配置体检  ' + (val.valid ? '✅ 通过' : '❌ ' + val.errors.length + ' 项错误'));
  (val.warnings || []).forEach(w => out('            ⚠ ' + w));
  line();

  const enabled = ((cfg.sources || {}).rss || []).filter(s => s.enabled !== false).length;
  out('  信息源    ' + enabled + ' 个已启用');
  line();
}

/* ─────────── config ─────────── */
function cmdConfig() {
  const c = store();
  if (args[0]) {
    const v = c.get(args[0]);
    out(v === undefined ? '(无此配置项: ' + args[0] + ')' : JSON.stringify(v, null, 2));
    return;
  }
  out(JSON.stringify(c.sanitizeForOutput(c.getAll()), null, 2));
}

function cmdSet() {
  const key = args[0];
  const raw = args.slice(1).join(' ');
  // v10.7.0：允许把数组型配置显式设为空（args 长度为 1，raw 为空串），
  // 因此用 arguments 长度判断“有没有给值”，而不是用 raw === ''
  const hasValue = args.length > 1;
  if (!key || !hasValue) {
    out('用法: node scripts/cli.js set <点路径> <值>');
    out('例:   node scripts/cli.js set email.itemsTotal 24');
    out('      node scripts/cli.js set ai.model deepseek-chat');
    out('      node scripts/cli.js set app.autoSchedule true');
    out('      node scripts/cli.js set sections.enabled ai,hardware,news');
    out('      node scripts/cli.js set sections.enabled ""        # 清空（全部关闭）');
    process.exit(1);
  }
  let val = raw;
  if (raw === 'true') val = true;
  else if (raw === 'false') val = false;
  else if (/^-?\d+(\.\d+)?$/.test(raw)) val = Number(raw);
  // v10.7.0：数组型配置支持逗号分隔写法
  //   node scripts/cli.js set sections.enabled ai,hardware,news
  //   node scripts/cli.js set sections.enabled ""        → 空数组（全部关闭）
  else if (/\[\]$/.test(key) || ARRAY_KEYS.indexOf(key) >= 0) {
    val = raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  }

  const c = store();
  const ok = c.set(key, val);
  out(ok ? '✅ ' + key + ' = ' + JSON.stringify(val) : '❌ 写入失败');
  if (!ok) process.exit(1);
}

function cmdDoctor() {
  const r = store().validate();
  out(JSON.stringify(r, null, 2));
  process.exit(r.valid ? 0 : 1);
}

/* ─────────── sources ─────────── */
function cmdSources() {
  const cfg = store().getAll();
  const rss = (cfg.sources || {}).rss || [];
  const cat = require('./sources-catalog');
  const on = rss.filter(s => s.enabled !== false);

  line();
  out('  信息源状态');
  line();
  out('  已配置        ' + rss.length);
  out('  已启用        ' + on.length + (on.length === rss.length ? '  ✅ 全部启用' : '  ⚠ 有 ' + (rss.length - on.length) + ' 个被禁用'));
  out('  内置目录      ' + cat.CATALOG.length);
  out('  RSS 总开关    ' + ((cfg.sources || {}).enableRss !== false ? '开' : '关'));
  out('  网页源兜底    ' + ((cfg.sources || {}).useWebFallback !== false ? '开' : '关'));
  out('');
  const by = {};
  on.forEach(s => { by[s.category || '?'] = (by[s.category || '?'] || 0) + 1; });
  out('  分类分布:');
  Object.keys(by).sort().forEach(k => out('    ' + k.padEnd(14) + by[k]));
  line();

  if (has('--all')) {
    out('');
    out('  全部源清单:');
    on.forEach((s, i) => out('   ' + String(i + 1).padStart(3) + '. [' + (s.category || '?') + '] ' + s.name));
  }
}

function cmdSourcesEnable() {
  // 一键全部启用
  const c = store();
  const rss = ((c.get('sources') || {}).rss || []).map(s => Object.assign({}, s, { enabled: true }));
  const ok = c.update({ sources: { enableRss: true, useWebFallback: true, rss } });
  out(ok ? '✅ 已启用全部 ' + rss.length + ' 个信息源' : '❌ 失败');
}

function cmdSections() {
  const cfg = store().getAll();
  const all = require('./fetch-news-ai').ALL_SECTIONS;
  const on = (cfg.sections || {}).enabled || [];
  const onSet = new Set(on);

  line();
  out('  阅读版块');
  line();
  out('  已启用        ' + on.length + ' / ' + all.length +
    (on.length === 0 ? '  ⚠ 全部关闭（抓取会中止）' : (on.length === all.length ? '  ✅ 全部开启' : '')));
  out('');
  all.forEach(function (s, i) {
    out('  ' + (onSet.has(s.key) ? '✅' : '⬜') + ' ' + String(i + 1).padStart(2) + '. ' +
      String(s.key).padEnd(11) + s.name);
  });
  line();
  out('  启用全部: node scripts/cli.js sections:enable');
  out('  启用部分: node scripts/cli.js set sections.enabled ai,hardware,news');
  out('  关闭全部: node scripts/cli.js set sections.enabled ""');
  line();
}

function cmdSectionsEnable() {
  // 启用全部版块
  const all = require('./fetch-news-ai').ALL_SECTIONS.map(function (s) { return s.key; });
  const ok = store().set('sections.enabled', all);
  out(ok ? '✅ 已启用全部 ' + all.length + ' 个版块: ' + all.join(', ') : '❌ 失败');
}

/* ─────────── run ─────────── */
function cmdRun() {
  const slot = slotOf(args[0]);
  out('=== ' + slot + ' 完整流程 ===');
  if (!run('fetch-news-ai.js', ['--period=' + slot], '① 抓取 + AI 编排')) process.exit(1);
  if (!run('gen-html.js', ['--data-file=data/' + slot + '-latest.json', '--output=data/' + slot + '-email.html'], '② 生成邮件')) process.exit(1);
  const sendArgs = ['--period=' + slot];
  if (has('--allow-degraded')) sendArgs.push('--allow-degraded');
  if (!run('send-mail.js', sendArgs, '③ 发送')) process.exit(1);
  out('✅ 完成');
}

function cmdFetch() {
  const slot = slotOf(args[0]);
  if (!run('fetch-news-ai.js', ['--period=' + slot], '抓取 ' + slot)) process.exit(1);
}

function cmdGen() {
  const slot = slotOf(args[0]);
  if (!run('gen-html.js', ['--data-file=data/' + slot + '-latest.json', '--output=data/' + slot + '-email.html'], '生成 ' + slot)) process.exit(1);
}

function cmdSend() {
  const slot = slotOf(args[0]);
  const a = ['--period=' + slot];
  if (has('--allow-degraded')) a.push('--allow-degraded');
  if (!run('send-mail.js', a, '发送 ' + slot)) process.exit(1);
}

function cmdServe() {
  const s = require('./scheduler');
  const cfg = store().getAll();
  out('调度器启动（Ctrl+C 退出）');
  out('  计划: ' + SLOTS.map(x => x + '=' + ((cfg.schedule || {})[x] || '-')).join('  '));
  out('  开关: ' + (cfg.app.autoSchedule ? '自动' : '关闭（app.autoSchedule=false，仅心跳，不触发）'));
  s.start();
  process.on('SIGINT', () => { s.stop(); process.exit(0); });
  setInterval(() => {}, 1 << 30);
}

/* ─────────── 维护 ─────────── */
function cmdTestAi() {
  const ai = require('./ai-provider');
  const cfg = ai.getConfig();
  out('模型: ' + cfg.providerName + ' / ' + cfg.model);
  out('端点: ' + cfg.baseUrl + '  maxTokens=' + cfg.maxTokens);
  const t0 = Date.now();
  ai.chat([{ role: 'user', content: '只回复四个字：连接成功' }], { maxTokens: 400 })
    .then(txt => {
      out('✅ ' + ((Date.now() - t0) / 1000).toFixed(1) + 's  返回: ' + txt.trim().slice(0, 60));
    })
    .catch(e => { out('❌ ' + e.message.slice(0, 300)); process.exit(1); });
}

function cmdTestMail() {
  const cfg = store().getAll();
  const to = cfg.mail.to || cfg.mail.user;
  if (!to) { out('❌ 未配置收件人'); process.exit(1); }
  out('发送测试邮件到 ' + to + ' …');
  require('./mail-provider').send({
    to: to,
    subject: '🧪 LumaPost 通道测试',
    html: '<div style="font-family:sans-serif;padding:20px"><h2>通道正常</h2>'
      + '<p>收到这封邮件说明 SMTP 配置正确。</p></div>',
    text: 'LumaPost 通道测试：收到这封邮件说明 SMTP 配置正确。',
  }).then(r => out('✅ 已发送  ' + (r.messageId || '')))
    .catch(e => { out('❌ ' + e.message.slice(0, 300)); process.exit(1); });
}

function cmdHistory() {
  const n = parseInt(args[0], 10) || 10;
  const h = store().getHistory();
  line();
  out('  最近抓取');
  line();
  (h.fetchHistory || []).slice(0, n).forEach(x => {
    out('  ' + (x.time || '').slice(0, 16) + '  ' + String(x.status || '').padEnd(4)
      + '  ' + String(x.quality || '-').padEnd(8)
      + '  条数' + String(x.items || '-').padStart(3)
      + '  解读' + String(x.commentary || 0).padStart(3)
      + (x.error ? '  ⚠ ' + String(x.error).slice(0, 40) : ''));
  });
  out('');
  line();
  out('  最近发送');
  line();
  (h.sendHistory || []).slice(0, n).forEach(x => {
    out('  ' + (x.time || '').slice(0, 16) + '  ' + String(x.status || '').padEnd(4) + '  ' + String(x.title || '').slice(0, 46));
  });
  line();
}

function cmdPreview() {
  const slot = slotOf(args[0]);
  const dataFile = path.join(ROOT, 'data', slot + '-latest.json');
  if (!fs.existsSync(dataFile)) { out('❌ 无数据: ' + dataFile); process.exit(1); }
  const outFile = path.join(ROOT, 'data', 'preview-' + slot + '.html');
  const g = require('./gen-html');
  const cfg = store().getAll();
  const html = g.generateHTML(JSON.parse(fs.readFileSync(dataFile, 'utf8')),
    (cfg.mail || {}).theme, (cfg.mail || {}).customTheme);
  fs.writeFileSync(outFile, html, 'utf8');
  fs.writeFileSync(outFile.replace(/\.html$/, '.txt'), g.generateText(JSON.parse(fs.readFileSync(dataFile, 'utf8'))), 'utf8');
  out('✅ 预览已生成: ' + outFile + '  (' + Math.round(Buffer.byteLength(html) / 1024) + ' KB)');
}

function cmdReset() {
  if (!has('--yes')) {
    out('这会清空所有配置（含 API Key、邮箱授权码）。确认请加 --yes');
    out('  node scripts/cli.js reset --yes');
    process.exit(1);
  }
  store().reset();
  out('✅ 配置已重置为默认值');
}

function cmdHelp() {
  out(fs.readFileSync(__filename, 'utf8').split('*/')[0].split('/**')[1].replace(/^\s*\* ?/gm, ''));
}

/* ─────────── 分发 ─────────── */
const CMDS = {
  status: cmdStatus,
  config: cmdConfig,
  set: cmdSet,
  doctor: cmdDoctor,
  sources: cmdSources,
  'sources:enable': cmdSourcesEnable,
  sections: cmdSections,
  'sections:enable': cmdSectionsEnable,
  run: cmdRun,
  fetch: cmdFetch,
  gen: cmdGen,
  send: cmdSend,
  serve: cmdServe,
  'test-ai': cmdTestAi,
  'test-mail': cmdTestMail,
  history: cmdHistory,
  preview: cmdPreview,
  reset: cmdReset,
  help: cmdHelp,
};

if (CMDS[cmd]) {
  CMDS[cmd]();
} else {
  out('未知命令: ' + cmd);
  out('可用命令: ' + Object.keys(CMDS).join(', '));
  process.exit(1);
}