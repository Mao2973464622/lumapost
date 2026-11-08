#!/usr/bin/env node
/**
 * cli.js — LumaPost 命令行入口（v10.7.1，分层架构版）
 *
 * 架构说明（方案A：模块化分层）：
 *   本项目为纯 CLI 驱动，无 Web UI / 本地网关。
 *   所有操作统一从这里进入，编排逻辑集中到 lib/orchestrator.js，
 *   基础设施（路径/锁/日志/任务状态/版块定义）集中在 lib/ 目录。
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
 *   node scripts/cli.js serve                 启动常驻调度器
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

/* ── 引入分层架构模块 ── */
const paths = require('../lib/paths');            // 统一路径常量
const sections = require('../lib/sections');      // 版块定义（单一数据源）
const orch = require('../lib/orchestrator');      // 编排层（fetch→gen→send）
const jobs = require('../lib/jobstore');          // 任务状态存储

/* ── 项目根目录 ── */
const ROOT = paths.ROOT;
/* ── 4 个可运行的时段 ── */
const SLOTS = paths.SLOTS;

/* ── 命令行参数解析 ── */
const argv = process.argv.slice(2);
const cmd = (argv[0] || 'help').toLowerCase();   // 子命令名
const args = argv.slice(1);                        // 子命令参数
const has = (f) => args.indexOf(f) >= 0;           // 判断是否含某参数

/* ── 配置存储单例（懒加载，避免循环依赖） ── */
function store() { return require('./config-store'); }

/** v10.7.0：这些配置项是数组，`set` 时按逗号切分 */
const ARRAY_KEYS = [
  'sections.enabled',
  'sources.enhance.hotTypes',
];

/* ── 输出工具 ── */
function out(s) { process.stdout.write(String(s) + '\n'); }
function line() { out('─'.repeat(58)); }

/**
 * 规范化时段参数（默认 morning）。
 * @param {string} v 用户传入的时段
 * @param {string} [def='morning'] 默认值
 * @returns {string} 合法时段名
 */
function slotOf(v, def) {
  const s = String(v || def || 'morning');
  return SLOTS.indexOf(s) >= 0 ? s : (def || 'morning');
}

/* ═══════════════════════════════════════════
 *  status —— 总览面板
 * ═══════════════════════════════════════════ */
function cmdStatus() {
  const c = store();
  const cfg = c.getAll();
  const hist = c.getHistory();
  const lf = (hist.fetchHistory || [])[0] || null;   // 最近抓取记录
  const ls = (hist.sendHistory || [])[0] || null;    // 最近发送记录
  const val = c.validate();                           // 配置体检结果

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

  /* 信息源启用统计 */
  const enabled = ((cfg.sources || {}).rss || []).filter(s => s.enabled !== false).length;
  out('  信息源    ' + enabled + ' 个已启用');
  line();

  /* 任务状态（jobstore）展示 */
  const allJobs = jobs.allStatus();
  const anyJobs = Object.keys(allJobs).length > 0;
  if (anyJobs) {
    out('');
    out('  任务状态（最近一次）');
    SLOTS.forEach(slot => {
      const j = allJobs[slot];
      if (!j) return;
      const parts = ['fetch', 'gen', 'send'].map(ph => {
        const t = j[ph];
        if (!t) return ph + ':—';
        const icon = t.status === 'success' ? '✅' : t.status === 'failed' ? '❌' : t.status === 'running' ? '⏳' : '·';
        return ph + ':' + icon;
      }).join('  ');
      out('    ' + slot.padEnd(10) + parts + (j.send && j.send.error ? '  ⚠ ' + j.send.error.slice(0, 30) : ''));
    });
    line();
  }
}

/* ═══════════════════════════════════════════
 *  config —— 查看配置（密钥脱敏）
 * ═══════════════════════════════════════════ */
function cmdConfig() {
  const c = store();
  if (args[0]) {
    const v = c.get(args[0]);
    out(v === undefined ? '(无此配置项: ' + args[0] + ')' : JSON.stringify(v, null, 2));
    return;
  }
  out(JSON.stringify(c.sanitizeForOutput(c.getAll()), null, 2));
}

/* ═══════════════════════════════════════════
 *  set —— 修改单项配置
 * ═══════════════════════════════════════════ */
