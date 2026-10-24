#!/usr/bin/env node
/**
 * mail-charts.js — 邮件 SVG 图表库 (v8.0)
 *
 * 核心原则：**静态即正确**。
 *   每个图形都先用最终属性值绘制，动画只做「从 0 到最终值」的增强。
 *   这样即使客户端剥离了 <animate>（QQ 邮箱常见），图形依然完整可见。
 *
 * 宽度：全部使用 viewBox + width:100%，由容器决定实际尺寸，天然适配移动端。
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
   1. 环形图 —— 静态分段绘制 + 可选动效
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

  // 每段用 stroke-dashoffset 定位，长度直接写最终值
  let acc = 0;
  const segs = data.map((d, i) => {
    const frac = d.value / total;
    const len = frac * C;
    const color = d.color || colors[i % colors.length];
    const dashArray = len.toFixed(2) + ' ' + (C - len).toFixed(2);
    const dashOffset = (-acc).toFixed(2);
    acc += len;

    // 2px 间隙让分段更清晰
    const gap = 1.5;
    const visible = Math.max(0, len - gap);
    const dashVisible = visible.toFixed(2) + ' ' + (C - visible).toFixed(2);

    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
      stroke="${color}" stroke-width="${stroke}"
      stroke-dasharray="${dashVisible}"
      stroke-dashoffset="${dashOffset}"
      transform="rotate(-90 ${cx} ${cy})">
      <animate attributeName="stroke-dasharray"
        from="0 ${C.toFixed(2)}" to="${dashVisible}"
        dur="0.8s" begin="${(i * 0.1).toFixed(2)}s" fill="freeze"
        calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1"/>
    </circle>`;
  }).join('');

  const centerVal = opts.centerText != null ? opts.centerText : total;

  return `<svg width="100%" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:auto;max-width:${size}px;margin:0 auto;">
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${T.line}" stroke-width="${stroke}"/>
  ${segs}
  <text x="${cx}" y="${cy - 2}" text-anchor="middle" font-family="-apple-system,PingFang SC,sans-serif" font-size="26" font-weight="800" fill="${T.ink}">${esc(centerVal)}</text>
  <text x="${cx}" y="${cy + 20}" text-anchor="middle" font-family="-apple-system,PingFang SC,sans-serif" font-size="11" fill="${T.ink4}">${esc(opts.label || '条资讯')}</text>
</svg>`;
}

/* ============================================================
   2. 横向条形图 —— 宽度自适应
   ============================================================ */
function barChartH(data, opts) {
  opts = opts || {};
  const width = opts.width || 300;
  const rowH = opts.rowH || 32;
  const labelW = opts.labelW || 88;
  const valueW = 32;
  const height = data.length * rowH + 4;
  const barMax = Math.max(20, width - labelW - valueW);
  const maxV = Math.max.apply(null, data.map((d) => d.value).concat([1]));

  const rows = data.map((d, i) => {
    const y = i * rowH + 6;
    const w = Math.max(4, (d.value / maxV) * barMax);
    const color = d.color || T.brand1;
    const gid = 'hb' + i + '_' + Math.floor(Math.random() * 1e6);

    return `<defs>
      <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.6"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="1"/>
      </linearGradient>
    </defs>
    <text x="0" y="${y + 13}" font-family="-apple-system,PingFang SC,sans-serif" font-size="11.5" font-weight="600" fill="${T.ink2}">${esc(d.label)}</text>
    <rect x="${labelW}" y="${y + 4}" width="${barMax}" height="8" rx="4" fill="${T.line}"/>
    <rect x="${labelW}" y="${y + 4}" width="${w.toFixed(1)}" height="8" rx="4" fill="url(#${gid})">
      <animate attributeName="width" from="0" to="${w.toFixed(1)}"
        dur="0.65s" begin="${(i * 0.07).toFixed(2)}s" fill="freeze"
        calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1"/>
    </rect>
    <text x="${width}" y="${y + 13}" text-anchor="end" font-family="ui-monospace,Menlo,monospace" font-size="11" font-weight="700" fill="${color}">${d.value}</text>`;
  }).join('');

  return `<svg width="100%" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:auto;">
  ${rows}
</svg>`;
}

/* ============================================================
   3. 竖向柱状图
   ============================================================ */
