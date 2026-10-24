#!/usr/bin/env node
/**
 * gen-html.js — LumaPost 光影邮报 HTML 邮件生成器 v6.0
 *
 * 设计理念：
 *   - 杂志式排版：大标题 + 分栏留白 + 强层次
 *   - 深色渐变头 + 浅色正文，对比清晰
 *   - 卡片化版块，每卡独立视觉单元
 *   - 全内联样式 + table 布局，兼容 QQ / Outlook / Gmail
 */
const fs = require('fs');
const path = require('path');

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

const THEMES = {
  ai:       { accent: '#6366F1' },
  hardware: { accent: '#0EA5E9' },
  github:   { accent: '#10B981' },
  news:     { accent: '#F59E0B' },
  games:    { accent: '#EC4899' },
  finance:  { accent: '#14B8A6' },
  auto:     { accent: '#8B5CF6' },
  internet: { accent: '#3B82F6' },
  life:     { accent: '#F97316' },
  space:    { accent: '#06B6D4' },
};

function themeOf(key) {
  return THEMES[key] || { accent: T.brand1 };
}

function esc(s) {
  const Q = String.fromCharCode(34);
  const AMP = String.fromCharCode(38);
  const QUOT = AMP + 'quot;';
  return String(s == null ? '' : s)
    .replace(new RegExp(AMP, 'g'), AMP + 'amp;')
    .replace(/</g, AMP + 'lt;')
    .replace(/>/g, AMP + 'gt;')
    .replace(new RegExp(Q, 'g'), QUOT);
}