function cmdSet() {
  const key = args[0];                 // 点路径，如 email.itemsTotal
  const raw = args.slice(1).join(' '); // 原始值字符串
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
  if (raw === 'true') val = true;                    // 字符串 true → 布尔
  else if (raw === 'false') val = false;             // 字符串 false → 布尔
  else if (/^-?\d+(\.\d+)?$/.test(raw)) val = Number(raw); // 数字字符串 → number
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

/* ═══════════════════════════════════════════
 *  doctor —— 配置体检
 * ═══════════════════════════════════════════ */
function cmdDoctor() {
  const r = store().validate();
  out(JSON.stringify(r, null, 2));
  process.exit(r.valid ? 0 : 1);
}

/* ═══════════════════════════════════════════
 *  sources —— 信息源状态
 * ═══════════════════════════════════════════ */
function cmdSources() {
  const cfg = store().getAll();
  const rss = (cfg.sources || {}).rss || [];   // 已配置的信息源
  const cat = require('./sources-catalog');     // 内置源目录
  const on = rss.filter(s => s.enabled !== false); // 已启用的

  line();
  out('  信息源状态');
  line();
  out('  已配置        ' + rss.length);
  out('  已启用        ' + on.length + (on.length === rss.length ? '  ✅ 全部启用' : '  ⚠ 有 ' + (rss.length - on.length) + ' 个被禁用'));
  out('  内置目录      ' + cat.CATALOG.length);
  out('  RSS 总开关    ' + ((cfg.sources || {}).enableRss !== false ? '开' : '关'));
  out('  网页源兜底    ' + ((cfg.sources || {}).useWebFallback !== false ? '开' : '关'));
  out('');
  /* 按分类统计 */
  const by = {};
  on.forEach(s => { by[s.category || '?'] = (by[s.category || '?'] || 0) + 1; });
  out('  分类分布:');
  Object.keys(by).sort().forEach(k => out('    ' + k.padEnd(14) + by[k]));
  line();

  /* --all：列出全部源 */
  if (has('--all')) {
    out('');
    out('  全部源清单:');
    on.forEach((s, i) => out('   ' + String(i + 1).padStart(3) + '. [' + (s.category || '?') + '] ' + s.name));
  }
}

/* ═══════════════════════════════════════════
 *  sources:enable —— 一键启用全部信息源
 * ═══════════════════════════════════════════ */
function cmdSourcesEnable() {
  const c = store();
  const rss = ((c.get('sources') || {}).rss || []).map(s => Object.assign({}, s, { enabled: true }));
  const ok = c.update({ sources: { enableRss: true, useWebFallback: true, rss } });
  out(ok ? '✅ 已启用全部 ' + rss.length + ' 个信息源' : '❌ 失败');
}

/* ═══════════════════════════════════════════
 *  sections —— 阅读版块启用状态
 * ═══════════════════════════════════════════ */
function cmdSections() {
  const cfg = store().getAll();
  const all = sections.ALL_SECTIONS;   // 从 lib/sections.js 取版块定义（单一数据源）
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

/* ═══════════════════════════════════════════
 *  sections:enable —— 启用全部版块
 * ═══════════════════════════════════════════ */
function cmdSectionsEnable() {
  const all = sections.ALL_SECTIONS.map(function (s) { return s.key; });
  const ok = store().set('sections.enabled', all);
  out(ok ? '✅ 已启用全部 ' + all.length + ' 个版块: ' + all.join(', ') : '❌ 失败');
}

/* ═══════════════════════════════════════════
 *  run —— 完整流水线（fetch→gen→send）
 *  统一走 lib/orchestrator.js，行为与调度器一致
 * ═══════════════════════════════════════════ */
function cmdRun() {
  const slot = slotOf(args[0]);
  const opts = { allowDegraded: has('--allow-degraded') };
  if (orch.runPipeline(slot, opts)) {
    out('✅ 完成');
  } else {
    process.exit(1);
  }
}

/* ═══════════════════════════════════════════
 *  fetch —— 只抓取
 * ═══════════════════════════════════════════ */
function cmdFetch() {
  const slot = slotOf(args[0]);
  if (!orch.runFetch(slot)) process.exit(1);
}

/* ═══════════════════════════════════════════
 *  gen —— 只生成 HTML
 * ═══════════════════════════════════════════ */
function cmdGen() {
  const slot = slotOf(args[0]);
  if (!orch.runGen(slot)) process.exit(1);
}

/* ═══════════════════════════════════════════
 *  send —— 只发送
 * ═══════════════════════════════════════════ */
function cmdSend() {
  const slot = slotOf(args[0]);
  const opts = { allowDegraded: has('--allow-degraded') };
  if (!orch.runSend(slot, opts)) process.exit(1);
}

/* ═══════════════════════════════════════════
 *  serve —— 启动常驻调度器
 * ═══════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════
 *  test-ai —— 测试 AI 通道
 * ═══════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════
 *  test-mail —— 测试邮件通道
 * ═══════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════
 *  history —— 最近抓取/发送记录
 * ═══════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════
 *  preview —— 生成浏览器可看的预览（不发信）
 * ═══════════════════════════════════════════ */
function cmdPreview() {
  const slot = slotOf(args[0]);
  const dataFile = paths.dataFile(slot);   // 用 lib/paths 统一路径
  if (!fs.existsSync(dataFile)) { out('❌ 无数据: ' + dataFile); process.exit(1); }
  const outFile = paths.previewFile(slot);
  const g = require('./gen-html');
  const cfg = store().getAll();
  const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  const html = g.generateHTML(data, (cfg.mail || {}).theme, (cfg.mail || {}).customTheme);
  fs.writeFileSync(outFile, html, 'utf8');
  fs.writeFileSync(paths.previewTextFile(slot), g.generateText(data), 'utf8');
  out('✅ 预览已生成: ' + outFile + '  (' + Math.round(Buffer.byteLength(html) / 1024) + ' KB)');
}

/* ═══════════════════════════════════════════
 *  reset —— 重置配置
 * ═══════════════════════════════════════════ */
function cmdReset() {
  if (!has('--yes')) {
    out('这会清空所有配置（含 API Key、邮箱授权码）。确认请加 --yes');
    out('  node scripts/cli.js reset --yes');
    process.exit(1);
  }
  store().reset();
  out('✅ 配置已重置为默认值');
}

/* ═══════════════════════════════════════════
 *  help —— 打印内置说明（从本文件头部注释提取）
 * ═══════════════════════════════════════════ */
function cmdHelp() {
  out(fs.readFileSync(__filename, 'utf8').split('*/')[0].split('/**')[1].replace(/^\s*\* ?/gm, ''));
}

/* ═══════════════════════════════════════════
 *  命令分发表
 * ═══════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════
 *  入口分发
 * ═══════════════════════════════════════════ */
if (CMDS[cmd]) {
  CMDS[cmd]();
} else {
  out('未知命令: ' + cmd);
  out('可用命令: ' + Object.keys(CMDS).join(', '));
  process.exit(1);
}