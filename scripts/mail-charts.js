#!/usr/bin/env node
/**
 * mail-charts.js — 邮件 SVG 图表库 (v6.1)
 *
 * 纯 SVG / 零依赖 / 内联到邮件。
 * 不使用 <style> 与 class（邮件客户端会剥离），全部用属性内联。
 * 动效使用 SMIL <animate>，QQ / Apple Mail 支持，Outlook 降级为静态。
 */

const T = {
  brand1: '#6366F1', brand2: '#8B5CF6', brand3: '#A855F7',
  ink: '#0F172A', ink2: '#334155', ink3: '#64748B', ink4: '#94A3B8',
  line: '#E8ECF3', white: '#FFFFFF',
};

function esc(s) {
  const AMP = String.fromCharCode(38);
  const Q = String.fromCharCode(34);
  return String(s == null ? '' : s)
    .replace(new RegExp(AMP, 'g'), AMP + 'amp;')
    .replace(/</g, AMP + 'lt;')
    .replace(/>/g, AMP + 'gt;')
    .replace(new RegExp(Q, 'g'), AMP + 'quot;');
}

/* ============================================================
   1. 环形进度环 —— 版块占比
   ============================================================ */
function donutChart(data, opts) {
  opts = opts || {};
  const size = opts.size || 180;
  const stroke = opts.stroke || 18;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;

  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const colors = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#3B82F6', '#F97316'];

  let offset = 0;
  const rings = data.map((d, i) => {
    const frac = d.value / total;
    const len = frac * C;
    const color = d.color || colors[i % colors.length];
    const seg = `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
        stroke="${color}" stroke-width="${stroke}"
        stroke-dasharray="0 ${C}" stroke-linecap="round"
        transform="rotate(-90 ${cx} ${cy})"
        style="opacity:0">
        <animate attributeName="stroke-dasharray"
          from="0 ${C.toFixed(1)}" to="${len.toFixed(1)} ${(C - len).toFixed(1)}"
          dur="0.9s" begin="${(i * 0.12).toFixed(2)}s" fill="freeze"
          calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1"/>
        <animate attributeName="style"
          from="opacity:0" to="opacity:1"
          dur="0.3s" begin="${(i * 0.12).toFixed(2)}s" fill="freeze"/>
      </circle>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
        stroke="${color}" stroke-width="${stroke}"
        stroke-dasharray="${len.toFixed(1)} ${(C - len).toFixed(1)}"
        stroke-dashoffset="${(-offset).toFixed(1)}"
        stroke-linecap="butt"
        transform="rotate(-90 ${cx} ${cy})"
        opacity="0"/>
    `;
    offset += len;
    return seg;
  }).join('');

  const top = data[0] || { label: '', value: 0 };

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;">
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${T.line}" stroke-width="${stroke}"/>
  ${rings}
  <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-family="-apple-system,PingFang SC,sans-serif" font-size="26" font-weight="800" fill="${T.ink}">
    ${esc(total)}
    <animate attributeName="opacity" from="0" to="1" dur="0.5s" begin="0.4s" fill="freeze"/>
  </text>
  <text x="${cx}" y="${cy + 18}" text-anchor="middle" font-family="-apple-system,PingFang SC,sans-serif" font-size="11" fill="${T.ink4}">
    ${esc(opts.label || '条资讯')}
  </text>
</svg>`;
}

/* ============================================================
   2. 横向条形图 —— 版块数量对比
   ============================================================ */
function barChartH(data, opts) {
  opts = opts || {};
  const width = opts.width || 560;
  const rowH = 34;
  const labelW = opts.labelW || 110;
  const valueW = 42;
  const height = data.length * rowH + 8;
  const barMax = width - labelW - valueW - 12;
  const maxV = Math.max.apply(null, data.map((d) => d.value).concat([1]));

  const rows = data.map((d, i) => {
    const y = i * rowH + 4;
    const w = Math.max(6, (d.value / maxV) * barMax);
    const color = d.color || T.brand1;
    const gid = 'hb' + i + '_' + Math.floor(Math.random() * 1e6);
    return `
    <defs>
      <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.65"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="1"/>
      </linearGradient>
    </defs>
    <g>
      <text x="0" y="${y + 15}" font-family="-apple-system,PingFang SC,sans-serif" font-size="12" font-weight="600" fill="${T.ink2}">${esc(d.label)}</text>
      <rect x="${labelW}" y="${y + 5}" width="${barMax}" height="9" rx="4.5" fill="${T.line}"/>
      <rect x="${labelW}" y="${y + 5}" width="0" height="9" rx="4.5" fill="url(#${gid})">
        <animate attributeName="width" from="0" to="${w.toFixed(1)}"
          dur="0.7s" begin="${(i * 0.08).toFixed(2)}s" fill="freeze"
          calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1"/>
      </rect>
      <text x="${width}" y="${y + 15}" text-anchor="end" font-family="ui-monospace,Menlo,monospace" font-size="12" font-weight="700" fill="${color}" opacity="0">
        ${d.value}
        <animate attributeName="opacity" from="0" to="1" dur="0.4s" begin="${(i * 0.08 + 0.4).toFixed(2)}s" fill="freeze"/>
      </text>
    </g>`;
  }).join('');

  return `<svg width="100%" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:auto;max-width:${width}px;">
  ${rows}
</svg>`;
}

/* ============================================================
   3. 竖向柱状图 —— 趋势/时间分布
   ============================================================ */
function barChartV(data, opts) {
  opts = opts || {};
  const width = opts.width || 560;
  const height = opts.height || 200;
  const padL = 34;
  const padB = 34;
  const padT = 22;
  const chartH = height - padB - padT;
  const chartW = width - padL - 12;
  const n = data.length || 1;
  const slot = chartW / n;
  const barW = Math.min(42, slot * 0.52);
  const maxV = Math.max.apply(null, data.map((d) => d.value).concat([1]));

  // 网格线
  let grid = '';
  for (let i = 0; i <= 4; i++) {
    const y = padT + (chartH / 4) * i;
    const v = Math.round(maxV * (4 - i) / 4);
    grid += `<line x1="${padL}" y1="${y}" x2="${width - 12}" y2="${y}" stroke="${T.line}" stroke-width="1"/>`;
    grid += `<text x="${padL - 8}" y="${y + 4}" text-anchor="end" font-family="ui-monospace,Menlo,monospace" font-size="10" fill="${T.ink4}">${v}</text>`;
  }

  const bars = data.map((d, i) => {
    const h = Math.max(3, (d.value / maxV) * chartH);
    const x = padL + slot * i + (slot - barW) / 2;
    const y = padT + chartH - h;
    const color = d.color || T.brand1;
    const gid = 'g' + i + '_' + Math.floor(Math.random() * 1e6);
    return `
    <defs>
      <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="1"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0.55"/>
      </linearGradient>
    </defs>
    <rect x="${x}" y="${padT + chartH}" width="${barW}" height="0" rx="6" fill="url(#${gid})">
      <animate attributeName="y" from="${padT + chartH}" to="${y.toFixed(1)}"
        dur="0.75s" begin="${(i * 0.07).toFixed(2)}s" fill="freeze"
        calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1"/>
      <animate attributeName="height" from="0" to="${h.toFixed(1)}"
        dur="0.75s" begin="${(i * 0.07).toFixed(2)}s" fill="freeze"
        calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1"/>
    </rect>
    <text x="${(x + barW / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle"
      font-family="ui-monospace,Menlo,monospace" font-size="11" font-weight="700" fill="${T.ink}" opacity="0">
      ${d.value}
      <animate attributeName="opacity" from="0" to="1" dur="0.4s" begin="${(i * 0.07 + 0.5).toFixed(2)}s" fill="freeze"/>
    </text>
    <text x="${(x + barW / 2).toFixed(1)}" y="${height - 12}" text-anchor="middle"
      font-family="-apple-system,PingFang SC,sans-serif" font-size="10.5" fill="${T.ink3}">
      ${esc(d.label)}
    </text>`;
  }).join('');

  return `<svg width="100%" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:auto;max-width:${width}px;">
  ${grid}
  ${bars}
</svg>`;
}

/* ============================================================
   4. 折线面积图 —— 趋势走势
   ============================================================ */
function areaChart(data, opts) {
  opts = opts || {};
  const width = opts.width || 560;
  const height = opts.height || 180;
  const padL = 34;
  const padB = 30;
  const padT = 20;
  const chartH = height - padB - padT;
  const chartW = width - padL - 14;
  const n = data.length;
  if (!n) return '';

  const vals = data.map((d) => d.value);
  const maxV = Math.max.apply(null, vals.concat([1]));
  const minV = Math.min.apply(null, vals.concat([0]));
  const span = (maxV - minV) || 1;
  const stepX = n > 1 ? chartW / (n - 1) : 0;

  const pts = data.map((d, i) => {
    const x = padL + stepX * i;
    const y = padT + chartH - ((d.value - minV) / span) * chartH;
    return { x: x, y: y, label: d.label, value: d.value };
  });

  // 平滑曲线
  let path = 'M ' + pts[0].x.toFixed(1) + ' ' + pts[0].y.toFixed(1);
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const cx1 = p0.x + (p1.x - p0.x) / 3;
    const cx2 = p0.x + (p1.x - p0.x) * 2 / 3;
    path += ' C ' + cx1.toFixed(1) + ' ' + p0.y.toFixed(1) + ', ' +
            cx2.toFixed(1) + ' ' + p1.y.toFixed(1) + ', ' +
            p1.x.toFixed(1) + ' ' + p1.y.toFixed(1);
  }

  const areaPath = path + ' L ' + pts[pts.length - 1].x.toFixed(1) + ' ' + (padT + chartH) +
    ' L ' + pts[0].x.toFixed(1) + ' ' + (padT + chartH) + ' Z';

  const dots = pts.map((p, i) => `
    <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="0" fill="${T.white}" stroke="${T.brand1}" stroke-width="2.5">
      <animate attributeName="r" from="0" to="4" dur="0.3s" begin="${(i * 0.1 + 0.6).toFixed(2)}s" fill="freeze"/>
    </circle>
    <text x="${p.x.toFixed(1)}" y="${height - 10}" text-anchor="middle"
      font-family="-apple-system,PingFang SC,sans-serif" font-size="10" fill="${T.ink4}">${esc(p.label)}</text>
  `).join('');

  const grid = [0, 1, 2, 3].map((i) => {
    const y = padT + (chartH / 3) * i;
    return `<line x1="${padL}" y1="${y}" x2="${width - 14}" y2="${y}" stroke="${T.line}" stroke-width="1" stroke-dasharray="3 4"/>`;
  }).join('');

  const gid = 'area' + Math.floor(Math.random() * 1e6);

  return `<svg width="100%" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:auto;max-width:${width}px;">
  <defs>
    <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${T.brand1}" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="${T.brand1}" stop-opacity="0.02"/>
    </linearGradient>
  </defs>
  ${grid}
  <path d="${areaPath}" fill="url(#${gid})" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.6s" begin="0.35s" fill="freeze"/>
  </path>
  <path d="${path}" fill="none" stroke="${T.brand1}" stroke-width="2.5" stroke-linecap="round"
    stroke-dasharray="2000" stroke-dashoffset="2000">
    <animate attributeName="stroke-dashoffset" from="2000" to="0" dur="1.2s" begin="0.1s" fill="freeze"
      calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1"/>
  </path>
  ${dots}
</svg>`;
}

/* ============================================================
   5. 雷达图 —— 版块覆盖度
   ============================================================ */
function radarChart(data, opts) {
  opts = opts || {};
  const size = opts.size || 260;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 44;
  const n = data.length;
  if (n < 3) return '';

  const maxV = Math.max.apply(null, data.map((d) => d.value).concat([1]));

  const angleOf = (i) => (Math.PI * 2 * i / n) - Math.PI / 2;

  // 网格
  let rings = '';
  [0.25, 0.5, 0.75, 1].forEach((f) => {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = angleOf(i);
      pts.push((cx + Math.cos(a) * r * f).toFixed(1) + ',' + (cy + Math.sin(a) * r * f).toFixed(1));
    }
    rings += `<polygon points="${pts.join(' ')}" fill="none" stroke="${T.line}" stroke-width="1"/>`;
  });

  // 轴线
  let axes = '';
  for (let i = 0; i < n; i++) {
    const a = angleOf(i);
    axes += `<line x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(a) * r).toFixed(1)}" y2="${(cy + Math.sin(a) * r).toFixed(1)}" stroke="${T.line}" stroke-width="1"/>`;
  }

  // 数据多边形
  const dataPts = data.map((d, i) => {
    const a = angleOf(i);
    const f = Math.max(0.08, d.value / maxV);
    return (cx + Math.cos(a) * r * f).toFixed(1) + ',' + (cy + Math.sin(a) * r * f).toFixed(1);
  }).join(' ');

  // 标签
  const labels = data.map((d, i) => {
    const a = angleOf(i);
    const lx = cx + Math.cos(a) * (r + 20);
    const ly = cy + Math.sin(a) * (r + 20);
    const anchor = Math.abs(Math.cos(a)) < 0.3 ? 'middle' : (Math.cos(a) > 0 ? 'start' : 'end');
    return `<text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="${anchor}"
      font-family="-apple-system,PingFang SC,sans-serif" font-size="10.5" font-weight="600" fill="${T.ink3}">${esc(d.label)}</text>`;
  }).join('');

  const gid = 'radar' + Math.floor(Math.random() * 1e6);

  return `<svg width="100%" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:auto;max-width:${size}px;margin:0 auto;">
  <defs>
    <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${T.brand1}" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="${T.brand3}" stop-opacity="0.18"/>
    </linearGradient>
  </defs>
  ${rings}
  ${axes}
  <polygon points="${dataPts}" fill="url(#${gid})" stroke="${T.brand2}" stroke-width="2" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.8s" begin="0.2s" fill="freeze"/>
  </polygon>
  ${labels}
</svg>`;
}

