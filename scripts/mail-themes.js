#!/usr/bin/env node
/**
 * mail-themes.js — 邮件主题库 (v10.0)
 *
 * 设计原则：**全部浅色系**。
 *   - 背景统一在 #F5~#FF 亮度区间，保证阅读舒适
 *   - 靠「品牌渐变 + 强调色 + 字体」区分风格，不靠明暗
 *   - 每套主题的色相拉开距离：紫 / 橙 / 粉 / 绿 / 蓝 / 青 / 金 / 灰 / 红 / 薄荷
 *
 * 自定义主题：key = 'custom'，从 config.mail.customTheme 读取，
 * 只覆盖用户填写的字段，其余继承「极简白」。
 */

const SANS = "-apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Helvetica Neue',Arial,sans-serif";
const SERIF = "Georgia,'Songti SC','STSong','SimSun',serif";
const ROUND = "'Nunito','PingFang SC','Microsoft YaHei',sans-serif";
const MONO = "'SF Mono',Monaco,Consolas,'Liberation Mono',monospace";

const THEMES = {
  /* ---------- 1. 极简白 · 靛紫（默认）---------- */
  minimal: {
    key: 'minimal', name: '极简白', desc: '靛紫渐变 · 纯白卡片 · 现代清爽',
    group: '经典',
    brand1: '#6366F1', brand2: '#8B5CF6', brand3: '#A855F7',
    ink: '#111827', ink2: '#374151', ink3: '#6B7280', ink4: '#9CA3AF',
    line: '#E9ECF3', bg: '#F6F7FB', card: '#FFFFFF', cardBorder: '#E9ECF3',
    accent: '#6366F1', footerText: '#9CA3AF',
    font: SANS, titleFont: SANS,
    heroText: '#FFFFFF', heroSub: 'rgba(255,255,255,.88)',
    tlrdBg: '#FFFBEB', tlrdBd: '#FDE68A', tlrdTx: '#78350F', tlrdLb: '#B45309',
  },

  /* ---------- 2. 暖阳 · 橙 ---------- */
  sunset: {
    key: 'sunset', name: '暖阳', desc: '珊瑚橙渐变 · 奶油底 · 温暖亲切',
    group: '暖色',
    brand1: '#FB923C', brand2: '#F97316', brand3: '#EA580C',
    ink: '#43200A', ink2: '#6B3A1A', ink3: '#9C6644', ink4: '#C49A7C',
    line: '#FBE6D2', bg: '#FFFAF4', card: '#FFFFFF', cardBorder: '#FAE4CE',
    accent: '#F97316', footerText: '#C49A7C',
    font: SANS, titleFont: SANS,
    heroText: '#FFFFFF', heroSub: 'rgba(255,255,255,.9)',
    tlrdBg: '#FFF4E6', tlrdBd: '#FCD9A8', tlrdTx: '#8C3D0A', tlrdLb: '#EA580C',
  },

  /* ---------- 3. 樱粉 · 粉 ---------- */
  sakura: {
    key: 'sakura', name: '樱粉', desc: '樱花粉渐变 · 米白底 · 温柔轻盈',
    group: '暖色',
    brand1: '#F9A8D4', brand2: '#F472B6', brand3: '#EC4899',
    ink: '#4A1030', ink2: '#7A2952', ink3: '#A8557C', ink4: '#CFA0B6',
    line: '#FCE3EE', bg: '#FFFAFC', card: '#FFFFFF', cardBorder: '#FBE0EA',
    accent: '#EC4899', footerText: '#CFA0B6',
    font: ROUND, titleFont: ROUND,
    heroText: '#FFFFFF', heroSub: 'rgba(255,255,255,.92)',
    tlrdBg: '#FFF2F8', tlrdBd: '#FBCFE8', tlrdTx: '#9D174D', tlrdLb: '#DB2777',
  },

  /* ---------- 4. 森野 · 绿 ---------- */
  forest: {
    key: 'forest', name: '森野', desc: '苔绿渐变 · 月白底 · 自然沉静',
    group: '冷色',
    brand1: '#34D399', brand2: '#10B981', brand3: '#059669',
    ink: '#0A2E22', ink2: '#1F4F3E', ink3: '#4E7D6B', ink4: '#8FB3A6',
    line: '#DDF0E7', bg: '#F7FCF9', card: '#FFFFFF', cardBorder: '#DAEEE4',
    accent: '#10B981', footerText: '#8FB3A6',
    font: SANS, titleFont: SANS,
    heroText: '#FFFFFF', heroSub: 'rgba(255,255,255,.9)',
    tlrdBg: '#EDFAF3', tlrdBd: '#A7F3D0', tlrdTx: '#065F46', tlrdLb: '#059669',
  },

  /* ---------- 5. 天空 · 蓝 ---------- */
  sky: {
    key: 'sky', name: '天空', desc: '天蓝渐变 · 雪白底 · 通透明亮',
    group: '冷色',
    brand1: '#60A5FA', brand2: '#3B82F6', brand3: '#2563EB',
    ink: '#0C2340', ink2: '#1E3A5F', ink3: '#517694', ink4: '#93B4CC',
    line: '#DEEBF7', bg: '#F7FBFF', card: '#FFFFFF', cardBorder: '#DBE9F6',
    accent: '#3B82F6', footerText: '#93B4CC',
    font: SANS, titleFont: SANS,
    heroText: '#FFFFFF', heroSub: 'rgba(255,255,255,.9)',
    tlrdBg: '#EFF7FF', tlrdBd: '#BFDBFE', tlrdTx: '#1E40AF', tlrdLb: '#2563EB',
  },

  /* ---------- 6. 薄荷 · 青 ---------- */
  mint: {
    key: 'mint', name: '薄荷', desc: '青碧渐变 · 冰白底 · 清冽舒爽',
    group: '冷色',
    brand1: '#5EEAD4', brand2: '#2DD4BF', brand3: '#14B8A6',
    ink: '#083B38', ink2: '#155E57', ink3: '#4A8A82', ink4: '#94BCB6',
    line: '#DBF2EE', bg: '#F6FDFC', card: '#FFFFFF', cardBorder: '#D8F0EC',
    accent: '#14B8A6', footerText: '#94BCB6',
    font: SANS, titleFont: SANS,
    heroText: '#FFFFFF', heroSub: 'rgba(255,255,255,.92)',
    tlrdBg: '#ECFDF9', tlrdBd: '#99F6E4', tlrdTx: '#115E59', tlrdLb: '#0D9488',
  },

  /* ---------- 7. 报刊 · 棕（衬线体）---------- */
  paper: {
    key: 'paper', name: '报刊', desc: '焦糖棕渐变 · 米纸底 · 衬线体印刷感',
    group: '经典',
    brand1: '#B4855C', brand2: '#96603A', brand3: '#7A4520',
    ink: '#2C1D12', ink2: '#4A382A', ink3: '#7D6B5C', ink4: '#B0A192',
    line: '#E8DCCB', bg: '#FBF7F1', card: '#FFFDF9', cardBorder: '#E6D8C5',
    accent: '#96603A', footerText: '#B0A192',
    font: SERIF, titleFont: SERIF,
    heroText: '#FFFDF9', heroSub: 'rgba(255,253,249,.9)',
    tlrdBg: '#FBF3E6', tlrdBd: '#E5D2B0', tlrdTx: '#6B4423', tlrdLb: '#8B5A2B',
  },

  /* ---------- 8. 金穗 · 金 ---------- */
  gold: {
    key: 'gold', name: '金穗', desc: '琥珀金渐变 · 象牙底 · 温润雅致',
    group: '暖色',
    brand1: '#FBBF24', brand2: '#F59E0B', brand3: '#D97706',
    ink: '#3B2A05', ink2: '#5E4610', ink3: '#907438', ink4: '#C4B183',
    line: '#F5E9CC', bg: '#FFFDF6', card: '#FFFFFF', cardBorder: '#F2E5C4',
    accent: '#D97706', footerText: '#C4B183',
    font: SERIF, titleFont: SERIF,
    heroText: '#FFFFFF', heroSub: 'rgba(255,255,255,.92)',
    tlrdBg: '#FFF9E6', tlrdBd: '#FDE68A', tlrdTx: '#78350F', tlrdLb: '#B45309',
  },

  /* ---------- 9. 简约灰 · 中性 ---------- */
  mono: {
    key: 'mono', name: '简约灰', desc: '石墨灰渐变 · 纯白底 · 极致克制',
    group: '经典',
    brand1: '#6B7280', brand2: '#4B5563', brand3: '#374151',
    ink: '#111827', ink2: '#374151', ink3: '#6B7280', ink4: '#9CA3AF',
    line: '#E5E7EB', bg: '#FAFAFA', card: '#FFFFFF', cardBorder: '#E5E7EB',
    accent: '#4B5563', footerText: '#9CA3AF',
    font: SANS, titleFont: SANS,
    heroText: '#FFFFFF', heroSub: 'rgba(255,255,255,.85)',
    tlrdBg: '#F3F4F6', tlrdBd: '#D1D5DB', tlrdTx: '#1F2937', tlrdLb: '#4B5563',
  },

  /* ---------- 10. 赤霞 · 红 ---------- */
  crimson: {
    key: 'crimson', name: '赤霞', desc: '胭脂红渐变 · 藕白底 · 热烈醒目',
    group: '暖色',
    brand1: '#F87171', brand2: '#EF4444', brand3: '#DC2626',
    ink: '#450A0A', ink2: '#7F1D1D', ink3: '#A85C5C', ink4: '#CFA5A5',
    line: '#FCE0E0', bg: '#FFF9F9', card: '#FFFFFF', cardBorder: '#FBDCDC',
    accent: '#EF4444', footerText: '#CFA5A5',
    font: SANS, titleFont: SANS,
    heroText: '#FFFFFF', heroSub: 'rgba(255,255,255,.9)',
    tlrdBg: '#FFF1F1', tlrdBd: '#FECACA', tlrdTx: '#991B1B', tlrdLb: '#DC2626',
  },
};

