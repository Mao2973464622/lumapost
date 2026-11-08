#!/usr/bin/env node
/**
 * mail-themes.js — 邮件主题库
 * 全部浅色系；自定义主题（key='custom'）从 config.mail.customTheme 读取。
 * 主题选择通过配置项 `mail.theme`（如 `cli.js set mail.theme sunset`）。
 */
const SANS = "-apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Helvetica Neue',Arial,sans-serif";
const SERIF = "Georgia,'Songti SC','STSong','SimSun',serif";
const ROUND = "'Nunito','PingFang SC','Microsoft YaHei',sans-serif";
const MONO = "'SF Mono',Monaco,Consolas,'Liberation Mono',monospace";

/** 内置主题表（含品牌色/文字色/背景/强调色等字段） */
const THEMES = {
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
};

/** 默认主题 key */
const DEFAULT_THEME = 'sunset';

/** 列出所有内置主题（供展示） */
function listThemes() {
  return Object.keys(THEMES).map((k) => {
    const t = THEMES[k];
    return {
      key: t.key, name: t.name, desc: t.desc, group: t.group, isLight: true,
      preview: {
        bg: t.bg, card: t.card,
        gradient: 'linear-gradient(135deg,' + t.brand1 + ',' + t.brand2 + ',' + t.brand3 + ')',
        ink: t.ink, ink3: t.ink3, accent: t.accent, line: t.line,
      },
    };
  });
}

/** 解析最终主题（处理 'custom' 与内置主题） */
function resolveTheme(key, custom) {
  const k = key || DEFAULT_THEME;
  if (k === 'custom') {
    const base = Object.assign({}, THEMES.sunset);
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

/** 生成默认自定义主题配置 */
function defaultCustom() {
  return {
    name: '我的主题', brand1: '#6366F1', brand2: '#8B5CF6', brand3: '#A855F7',
    bg: '#F6F7FB', card: '#FFFFFF', cardBorder: '#E9ECF3',
    ink: '#111827', ink2: '#374151', ink3: '#6B7280', ink4: '#9CA3AF',
    line: '#E9ECF3', accent: '#6366F1', footerText: '#9CA3AF',
    fontFamily: 'sans', tlrdBg: '#FFFBEB', tlrdBd: '#FDE68A',
    tlrdTx: '#78350F', tlrdLb: '#B45309',
  };
}

module.exports = {
  THEMES, DEFAULT_THEME, listThemes, resolveTheme, defaultCustom,
  FONTS: { sans: SANS, serif: SERIF, round: ROUND, mono: MONO },
};