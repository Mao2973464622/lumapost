#!/usr/bin/env node
/**
 * gen-html.js — LumaPost 光影邮报 HTML 邮件生成器 v8.0
 *
 * v8 变更：
 *   - 移动端适配：容器 max-width 600px，内边距随屏宽收缩
 *   - 图表区重排：环形图与条形图改为上下堆叠（移动端不再挤成一团）
 *   - 主题系统：支持 极简白 / 墨黑 / 报刊 三套主题
 *   - 版块卡片优化：标题行、标签行分离，阅读更顺畅
 */
const fs = require('fs');
const path = require('path');

let charts = {};
try { charts = require('./mail-charts'); } catch (e) { charts = {}; }

let store = null;
try { store = require('./config-store'); } catch (e) { store = null; }

const CONFIG = { dataFile: null, outputFile: null, theme: null };

function parseArgs() {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    let arg = args[i];
    let val = null;
    const eq = arg.indexOf('=');
    if (eq > 0) { val = arg.slice(eq + 1); arg = arg.slice(0, eq); }
    if ((arg === '--data-file' || arg === '-d') && (val || args[i + 1])) {
      CONFIG.dataFile = val || args[++i];
    } else if ((arg === '--output' || arg === '-o') && (val || args[i + 1])) {
      CONFIG.outputFile = val || args[++i];
    } else if (arg === '--theme' && (val || args[i + 1])) {
      CONFIG.theme = val || args[++i];
    }
  }
  if (!CONFIG.dataFile || !CONFIG.outputFile) {
    console.error('用法: node gen-html.js --data-file=<json> --output=<html> [--theme=minimal|dark|paper]');
    process.exit(1);
  }
}

/* ============================================================
   主题系统（外置到 mail-themes.js）
   ============================================================ */
let themes = { THEMES: {}, resolveTheme: null, listThemes: null, defaultCustom: null, DEFAULT_THEME: 'minimal' };
try { themes = require('./mail-themes'); } catch (e) { /* 降级 */ }

const THEMES = themes.THEMES || {};
function resolveTheme(key, custom) {
  if (typeof themes.resolveTheme === 'function') return themes.resolveTheme(key, custom);
  return THEMES[key] || THEMES.minimal || {};
}

let T = THEMES.minimal || {};   // 运行时覆盖

/* ============================================================
   版块主题色
   ============================================================ */
const SECTION_THEMES = {
  ai:        { accent: '#6366F1', name: 'AI 智能体' },
  hardware:  { accent: '#0EA5E9', name: '硬件数码' },
  github:    { accent: '#10B981', name: '全球创意开源' },
  news:      { accent: '#F59E0B', name: '国内外新闻' },
  games:     { accent: '#EC4899', name: '游戏动漫' },
  finance:   { accent: '#14B8A6', name: '理财财经' },
  auto:      { accent: '#8B5CF6', name: '汽车新能源' },
  internet:  { accent: '#3B82F6', name: '互联网大厂' },
  life:      { accent: '#F97316', name: '影视生活' },
  space:     { accent: '#06B6D4', name: '科学航天健康' },
};

const FALLBACK_ACCENTS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#3B82F6', '#F97316', '#14B8A6', '#0EA5E9'];

function themeOf(key, idx) {
  if (SECTION_THEMES[key]) return SECTION_THEMES[key];
  return { accent: FALLBACK_ACCENTS[(idx || 0) % FALLBACK_ACCENTS.length], name: String(key || '资讯') };
}

/* ============================================================
   工具
   ============================================================ */
function esc(s) {
  const AMP = String.fromCharCode(38);
  const Q = String.fromCharCode(34);
  return String(s == null ? '' : s)
    .replace(new RegExp(AMP, 'g'), AMP + 'amp;')
    .replace(/</g, AMP + 'lt;')
    .replace(/>/g, AMP + 'gt;')
    .replace(new RegExp(Q, 'g'), AMP + 'quot;');
}