/* ============================================================
   6. 环形进度（多环）—— 数据概览
   ============================================================ */
function progressRings(items, opts) {
  opts = opts || {};
  const size = opts.size || 88;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;

  const rings = items.map((it, i) => {
    const len = Math.min(1, it.ratio || 0) * C;
    const color = it.color || T.brand1;
    return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${T.line}" stroke-width="${stroke}"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
      stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"
      stroke-dasharray="0 ${C.toFixed(1)}">
      <animate attributeName="stroke-dasharray"
        from="0 ${C.toFixed(1)}" to="${len.toFixed(1)} ${(C - len).toFixed(1)}"
        dur="0.9s" begin="${(i * 0.1).toFixed(2)}s" fill="freeze"
        calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1"/>
    </circle>
    <text x="${cx}" y="${cy + 5}" text-anchor="middle"
      font-family="ui-monospace,Menlo,monospace" font-size="15" font-weight="800" fill="${T.ink}">
      ${it.display != null ? esc(it.display) : Math.round((it.ratio || 0) * 100)}
    </text>`;
  }).join('');

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;">
  ${rings}
</svg>`;
}

/* ============================================================
   7. 迷你走势线 —— 单条数据 sparkline
   ============================================================ */
function sparkline(values, opts) {
  opts = opts || {};
  const width = opts.width || 120;
  const height = opts.height || 34;
  const color = opts.color || T.brand1;
  if (!values || values.length < 2) return '';

  const maxV = Math.max.apply(null, values);
  const minV = Math.min.apply(null, values);
  const span = (maxV - minV) || 1;
  const stepX = width / (values.length - 1);

  const pts = values.map((v, i) => ({
    x: i * stepX,
    y: height - 3 - ((v - minV) / span) * (height - 6),
  }));

  let d = 'M ' + pts[0].x.toFixed(1) + ' ' + pts[0].y.toFixed(1);
  for (let i = 1; i < pts.length; i++) {
    d += ' L ' + pts[i].x.toFixed(1) + ' ' + pts[i].y.toFixed(1);
  }

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="display:block;">
  <path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
    stroke-dasharray="400" stroke-dashoffset="400">
    <animate attributeName="stroke-dashoffset" from="400" to="0" dur="0.9s" fill="freeze"
      calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1"/>
  </path>
</svg>`;
}

module.exports = {
  donutChart, barChartH, barChartV, areaChart, radarChart, progressRings, sparkline,
};