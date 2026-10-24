#!/usr/bin/env node
/**
 * gen-html.js — LumaPost 光影邮报 HTML 邮件生成器 v7.0
 *
 * v7 变更（用户反馈）：
 *   - 移除「今日头条」「趋势解读」「股市行情」三个区块
 *   - 新增 SVG 图表区（环形图 + 条形图 + 雷达图），带 SMIL 动效
 *   - 版块区增加分隔与呼吸感，卡片间距重新调整
 *   - 修复 stocks NaN%（字段类型不匹配）
 *   - 修复版块标题 emoji 剥离后的分隔符残渣
 */
const fs = require('fs');
const path = require('path');

let charts = {};
try { charts = require('./mail-charts'); } catch (e) { charts = {}; }

const CONFIG = { dataFile: null, outputFile: null };

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
    }
  }
  if (!CONFIG.dataFile || !CONFIG.outputFile) {
    console.error('用法: node gen-html.js --data-file=<json> --output=<html>');
    process.exit(1);
  }
}

/* ============ 设计令牌 ============ */
const T = {
  brand1: '#6366F1', brand2: '#8B5CF6', brand3: '#A855F7',
  ink: '#0F172A', ink2: '#334155', ink3: '#64748B', ink4: '#94A3B8',
  line: '#E8ECF3', bg: '#F5F7FC', white: '#FFFFFF',
  up: '#EF4444', down: '#10B981', star: '#F59E0B',
  font: "-apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Helvetica Neue',Arial,sans-serif",
  mono: "'SF Mono',Monaco,Consolas,'Liberation Mono',monospace",
};

