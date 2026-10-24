#!/usr/bin/env node
/**
 * mail-themes.js — 邮件主题库 (v9.0)
 *
 * 10 套预设主题 + 自定义主题支持。
 * 每个主题定义：品牌渐变、背景、卡片、文字、分隔线、字体栈。
 *
 * 自定义主题（key = 'custom'）从 config.mail.customTheme 读取，
 * 只覆盖用户填写的字段，其余继承「极简白」。
 */

const SANS = "-apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Helvetica Neue',Arial,sans-serif";
const SERIF = "Georgia,'Songti SC','STSong','SimSun',serif";
const MONO = "'SF Mono',Monaco,Consolas,'Liberation Mono',monospace";
const ROUND = "'Nunito','PingFang SC','Microsoft YaHei',sans-serif";

const THEMES = {
  /* ---------- 1. 极简白（默认）---------- */
  minimal: {
    key: 'minimal', name: '极简白', desc: '渐变紫 + 纯白卡片，清爽现代',
    group: '明亮',
    brand1: '#6366F1', brand2: '#8B5CF6', brand3: '#A855F7',
    ink: '#0F172A', ink2: '#334155', ink3: '#64748B', ink4: '#94A3B8',
    line: '#E8ECF3', bg: '#F5F7FC', card: '#FFFFFF', cardBorder: '#E8ECF3',
    accent: '#6366F1', footerText: '#94A3B8',
    font: SANS, titleFont: SANS,
    heroText: '#FFFFFF', heroSub: 'rgba(255,255,255,.85)',
    tlrdBg: '#FFFBEB', tlrdBd: '#FDE68A', tlrdTx: '#78350F', tlrdLb: '#B45309',
  },

  /* ---------- 2. 墨黑 ---------- */
  dark: {
    key: 'dark', name: '墨黑', desc: '深灰底 + 暖白字，夜间护眼',
    group: '暗色',
    brand1: '#818CF8', brand2: '#A78BFA', brand3: '#C084FC',
    ink: '#F1F5F9', ink2: '#CBD5E1', ink3: '#94A3B8', ink4: '#64748B',
    line: '#1E293B', bg: '#0B0F1A', card: '#151C2C', cardBorder: '#232D42',
    accent: '#818CF8', footerText: '#64748B',
    font: SANS, titleFont: SANS,
    heroText: '#FFFFFF', heroSub: 'rgba(255,255,255,.85)',
    tlrdBg: '#1E1B0F', tlrdBd: '#3F3418', tlrdTx: '#FCD34D', tlrdLb: '#D97706',
  },

  /* ---------- 3. 报刊 ---------- */
  paper: {
    key: 'paper', name: '报刊', desc: '米色纸张 + 衬线体，旧报纸质感',
    group: '古典',
    brand1: '#8B4513', brand2: '#A0522D', brand3: '#B8860B',
    ink: '#2B2118', ink2: '#4A3F35', ink3: '#7A6D5F', ink4: '#A89888',
    line: '#E0D8CC', bg: '#FAF7F0', card: '#FFFDF8', cardBorder: '#E8DFD2',
    accent: '#8B4513', footerText: '#A89888',
    font: SERIF, titleFont: SERIF,
    heroText: '#FFFDF8', heroSub: 'rgba(255,253,248,.88)',
    tlrdBg: '#FDF6E3', tlrdBd: '#E8DFD2', tlrdTx: '#6B4423', tlrdLb: '#8B4513',
  },

  /* ---------- 4. 深海 ---------- */
  ocean: {
    key: 'ocean', name: '深海', desc: '藏青底 + 青蓝点缀，静谧深邃',
    group: '暗色',
    brand1: '#0EA5E9', brand2: '#06B6D4', brand3: '#22D3EE',
    ink: '#E2F2FF', ink2: '#B0CCE0', ink3: '#7A9BB5', ink4: '#4F6E88',
    line: '#16334A', bg: '#08182A', card: '#0F2438', cardBorder: '#1B3A56',
    accent: '#22D3EE', footerText: '#4F6E88',
    font: SANS, titleFont: SANS,
    heroText: '#FFFFFF', heroSub: 'rgba(226,242,255,.86)',
    tlrdBg: '#122E42', tlrdBd: '#1E4A66', tlrdTx: '#7DD3FC', tlrdLb: '#38BDF8',
  },

  /* ---------- 5. 霓虹 ---------- */
  neon: {
    key: 'neon', name: '霓虹', desc: '黑底 + 洋红青绿，赛博脉冲',
    group: '暗色',
    brand1: '#EC4899', brand2: '#A855F7', brand3: '#22D3EE',
    ink: '#FAF5FF', ink2: '#D8B4FE', ink3: '#A78BFA', ink4: '#7C3AED',
    line: '#2E1065', bg: '#0A0014', card: '#170B26', cardBorder: '#3B0764',
    accent: '#EC4899', footerText: '#7C3AED',
    font: SANS, titleFont: SANS,
    heroText: '#FFFFFF', heroSub: 'rgba(250,245,255,.88)',
    tlrdBg: '#2A0E3D', tlrdBd: '#4C1D95', tlrdTx: '#F0ABFC', tlrdLb: '#EC4899',
  },

  /* ---------- 6. 森野 ---------- */
  forest: {
    key: 'forest', name: '森野', desc: '墨绿 + 苔藓，自然沉静',
    group: '自然',
    brand1: '#059669', brand2: '#10B981', brand3: '#34D399',
    ink: '#E7F5EF', ink2: '#B8D8CC', ink3: '#7FA396', ink4: '#527A6C',
    line: '#1B3B2F', bg: '#0A1F18', card: '#112B21', cardBorder: '#1E4436',
    accent: '#34D399', footerText: '#527A6C',
    font: SANS, titleFont: SANS,
    heroText: '#FFFFFF', heroSub: 'rgba(231,245,239,.86)',
    tlrdBg: '#14352A', tlrdBd: '#1E5540', tlrdTx: '#6EE7B7', tlrdLb: '#10B981',
  },

  /* ---------- 7. 暖阳 ---------- */
  sunset: {
    key: 'sunset', name: '暖阳', desc: '橙粉渐变 + 奶油底，温暖柔和',
    group: '明亮',
    brand1: '#F97316', brand2: '#F43F5E', brand3: '#EC4899',
    ink: '#2A1810', ink2: '#5C4033', ink3: '#8B6F5C', ink4: '#BFA595',
    line: '#F5E0D0', bg: '#FFF9F4', card: '#FFFFFF', cardBorder: '#F7E5D8',
    accent: '#F97316', footerText: '#BFA595',
    font: SANS, titleFont: SANS,
    heroText: '#FFFFFF', heroSub: 'rgba(255,255,255,.9)',
    tlrdBg: '#FFF3E6', tlrdBd: '#FBD5A9', tlrdTx: '#9A3412', tlrdLb: '#EA580C',
  },

  /* ---------- 8. 樱粉 ---------- */
  sakura: {
    key: 'sakura', name: '樱粉', desc: '樱花粉 + 米白，温柔轻盈',
    group: '明亮',
    brand1: '#F472B6', brand2: '#EC4899', brand3: '#DB2777',
    ink: '#3B1626', ink2: '#6B3D52', ink3: '#9D7285', ink4: '#C9A8B8',
    line: '#FBE4EE', bg: '#FFF7FA', card: '#FFFFFF', cardBorder: '#F8DFE9',
    accent: '#EC4899', footerText: '#C9A8B8',
    font: ROUND, titleFont: ROUND,
    heroText: '#FFFFFF', heroSub: 'rgba(255,255,255,.92)',
    tlrdBg: '#FFF0F6', tlrdBd: '#FBCFE8', tlrdTx: '#9D174D', tlrdLb: '#DB2777',
  },

  /* ---------- 9. 极光 ---------- */
  aurora: {
    key: 'aurora', name: '极光', desc: '青紫流体渐变，冷冽幻彩',
    group: '暗色',
    brand1: '#22D3EE', brand2: '#818CF8', brand3: '#C084FC',
    ink: '#EEF2FF', ink2: '#C7D2FE', ink3: '#8B9BC7', ink4: '#5A6B99',
    line: '#1E2749', bg: '#0A0E1F', card: '#121833', cardBorder: '#222C55',
    accent: '#22D3EE', footerText: '#5A6B99',
    font: SANS, titleFont: SANS,
    heroText: '#FFFFFF', heroSub: 'rgba(238,242,255,.88)',
    tlrdBg: '#16204A', tlrdBd: '#2A3A6E', tlrdTx: '#A5F3FC', tlrdLb: '#22D3EE',
  },

  /* ---------- 10. 简约灰 ---------- */
  mono: {
    key: 'mono', name: '简约灰', desc: '灰阶克制，仅黑白灰三色',
    group: '明亮',
    brand1: '#1F2937', brand2: '#374151', brand3: '#4B5563',
    ink: '#111827', ink2: '#374151', ink3: '#6B7280', ink4: '#9CA3AF',
    line: '#E5E7EB', bg: '#FAFAFA', card: '#FFFFFF', cardBorder: '#E5E7EB',
    accent: '#374151', footerText: '#9CA3AF',
    font: SANS, titleFont: SANS,
    heroText: '#FFFFFF', heroSub: 'rgba(255,255,255,.82)',
    tlrdBg: '#F3F4F6', tlrdBd: '#D1D5DB', tlrdTx: '#1F2937', tlrdLb: '#4B5563',
  },
};

