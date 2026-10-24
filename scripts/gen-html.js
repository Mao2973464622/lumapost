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

/** 移动端友好的外层容器：最大 600px，内边距随屏宽收缩 */
function wrapStart() {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${T.bg};">
  <tr><td align="center" style="padding:0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;">`;
}

function wrapEnd() {
  return `    </table>
  </td></tr>
</table>`;
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
                <td style="font-family:${T.font};font-size:12.5px;font-weight:800;color:${T.ink};">
                  LumaPost <span style="color:${T.ink4};font-weight:600;">光影邮报</span>
                </td>
                <td align="right" style="font-family:${T.font};font-size:10.5px;color:${T.ink4};">
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
            <div style="font-family:${T.font};font-size:9px;font-weight:700;color:rgba(255,255,255,.72);letter-spacing:2.5px;margin-bottom:12px;">
              DAILY DIGEST
            </div>
            <div style="font-family:${T.titleFont};font-size:23px;font-weight:800;color:#FFFFFF;line-height:1.35;letter-spacing:-.4px;margin-bottom:10px;">
              ${esc(stripEmoji(data.greeting || '你好'))}
            </div>
            <div style="font-family:${T.font};font-size:12px;color:rgba(255,255,255,.85);line-height:1.6;margin-bottom:18px;">
              ${esc(w.location || '')}${w.location && (w.text || w.temp) ? ' · ' : ''}${esc(w.text || '')}${w.temp ? ' ' + esc(w.temp) : ''}
            </div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td width="33%" align="center" style="border-right:1px solid rgba(255,255,255,.22);">
                  <div style="font-family:${T.font};font-size:19px;font-weight:800;color:#FFFFFF;line-height:1;">${itemCount}</div>
                  <div style="font-family:${T.font};font-size:9.5px;color:rgba(255,255,255,.72);letter-spacing:.5px;margin-top:4px;">条精选</div>
                </td>
                <td width="33%" align="center" style="border-right:1px solid rgba(255,255,255,.22);">
                  <div style="font-family:${T.font};font-size:19px;font-weight:800;color:#FFFFFF;line-height:1;">${secCount}</div>
                  <div style="font-family:${T.font};font-size:9.5px;color:rgba(255,255,255,.72);letter-spacing:.5px;margin-top:4px;">个版块</div>
                </td>
                <td width="34%" align="center">
                  <div style="font-family:${T.font};font-size:19px;font-weight:800;color:#FFFFFF;line-height:1;">${data.tldr ? '1' : '0'}</div>
                  <div style="font-family:${T.font};font-size:9.5px;color:rgba(255,255,255,.72);letter-spacing:.5px;margin-top:4px;">条摘要</div>
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
                <td width="48" valign="top" style="font-family:${T.font};font-size:9.5px;font-weight:800;color:${lb};letter-spacing:1.2px;padding-top:2px;">TL;DR</td>
                <td style="font-family:${T.font};font-size:12.5px;color:${tx};line-height:1.7;font-weight:600;">${esc(data.tldr)}</td>
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
            <div style="font-family:${T.font};font-size:12.5px;font-weight:800;color:${T.ink};margin-bottom:3px;">本期数据概览</div>
            <div style="font-family:${T.font};font-size:10.5px;color:${T.ink4};margin-bottom:16px;">共 ${total} 条资讯 · ${rows.length} 个版块</div>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="padding-bottom:16px;">
                  ${donut}
                  <div style="font-family:${T.font};font-size:10px;color:${T.ink4};margin-top:8px;">前 6 版块占比</div>
                </td>
              </tr>
            </table>

            <div style="height:1px;background:${T.line};margin:0 0 14px;"></div>

            <div style="font-family:${T.font};font-size:10.5px;font-weight:700;color:${T.ink3};letter-spacing:.4px;margin-bottom:10px;">各版块资讯量</div>
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
    return `
              <tr><td style="padding:8px 0;border-bottom:1px solid ${T.line};">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td width="14" valign="middle">
                      <span style="display:inline-block;width:8px;height:8px;border-radius:4px;background:${th.accent};"></span>
                    </td>
                    <td style="font-family:${T.font};font-size:12.5px;font-weight:600;color:${T.ink2};">
                      <a href="#sec-${esc(s.key)}" style="color:${T.ink2};text-decoration:none;">${esc(name)}</a>
                    </td>
                    <td align="right" width="42">
                      <span style="display:inline-block;background:${hexAlpha(th.accent, 0.1)};color:${th.accent};font-family:${T.font};font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:12px;">${n}</span>
                    </td>
                  </tr>
                </table>
              </td></tr>`;
  }).join('');

  return `
      <tr><td style="padding:10px 10px 0;background:${T.bg};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="background:${T.card};border:1px solid ${T.cardBorder};border-radius:16px;padding:16px 18px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-family:${T.font};font-size:12.5px;font-weight:800;color:${T.ink};padding-bottom:4px;">本期目录</td>
                <td align="right" style="font-family:${T.font};font-size:10.5px;color:${T.ink4};padding-bottom:4px;">${sections.length} 个版块</td>
              </tr>
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
                  <div style="font-family:${T.titleFont};font-size:15.5px;font-weight:800;color:${T.ink};letter-spacing:-.2px;line-height:1.3;">${esc(title)}</div>
                  ${sub ? `<div style="font-family:${T.font};font-size:10.5px;color:${T.ink4};margin-top:2px;">${esc(sub)}</div>` : ''}
                </td>
              </tr>
            </table>`;
}

function newsItem(item, accent, isLast) {
  const link = item.url ? `href="${esc(item.url)}"` : '';
  const stars = item.stars ? '★'.repeat(Math.min(5, item.stars)) : '';
  const qnBg = hexAlpha(accent, T.key === 'dark' ? 0.14 : 0.07);

  return `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:${isLast ? '0' : '10px'};">
              <tr><td style="background:${T.card};border:1px solid ${T.cardBorder};border-radius:13px;padding:15px 15px;">
                <a ${link} style="font-family:${T.font};font-size:14px;font-weight:700;color:${T.ink};line-height:1.5;text-decoration:none;display:block;margin-bottom:8px;">
                  ${esc(cleanText(item.title))}
                </a>
                <div style="font-family:${T.font};font-size:12px;color:${T.ink3};line-height:1.75;margin-bottom:${item.quicknote ? '10px' : '9px'};">
                  ${esc(cls(item.summary, 150))}
                </div>
                ${item.quicknote ? `
                <div style="font-family:${T.font};font-size:11.5px;color:${accent};background:${qnBg};border-radius:8px;padding:9px 11px;line-height:1.65;margin-bottom:9px;">
                  ${esc(cls(item.quicknote, 80))}
                </div>` : ''}
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-family:${T.font};font-size:10px;color:${T.ink4};">
                      ${esc(item.source || '')}${stars ? ' · <span style="color:#F59E0B;">' + stars + '</span>' : ''}
                    </td>
                    ${item.url ? `<td align="right"><a href="${esc(item.url)}" style="font-family:${T.font};font-size:10px;color:${accent};text-decoration:none;font-weight:700;">阅读原文 →</a></td>` : ''}
                  </tr>
                </table>
              </td></tr>
            </table>`;
}

function sectionBlock(sec, idx, total) {
  const th = themeOf(sec.key, idx);
  const items = sec.items || [];
  if (!items.length) return '';
  const name = cleanSectionName(sec.name, sec.key, idx);
  const pos = String(idx + 1).padStart(2, '0') + ' / ' + String(total).padStart(2, '0');

  return `
      <tr><td id="sec-${esc(sec.key)}" style="padding:${idx === 0 ? '24px' : '26px'} 10px 0;background:${T.bg};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;">
              <tr>
                <td style="width:3px;background:${th.accent};border-radius:2px;"></td>
                <td style="padding-left:10px;">
                  <div style="font-family:${T.titleFont};font-size:15.5px;font-weight:800;color:${T.ink};letter-spacing:-.2px;line-height:1.3;">${esc(name)}</div>
                  <div style="font-family:${T.font};font-size:10.5px;color:${T.ink4};margin-top:2px;">${items.length} 条更新</div>
                </td>
                <td align="right" valign="top" style="font-family:${T.font};font-size:10px;color:${T.ink4};padding-top:3px;">${pos}</td>
              </tr>
            </table>
            ${items.map((it, i) => newsItem(it, th.accent, i === items.length - 1)).join('')}
          </td></tr>
        </table>
      </td></tr>`;
}

function quoteBlock(data) {
  if (!data.dailyQuote) return '';
  return `
      <tr><td style="padding:26px 10px 0;background:${T.bg};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="background:linear-gradient(135deg,${T.brand1} 0%,${T.brand3} 100%);border-radius:16px;padding:22px 20px;">
            <div style="font-family:Georgia,serif;font-size:30px;color:rgba(255,255,255,.35);line-height:.8;margin-bottom:6px;">&#8220;</div>
            <div style="font-family:${T.font};font-size:13.5px;color:#FFFFFF;line-height:1.8;font-style:italic;">${esc(data.dailyQuote)}</div>
          </td></tr>
        </table>
      </td></tr>`;
}

function footer(data) {
  return `
      <tr><td style="padding:26px 10px 32px;background:${T.bg};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td align="center" style="border-top:1px solid ${T.line};padding-top:20px;">
            <div style="font-family:${T.font};font-size:12px;font-weight:800;color:${T.ink};margin-bottom:5px;">LumaPost 光影邮报</div>
            <div style="font-family:${T.font};font-size:10.5px;color:${T.footerText};line-height:1.75;">
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
function generateHTML(data, themeKey, customTheme) {
  T = resolveTheme(themeKey || CONFIG.theme || 'minimal', customTheme);
  const secs = (data.sections || []).filter((s) => (s.items || []).length > 0);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no">
<title>LumaPost 光影邮报 · ${esc(data.date || '')}</title>
</head>
<body style="margin:0;padding:0;background:${T.bg};-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;">

${wrapStart()}
      ${brandBar(data)}
      ${hero(data)}
      ${tldrBar(data)}
      ${chartsBlock(data)}
      ${toc(data)}
      ${secs.map((s, i) => sectionBlock(s, i, secs.length)).join('')}
      ${quoteBlock(data)}
      ${footer(data)}
${wrapEnd()}

</body>
</html>`;
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

  const secCount = (data.sections || []).length;
  const itemCount = (data.sections || []).reduce((s, x) => s + (x.items || []).length, 0);

  console.log('LumaPost 邮件生成完成 (v8)');
  console.log('  主题 : ' + T.name + ' (' + T.key + ')');
  console.log('  输出 : ' + out);
  console.log('  大小 : ' + Math.round(Buffer.byteLength(html) / 1024) + ' KB');
  console.log('  版块 : ' + secCount + ' 个 / ' + itemCount + ' 条新闻');
}

if (require.main === module) main();

module.exports = { generateHTML, THEMES, resolveTheme, listThemes: themes.listThemes, defaultCustom: themes.defaultCustom };