#!/usr/bin/env node
/**
 * gen-html.js - LumaPost 光影邮报 HTML 邮件生成脚本 v5
 *
 * 参考 PDF 样式重写，包含：
 *   - 渐变头部 + 天气 + 问候
 *   - TOP 3 头条新闻（带 AI 编者按）
 *   - 多版块新闻（星级评分 + 快评 + 深度解读）
 *   - 今日趋势深度解读
 *   - 每日一句
 *   - 专业页脚
 */

const fs = require('fs');
const path = require('path');

// ============ 配置 ============
const CONFIG = {
  dataFile: null,
  outputFile: null,
};

// ============ 解析参数 ============
function parseArgs() {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    let arg = args[i];
    // 支持 --key=value 和 --key value 两种格式
    if (arg.includes('=')) {
      const [key, ...valParts] = arg.split('=');
      arg = key;
      args[i] = valParts.join('=');
      args.splice(i + 1, 0, args[i]);
    }
    if ((arg === '--data-file' || arg === '-d') && args[i + 1]) {
      CONFIG.dataFile = args[++i];
    } else if ((arg === '--output' || arg === '-o') && args[i + 1]) {
      CONFIG.outputFile = args[++i];
    }
  }
  if (!CONFIG.dataFile || !CONFIG.outputFile) {
    console.error('Usage: node gen-html.js --data-file=<json> --output=<html>');
    process.exit(1);
  }
}

// ============ 星级 HTML ============
function generateStars(stars) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += i <= stars
      ? '<span style="color:#fbbf24;font-size:13px;">★</span>'
      : '<span style="color:#d1d5db;font-size:13px;">☆</span>';
  }
  return html;
}

// ============ 版块配色 ============
function getSectionTheme(colorKey) {
  const themes = {
    ai:          { gradient: 'linear-gradient(135deg,#667eea,#764ba2)', accent: '#667eea', icon: '🤖' },
    hardware:    { gradient: 'linear-gradient(135deg,#f093fb,#f5576c)',  accent: '#f5576c', icon: '💻' },
    github:      { gradient: 'linear-gradient(135deg,#4facfe,#00f2fe)', accent: '#4facfe', icon: '🌍' },
    domestic:    { gradient: 'linear-gradient(135deg,#a18cd1,#fbc2eb)', accent: '#a18cd1', icon: '📰' },
    news:        { gradient: 'linear-gradient(135deg,#a18cd1,#fbc2eb)', accent: '#a18cd1', icon: '📰' },
    games:       { gradient: 'linear-gradient(135deg,#43e97b,#38f9d7)', accent: '#43e97b', icon: '🎮' },
    finance:     { gradient: 'linear-gradient(135deg,#30cfd0,#330867)', accent: '#30cfd0', icon: '💰' },
    auto:        { gradient: 'linear-gradient(135deg,#232526,#414345)', accent: '#414345', icon: '🚗' },
    internet:    { gradient: 'linear-gradient(135deg,#11998E,#38EF7D)', accent: '#11998E', icon: '🌐' },
    life:        { gradient: 'linear-gradient(135deg,#F53844,#42378F)', accent: '#F53844', icon: '🎬' },
    space:       { gradient: 'linear-gradient(135deg,#0B0F19,#4062BB)', accent: '#4062BB', icon: '🔬' },
    // 保留旧版 key 兼容
    movie:       { gradient: 'linear-gradient(135deg,#F53844,#42378F)', accent: '#F53844', icon: '🎬' },
    sport:       { gradient: 'linear-gradient(135deg,#FF4B2B,#FF416C)', accent: '#FF4B2B', icon: '⚽' },
    health:      { gradient: 'linear-gradient(135deg,#34E89E,#0F3443)', accent: '#34E89E', icon: '💊' },
    robot:       { gradient: 'linear-gradient(135deg,#8E2DE2,#4A00E0)', accent: '#8E2DE2', icon: '🤖' },
    anime:       { gradient: 'linear-gradient(135deg,#fa709a,#fee140)', accent: '#fa709a', icon: '🎨' },
    mobile:      { gradient: 'linear-gradient(135deg,#a8edea,#fed6e3)', accent: '#a8edea', icon: '📱' },
    international:{ gradient: 'linear-gradient(135deg,#ff9a9e,#fecfef)', accent: '#ff9a9e', icon: '🌍' },
    default:     { gradient: 'linear-gradient(135deg,#667eea,#764ba2)', accent: '#667eea', icon: '📌' },
  };
  return themes[colorKey] || themes.default;
}