function stripEmoji(s) {
  return String(s || '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, '').trim();
}

function cleanText(s) {
  return String(s || '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function cleanSectionName(raw, key, idx) {
  const th = themeOf(key, idx);
  if (SECTION_THEMES[key]) return SECTION_THEMES[key].name;
  let s = stripEmoji(raw || '').replace(/[·|、]/g, ' ').replace(/\s+/g, ' ').trim();
  return (s && s.length >= 2) ? s : th.name;
}

function cls(text, n) {
  const s = cleanText(text);
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function hexAlpha(hex, alpha) {
  // #6366F1 + 0.1 -> #6366F11A
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255).toString(16).padStart(2, '0').toUpperCase();
  return String(hex).slice(0, 7) + a;
}

/** v10.5.0：URL 协议白名单，杜绝 javascript:/data: 注入 */
function safeUrl(u) {
  const s = String(u || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (/^mailto:/i.test(s)) return s;
  if (s.charAt(0) === '#') return s;
  return '';
}

/** v10.5.0：极简行内加粗（先 esc 再替换，安全） */
function md(s) {
  return esc(s).replace(/\*\*([^*\n]{1,200})\*\*/g, '<strong>$1</strong>');
}

/** v10.5.0：星级安全渲染（旧实现 '★'.repeat(stars) 无上界） */
function starStr(n) {
  const k = Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
  return k ? '★'.repeat(k) : '';
}

/** 涨跌色（邮件只允许极安全颜色语义） */
function pctColor(pct) {
  const v = parseFloat(String(pct).replace(/[+%]/g, ''));
  if (!isFinite(v) || v === 0) return T.ink3;
  return v > 0 ? '#DC2626' : '#059669';   // A 股习惯：红涨绿跌
}

/**
 * v10.5.1：清洗「内容简介」文本。
 *
 * 背景：early 版本把 quicknote 当作元数据槽位，写入了 `csdn #1`、`知乎 #3`
 * 这类「来源 + 排名」字符串。这类值在邮件里只会渲染出一个没有信息的空框，
 * 所以要在这里主动识别并丢弃，让卡片要么有真简介、要么不出现这一块。
 */
function cleanBrief(raw) {
  let s = cleanText(raw);
  if (!s) return '';
  // 1) 先剥离尾部的排名标记：`… #1` / `…#12` / `… · #3`
  s = s.replace(/\s*[·\-—|]?\s*#\s*\d{1,3}\s*$/, '').trim();
  // 2) 剥完只剩 8 字以内且没有任何标点/数字 → 说明它本来就是「来源名」之类的元数据
  if (s.length < 8) return '';
  if (s.length <= 12 && !/[，。！？、,.!?0-9]/.test(s)) return '';
  return s;
}

/** 移动端友好的外层容器：最大 600px，内边距随屏宽收缩 */
function wrapStart() {
  // v10.6.0：在 <body> 上统一声明字体与字号。
  // 旧实现给每个 <div> 都内联整条字体栈（117 字符 × 184 处 ≈ 21KB 纯冗余），
  // 而邮件客户端会沿 DOM 继承 font-family/size/color，声明一次即可。
  // 这里同时声明 mso-line-height-rule 让 Outlook 的行高不跳。
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${T.bg};">
  <tr><td align="center" style="padding:0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;">`;
}

/** v10.6.0：body 统一样式（字体只在这里出现一次） */
function bodyStyle() {
  return 'margin:0;padding:0;background:' + T.bg + ';'
    + '-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;'
    + 'font-family:' + T.font + ';font-size:12px;color:' + T.ink3 + ';'
    + 'mso-line-height-rule:exactly;';
}

function wrapEnd() {
  return `    </table>
  </td></tr>
</table>`;
}

/**
 * v10.5.0：内容预算（防止邮件超出 Gmail 102KB 硬截断线）
 * 可在 config/app.json 的 email 段覆盖。
 */
const LIMITS = {
  itemsTotal: 40,        // 全局条目上限
  itemsPerSection: 5,    // 单版块上限
  headlineCount: 3,
  trendCount: 5,
  titleChars: 120,
  summaryChars: 150,
  commentaryChars: 640,
  quicknoteChars: 120,
  maxHtmlKB: 92,         // 留足余量给邮件头与 base64 膨胀
  showHeadlines: true,
  showCommentary: true,
  showStocks: true,
  showTrends: true,
  showCharts: true,
  showToc: true,
  showQuote: true,
};

function resolveLimits() {
  const L = Object.assign({}, LIMITS);
  if (store) {
    try {
      const e = store.get('email');
      if (e && typeof e === 'object') {
        for (const k of Object.keys(L)) {
          if (e[k] === undefined || e[k] === null) continue;
          if (typeof L[k] === 'number') {
            const n = Number(e[k]);
            if (Number.isFinite(n) && n >= 0) L[k] = n;
          } else if (typeof L[k] === 'boolean') {
            L[k] = e[k] === true || e[k] === 'true';
          }
        }
      }
    } catch (err) { /* 用默认 */ }
  }
  return L;
}

function truncate(s, n) {
  const str = cleanText(s);
  if (n <= 0) return '';
  return str.length > n ? str.slice(0, n) + '…' : str;
}

/**
 * v10.5.0：按预算裁剪数据（返回浅拷贝 + 统计），
 * 让"抓取端生成很多"与"邮件端发得下"解耦。
 *
 * v10.6.0 关键修复：旧实现是「贪心填充」——前面的版块吃到 itemsTotal 上限后，
 * 后面的版块整块消失（实测 10 个版块只渲染出 6 个，读者以为本期只有 6 个分区）。
 * 现在改为**两轮公平分配**：
 *   第 1 轮：每个版块先保底 min(条数, floor(itemsTotal / 版块数))
 *   第 2 轮：剩余配额按各版块的 stars 优先级补足
 * 保证「每个分区都能出现」，且高星内容仍优先。
 */
function applyBudget(data, L) {
  const dropped = { items: 0, headlines: 0, trends: 0, chars: 0 };
  const out = Object.assign({}, data);

  out.headline = (data.headline || []).slice(0, L.headlineCount);
  dropped.headlines = Math.max(0, (data.headline || []).length - L.headlineCount);

  out.summary = (data.summary || []).slice(0, L.trendCount);
  dropped.trends = Math.max(0, (data.summary || []).length - L.trendCount);

  const srcSections = (data.sections || []).filter(function (s) { return (s.items || []).length > 0; });

  // 每个版块先按 stars 排序（高星优先），并限制版块内上限
  const ranked = srcSections.map(function (sec) {
    const items = (sec.items || []).slice();
    const r = items
      .map(function (it, i) { return { it: it, i: i, st: Number(it && it.stars) || 0 }; })
      .sort(function (a, b) { return (b.st - a.st) || (a.i - b.i); })
      .sort(function (a, b) { return a.i - b.i; });   // 还原原顺序
    dropped.items += Math.max(0, items.length - L.itemsPerSection);
    return r.slice(0, L.itemsPerSection).map(function (x) { return x.it; });
  });

  // 第 1 轮：公平保底 —— 让每个版块都至少有内容
  const totalSections = ranked.length || 1;
  const fairShare = Math.max(1, Math.floor(L.itemsTotal / totalSections));
  const quota = ranked.map(function (list) { return Math.min(list.length, fairShare); });
  let used = quota.reduce(function (a, b) { return a + b; }, 0);

  // 第 2 轮：把剩余配额按 stars 高低分配（轮转填充，避免又变成贪心）
  let remaining = Math.max(0, L.itemsTotal - used);
  let progressed = true;
  while (remaining > 0 && progressed) {
    progressed = false;
    for (let i = 0; i < ranked.length && remaining > 0; i++) {
      if (quota[i] < ranked[i].length) {
        quota[i]++; remaining--; used++; progressed = true;
      }
    }
  }

  out.sections = ranked.map(function (list, i) {
    const keepCount = Math.min(quota[i], list.length, L.itemsPerSection);
    const keepIdx = new Set();
    // 保留原顺序里的前 keepCount 条（已按 stars 排过序的列表再按原索引还原顺序选）
    const sortedByStar = list
      .map(function (it, idx) { return { it: it, idx: idx, st: Number(it.stars) || 0 }; })
      .sort(function (a, b) { return (b.st - a.st) || (a.idx - b.idx); })
      .slice(0, keepCount)
      .sort(function (a, b) { return a.idx - b.idx; });
    const kept = sortedByStar.map(function (x) { return x.it; });
    dropped.items += Math.max(0, (srcSections[i].items || []).length - kept.length);

    const norm = kept.map(function (it) {
      const ni = Object.assign({}, it);
      const beforeLen = String(it.summary || '').length + String(it.commentary || '').length;
      ni.title = truncate(it.title, L.titleChars);
      ni.summary = truncate(it.summary, L.summaryChars);
      ni.quicknote = truncate(cleanBrief(it.quicknote), L.quicknoteChars);
      if (L.showCommentary) ni.commentary = truncate(it.commentary, L.commentaryChars);
      else ni.commentary = '';
      const afterLen = String(ni.summary || '').length + String(ni.commentary || '').length;
      dropped.chars += Math.max(0, beforeLen - afterLen);
      return ni;
    });

    return Object.assign({}, srcSections[i], { items: norm });
  }).filter(function (s) { return s.items.length > 0; });

  const total = out.sections.reduce(function (a, s) { return a + s.items.length; }, 0);

  out.meta = Object.assign({}, data.meta || {}, {
    budget: {
      itemsTotal: L.itemsTotal,
      itemsPerSection: L.itemsPerSection,
      kept: total,
      droppedItems: dropped.items,
      droppedChars: dropped.chars,
    },
  });
  return { data: out, dropped: dropped, count: total };
}

/* ============================================================
   组件
   ============================================================ */

function brandBar(data) {
  return `
      <tr><td style="padding:0;background:${T.bg};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="padding:16px 16px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-size:12.5px;font-weight:800;color:${T.ink};">
                  LumaPost <span style="color:${T.ink4};font-weight:600;">光影邮报</span>
                </td>
                <td align="right" style="font-size:10.5px;color:${T.ink4};">
                  ${esc(data.date || '')}
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </td></tr>`;
}

function hero(data) {
  const w = data.weather || {};
  const itemCount = (data.sections || []).reduce((s, x) => s + (x.items || []).length, 0);
  const secCount = (data.sections || []).length;

  return `
      <tr><td style="padding:0 10px;background:${T.bg};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="background:linear-gradient(135deg,${T.brand1} 0%,${T.brand2} 55%,${T.brand3} 100%);border-radius:20px;padding:26px 22px 22px;">
            <div style="font-size:9px;font-weight:700;color:rgba(255,255,255,.72);letter-spacing:2.5px;margin-bottom:12px;">
              DAILY DIGEST
            </div>
            <div style="font-size:23px;font-weight:800;color:#FFFFFF;line-height:1.35;letter-spacing:-.4px;margin-bottom:10px;">
              ${esc(stripEmoji(data.greeting || '你好'))}
            </div>
            <div style="font-size:12px;color:rgba(255,255,255,.85);line-height:1.6;margin-bottom:18px;">
              ${esc(w.location || '')}${w.location && (w.text || w.temp) ? ' · ' : ''}${esc(w.text || '')}${w.temp ? ' ' + esc(w.temp) : ''}
            </div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td width="33%" align="center" style="border-right:1px solid rgba(255,255,255,.22);">
                  <div style="font-size:19px;font-weight:800;color:#FFFFFF;line-height:1;">${itemCount}</div>
                  <div style="font-size:9.5px;color:rgba(255,255,255,.72);letter-spacing:.5px;margin-top:4px;">条精选</div>
                </td>
                <td width="33%" align="center" style="border-right:1px solid rgba(255,255,255,.22);">
                  <div style="font-size:19px;font-weight:800;color:#FFFFFF;line-height:1;">${secCount}</div>
                  <div style="font-size:9.5px;color:rgba(255,255,255,.72);letter-spacing:.5px;margin-top:4px;">个版块</div>
                </td>
                <td width="34%" align="center">
                  <div style="font-size:19px;font-weight:800;color:#FFFFFF;line-height:1;">${data.tldr ? '1' : '0'}</div>
                  <div style="font-size:9.5px;color:rgba(255,255,255,.72);letter-spacing:.5px;margin-top:4px;">条摘要</div>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </td></tr>`;
}

function tldrBar(data) {
  if (!data.tldr) return '';
  const bg = T.key === 'dark' ? '#1E1B0F' : '#FFFBEB';
  const bd = T.key === 'dark' ? '#3F3418' : '#FDE68A';
  const tx = T.key === 'dark' ? '#FCD34D' : '#78350F';
  const lb = T.key === 'dark' ? '#D97706' : '#B45309';
  return `
      <tr><td style="padding:10px 10px 0;background:${T.bg};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="background:${bg};border:1px solid ${bd};border-left:4px solid #F59E0B;border-radius:12px;padding:14px 16px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="48" valign="top" style="font-size:9.5px;font-weight:800;color:${lb};letter-spacing:1.2px;padding-top:2px;">TL;DR</td>
                <td style="font-size:12.5px;color:${tx};line-height:1.7;font-weight:600;">${esc(data.tldr)}</td>
              </tr>
            </table>
          </td></tr>
        </table>
      </td></tr>`;
}

/** 图表区：环形图与条形图上下堆叠，移动端不挤 */
function chartsBlock(data) {
  const secs = (data.sections || []).filter((s) => (s.items || []).length > 0);
  if (!secs.length || !charts.barChartH) return '';

  const rows = secs.map((s, i) => {
    const th = themeOf(s.key, i);
    return { label: cleanSectionName(s.name, s.key, i), value: (s.items || []).length, color: th.accent };
  });

  const total = rows.reduce((a, b) => a + b.value, 0);
  const top6 = rows.slice(0, 6);

  const bar = charts.barChartH(rows, { width: 300, labelW: 92, rowH: 30 });
  const donut = charts.donutChart(top6, { size: 150, stroke: 16, label: '', centerText: total });

  return `
      <tr><td style="padding:10px 10px 0;background:${T.bg};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="background:${T.card};border:1px solid ${T.cardBorder};border-radius:16px;padding:18px 16px;">
            <div style="font-size:12.5px;font-weight:800;color:${T.ink};margin-bottom:3px;">本期数据概览</div>
            <div style="font-size:10.5px;color:${T.ink4};margin-bottom:16px;">共 ${total} 条资讯 · ${rows.length} 个版块</div>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="padding-bottom:16px;">
                  ${donut}
                  <div style="font-size:10px;color:${T.ink4};margin-top:8px;">前 6 版块占比</div>
                </td>
              </tr>
            </table>

            <div style="height:1px;background:${T.line};margin:0 0 14px;"></div>

            <div style="font-size:10.5px;font-weight:700;color:${T.ink3};letter-spacing:.4px;margin-bottom:10px;">各版块资讯量</div>
            ${bar}
          </td></tr>
        </table>
      </td></tr>`;
}

function toc(data) {
  const sections = data.sections || [];
  if (!sections.length) return '';

  const rows = sections.map((s, i) => {
    const th = themeOf(s.key, i);
    const n = (s.items || []).length;
    const name = cleanSectionName(s.name, s.key, i);
    const cm = (s.items || []).filter(function (it) { return it.commentary; }).length;
    const num = String(i + 1).padStart(2, '0');
    // v10.6.0：目录升级为阅读路标 —— 带序号、色块、条数、解读数，
    // 让读者能在进正文前建立「这篇文章分几块、每块讲什么」的地图。
    return `
              <tr><td style="padding:0;border-bottom:1px solid ${T.line};">
                <a href="#sec-${esc(s.key)}" style="display:block;text-decoration:none;padding:9px 0;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="26" valign="middle" style="font-size:10px;font-weight:800;color:${th.accent};letter-spacing:.3px;">${num}</td>
                      <td width="8" valign="middle">
                        <span style="display:inline-block;width:6px;height:16px;border-radius:3px;background:${th.accent};"></span>
                      </td>
                      <td style="font-size:12.5px;font-weight:700;color:${T.ink2};padding-left:9px;">
                        ${esc(name)}
                      </td>
                      <td align="right" width="96" style="white-space:nowrap;">
                        <span style="display:inline-block;background:${hexAlpha(th.accent, 0.1)};color:${th.accent};font-size:10px;font-weight:700;padding:2px 7px;border-radius:11px;">${n} 条</span>
                        ${cm ? '<span style="display:inline-block;background:' + hexAlpha(T.brand2, 0.1) + ';color:' + T.brand2 + ';font-family:' + T.font + ';font-size:10px;font-weight:700;padding:2px 7px;border-radius:11px;margin-left:4px;">' + cm + ' 解读</span>' : ''}
                      </td>
                    </tr>
                  </table>
                </a>
              </td></tr>`;
  }).join('');

  return `
      <tr><td id="toc" style="padding:18px 10px 0;background:${T.bg};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="background:${T.card};border:1px solid ${T.cardBorder};border-radius:16px;padding:16px 18px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-size:9.5px;font-weight:800;color:${T.ink4};letter-spacing:1.6px;padding-bottom:6px;">CONTENTS</td>
                <td align="right" style="font-size:10.5px;color:${T.ink4};padding-bottom:6px;">共 ${sections.length} 个版块</td>
              </tr>
              <tr><td colspan="2" style="font-size:15px;font-weight:800;color:${T.ink};padding-bottom:10px;">本期目录</td></tr>
            </table>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              ${rows}
            </table>
          </td></tr>
        </table>
      </td></tr>`;
}

function sectionTitle(title, sub, accent) {
  return `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;">
              <tr>
                <td style="width:3px;background:${accent};border-radius:2px;"></td>
                <td style="padding-left:10px;">
                  <div style="font-size:15.5px;font-weight:800;color:${T.ink};letter-spacing:-.2px;line-height:1.3;">${esc(title)}</div>
                  ${sub ? `<div style="font-size:10.5px;color:${T.ink4};margin-top:2px;">${esc(sub)}</div>` : ''}
                </td>
              </tr>
            </table>`;
}

/**
 * v10.6.0：新闻卡片重写为扁平结构。
 *
 * 旧实现每张卡是 4 层嵌套 table，且每个 <div> 都内联完整字体栈
 * （117 字符），实测单卡 11.4KB 而正文仅 150 字节 —— 包装开销 76 倍，
 * 直接导致 10 个版块必然触发体积瘦身（进而砍掉目录与解读）。
 *
 * 现在：
 *   - 字体由 <body> 统一继承，卡内只声明差异（字号/颜色/粗细）
 *   - 「内容简介」「AI 深度解读」用带左边框的单行 td，不再各自套 table
 *   - table 属性用简写（role/cellspacing 由发送端统一，必要的保留）
 */
function newsItem(item, accent, isLast) {
  const url = safeUrl(item.url);
  const link = url ? 'href="' + esc(url) + '"' : '';
  const stars = starStr(item.stars);
  const qnBg = hexAlpha(accent, T.key === 'dark' ? 0.14 : 0.07);
  const cm = cleanText(item.commentary);
  const titleTxt = esc(truncate(item.title, 120));
  const sumTxt = cls(item.summary, 150);
  // v10.5.1：quicknote 只当作「读完后的简要概括」来渲染，旧数据里的 `csdn #1` 之类元数据在此剔除
  const brief = cleanBrief(item.quicknote);

  const titleHtml = url
    ? '<a ' + link + ' style="font-size:14px;font-weight:700;color:' + T.ink + ';line-height:1.5;text-decoration:none;display:block;">' + titleTxt + '</a>'
    : '<div style="font-size:14px;font-weight:700;color:' + T.ink + ';line-height:1.5;">' + titleTxt + '</div>';

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:${isLast ? '0' : '9px'};">
      <tr><td style="background:${T.card};border:1px solid ${T.cardBorder};border-radius:12px;padding:13px 14px;">
        <div style="margin-bottom:${sumTxt ? '7px' : '6px'};">${titleHtml}</div>
        ${sumTxt ? '<div style="font-size:11.5px;line-height:1.72;margin-bottom:' + (brief || cm ? '8px' : '6px') + ';">' + esc(sumTxt) + '</div>' : ''}
        ${brief ? '<div style="background:' + qnBg + ';border-radius:7px;padding:8px 10px;margin-bottom:' + (cm ? '8px' : '6px') + ';">'
          + '<div style="font-size:9px;font-weight:800;color:' + accent + ';letter-spacing:1.1px;margin-bottom:3px;">内容简介</div>'
          + '<div style="font-size:11px;color:' + T.ink2 + ';line-height:1.68;">' + esc(cls(brief, 100)) + '</div></div>' : ''}
        ${cm ? '<div style="border-left:3px solid ' + accent + ';padding-left:10px;margin-bottom:6px;">'
          + '<div style="font-size:9px;font-weight:800;color:' + accent + ';letter-spacing:1.1px;margin-bottom:3px;">AI 深度解读</div>'
          + '<div style="font-size:11.5px;color:' + T.ink2 + ';line-height:1.78;">' + md(cm) + '</div></div>' : ''}
        <div style="font-size:10px;color:${T.ink4};">${esc(item.source || '')}${stars ? ' · <span style="color:#F59E0B;">' + stars + '</span>' : ''}${url ? ' &nbsp;<a href="' + esc(url) + '" style="font-size:10px;color:' + accent + ';text-decoration:none;font-weight:700;">阅读原文 →</a>' : ''}</div>
      </td></tr>
    </table>`;
}

/**
 * v10.5.0：今日头条（3 条）—— 抓取端生成但旧渲染层完全丢弃
 */
function headlinesBlock(data, L) {
  const list = (data.headline || []).filter(function (h) { return h && (h.title || '').trim(); });
  if (!L.showHeadlines || !list.length) return '';
  const cards = list.map(function (h, i) {
    const url = safeUrl(h.url);
    const cm = truncate(h.commentary, L.commentaryChars);
    const num = String(i + 1).padStart(2, '0');
    return `
      <tr><td style="padding:${i === 0 ? '0' : '8px'} 10px 0;background:${T.bg};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="background:${T.card};border:1px solid ${T.cardBorder};border-top:3px solid ${T.brand2};border-radius:14px;padding:16px 15px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="26" valign="top" style="font-size:15px;font-weight:800;color:${hexAlpha(T.brand2, 0.85)};">${num}</td>
                <td>
                  <div style="font-size:9px;font-weight:800;color:${T.ink4};letter-spacing:1.4px;margin-bottom:5px;">今日头条 · TOP ${i + 1}</div>
                  ${url ? `<a href="${esc(url)}" style="font-size:15px;font-weight:800;color:${T.ink};line-height:1.45;text-decoration:none;display:block;">${esc(truncate(h.title, 100))}</a>`
                        : `<div style="font-size:15px;font-weight:800;color:${T.ink};line-height:1.45;">${esc(truncate(h.title, 100))}</div>`}
                  ${h.summary ? `<div style="font-size:12px;color:${T.ink3};line-height:1.78;margin-top:8px;">${esc(truncate(h.summary, 160))}</div>` : ''}
                  ${cm ? `<div style="font-size:12px;color:${T.ink2};line-height:1.82;margin-top:10px;padding-top:10px;border-top:1px dashed ${T.line};">${md(cm)}</div>` : ''}
                  <div style="font-size:10px;color:${T.ink4};margin-top:9px;">
                    ${esc(h.source || '综合')}${url ? ' · <a href="' + esc(url) + '" style="color:' + T.accent + ';text-decoration:none;font-weight:700;">查看详情 →</a>' : ''}
                  </div>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </td></tr>`;
  }).join('');

  return `
      <tr><td style="padding:14px 0 0;background:${T.bg};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="padding:0 10px 8px;">
            <div style="font-size:11px;font-weight:800;color:${T.brand2};letter-spacing:1.6px;">★ TODAY'S HEADLINES</div>
          </td></tr>
        </table>
      </td></tr>${cards}`;
}

/**
 * v10.5.0：股指条（数据源已抓但从未渲染）
 * stocks 兼容两种形态：fetchStockData 的 {name,price,change,pct} 与 hotboard 的 {name,current,change,pct}
 */
function stocksBar(data, L) {
  if (!L.showStocks) return '';
  const list = (data.stocks || []).filter(function (s) { return s && s.name; }).slice(0, 6);
  if (!list.length) return '';
  const cells = list.map(function (s, i) {
    const price = s.price != null ? s.price : (s.current != null ? Number(s.current).toFixed(2) : '--');
    const rawPct = s.pct != null ? s.pct : '0';
    const col = pctColor(rawPct);
    const sign = String(rawPct).indexOf('-') === 0 ? '' : '+';
    const pctTxt = String(rawPct).indexOf('%') >= 0 ? String(rawPct) : sign + Number(rawPct).toFixed(2) + '%';
    return `
            <td${i < list.length - 1 ? ' width="25%" style="border-right:1px solid ' + T.line + ';"' : ' width="25%"'} align="center">
              <div style="font-size:9.5px;color:${T.ink4};margin-bottom:3px;">${esc(s.name)}</div>
              <div style="font-size:13.5px;font-weight:800;color:${T.ink};line-height:1.2;">${esc(String(price))}</div>
              <div style="font-size:10.5px;font-weight:700;color:${col};margin-top:2px;">${esc(pctTxt)}</div>
            </td>`;
  }).join('');

  return `
      <tr><td style="padding:10px 10px 0;background:${T.bg};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="background:${T.card};border:1px solid ${T.cardBorder};border-radius:14px;padding:13px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>${cells}</tr>
            </table>
            <div style="font-size:9px;color:${T.ink4};text-align:center;margin-top:8px;">行情数据仅供参考 · 来源新浪财经</div>
          </td></tr>
        </table>
      </td></tr>`;
}

/**
 * v10.5.0：趋势总结（summary，抓取端生成但从未渲染）
 */
function trendsBlock(data, L) {
  if (!L.showTrends) return '';
  const list = (data.summary || []).filter(function (t) { return t && (t.trend || t.detail); }).slice(0, L.trendCount);
  if (!list.length) return '';
  const rows = list.map(function (t, i) {
    return `
              <tr><td style="padding:${i === 0 ? '0' : '11px'} 0 ${i === list.length - 1 ? '0' : '11px'};${i > 0 ? 'border-top:1px solid ' + T.line + ';' : ''}">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td width="60" valign="top" style="font-size:10.5px;font-weight:800;color:${T.brand2};padding-top:2px;">${esc(stripEmoji(t.category || ('趋势 ' + (i + 1))))}</td>
                    <td>
                      <div style="font-size:12.5px;font-weight:700;color:${T.ink};line-height:1.5;">${esc(truncate(t.trend, 90))}</div>
                      ${t.detail ? `<div style="font-size:11.5px;color:${T.ink3};line-height:1.75;margin-top:4px;">${esc(truncate(t.detail, 150))}</div>` : ''}
                    </td>
                  </tr>
                </table>
              </td></tr>`;
  }).join('');

  return `
      <tr><td style="padding:22px 10px 0;background:${T.bg};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="background:${T.card};border:1px solid ${T.cardBorder};border-radius:16px;padding:17px 16px;">
            <div style="font-size:14.5px;font-weight:800;color:${T.ink};margin-bottom:12px;">今日趋势观察</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              ${rows}
            </table>
          </td></tr>
        </table>
      </td></tr>`;
}

/** v10.5.0：降级提示条（AI 未参与时明确告知，不再冒充 AI 解读） */
function degradedBanner(data) {
  const m = data.meta || {};
  if (m.aiMode !== false) return '';
  return `
      <tr><td style="padding:10px 10px 0;background:${T.bg};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="background:#FEF3C7;border:1px solid #FCD34D;border-left:4px solid #D97706;border-radius:12px;padding:12px 14px;">
            <div style="font-size:11.5px;font-weight:700;color:#92400E;line-height:1.6;">
              本期为热榜直连模式（AI 主编未参与），内容为原始热点标题，无深度解读。
            </div>
          </td></tr>
        </table>
      </td></tr>`;
}

/**
 * v10.6.0：版块分隔头（显著化）
 *
 * 旧实现只有一个 3px 竖条 + 15.5px 标题，滚动到中段后读者完全不知道
 * 自己在看哪个分区。现在改成整条色带：
 *   [SECTION/01]   🤖 AI · 智能体
 *                  4 条资讯 · 第 1/10 个版块
 * 并在顶部加「回到目录」锚点、底部加「下一版块」预告，形成明确的阅读路标。
 * 全部用 table + inline style，兼容 Gmail / Outlook（gradient 不支持的客户端
 * 会回落到 bgcolor 纯色，仍然醒目）。
 */
function sectionHeader(sec, idx, total, opts) {
  opts = opts || {};
  const th = themeOf(sec.key, idx);
  const items = sec.items || [];
  const name = cleanSectionName(sec.name, sec.key, idx);
  const num = String(idx + 1).padStart(2, '0');
  const totalStr = String(total).padStart(2, '0');
  const withCommentary = items.filter(function (it) { return it.commentary; }).length;

  const metaLine = items.length + ' 条资讯'
    + (withCommentary ? ' · ' + withCommentary + ' 条深度解读' : '')
    + ' · 第 ' + (idx + 1) + ' / ' + total + ' 个版块';

  // 结构刻意保持扁平：色带是一行 td，版块尾注是另一行 td。
  // 早期版本把整个版块包进带边框的大 table，导致 10 个版块凭空多出 200+ KB
  // （每个 newsItem 自身已有 4 层嵌套 table，外层再套一层就会爆体积）。
  return `
      <tr><td id="sec-${esc(sec.key)}" bgcolor="${th.accent}" style="background:${th.accent};background-image:linear-gradient(135deg,${th.accent} 0%,${T.brand2} 100%);padding:${idx === 0 ? '14px' : '26px'} 14px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="40" valign="middle">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="38">
                <tr><td bgcolor="#FFFFFF" style="background:rgba(255,255,255,0.22);border-radius:9px;padding:4px 0;text-align:center;">
                  <div style="font-size:7px;font-weight:800;color:rgba(255,255,255,0.8);letter-spacing:.8px;line-height:1.2;">SEC</div>
                  <div style="font-size:16px;font-weight:800;color:#FFFFFF;line-height:1.1;">${num}</div>
                </td></tr>
              </table>
            </td>
            <td valign="middle" style="padding-left:11px;">
              <div style="font-size:17px;font-weight:800;color:#FFFFFF;letter-spacing:-.2px;line-height:1.28;">${esc(name)}</div>
              <div style="font-size:10px;color:rgba(255,255,255,0.88);margin-top:3px;line-height:1.4;">${esc(metaLine)}</div>
            </td>
            <td align="right" valign="top" width="48" style="padding-top:0;">
              <div style="font-size:13px;font-weight:800;color:rgba(255,255,255,0.95);line-height:1.1;">${num}</div>
              <div style="font-size:8.5px;font-weight:700;color:rgba(255,255,255,0.55);line-height:1.3;">OF ${totalStr}</div>
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td bgcolor="${T.bg}" style="background:${T.bg};padding:12px 10px 0;">
        ${items.map(function (it, i) { return newsItem(it, th.accent, i === items.length - 1); }).join('')}
      </td></tr>
      <tr><td bgcolor="${T.bg}" style="background:${T.bg};padding:9px 12px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="border-top:1px dashed ${T.line};padding-top:8px;font-size:9.5px;color:${T.ink4};">
              ${esc(name)} · 完${opts.nextName ? ' · 下一版块：' + esc(opts.nextName) : ' · 本期最后一个版块'}
            </td>
            <td align="right" style="border-top:1px dashed ${T.line};padding-top:8px;white-space:nowrap;">
              ${opts.hasToc ? '<a href="#toc" style="font-family:' + T.font + ';font-size:9.5px;font-weight:700;color:' + T.ink4 + ';text-decoration:none;">↑ 目录</a>' : ''}
            </td>
          </tr>
        </table>
      </td></tr>`;
}

function sectionBlock(sec, idx, total, opts) {
  const items = sec.items || [];
  if (!items.length) return '';
  return sectionHeader(sec, idx, total, opts);
}

function quoteBlock(data) {
  if (!data.dailyQuote) return '';
  return `
      <tr><td style="padding:26px 10px 0;background:${T.bg};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="background:linear-gradient(135deg,${T.brand1} 0%,${T.brand3} 100%);border-radius:16px;padding:22px 20px;">
            <div style="font-family:Georgia,serif;font-size:30px;color:rgba(255,255,255,.35);line-height:.8;margin-bottom:6px;">&#8220;</div>
            <div style="font-size:13.5px;color:#FFFFFF;line-height:1.8;font-style:italic;">${esc(data.dailyQuote)}</div>
          </td></tr>
        </table>
      </td></tr>`;
}

function footer(data) {
  return `
      <tr><td style="padding:26px 10px 32px;background:${T.bg};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td align="center" style="border-top:1px solid ${T.line};padding-top:20px;">
            <div style="font-size:12px;font-weight:800;color:${T.ink};margin-bottom:5px;">LumaPost 光影邮报</div>
            <div style="font-size:10.5px;color:${T.footerText};line-height:1.75;">
              由 AI 自动编排 · 175 个信息源 · 13 个中文热榜<br>
              ${esc(data.date || '')} · 主题：${esc(T.name)}
            </div>
          </td></tr>
        </table>
      </td></tr>`;
}

/* ============================================================
   主模板
   ============================================================ */
function assemble(data, L) {
  const secs = (data.sections || []).filter((s) => (s.items || []).length > 0);
  // v10.6.0：给每个版块传「下一个版块名」和「是否有目录」，让读者始终知道自己在哪、接下来是什么
  const secHtml = secs.map(function (s, i) {
    const next = secs[i + 1];
    return sectionBlock(s, i, secs.length, {
      hasToc: !!L.showToc,
      nextName: next ? cleanSectionName(next.name, next.key, i + 1) : '',
    });
  }).join('');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no">
<title>LumaPost 光影邮报 · ${esc(data.date || '')}</title>
</head>
<body style="${bodyStyle()}">

${wrapStart()}
      ${brandBar(data)}
      ${hero(data)}
      ${degradedBanner(data)}
      ${tldrBar(data)}
      ${L.showStocks ? stocksBar(data, L) : ''}
      ${L.showHeadlines ? headlinesBlock(data, L) : ''}
      ${L.showCharts ? chartsBlock(data) : ''}
      ${L.showToc ? toc(data) : ''}
      ${secHtml}
      ${L.showTrends ? trendsBlock(data, L) : ''}
      ${L.showQuote ? quoteBlock(data) : ''}
      ${footer(data)}
${wrapEnd()}

</body>
</html>`;
}

/** 纯文本备选体（multipart/alternative，提升可达性与可读性） */
function generateText(data) {
  const L = resolveLimits();
  const lines = [];
  // v10.5.0 修复：push 必须接收全部参数（旧版声明 (s)=>，第二个实参被静默丢弃，
  // 导致标题/版块名从未进入纯文本备选体）
  const push = function () {
    for (let i = 0; i < arguments.length; i++) {
      const s = arguments[i];
      if (s === null || s === undefined || s === false) continue;
      lines.push(String(s));            // 空串保留为空行分隔（原实现把空行也丢了）
    }
  };
  push('LumaPost 光影邮报 · ' + (data.date || ''));
  push('');
  push(cleanText(data.greeting || ''));
  const w = data.weather || {};
  if (w.location) push(w.location + ' ' + (w.text || '') + ' ' + (w.temp || ''));
  if (data.tldr) push('', '【TL;DR】' + cleanText(data.tldr));
  if (data.stocks && data.stocks.length) {
    push('', '【行情】');
    data.stocks.forEach(s => push('  · ' + s.name + ' ' + (s.price != null ? s.price : (s.current != null ? Number(s.current).toFixed(2) : '--')) + ' ' + (s.pct != null ? (String(s.pct).indexOf('%') >= 0 ? s.pct : String(s.pct) + '%') : '')));
  }
  if (data.headline && data.headline.length) {
    push('', '【今日头条】');
    data.headline.slice(0, L.headlineCount).forEach((h, i) => {
      push('', (i + 1) + '. ' + cleanText(h.title));
      if (h.summary) push('   ' + cleanText(h.summary));
      if (h.commentary) push('   解读：' + cleanText(h.commentary));
      if (h.url && safeUrl(h.url)) push('   ' + h.url);
    });
  }
  (data.sections || []).forEach(sec => {
    const items = (sec.items || []).slice(0, L.itemsPerSection);
    if (!items.length) return;
    push('', '【' + cleanSectionName(sec.name, sec.key, 0) + '】');
    items.forEach(it => {
      push('', '- ' + cleanText(it.title));
      if (it.summary) push('  ' + cleanText(it.summary));
      if (it.quicknote) {
        const b = cleanBrief(it.quicknote);
        if (b) push('  简介：' + b);
      }
      if (it.commentary && L.showCommentary) push('  解读：' + cleanText(it.commentary).slice(0, 400));
      if (it.url && safeUrl(it.url)) push('  ' + it.url);
    });
  });
  if (data.summary && data.summary.length) {
    push('', '【今日趋势观察】');
    data.summary.slice(0, L.trendCount).forEach(t => push('- ' + cleanText(t.category || '') + ' ' + cleanText(t.trend || '') + (t.detail ? '：' + cleanText(t.detail) : '')));
  }
  if (data.dailyQuote) push('', '“' + cleanText(data.dailyQuote) + '”');
  push('', '—— LumaPost 光影邮报 · 由 AI 自动编排');
  return lines.join('\n');
}

function generateHTML(data, themeKey, customTheme) {
  T = resolveTheme(themeKey || CONFIG.theme || 'minimal', customTheme);
  const L = resolveLimits();
  const budgeted = applyBudget(data, L);
  let html = assemble(budgeted.data, L);

  // v10.5.0：体积守门。Gmail 在 102KB 截断，超预算则按优先级逐级瘦身。
  //
  // 实测数据：40 条卡片仅 HTML 包装就约 52KB，再叠加 30 条 × 640 字解读
  // （中文 3 字节/字 ≈ 57KB），总量必然破 100KB。
  // 因此策略是「优先砍条数、保住解读质量」：
  //   卡片数下降 = 同时省下包装 + 正文两笔开销，效率最高；
  //   而解读是这封邮件的核心价值，放到最后才动。
  const kb = () => Buffer.byteLength(html, 'utf8') / 1024;
  if (kb() > L.maxHtmlKB) {
    const shrinkSteps = [
      function () { L.showQuote = false; },                                    // 1 每日一句
      function () { L.showCharts = false; },                                   // 2 图表（Outlook 不支持 SVG）
      function () { L.trendCount = Math.min(L.trendCount, 3); },                // 3 趋势条数
      function () { L.itemsTotal = Math.min(L.itemsTotal, 30); L.itemsPerSection = Math.min(L.itemsPerSection, 4); },  // 4
      function () { L.itemsTotal = Math.min(L.itemsTotal, 24); },               // 5
      function () { L.itemsTotal = Math.min(L.itemsTotal, 20); },               // 6
      function () { L.itemsTotal = Math.min(L.itemsTotal, 16); },               // 7
      function () { L.summaryChars = Math.min(L.summaryChars, 110); },          // 8 摘要字数
      function () { L.commentaryChars = Math.min(L.commentaryChars, 420); },    // 9 解读适度压缩
      function () { L.itemsTotal = Math.min(L.itemsTotal, 12); },               // 10
      function () { L.commentaryChars = Math.min(L.commentaryChars, 260); },    // 11
      // v10.6.0：目录是「读者知道自己在哪」的导航骨架，属于体验核心，
      // 和解读一样放到最后才牺牲（旧顺序第 3 步就把它砍了）。
      function () { L.showToc = false; },                                       // 12
      function () { L.showCommentary = false; },                                // 13
    ];
    for (let i = 0; i < shrinkSteps.length && kb() > L.maxHtmlKB; i++) {
      shrinkSteps[i]();
      const nb = applyBudget(data, L);
      html = assemble(nb.data, L);
      console.log('  ⚠ 体积超预算，瘦身第 ' + (i + 1) + ' 步 → ' + kb().toFixed(1) + ' KB');
    }
  }
  if (kb() > 100) {
    console.error('  ❌ 邮件仍达 ' + kb().toFixed(1) + ' KB，可能被 Gmail 截断（102KB）');
  }
  html = html.replace('</head>', '<!-- lumapost-size:' + kb().toFixed(1) + 'KB -->\n</head>');
  return html;
}

function main() {
  parseArgs();

  // 主题优先级：命令行 > 配置文件 > 默认
  let themeKey = CONFIG.theme;
  if (!themeKey && store) {
    try { themeKey = store.get('mail.theme'); } catch (e) { /* noop */ }
  }

  // 自定义主题配置
  let customTheme = null;
  if (store) {
    try { customTheme = store.get('mail.customTheme'); } catch (e) { customTheme = null; }
  }

  const raw = fs.readFileSync(path.resolve(CONFIG.dataFile), 'utf8');
  const data = JSON.parse(raw);
  const html = generateHTML(data, themeKey, customTheme);
  const out = path.resolve(CONFIG.outputFile);
  const dir = path.dirname(out);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(out, html, 'utf8');

  // v10.5.0：同时产出纯文本备选体 <name>.txt，供 multipart 发送
  try {
    const txt = generateText(data);
    const txtOut = out.replace(/\.html?$/i, '') + '.txt';
    fs.writeFileSync(txtOut, txt, 'utf8');
    if (CONFIG.textFile !== undefined) { /* noop */ }
  } catch (e) {
    console.warn('  ⚠ 纯文本备选体生成失败:', e.message);
  }

  const secs = (data.sections || []).filter(s => (s.items || []).length > 0);
  const L = resolveLimits();
  const secCount = secs.length;
  const rawCount = secs.reduce((s, x) => s + (x.items || []).length, 0);
  const keptCount = Math.min(rawCount, L.itemsTotal);
  const withCommentary = secs.reduce((s, x) => s + (x.items || []).filter(i => i.commentary).length, 0);

  console.log('LumaPost 邮件生成完成 (v10.5)');
  console.log('  主题 : ' + T.name + ' (' + T.key + ')');
  console.log('  输出 : ' + out);
  console.log('  大小 : ' + Math.round(Buffer.byteLength(html) / 1024) + ' KB  (Gmail 截断线 102 KB)');
  console.log('  版块 : ' + secCount + ' 个 / 原始 ' + rawCount + ' 条 → 收录 ' + keptCount + ' 条 (上限 ' + L.itemsTotal + ')');
  console.log('  解读 : ' + withCommentary + ' 条含 AI 深度解读' + (withCommentary === 0 ? '  ⚠ 抓取处于降级模式，无解读内容' : ''));
  console.log('  模块 : 头条 ' + ((data.headline || []).length) + ' · 行情 ' + ((data.stocks || []).length) + ' · 趋势 ' + ((data.summary || []).length));
}

if (require.main === module) main();

module.exports = {
  generateHTML, generateText, THEMES, resolveTheme,
  listThemes: themes.listThemes, defaultCustom: themes.defaultCustom,
  applyBudget: applyBudget, resolveLimits: resolveLimits, LIMITS: LIMITS,
  safeUrl: safeUrl, esc: esc, truncate: truncate, cleanBrief: cleanBrief,
};