function barChartV(data, opts) {
  opts = opts || {};
  const width = opts.width || 340;
  const height = opts.height || 170;
  const padL = 26;
  const padB = 28;
  const padT = 18;
  const chartH = height - padB - padT;
  const chartW = width - padL - 8;
  const n = data.length || 1;
  const slot = chartW / n;
  const barW = Math.max(8, Math.min(36, slot * 0.5));
  const maxV = Math.max.apply(null, data.map((d) => d.value).concat([1]));

  let grid = '';
  for (let i = 0; i <= 3; i++) {
    const y = padT + (chartH / 3) * i;
    const v = Math.round(maxV * (3 - i) / 3);
    grid += `<line x1="${padL}" y1="${y}" x2="${width - 8}" y2="${y}" stroke="${T.line}" stroke-width="1"/>`;
    grid += `<text x="${padL - 6}" y="${y + 3.5}" text-anchor="end" font-family="ui-monospace,Menlo,monospace" font-size="9" fill="${T.ink4}">${v}</text>`;
  }

  const bars = data.map((d, i) => {
    const h = Math.max(3, (d.value / maxV) * chartH);
    const x = padL + slot * i + (slot - barW) / 2;
    const y = padT + chartH - h;
    const color = d.color || T.brand1;
    const gid = 'vb' + i + '_' + Math.floor(Math.random() * 1e6);
    return `<defs>
      <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="1"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0.5"/>
      </linearGradient>
    </defs>
    <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW}" height="${h.toFixed(1)}" rx="5" fill="url(#${gid})">
      <animate attributeName="height" from="0" to="${h.toFixed(1)}"
        dur="0.7s" begin="${(i * 0.06).toFixed(2)}s" fill="freeze"
        calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1"/>
      <animate attributeName="y" from="${(padT + chartH).toFixed(1)}" to="${y.toFixed(1)}"
        dur="0.7s" begin="${(i * 0.06).toFixed(2)}s" fill="freeze"
        calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1"/>
    </rect>
    <text x="${(x + barW / 2).toFixed(1)}" y="${(y - 5).toFixed(1)}" text-anchor="middle"
      font-family="ui-monospace,Menlo,monospace" font-size="10" font-weight="700" fill="${T.ink}">${d.value}</text>
    <text x="${(x + barW / 2).toFixed(1)}" y="${height - 9}" text-anchor="middle"
      font-family="-apple-system,PingFang SC,sans-serif" font-size="9.5" fill="${T.ink3}">${esc(d.label)}</text>`;
  }).join('');

  return `<svg width="100%" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:auto;">
  ${grid}
  ${bars}
</svg>`;
}

/* ============================================================
   4. 折线面积图
   ============================================================ */
function areaChart(data, opts) {
  opts = opts || {};
  const width = opts.width || 340;
  const height = opts.height || 150;
  const padL = 26;
  const padB = 26;
  const padT = 16;
  const chartH = height - padB - padT;
  const chartW = width - padL - 10;
  const n = data.length;
  if (!n) return '';

  const vals = data.map((d) => d.value);
  const maxV = Math.max.apply(null, vals.concat([1]));
  const minV = Math.min.apply(null, vals.concat([0]));
  const span = (maxV - minV) || 1;
  const stepX = n > 1 ? chartW / (n - 1) : 0;

  const pts = data.map((d, i) => ({
    x: padL + stepX * i,
    y: padT + chartH - ((d.value - minV) / span) * chartH,
    label: d.label,
    value: d.value,
  }));

  let path = 'M ' + pts[0].x.toFixed(1) + ' ' + pts[0].y.toFixed(1);
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const c1 = p0.x + (p1.x - p0.x) / 3;
    const c2 = p0.x + (p1.x - p0.x) * 2 / 3;
    path += ' C ' + c1.toFixed(1) + ' ' + p0.y.toFixed(1) + ', ' +
            c2.toFixed(1) + ' ' + p1.y.toFixed(1) + ', ' +
            p1.x.toFixed(1) + ' ' + p1.y.toFixed(1);
  }

  const areaPath = path + ' L ' + pts[pts.length - 1].x.toFixed(1) + ' ' + (padT + chartH) +
    ' L ' + pts[0].x.toFixed(1) + ' ' + (padT + chartH) + ' Z';

  const dots = pts.map((p) =>
    `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="${T.white}" stroke="${T.brand1}" stroke-width="2"><animate attributeName="r" from="0" to="3.5" dur="0.3s" begin="0.5s" fill="freeze"/></circle>` +
    `<text x="${p.x.toFixed(1)}" y="${height - 8}" text-anchor="middle" font-family="-apple-system,PingFang SC,sans-serif" font-size="9" fill="${T.ink4}">${esc(p.label)}</text>`
  ).join('');

  const grid = [0, 1, 2, 3].map((i) => {
    const y = padT + (chartH / 3) * i;
    return `<line x1="${padL}" y1="${y}" x2="${width - 10}" y2="${y}" stroke="${T.line}" stroke-width="1" stroke-dasharray="3 4"/>`;
  }).join('');

  const gid = 'ar' + Math.floor(Math.random() * 1e6);

  return `<svg width="100%" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:auto;">
  <defs>
    <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${T.brand1}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${T.brand1}" stop-opacity="0.02"/>
    </linearGradient>
  </defs>
  ${grid}
  <path d="${areaPath}" fill="url(#${gid})"/>
  <path d="${path}" fill="none" stroke="${T.brand1}" stroke-width="2.5" stroke-linecap="round"/>
  ${dots}
</svg>`;
}