function stripEmoji(s) {
  return String(s || '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, '').trim();
}

function cls(text, n) {
  const s = stripEmoji(text);
  return s.length > n ? s.slice(0, n) + '…' : s;
}

/* ============ 组件 ============ */

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
  const count = (data.headline || []).length +
    (data.sections || []).reduce((s, x) => s + (x.items || []).length, 0);

  return `
  <tr><td style="padding:0 12px;background:${T.bg};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:616px;margin:0 auto;">
      <tr><td style="background:linear-gradient(135deg,${T.brand1} 0%,${T.brand2} 55%,${T.brand3} 100%);border-radius:22px;padding:34px 30px 26px;">
        <div style="font-family:${T.font};font-size:10px;font-weight:700;color:rgba(255,255,255,.72);letter-spacing:3px;margin-bottom:14px;">
          DAILY DIGEST
        </div>
        <div style="font-family:${T.font};font-size:30px;font-weight:800;color:#FFFFFF;line-height:1.22;letter-spacing:-.8px;margin-bottom:12px;">
          ${esc(stripEmoji(data.greeting || '你好'))}
        </div>
        <div style="font-family:${T.font};font-size:13px;color:rgba(255,255,255,.85);line-height:1.7;margin-bottom:22px;">
          ${esc(w.location || '')}${w.location && (w.text || w.temp) ? ' · ' : ''}${esc(w.text || '')}${w.temp ? ' ' + esc(w.temp) : ''}
        </div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding-right:26px;">
              <div style="font-family:${T.font};font-size:22px;font-weight:800;color:#FFFFFF;line-height:1;">${count}</div>
              <div style="font-family:${T.font};font-size:10px;color:rgba(255,255,255,.72);letter-spacing:1px;margin-top:5px;">条精选</div>
            </td>
            <td style="padding:0 26px;border-left:1px solid rgba(255,255,255,.24);">
              <div style="font-family:${T.font};font-size:22px;font-weight:800;color:#FFFFFF;line-height:1;">${(data.sections || []).length}</div>
              <div style="font-family:${T.font};font-size:10px;color:rgba(255,255,255,.72);letter-spacing:1px;margin-top:5px;">个版块</div>
            </td>
            <td style="border-left:1px solid rgba(255,255,255,.24);padding-left:26px;">
              <div style="font-family:${T.font};font-size:22px;font-weight:800;color:#FFFFFF;line-height:1;">${(data.stocks || []).length}</div>
              <div style="font-family:${T.font};font-size:10px;color:rgba(255,255,255,.72);letter-spacing:1px;margin-top:5px;">行情</div>
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
  <tr><td style="padding:12px 12px 0;background:${T.bg};">
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

function stocksBar(data) {
  const list = (data.stocks || []).slice(0, 3);
  if (!list.length) return '';

  const cells = list.map((s) => {
    const up = (s.change || s.pct || 0) >= 0;
    const color = up ? T.up : T.down;
    const arrow = up ? '▲' : '▼';
    return `
      <td align="center" style="padding:16px 8px;">
        <div style="font-family:${T.font};font-size:11px;color:rgba(255,255,255,.68);margin-bottom:7px;">${esc(s.name || '')}</div>
        <div style="font-family:${T.mono};font-size:16px;font-weight:700;color:#FFFFFF;line-height:1;margin-bottom:6px;">
          ${typeof s.current === 'number' ? s.current.toFixed(2) : esc(s.current || '')}
        </div>
        <div style="font-family:${T.mono};font-size:11px;font-weight:700;color:${color};">
          ${arrow} ${s.pct != null ? (s.pct >= 0 ? '+' : '') + Number(s.pct).toFixed(2) + '%' : ''}
        </div>
      </td>`;
  }).join('');

  return `
  <tr><td style="padding:12px 12px 0;background:${T.bg};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:616px;margin:0 auto;">
      <tr><td style="background:${T.ink};border-radius:16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>${cells}</tr>
        </table>
      </td></tr>
    </table>
  </td></tr>`;
}

function toc(data) {
  const sections = data.sections || [];
  if (!sections.length) return '';

  const rows = [];
  for (let i = 0; i < sections.length; i += 2) {
    const a = sections[i];
    const b = sections[i + 1];
    const cell = (s) => {
      if (!s) return '<td width="50%" style="padding:5px;"></td>';
      const th = themeOf(s.key);
      return `
      <td width="50%" style="padding:5px;">
        <a href="#sec-${esc(s.key)}" style="display:block;text-decoration:none;background:${T.white};border:1px solid ${T.line};border-radius:12px;padding:13px 15px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-family:${T.font};font-size:12.5px;font-weight:700;color:${T.ink};">
                <span style="display:inline-block;width:6px;height:6px;border-radius:3px;background:${th.accent};margin-right:8px;vertical-align:middle;"></span>${esc(cls(s.name, 12))}
              </td>
              <td align="right" style="font-family:${T.mono};font-size:11px;font-weight:700;color:${th.accent};white-space:nowrap;">
                ${(s.items || []).length}
              </td>
            </tr>
          </table>
        </a>
      </td>`;
    };
    rows.push('<tr>' + cell(a) + cell(b) + '</tr>');
  }

  return `
  <tr><td style="padding:12px 12px 0;background:${T.bg};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:616px;margin:0 auto;">
      <tr><td style="background:${T.white};border:1px solid ${T.line};border-radius:18px;padding:20px;">
        <div style="font-family:${T.font};font-size:13px;font-weight:800;color:${T.ink};margin-bottom:14px;">
          本期目录
          <span style="font-size:11px;font-weight:600;color:${T.ink4};margin-left:6px;">${sections.length} 个版块</span>
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:-5px;">
          ${rows.join('')}
        </table>
      </td></tr>
    </table>
  </td></tr>`;
}

function sectionTitle(title, sub, accent) {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
    <tr>
      <td style="width:4px;background:${accent};border-radius:2px;"></td>
      <td style="padding-left:12px;">
        <div style="font-family:${T.font};font-size:17px;font-weight:800;color:${T.ink};letter-spacing:-.3px;line-height:1.3;">
          ${esc(title)}
        </div>
        ${sub ? `<div style="font-family:${T.font};font-size:11.5px;color:${T.ink4};margin-top:4px;">${esc(sub)}</div>` : ''}
      </td>
    </tr>
  </table>`;
}