const DEFAULT_THEME = 'minimal';

function listThemes() {
  return Object.keys(THEMES).map((k) => {
    const t = THEMES[k];
    return {
      key: t.key,
      name: t.name,
      desc: t.desc,
      group: t.group,
      isLight: true,
      preview: {
        bg: t.bg,
        card: t.card,
        gradient: 'linear-gradient(135deg,' + t.brand1 + ',' + t.brand2 + ',' + t.brand3 + ')',
        ink: t.ink,
        ink3: t.ink3,
        accent: t.accent,
        line: t.line,
      },
    };
  });
}

function resolveTheme(key, custom) {
  const k = key || DEFAULT_THEME;

  if (k === 'custom') {
    const base = Object.assign({}, THEMES.minimal);
    const c = custom || {};
    const ALLOWED = [
      'brand1', 'brand2', 'brand3', 'ink', 'ink2', 'ink3', 'ink4',
      'line', 'bg', 'card', 'cardBorder', 'accent', 'footerText',
      'tlrdBg', 'tlrdBd', 'tlrdTx', 'tlrdLb',
    ];
    ALLOWED.forEach((f) => {
      const v = c[f];
      if (typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v)) base[f] = v;
    });
    const fontMap = { sans: SANS, serif: SERIF, round: ROUND };
    if (c.fontFamily && fontMap[c.fontFamily]) {
      base.font = fontMap[c.fontFamily];
      base.titleFont = fontMap[c.fontFamily];
    }
    base.key = 'custom';
    base.name = (typeof c.name === 'string' && c.name.trim()) ? c.name.trim().slice(0, 20) : '自定义';
    base.desc = '用户自定义配色';
    base.group = '自定义';
    base.heroText = '#FFFFFF';
    base.heroSub = 'rgba(255,255,255,.88)';
    return base;
  }

  return THEMES[k] || THEMES[DEFAULT_THEME];
}

function defaultCustom() {
  return {
    name: '我的主题',
    brand1: '#6366F1',
    brand2: '#8B5CF6',
    brand3: '#A855F7',
    bg: '#F6F7FB',
    card: '#FFFFFF',
    cardBorder: '#E9ECF3',
    ink: '#111827',
    ink2: '#374151',
    ink3: '#6B7280',
    ink4: '#9CA3AF',
    line: '#E9ECF3',
    accent: '#6366F1',
    footerText: '#9CA3AF',
    fontFamily: 'sans',
    tlrdBg: '#FFFBEB',
    tlrdBd: '#FDE68A',
    tlrdTx: '#78350F',
    tlrdLb: '#B45309',
  };
}

module.exports = {
  THEMES, DEFAULT_THEME, listThemes, resolveTheme, defaultCustom,
  FONTS: { sans: SANS, serif: SERIF, round: ROUND, mono: MONO },
};