// ============ 头部配色（按时段）===========
function getHeaderTheme(greetingType) {
  const themes = {
    morning:   { gradient: 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)', emoji: '🌅' },
    noon:      { gradient: 'linear-gradient(135deg,#f093fb 0%,#f5576c 100%)', emoji: '☀️' },
    afternoon: { gradient: 'linear-gradient(135deg,#4facfe 0%,#00f2fe 100%)', emoji: '🌇' },
    evening:   { gradient: 'linear-gradient(135deg,#0f0c29 0%,#302b63 50%,#24243e 100%)', emoji: '🌙' },
  };
  return themes[greetingType] || themes.morning;
}

// ============ 转义 HTML ============
function esc(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============ 相对时间 ============
function formatRelativeTime(ts) {
  if (!ts) return '';
  const now = new Date();
  const t = new Date(ts);
  if (isNaN(t.getTime())) return esc(ts);
  const diff = Math.max(0, now - t);
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hour = Math.floor(min / 60);
  const day = Math.floor(hour / 24);

  if (sec < 60) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  if (hour < 24) return `${hour} 小时前`;
  if (day < 30) return `${day} 天前`;
  return t.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

// ============ 生成头条卡片 ============
function renderHeadlineItem(item, index) {
  const rank = index + 1;
  const rankColors = ['#ef4444', '#f97316', '#eab308'];
  const rankColor = rankColors[index] || '#6b7280';

  return `
      <div style="background:#fff;border-radius:14px;padding:24px 28px;margin-bottom:14px;border:1px solid #e5e7eb;border-left:4px solid ${rankColor};box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <span style="background:${rankColor};color:#fff;font-size:12px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:0.5px;">⭐ TOP ${rank}</span>
          <span style="font-size:12px;color:#9ca3af;">📌 ${esc(item.source)}</span>
          <span style="font-size:12px;color:#9ca3af;">🕐 ${formatRelativeTime(item.time)}</span>
          ${item.verified ? '<span style="font-size:12px;color:#10b981;">✅ 已核实</span>' : ''}
        </div>
        <h3 style="font-size:17px;font-weight:700;color:#1f2937;margin:0 0 10px;line-height:1.5;">
          <a href="${esc(item.url)}" target="_blank" style="color:#1f2937;text-decoration:none;">${esc(item.title)}</a>
        </h3>
        <p style="font-size:14px;color:#4b5563;line-height:1.7;margin:0 0 14px;">${esc(item.summary)}</p>
        ${item.commentary ? `
        <div style="background:linear-gradient(135deg,#f0f4ff,#fce7f3);border-radius:10px;padding:14px 16px;border-left:3px solid #667eea;">
          <div style="font-size:12px;font-weight:700;color:#667eea;margin-bottom:6px;">🧠 编者按 · AI 编辑解读</div>
          <p style="font-size:13px;color:#374151;line-height:1.7;margin:0;">${esc(item.commentary)}</p>
        </div>` : ''}
        ${item.url ? `<div style="margin-top:10px;"><a href="${esc(item.url)}" target="_blank" style="font-size:13px;color:#667eea;text-decoration:none;">📖 阅读原文 →</a></div>` : ''}
      </div>`;
}

// ============ 生成版块新闻卡片 ============
function renderSectionItem(item, isLast) {
  return `
        <div style="padding:18px 20px;${isLast ? '' : 'border-bottom:2px solid #f0f2f5;'}">
          <!-- 元信息行 -->
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:9px;flex-wrap:wrap;">
            <span style="font-size:12px;letter-spacing:1px;">${generateStars(item.stars || 3)}</span>
            <span style="font-size:11px;color:#9ca3af;">🕐 ${formatRelativeTime(item.time)}</span>
            ${item.verified ? '<span style="background:#d1fae5;color:#065f46;font-size:10px;padding:1px 6px;border-radius:10px;font-weight:600;">✅ 已验证</span>' : ''}
          </div>
          <!-- 标题 -->
          <h4 style="font-size:15px;font-weight:700;color:#111827;margin:0 0 9px;line-height:1.55;">
            <a href="${esc(item.url)}" target="_blank" style="color:#111827;text-decoration:none;">📌 ${esc(item.title)}</a>
          </h4>
          <!-- 摘要 -->
          <p style="font-size:13px;color:#4b5563;line-height:1.7;margin:0 0 9px;padding:10px 14px;background:#f9fafb;border-radius:8px;border-left:3px solid #e5e7eb;">📝 ${esc(item.summary)}</p>
          <!-- AI 解析（主要内容）-->
          ${item.commentary ? `
          <div style="background:linear-gradient(135deg,#f0f4ff,#faf5ff);border-radius:10px;padding:12px 16px;border:1px solid #e0e7ff;margin-bottom:9px;">
            <div style="font-size:11px;font-weight:700;color:#4f46e5;margin-bottom:6px;display:flex;align-items:center;gap:4px;">🧠 AI 深度解析</div>
            <p style="font-size:13px;color:#1e1b4b;line-height:1.75;margin:0;">${esc(item.commentary)}</p>
          </div>` : ''}
          <!-- 快评 -->
          ${item.quicknote ? `<p style="font-size:12px;color:#7c3aed;margin:0 0 8px;font-style:italic;padding-left:4px;">💬 ${esc(item.quicknote)}</p>` : ''}
          <!-- 底部元信息 -->
          <div style="display:flex;align-items:center;gap:12px;padding-top:6px;">
            <span style="font-size:11px;color:#9ca3af;background:#f3f4f6;padding:2px 8px;border-radius:10px;">📡 ${esc(item.source)}</span>
            ${item.url ? `<a href="${esc(item.url)}" target="_blank" style="font-size:11px;color:#667eea;text-decoration:none;font-weight:500;">📖 阅读原文 →</a>` : ''}
          </div>
        </div>`;
}

// ============ 生成趋势解读卡片 ============
function renderSummaryItem(item) {
  return `
      <div style="background:#fff;border-radius:12px;padding:20px 24px;margin-bottom:12px;border:1px solid #e5e7eb;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span style="font-size:20px;">${esc(item.category)}</span>
        </div>
        <div style="font-size:15px;font-weight:700;color:#667eea;margin-bottom:8px;">🎯 ${esc(item.trend)}</div>
        <p style="font-size:13px;color:#4b5563;line-height:1.7;margin:0;">💬 ${esc(item.detail)}</p>
      </div>`;
}

// ============ 主 HTML 生成 ============
function generateHTML(data) {
  const date = data.date || new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  const greeting = data.greeting || '你好！';
  const dailyQuote = data.dailyQuote || '';
  const weather = data.weather || { location: '', text: '', temp: '' };
  const headline = data.headline || [];
  const sections = data.sections || [];
  const summary = data.summary || [];
  const greetingType = data.greetingType || 'morning';
  const headerTheme = getHeaderTheme(greetingType);
  const totalItems = headline.length + sections.reduce((sum, s) => sum + (s.items?.length || 0), 0);
  const timeWindow = data.timeWindow || '过去6小时';

  let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>✨ LumaPost · 光影邮报</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;">
  <div style="max-width:680px;margin:0 auto;background:#f0f2f5;">

    <!-- ========== 头部 ========== -->
    <div style="background:${headerTheme.gradient};padding:40px 30px 30px;text-align:center;color:#fff;border-radius:0 0 0 0;">
      <h1 style="font-size:30px;margin:0 0 6px;font-weight:800;letter-spacing:2px;text-shadow:0 2px 8px rgba(0,0,0,0.15);">
        ${headerTheme.emoji} LumaPost · 光影邮报
      </h1>
      <div style="font-size:13px;opacity:0.85;margin-bottom:16px;letter-spacing:1px;">
        🤖 AI 精选 · 🌍 多源验证 · 📖 深度解读 · 💬 编者按
      </div>
      <div style="font-size:14px;opacity:0.95;margin-bottom:8px;">
        📅 ${esc(date)}　⏱ ${esc(timeWindow)}　📊 ${totalItems} 条精选
      </div>
      ${weather.location ? `<div style="font-size:14px;opacity:0.95;">📍 ${esc(weather.location)} ${esc(weather.text)} ${esc(weather.temp)}</div>` : ''}
      <div style="font-size:18px;font-weight:300;margin-top:16px;opacity:0.95;">${esc(greeting)}</div>
    </div>

    <!-- ========== ⚡ TL;DR 一句话速览 ========== -->
    ${data.tldr ? `
    <div style="padding:12px 20px 4px;">
      <div style="background:linear-gradient(135deg,#FFD700,#FFA500);border-radius:12px;padding:14px 20px;text-align:center;">
        <span style="font-size:18px;margin-right:6px;">⚡</span>
        <span style="font-size:14px;font-weight:700;color:#7C2D12;">${esc(data.tldr)}</span>
      </div>
    </div>` : ''}

    <!-- ========== 📈 市场数据 ========== -->
    ${data.stocks ? `
    <div style="padding:8px 20px 4px;">
      <div style="background:#1a1a2e;border-radius:12px;padding:12px 18px;display:flex;flex-wrap:wrap;justify-content:space-around;gap:8px;">
        ${(data.stocks||[]).map(s => `
        <div style="text-align:center;min-width:60px;">
          <div style="font-size:11px;color:#9ca3af;">${esc(s.name || '')}</div>
          <div style="font-size:15px;font-weight:700;color:${parseFloat(s.change||'0')>=0?'#ef4444':'#10b981'};">${esc(s.price || '')}</div>
          <div style="font-size:11px;color:${parseFloat(s.change||'0')>=0?'#ef4444':'#10b981'};">${parseFloat(s.change||'0')>=0?'📈':'📉'} ${esc(s.pct || '')}</div>
        </div>`).join('')}
      </div>
    </div>` : ''}

    <!-- ========== 📋 目录导航（紧凑双列）========== -->
    <div style="padding:16px 20px 6px;">
      <div style="background:#fff;border-radius:14px;padding:16px 20px;border:1px solid #e5e7eb;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
        <div style="font-size:13px;font-weight:700;color:#1f2937;margin-bottom:10px;display:flex;align-items:center;gap:6px;">
          📋 <span>本期内容目录</span>
          <span style="margin-left:auto;font-size:11px;color:#9ca3af;font-weight:400;">${totalItems} 条精选</span>
        </div>
        <!-- 固定入口行：头条 + 趋势 -->
        <div style="display:flex;gap:8px;margin-bottom:8px;">
          ${headline.length > 0 ? `<a href="#top-headlines" style="flex:1;display:flex;align-items:center;gap:5px;padding:7px 10px;background:#fff7ed;border-radius:8px;border:1px solid #fed7aa;text-decoration:none;">
            <span style="font-size:13px;">🔥</span>
            <span style="font-size:12px;color:#ea580c;font-weight:600;">今日头条</span>
            <span style="margin-left:auto;font-size:11px;color:#9ca3af;">${headline.length}条</span>
          </a>` : ''}
          ${summary.length > 0 ? `<a href="#trend-summary" style="flex:1;display:flex;align-items:center;gap:5px;padding:7px 10px;background:#eff6ff;border-radius:8px;border:1px solid #bfdbfe;text-decoration:none;">
            <span style="font-size:13px;">📈</span>
            <span style="font-size:12px;color:#2563eb;font-weight:600;">趋势解读</span>
            <span style="margin-left:auto;font-size:11px;color:#9ca3af;">${summary.length}条</span>
          </a>` : ''}
        </div>
        <!-- 版块双列网格 -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
          ${sections.map(s => {
            const theme = getSectionTheme(s.colorKey);
            const cnt = (s.items||[]).length;
            return `<a href="#section-${s.colorKey}" style="display:flex;align-items:center;gap:5px;padding:6px 9px;background:#f9fafb;border-radius:7px;border:1px solid #f3f4f6;text-decoration:none;min-width:0;">
              <span style="font-size:12px;flex-shrink:0;">${theme.icon}</span>
              <span style="font-size:11px;color:#374151;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(s.name.replace(/^[^\s]*\s/,''))}</span>
              <span style="margin-left:auto;font-size:10px;color:#9ca3af;flex-shrink:0;">${cnt}条</span>
            </a>`;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- ========== 今日头条 ========== -->
    ${headline.length > 0 ? `
    <div style="padding:24px 20px 10px;" id="top-headlines">
      <div style="background:linear-gradient(135deg,#1f2937,#374151);border-radius:16px;padding:24px 28px;color:#fff;">
        <h2 style="font-size:22px;margin:0 0 4px;font-weight:700;">🔥 今日头条</h2>
        <p style="font-size:13px;opacity:0.7;margin:0 0 20px;">⚡ 今日最重要的 ${headline.length} 条新闻，不容错过</p>
        ${headline.map((item, i) => renderHeadlineItem(item, i)).join('')}
        <div style="text-align:center;font-size:12px;color:#9ca3af;margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.1);">
          💡 头条新闻由 AI 编辑综合多源信息评定重要度后精选
        </div>
      </div>
    </div>` : ''}

    <!-- ========== 版块内容 ========== -->
    ${sections.map(section => {
      const theme = getSectionTheme(section.colorKey);
      const itemCount = section.items ? section.items.length : 0;
      return `
    <div style="padding:16px 20px 8px;" id="section-${section.colorKey}">
      <div style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <div style="background:${theme.gradient};padding:16px 24px;color:#fff;">
          <h2 style="font-size:18px;margin:0;font-weight:700;">${esc(section.name)}</h2>
          <span style="font-size:12px;opacity:0.85;">📋 ${itemCount} 条精选</span>
        </div>
        <div style="padding:0 0 4px;">
          ${section.items ? section.items.map((item, idx, arr) => renderSectionItem(item, idx === arr.length - 1)).join('') : '<p style="color:#9ca3af;text-align:center;padding:20px;">暂无内容</p>'}
        </div>
      </div>
    </div>`;
    }).join('')}

    <!-- ========== 趋势解读 ========== -->
    ${summary.length > 0 ? `
    <div style="padding:16px 20px 8px;" id="trend-summary">
      <div style="background:linear-gradient(135deg,#1e3a8a,#1e40af);border-radius:16px;padding:24px 28px;color:#fff;">
        <h2 style="font-size:22px;margin:0 0 4px;font-weight:700;">📈 今日趋势深度解读</h2>
        <p style="font-size:13px;opacity:0.7;margin:0 0 20px;">🎯 一句话看懂各领域走向</p>
        ${summary.map(item => renderSummaryItem(item)).join('')}
      </div>
    </div>` : ''}

    <!-- ========== 每日一句 ========== -->
    ${dailyQuote ? `
    <div style="padding:16px 20px 8px;" id="daily-quote">
      <div style="background:linear-gradient(135deg,#fef3c7,#fde68a);border-radius:14px;padding:24px 28px;text-align:center;">
        <div style="font-size:13px;color:#92400e;margin-bottom:8px;">💬 每日一句</div>
        <p style="font-size:16px;color:#78350f;font-style:italic;margin:0;line-height:1.7;">"${esc(dailyQuote)}"</p>
      </div>
    </div>` : ''}

    <!-- ========== 页脚 ========== -->
    <div style="padding:16px 20px 32px;">
      <div style="background:#1f2937;border-radius:14px;padding:24px 28px;color:#9ca3af;text-align:center;">
        <div style="font-size:24px;margin-bottom:10px;">📰✨📧</div>
        <p style="font-size:13px;margin:0 0 6px;">🤖 本邮报由 AI 自动搜集整理 · 关键事实已标注核实状态</p>
        <p style="font-size:13px;margin:0 0 6px;">🧠 编者按为 AI 编辑深度解读，仅供参考分析 · 📖 原文链接请点击标题或「阅读原文」核实</p>
        <p style="font-size:13px;margin:0 0 12px;">❤ 感谢你的订阅 · 订阅正常运行中 ✅</p>
        <div style="padding-top:12px;border-top:1px solid #374151;">
          <p style="font-size:12px;margin:0 0 4px;">📅 下次发送：06:00 / 12:00 / 16:00 / 24:00（每日 4 次）</p>
          <p style="font-size:12px;margin:0;color:#667eea;">POWERED BY LumaPost · 光影邮报 v5</p>
        </div>
      </div>
    </div>

  </div>
</body>
</html>`;

  return html;
}

// ============ 主函数 ============
function main() {
  parseArgs();
  console.log('🚀 生成 HTML 邮件...');
  console.log(`📂 输入: ${CONFIG.dataFile}`);

  const raw = fs.readFileSync(CONFIG.dataFile, 'utf8');
  const data = JSON.parse(raw);

  const html = generateHTML(data);

  const outputDir = path.dirname(CONFIG.outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(CONFIG.outputFile, html, 'utf8');
  console.log(`✅ HTML 已生成: ${CONFIG.outputFile}`);
  console.log(`📊 大小: ${(fs.statSync(CONFIG.outputFile).size / 1024).toFixed(2)} KB`);
  console.log(`📰 头条: ${data.headline?.length || 0} | 版块: ${data.sections?.length || 0} | 趋势: ${data.summary?.length || 0}`);
}

main();