/* ============ 版块配色（与图表共用） ============ */
const THEMES = {
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

const DEFAULT_ACCENTS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#3B82F6', '#F97316', '#14B8A6', '#0EA5E9'];

function themeOf(key, idx) {
  if (THEMES[key]) return THEMES[key];
  return { accent: DEFAULT_ACCENTS[(idx || 0) % DEFAULT_ACCENTS.length], name: String(key || '资讯') };
}

/* ============ 工具 ============ */
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

/** 清洗版块名：优先使用内置规范名，否则剥离 emoji 并归一化分隔符 */
function cleanSectionName(raw, key, idx) {
  const th = themeOf(key, idx);
  // 有内置规范名时直接用（避免「硬件 数码」这种空格断裂）
  if (THEMES[key] && THEMES[key].name) return THEMES[key].name;

  let s = stripEmoji(raw || '');
  s = s.replace(/[·|、]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  if (!s || s.length < 2) return th.name;
  return s;
}

/** 全文本净化：剥离 emoji（标题/摘要/快评里都可能夹带） */
function cleanText(s) {
  return String(s || '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function cls(text, n) {
  const s = cleanText(text);
  return s.length > n ? s.slice(0, n) + '…' : s;
}

/** 安全解析百分比：兼容 "+0.89%" / 0.89 / "+0.89" */
function parsePct(v) {
  if (v == null) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const m = String(v).replace(/%/g, '').trim();
  const n = parseFloat(m);
  return isFinite(n) ? n : null;
}

/** 安全解析数字：兼容 "3690.48" */
function parseNum(v) {
  if (v == null) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const n = parseFloat(String(v).replace(/,/g, '').trim());
  return isFinite(n) ? n : null;
}

/* ============================================================
   组件
   ============================================================ */

function brandBar(data) {
  return `
  <tr><td style="padding:0;background:${T.bg};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;margin:0 auto;">
      <tr><td style="padding:18px 24px 10px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-family:${T.font};font-size:13px;font-weight:800;color:${T.ink};">
              LumaPost <span style="color:${T.ink4};font-weight:600;">光影邮报</span>
            </td>
            <td align="right" style="font-family:${T.font};font-size:11px;color:${T.ink4};">
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
  const srcCount = new Set((data.sections || []).map((s) => s.key)).size;

  return `
  <tr><td style="padding:0 12px;background:${T.bg};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:616px;margin:0 auto;">
      <tr><td style="background:linear-gradient(135deg,${T.brand1} 0%,${T.brand2} 55%,${T.brand3} 100%);border-radius:22px;padding:34px 30px 26px;">
        <div style="font-family:${T.font};font-size:10px;font-weight:700;color:rgba(255,255,255,.72);letter-spacing:3px;margin-bottom:14px;">
          DAILY DIGEST
        </div>
        <div style="font-family:${T.font};font-size:29px;font-weight:800;color:#FFFFFF;line-height:1.25;letter-spacing:-.8px;margin-bottom:12px;">
          ${esc(stripEmoji(data.greeting || '你好'))}
        </div>
        <div style="font-family:${T.font};font-size:13px;color:rgba(255,255,255,.85);line-height:1.7;margin-bottom:22px;">
          ${esc(w.location || '')}${w.location && (w.text || w.temp) ? ' · ' : ''}${esc(w.text || '')}${w.temp ? ' ' + esc(w.temp) : ''}
        </div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding-right:26px;">
              <div style="font-family:${T.font};font-size:22px;font-weight:800;color:#FFFFFF;line-height:1;">${itemCount}</div>
              <div style="font-family:${T.font};font-size:10px;color:rgba(255,255,255,.72);letter-spacing:1px;margin-top:5px;">条精选</div>
            </td>
            <td style="padding:0 26px;border-left:1px solid rgba(255,255,255,.24);">
              <div style="font-family:${T.font};font-size:22px;font-weight:800;color:#FFFFFF;line-height:1;">${secCount}</div>
              <div style="font-family:${T.font};font-size:10px;color:rgba(255,255,255,.72);letter-spacing:1px;margin-top:5px;">个版块</div>
            </td>
            <td style="border-left:1px solid rgba(255,255,255,.24);padding-left:26px;">
              <div style="font-family:${T.font};font-size:22px;font-weight:800;color:#FFFFFF;line-height:1;">${data.tldr ? '1' : '0'}</div>
              <div style="font-family:${T.font};font-size:10px;color:rgba(255,255,255,.72);letter-spacing:1px;margin-top:5px;">条摘要</div>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </td></tr>`;
}

function tldrBar(data) {
  if (!data.tldr) return '';
  return `
  <tr><td style="padding:14px 12px 0;background:${T.bg};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:616px;margin:0 auto;">
      <tr><td style="background:#FFFBEB;border:1px solid #FDE68A;border-left:4px solid ${T.star};border-radius:14px;padding:16px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="56" valign="top" style="font-family:${T.font};font-size:10px;font-weight:800;color:#B45309;letter-spacing:1.5px;padding-top:2px;">
              TL;DR
            </td>
            <td style="font-family:${T.font};font-size:13.5px;color:#78350F;line-height:1.75;font-weight:600;">
              ${esc(data.tldr)}
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </td></tr>`;
}

/** 图表区：环形图 + 横向条形图 */
function chartsBlock(data) {
  const secs = (data.sections || []).filter((s) => (s.items || []).length > 0);
  if (!secs.length || !charts.barChartH) return '';

  const rows = secs.map((s, i) => {
    const th = themeOf(s.key, i);
    return { label: cleanSectionName(s.name, s.key, i), value: (s.items || []).length, color: th.accent };
  });

  const total = rows.reduce((a, b) => a + b.value, 0);

  const bar = charts.barChartH(rows, { width: 520, labelW: 108 });
  const donut = charts.donutChart(rows.slice(0, 6), { size: 168, stroke: 17, label: '条资讯' });

  return `
  <tr><td style="padding:16px 12px 0;background:${T.bg};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:616px;margin:0 auto;">
      <tr><td style="background:${T.white};border:1px solid ${T.line};border-radius:18px;padding:22px 20px;">
        <div style="font-family:${T.font};font-size:13px;font-weight:800;color:${T.ink};margin-bottom:4px;">
          本期数据概览
        </div>
        <div style="font-family:${T.font};font-size:11.5px;color:${T.ink4};margin-bottom:18px;">
          共 ${total} 条资讯，${rows.length} 个版块
        </div>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td valign="middle" width="180" style="padding-right:16px;">
              ${donut}
              <div style="font-family:${T.font};font-size:10.5px;color:${T.ink4};text-align:center;margin-top:10px;">
                前 6 版块占比
              </div>
            </td>
            <td valign="middle">
              <div style="font-family:${T.font};font-size:10.5px;font-weight:700;color:${T.ink3};letter-spacing:.5px;margin-bottom:12px;">
                各版块资讯量
              </div>
              ${bar}
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </td></tr>`;
}

/** 内容目录（竖向列表，比双列更清晰） */
function toc(data) {
  const sections = data.sections || [];
  if (!sections.length) return '';

  const rows = sections.map((s, i) => {
    const th = themeOf(s.key, i);
    const n = (s.items || []).length;
    const name = cleanSectionName(s.name, s.key, i);
    return `
    <tr><td style="padding:9px 0;border-bottom:1px solid ${T.line};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="16" valign="middle">
            <span style="display:inline-block;width:9px;height:9px;border-radius:4.5px;background:${th.accent};"></span>
          </td>
          <td style="font-family:${T.font};font-size:13px;font-weight:600;color:${T.ink2};">
            <a href="#sec-${esc(s.key)}" style="color:${T.ink2};text-decoration:none;">${esc(name)}</a>
          </td>
          <td align="right" width="52">
            <span style="display:inline-block;background:${th.accent}1A;color:${th.accent};font-family:${T.mono};font-size:11px;font-weight:700;padding:2px 9px;border-radius:20px;">
              ${n}
            </span>
          </td>
        </tr>
      </table>
    </td></tr>`;
  }).join('');

  return `
  <tr><td style="padding:16px 12px 0;background:${T.bg};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:616px;margin:0 auto;">
      <tr><td style="background:${T.white};border:1px solid ${T.line};border-radius:18px;padding:20px 22px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:6px;">
          <tr>
            <td style="font-family:${T.font};font-size:13px;font-weight:800;color:${T.ink};">本期目录</td>
            <td align="right" style="font-family:${T.font};font-size:11px;color:${T.ink4};">${sections.length} 个版块</td>
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
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;">
    <tr>
      <td style="width:4px;background:${accent};border-radius:2px;"></td>
      <td style="padding-left:12px;">
        <div style="font-family:${T.font};font-size:17px;font-weight:800;color:${T.ink};letter-spacing:-.3px;line-height:1.3;">
          ${esc(title)}
        </div>
        ${sub ? `<div style="font-family:${T.font};font-size:11.5px;color:${T.ink4};margin-top:3px;">${esc(sub)}</div>` : ''}
      </td>
    </tr>
  </table>`;
}

function newsItem(item, accent, isLast) {
  const link = item.url ? `href="${esc(item.url)}"` : '';
  const stars = item.stars ? '★'.repeat(Math.min(5, item.stars)) : '';
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:${isLast ? '0' : '14px'};">
    <tr><td style="background:${T.white};border:1px solid ${T.line};border-radius:14px;padding:18px 19px;">
      <a ${link} style="font-family:${T.font};font-size:14.5px;font-weight:700;color:${T.ink};line-height:1.55;text-decoration:none;display:block;margin-bottom:9px;">
        ${esc(cleanText(item.title))}
      </a>
      <div style="font-family:${T.font};font-size:12.5px;color:${T.ink3};line-height:1.8;margin-bottom:${item.quicknote ? '12px' : '11px'};">
        ${esc(cls(item.summary, 150))}
      </div>
      ${item.quicknote ? `
      <div style="font-family:${T.font};font-size:12px;color:${accent};background:${accent}12;border-radius:9px;padding:10px 13px;line-height:1.7;margin-bottom:11px;">
        ${esc(cls(item.quicknote, 80))}
      </div>` : ''}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="font-family:${T.font};font-size:10.5px;color:${T.ink4};">
            ${esc(item.source || '')}${stars ? ' · <span style="color:' + T.star + ';">' + stars + '</span>' : ''}
          </td>
          ${item.url ? `<td align="right"><a href="${esc(item.url)}" style="font-family:${T.font};font-size:10.5px;color:${accent};text-decoration:none;font-weight:700;">阅读原文 →</a></td>` : ''}
        </tr>
      </table>
    </td></tr>
  </table>`;
}

function sectionBlock(sec, idx) {
  const th = themeOf(sec.key, idx);
  const items = sec.items || [];
  if (!items.length) return '';
  const name = cleanSectionName(sec.name, sec.key, idx);

  return `
  <tr><td id="sec-${esc(sec.key)}" style="padding:${idx === 0 ? '26px' : '30px'} 12px 0;background:${T.bg};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:616px;margin:0 auto;">
      <tr><td>
        ${sectionTitle(name, items.length + ' 条更新', th.accent)}
        ${items.map((it, i) => newsItem(it, th.accent, i === items.length - 1)).join('')}
      </td></tr>
    </table>
  </td></tr>`;
}

function quoteBlock(data) {
  if (!data.dailyQuote) return '';
  return `
  <tr><td style="padding:30px 12px 0;background:${T.bg};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:616px;margin:0 auto;">
      <tr><td style="background:linear-gradient(135deg,${T.brand1} 0%,${T.brand3} 100%);border-radius:18px;padding:26px 24px;">
        <div style="font-family:Georgia,serif;font-size:34px;color:rgba(255,255,255,.35);line-height:.8;margin-bottom:8px;">&#8220;</div>
        <div style="font-family:${T.font};font-size:14.5px;color:#FFFFFF;line-height:1.85;font-style:italic;">
          ${esc(data.dailyQuote)}
        </div>
      </td></tr>
    </table>
  </td></tr>`;
}

function footer(data) {
  return `
  <tr><td style="padding:30px 12px 36px;background:${T.bg};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:616px;margin:0 auto;">
      <tr><td align="center" style="border-top:1px solid ${T.line};padding-top:22px;">
        <div style="font-family:${T.font};font-size:12.5px;font-weight:800;color:${T.ink};margin-bottom:6px;">
          LumaPost 光影邮报
        </div>
        <div style="font-family:${T.font};font-size:11px;color:${T.ink4};line-height:1.8;">
          由 AI 自动编排 · 175 个信息源 · 13 个中文热榜<br>
          ${esc(data.date || '')} · 本邮件由系统自动生成
        </div>
      </td></tr>
    </table>
  </td></tr>`;
}

/* ============ 主模板 ============ */
function generateHTML(data) {
  const secs = (data.sections || []).filter((s) => (s.items || []).length > 0);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>LumaPost 光影邮报 · ${esc(data.date || '')}</title>
</head>
<body style="margin:0;padding:0;background:${T.bg};-webkit-font-smoothing:antialiased;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${T.bg};">
  <tr><td align="center" style="padding:0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;">
      ${brandBar(data)}
      ${hero(data)}
      ${tldrBar(data)}
      ${chartsBlock(data)}
      ${toc(data)}
      ${secs.map((s, i) => sectionBlock(s, i)).join('')}
      ${quoteBlock(data)}
      ${footer(data)}
    </table>
  </td></tr>
</table>

</body>
</html>`;
}

function main() {
  parseArgs();
  const raw = fs.readFileSync(path.resolve(CONFIG.dataFile), 'utf8');
  const data = JSON.parse(raw);
  const html = generateHTML(data);
  const out = path.resolve(CONFIG.outputFile);
  const dir = path.dirname(out);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(out, html, 'utf8');

  const secCount = (data.sections || []).length;
  const itemCount = (data.sections || []).reduce((s, x) => s + (x.items || []).length, 0);

  console.log('LumaPost 邮件生成完成 (v7)');
  console.log('  输出 : ' + out);
  console.log('  大小 : ' + Math.round(Buffer.byteLength(html) / 1024) + ' KB');
  console.log('  版块 : ' + secCount + ' 个 / ' + itemCount + ' 条新闻');
  console.log('  图表 : ' + (charts.barChartH ? '已启用（环形 + 条形）' : '未加载'));
}

if (require.main === module) main();

module.exports = { generateHTML };