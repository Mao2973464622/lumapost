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
  },};

const DEFAULT_THEME = 'sunset';

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
    const base = Object.assign({}, THEMES.sunset);   // v10.7.0：minimal 已移除，以 sunset 为自定义基线
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