/* ============================================================
   5. 雷达图
   ============================================================ */
function radarChart(data, opts) {
  opts = opts || {};
  const size = opts.size || 240;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 40;
  const n = data.length;
  if (n < 3) return '';

  const maxV = Math.max.apply(null, data.map((d) => d.value).concat([1]));
  const angleOf = (i) => (Math.PI * 2 * i / n) - Math.PI / 2;

  let rings = '';
  [0.25, 0.5, 0.75, 1].forEach((f) => {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = angleOf(i);
      pts.push((cx + Math.cos(a) * r * f).toFixed(1) + ',' + (cy + Math.sin(a) * r * f).toFixed(1));
    }
    rings += `<polygon points="${pts.join(' ')}" fill="none" stroke="${T.line}" stroke-width="1"/>`;
  });

  let axes = '';
  for (let i = 0; i < n; i++) {
    const a = angleOf(i);
    axes += `<line x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(a) * r).toFixed(1)}" y2="${(cy + Math.sin(a) * r).toFixed(1)}" stroke="${T.line}" stroke-width="1"/>`;
  }

  const dataPts = data.map((d, i) => {
    const a = angleOf(i);
    const f = Math.max(0.1, d.value / maxV);
    return (cx + Math.cos(a) * r * f).toFixed(1) + ',' + (cy + Math.sin(a) * r * f).toFixed(1);
  }).join(' ');

  const labels = data.map((d, i) => {
    const a = angleOf(i);
    const lx = cx + Math.cos(a) * (r + 18);
    const ly = cy + Math.sin(a) * (r + 18);
    const anchor = Math.abs(Math.cos(a)) < 0.3 ? 'middle' : (Math.cos(a) > 0 ? 'start' : 'end');
    return `<text x="${lx.toFixed(1)}" y="${(ly + 3.5).toFixed(1)}" text-anchor="${anchor}"
      font-family="-apple-system,PingFang SC,sans-serif" font-size="9.5" font-weight="600" fill="${T.ink3}">${esc(d.label)}</text>`;
  }).join('');

  const gid = 'rd' + Math.floor(Math.random() * 1e6);

  return `<svg width="100%" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:auto;max-width:${size}px;margin:0 auto;">
  <defs>
    <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${T.brand1}" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="${T.brand3}" stop-opacity="0.2"/>
    </linearGradient>
  </defs>
  ${rings}
  ${axes}
  <polygon points="${dataPts}" fill="url(#${gid})" stroke="${T.brand2}" stroke-width="2"/>
  ${labels}
</svg>`;
}

/* ============================================================
   6. 环形进度
   ============================================================ */
function progressRings(items, opts) {
  opts = opts || {};
  const size = opts.size || 88;
  const stroke = opts.stroke || 8;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;

  const it = items[0] || { ratio: 0 };
  const len = Math.min(1, it.ratio || 0) * C;
  const color = it.color || T.brand1;

  return `<svg width="100%" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:auto;max-width:${size}px;margin:0 auto;">
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${T.line}" stroke-width="${stroke}"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
    stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"
    stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}">
    <animate attributeName="stroke-dasharray" from="0 ${C.toFixed(2)}" to="${len.toFixed(2)} ${(C - len).toFixed(2)}"
      dur="0.8s" fill="freeze" calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1"/>
  </circle>
  <text x="${cx}" y="${cy + 4}" text-anchor="middle"
    font-family="ui-monospace,Menlo,monospace" font-size="14" font-weight="800" fill="${T.ink}">${it.display != null ? esc(it.display) : Math.round((it.ratio || 0) * 100)}</text>
</svg>`;
}

/* ============================================================
   7. 迷你走势线
   ============================================================ */
function sparkline(values, opts) {
  opts = opts || {};
  const width = opts.width || 100;
  const height = opts.height || 28;
  const color = opts.color || T.brand1;
  if (!values || values.length < 2) return '';

  const maxV = Math.max.apply(null, values);
  const minV = Math.min.apply(null, values);
  const span = (maxV - minV) || 1;
  const stepX = width / (values.length - 1);

  const pts = values.map((v, i) => ({
    x: i * stepX,
    y: height - 2 - ((v - minV) / span) * (height - 4),
  }));

  let d = 'M ' + pts[0].x.toFixed(1) + ' ' + pts[0].y.toFixed(1);
  for (let i = 1; i < pts.length; i++) d += ' L ' + pts[i].x.toFixed(1) + ' ' + pts[i].y.toFixed(1);

  return `<svg width="100%" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:auto;max-width:${width}px;">
  <path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}

module.exports = {
  donutChart, barChartH, barChartV, areaChart, radarChart, progressRings, sparkline,
};