/** 默认主题 */
const DEFAULT_THEME = 'minimal';

/** 主题列表（供 API / UI 使用） */
function listThemes() {
  return Object.keys(THEMES).map((k) => {
    const t = THEMES[k];
    return {
      key: t.key,
      name: t.name,
      desc: t.desc,
      group: t.group,
      preview: {
        bg: t.bg,
        card: t.card,
        gradient: 'linear-gradient(135deg,' + t.brand1 + ',' + t.brand2 + ',' + t.brand3 + ')',
        ink: t.ink,
        accent: t.accent,
      },
    };
  });
}

/**
 * 解析主题。
 * @param {string} key 主题 key，'custom' 时走自定义
 * @param {object} custom 自定义主题配置（覆盖字段）
 */
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
    // 字体选择
    const fontMap = { sans: SANS, serif: SERIF, round: ROUND };
    if (c.fontFamily && fontMap[c.fontFamily]) {
      base.font = fontMap[c.fontFamily];
      base.titleFont = fontMap[c.fontFamily];
    }
    // 深浅判定：bg 亮度
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

/** 自定义主题的默认值（UI 初始化用） */
function defaultCustom() {
  return {
    name: '我的主题',
    brand1: '#6366F1',
    brand2: '#8B5CF6',
    brand3: '#A855F7',
    bg: '#F5F7FC',
    card: '#FFFFFF',
    cardBorder: '#E8ECF3',
    ink: '#0F172A',
    ink2: '#334155',
    ink3: '#64748B',
    ink4: '#94A3B8',
    line: '#E8ECF3',
    accent: '#6366F1',
    footerText: '#94A3B8',
    fontFamily: 'sans',
    tlrdBg: '#FFFBEB',
    tlrdBd: '#FDE68A',
    tlrdTx: '#78350F',
    tlrdLb: '#B45309',
  };
}

module.exports = { THEMES, DEFAULT_THEME, listThemes, resolveTheme, defaultCustom, FONTS: { sans: SANS, serif: SERIF, round: ROUND } };