function headlineCard(item, index) {
  const rank = String(index + 1).padStart(2, '0');
  const link = item.url ? `href="${esc(item.url)}"` : '';
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;">
    <tr><td style="background:${T.white};border:1px solid ${T.line};border-radius:16px;padding:20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="44" valign="top" style="font-family:${T.mono};font-size:26px;font-weight:800;color:${T.brand1};line-height:1;letter-spacing:-1px;">
            ${rank}
          </td>
          <td valign="top">
            <a ${link} style="font-family:${T.font};font-size:16px;font-weight:800;color:${T.ink};line-height:1.5;text-decoration:none;display:block;margin-bottom:9px;">
              ${esc(item.title || '')}
            </a>
            <div style="font-family:${T.font};font-size:13px;color:${T.ink2};line-height:1.8;">
              ${esc(cls(item.summary, 200))}
            </div>
          </td>
        </tr>
      </table>
      ${item.commentary ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;">
        <tr><td style="background:${T.bg};border-radius:11px;padding:14px 16px;">
          <div style="font-family:${T.font};font-size:10px;font-weight:800;color:${T.brand1};letter-spacing:1.5px;margin-bottom:7px;">
            编者按
          </div>
          <div style="font-family:${T.font};font-size:12.5px;color:${T.ink2};line-height:1.8;">
            ${esc(cls(item.commentary, 260))}
          </div>
        </td></tr>
      </table>` : ''}
      <div style="font-family:${T.font};font-size:10.5px;color:${T.ink4};margin-top:12px;">
        ${esc(item.source || '综合')}${item.verified ? ' · 已核实' : ''}
      </div>
    </td></tr>
  </table>`;
}

function newsItem(item, accent) {
  const link = item.url ? `href="${esc(item.url)}"` : '';
  const stars = item.stars ? '★'.repeat(Math.min(5, item.stars)) : '';
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;">
    <tr><td style="background:${T.white};border:1px solid ${T.line};border-radius:14px;padding:17px 18px;">
      <a ${link} style="font-family:${T.font};font-size:14.5px;font-weight:700;color:${T.ink};line-height:1.55;text-decoration:none;display:block;margin-bottom:7px;">
        ${esc(item.title || '')}
      </a>
      <div style="font-family:${T.font};font-size:12.5px;color:${T.ink3};line-height:1.75;margin-bottom:${item.quicknote ? '10px' : '9px'};">
        ${esc(cls(item.summary, 150))}
      </div>
      ${item.quicknote ? `
      <div style="font-family:${T.font};font-size:12px;color:${accent};background:${T.bg};border-radius:9px;padding:9px 12px;line-height:1.65;margin-bottom:9px;">
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

function sectionBlock(sec) {
  const th = themeOf(sec.key);
  const items = sec.items || [];
  if (!items.length) return '';
  return `
  <tr><td id="sec-${esc(sec.key)}" style="padding:22px 12px 0;background:${T.bg};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:616px;margin:0 auto;">
      <tr><td>
        ${sectionTitle(stripEmoji(sec.name), items.length + ' 条更新', th.accent)}
        ${items.map((it) => newsItem(it, th.accent)).join('')}
      </td></tr>
    </table>
  </td></tr>`;
}

function trendsBlock(data) {
  const list = data.summary || [];
  if (!list.length) return '';

  const rows = list.slice(0, 5).map((s) => `
    <tr><td style="padding:15px 0;border-bottom:1px solid ${T.line};">
      <div style="font-family:${T.font};font-size:10.5px;font-weight:800;color:${T.brand1};margin-bottom:7px;">
        ${esc(stripEmoji(s.category || ''))}
      </div>
      <div style="font-family:${T.font};font-size:14px;font-weight:700;color:${T.ink};line-height:1.6;margin-bottom:8px;">
        ${esc(s.trend || '')}
      </div>
      <div style="font-family:${T.font};font-size:12.5px;color:${T.ink2};line-height:1.8;">
        ${esc(cls(s.detail, 220))}
      </div>
    </td></tr>`).join('');

  return `
  <tr><td style="padding:22px 12px 0;background:${T.bg};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:616px;margin:0 auto;">
      <tr><td style="background:${T.white};border:1px solid ${T.line};border-radius:18px;padding:22px;">
        ${sectionTitle('趋势解读', '跨版块的深层信号', T.brand2)}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${rows}
        </table>
      </td></tr>
    </table>
  </td></tr>`;
}

function quoteBlock(data) {
  if (!data.dailyQuote) return '';
  return `
  <tr><td style="padding:22px 12px 0;background:${T.bg};">
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
  <tr><td style="padding:28px 12px 34px;background:${T.bg};">
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

function generateHTML(data) {
  const heads = (data.headline || []).slice(0, 3);
  const secs = data.sections || [];

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
      ${stocksBar(data)}
      ${toc(data)}
      ${heads.length ? `
      <tr><td style="padding:26px 12px 0;background:${T.bg};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:616px;margin:0 auto;">
          <tr><td>
            ${sectionTitle('今日头条', '最重要的 ' + heads.length + ' 件事', T.brand1)}
            ${heads.map((h, i) => headlineCard(h, i)).join('')}
          </td></tr>
        </table>
      </td></tr>` : ''}
      ${trendsBlock(data)}
      ${secs.map(sectionBlock).join('')}
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

  const headCount = (data.headline || []).length;
  const secCount = (data.sections || []).length;
  const itemCount = (data.sections || []).reduce((s, x) => s + (x.items || []).length, 0);

  console.log('LumaPost 邮件生成完成');
  console.log('  输出 : ' + out);
  console.log('  大小 : ' + Math.round(Buffer.byteLength(html) / 1024) + ' KB');
  console.log('  头条 : ' + headCount + ' 条');
  console.log('  版块 : ' + secCount + ' 个 / ' + itemCount + ' 条新闻');
}

if (require.main === module) main();

module.exports = { generateHTML };