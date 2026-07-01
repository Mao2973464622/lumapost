#!/usr/bin/env node
/**
 * fetch-news-ai.js — AI 驱动的新闻抓取脚本（v2.6 多信息源升级版）
 *
 * 核心改进：
 *   1. 关键字过滤热榜 → 每个版块只接收相关内容
 *   2. 4 组 × 4 版块分组调用 AI（避免单次大调用失败）
 *   3. 两批并行（批内串行）提升速度
 *   4. 正确解析 Sina GBK 编码的股市数据
 *   5. 多信息源抓取（热榜 API + AIbase + AI-Bot + 猫目 + CNMO科技 + IT之家 + 数码闲聊站）
 *   6. 每版块无条数上限，有多少写多少
 *
 * 用法：
 *   node fetch-news-ai.js --period=morning --output=data/morning.json
 *
 * 环境变量：
 *   AI_PROVIDER / AI_API_KEY / AI_MODEL
 *   WEATHER_LAT / WEATHER_LON  (默认长沙)
 *   ENABLED_SECTIONS  (逗号分隔版块 key，筛选版块)
 */

const fs = require('fs');
const path = require('path');
try { require('dotenv').config(); } catch(e) {}

// ─────────────────────────────────────────────
//  Node.js 版本检查
// ─────────────────────────────────────────────
const NODE_MIN = 18;
const nodeVer = parseInt(process.version.slice(1));
if (nodeVer < NODE_MIN) {
  console.error(`❌ Node.js 版本过低: ${process.version}，需要 >= ${NODE_MIN}`);
  process.exit(1);
}

const ai = require('./ai-provider');

// ─────────────────────────────────────────────
//  Run lock 防重复
// ─────────────────────────────────────────────
const LOCK_DIR = path.resolve(__dirname, '..', 'data', '.locks');
function acquireLock(name, ttl = 3600000) {
  if (!fs.existsSync(LOCK_DIR)) fs.mkdirSync(LOCK_DIR, { recursive: true });
  const lockPath = path.join(LOCK_DIR, `${name}.lock`);
  if (fs.existsSync(lockPath)) {
    const age = Date.now() - fs.statSync(lockPath).mtimeMs;
    if (age < ttl) return null;
    fs.unlinkSync(lockPath);
  }
  fs.writeFileSync(lockPath, String(Date.now()));
  return lockPath;
}
function releaseLock(lockPath) {
  if (lockPath && fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
}

// ─────────────────────────────────────────────
//  4 个时段差异化关键词
// ─────────────────────────────────────────────
const PERIOD_CONFIG = {
  morning: {
    label:'早报', colorKey:'morning', timeWindow:'隔夜大事',
    greeting:'清晨好！新的一天，从一份光影邮报开始~', greetingType:'morning',
    focus:'隔夜国际大事、美股收盘、海外科技发布',
  },
  noon: {
    label:'午报', colorKey:'noon', timeWindow:'今天上午',
    greeting:'中午好！光影速递，陪你度过午后时光~', greetingType:'noon',
    focus:'上午 A 股行情、国内外新闻、企业动态',
  },
  afternoon: {
    label:'午后速递', colorKey:'afternoon', timeWindow:'中午到下午',
    greeting:'下午好！最新资讯已为你打包送达~', greetingType:'afternoon',
    focus:'下午突发事件、新品发布、下午盘走势',
  },
  evening: {
    label:'晚间总结', colorKey:'evening', timeWindow:'全天回顾',
    greeting:'晚上好！今日大事回顾~', greetingType:'evening',
    focus:'全天复盘、欧美收盘、全网热榜 TOP 10',
  },
};

// ─────────────────────────────────────────────
//  版块定义
// ─────────────────────────────────────────────
const ALL_SECTIONS = [
  { key:'ai',            name:'🤖 AI · 智能体',       colorKey:'ai' },
  { key:'hardware',      name:'💻 硬件 · 数码',       colorKey:'hardware' },
  { key:'github',        name:'🌍 全球创意 · 开源',   colorKey:'github' },
  { key:'news',          name:'📰 国内外新闻',        colorKey:'domestic' },
  { key:'games',         name:'🎮 游戏 · 动漫',       colorKey:'games' },
  { key:'finance',       name:'💰 理财 · 财经',       colorKey:'finance' },
  { key:'auto',          name:'🚗 汽车 · 新能源',     colorKey:'auto' },
  { key:'internet',      name:'🌐 互联网大厂',        colorKey:'internet' },
  { key:'life',          name:'🎬 影视 · 生活 · 科技', colorKey:'movie' },
  { key:'space',         name:'🔬 科学 · 航天 · 健康', colorKey:'space' },
];

// ─────────────────────────────────────────────
//  版块关键词映射 — 用于过滤热榜
// ─────────────────────────────────────────────
const SECTION_KEYWORDS = {
  ai: ['AI','人工智能','大模型','GPT','ChatGPT','LLM','DeepSeek','机器学习','深度学习','AGI','Claude','Gemini','OpenAI','Anthropic','Copilot','智能体','agent','多模态','文生图','文生视频','Sora','Stable Diffusion','Midjourney','神经网络','transformer','训练','推理','token','上下文','prompt','微调','RAG','机器人','人形机器人','具身智能','Figure','Optimus','宇树','智元','波士顿动力'],
  hardware: ['芯片','半导体','NVIDIA','英伟达','Intel','AMD','高通','台积电','华为','处理器','显卡','GPU','CPU','制程','3nm','5nm','晶圆','光刻','HBM','内存','SSD','主板','手机','数码','iPhone','华为','小米','OPPO','vivo','三星','折叠屏','平板','手表','耳机','充电','电池','屏幕','摄像头','骁龙','天玑','iOS','Android','鸿蒙','HarmonyOS'],
  github: ['GitHub','开源','项目','代码','编程','开发者','工具','框架','star','repo','仓库','npm','pip','Rust','Python','Go','前端','后端','全栈','科学','物理','天文','航天','火箭','SpaceX','NASA','卫星','月球','火星','量子','粒子','对撞机','望远镜','JWST','嫦娥','天宫','神舟','空间站','医疗','健康','药品','疫苗','医院','疾病','医保','基因','生物医药','抗癌','罕见病','脑机接口'],
  news: ['中国','国内','政府','政策','法规','社会','民生','教育','高考','医疗','养老','住房','环保','交通','法律','公安','美国','欧洲','日本','韩国','俄罗斯','全球','外交','关税','贸易','制裁','北约','欧盟','联合国','G7','G20','白宫','拜登','特朗普'],
  games: ['游戏','Steam','电竞','手游','主机','PS5','Switch','Xbox','英雄联盟','LOL','原神','王者荣耀','崩坏','绝区零','黑神话','赛博朋克','老头环','FPS','MOBA','RPG','独立游戏','3A','动漫','漫画','番剧','动画','二次元','B站','新番','Cosplay','鬼灭','咒术','海贼王','进击','间谍过家家','芙莉莲','JOJO','电锯人','体育','NBA','足球','篮球','欧冠','世界杯','欧洲杯','英超','西甲','中超','F1','网球','游泳','田径','电竞比赛','LPL','KPL','TI','S赛'],
  finance: ['股市','A股','财经','基金','投资','理财','美股','港股','央行','利率','降息','加息','IPO','上市','比特币','加密货币','黄金','原油','期货','外汇','CPI','GDP','PMI','通胀','财报','分红','回购','创业','融资','估值','独角兽'],
  auto: ['汽车','新能源','电动车','特斯拉','比亚迪','蔚来','理想','小鹏','自动驾驶','电池','充电桩','小米汽车','华为汽车','L4','固态电池','换电','混动'],
  internet: ['互联网','大厂','字节','腾讯','阿里','百度','美团','拼多多','京东','Meta','Google','微软','Apple','Amazon','TikTok','微信','抖音','快手','小红书','B站','淘宝','天猫','裁员','财报','股价','增长'],
  life: ['电影','剧集','影视','综艺','Netflix','票房','上映','流媒体','导演','奥斯卡','戛纳','国产剧','韩剧','美剧','纪录片','漫威','DC','科幻片','动画电影','IT之家','少数派','V2EX','Hacker News','Product Hunt','GitHub Trending'],
  space: ['科学','物理','天文','航天','火箭','SpaceX','NASA','卫星','月球','火星','量子','粒子','对撞机','望远镜','医疗','健康','药品','疫苗','医院','疾病','医保','基因','生物医药','抗癌','罕见病','脑机接口'],
};

function getEnabledSections() {
  const filter = process.env.ENABLED_SECTIONS;
  if (!filter) return ALL_SECTIONS;
  const keys = new Set(filter.split(',').map(s => s.trim()));
  return ALL_SECTIONS.filter(s => keys.has(s.key));
}

// ─────────────────────────────────────────────
//  工具
// ─────────────────────────────────────────────
function safeJSON(text) {
  if (!text) return null;
  text = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(text); } catch(e) {}
  const m = text.match(/\{[\s\S]*\}/) || text.match(/\[[\s\S]*\]/);
  if (m) { try { return JSON.parse(m[0]); } catch(e) {} }
  return null;
}

async function retry(fn, maxRetries = 3, delay = 3000) {
  for (let i = 0; i < maxRetries; i++) {
    try { return await fn(); } catch (e) {
      if (i === maxRetries - 1) throw e;
      console.warn(`  ⚠ 重试 ${i+1}/${maxRetries}: ${e.message}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// ─────────────────────────────────────────────
//  抓取热榜
// ─────────────────────────────────────────────
async function fetchHotBoard(type, limit = 6) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`https://uapis.cn/api/v1/misc/hotboard?type=${type}`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const data = await res.json();
    const updateTime = data.update_time || data.data?.update_time || new Date().toISOString();
    return (data.list || data.data?.list || []).slice(0, limit).map((item, i) => ({
      raw_title: item.title || item.name,
      raw_desc: (item.extra?.desc || item.desc || item.description || '').slice(0, 100),
      hot: item.hot_value || item.hot || item.score,
      rank: item.index || item.rank || i + 1,
      url: item.url || item.link,
      source: `${type}热榜`,
      updateTime: updateTime,
    }));
  } catch (e) { return []; }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchAllBoards() {
  const types = ['zhihu', 'weibo', 'baidu', 'toutiao', 'sina', 'tieba', 'v2ex', 'kuaishou', 'sspai', 'ithome', '36kr', 'juejin', 'hupu', 'douyin', 'bilibili'];
  const results = [];
  for (const t of types) {
    const r = await fetchHotBoard(t, 6);
    if (r.length > 0) results.push({ type: t, items: r });
    await sleep(300);
  }
  return results;
}

// ─────────────────────────────────────────────
//  额外信息源抓取（HTML 抓取 + GitHub API + Product Hunt API）
// ─────────────────────────────────────────────
const EXTRA_SOURCES = [
  { name: 'AIbase', url: 'https://www.aibase.com/zh/news',
    extract: (html) => {
      const items = [];
      const re = /aria-label="阅读文章:\s*([^"]+)"\s*href="(\/news\/\d+)"/gi;
      let m;
      while ((m = re.exec(html)) !== null && items.length < 30) {
        items.push({ raw_title: m[1].trim(), url: 'https://www.aibase.com' + m[2], source: 'AIbase' });
      }
      return items;
    }
  },
  { name: 'AI-Bot', url: 'https://ai-bot.cn/daily-ai-news/',
    extract: (html) => {
      const items = [];
      const h2re = /<h2[^>]*>[\s\S]*?<a\s+href="(https?:\/\/[^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<\/h2>/gi;
      let m;
      while ((m = h2re.exec(html)) !== null && items.length < 25) {
        const title = m[2].replace(/<[^>]+>/g, '').trim();
        const url = m[1];
        if (title.length > 10) items.push({ raw_title: title, url, source: 'AI-Bot' });
      }
      if (items.length < 5) {
        const simpleRe = /<h2[^>]*>([^<]{10,200})<\/h2>/gi;
        const titles = [];
        while ((m = simpleRe.exec(html)) !== null) {
          const t = m[1].replace(/<[^>]+>/g, '').trim();
          if (t.length > 10) titles.push(t);
        }
        const linkRe = /href="(https?:\/\/(?:www\.)?(?:ithome|mp\.weixin\.qq|36kr|jiqizhixin|qbitai)\.com[^"]*)"/gi;
        const links = [];
        while ((m = linkRe.exec(html)) !== null) links.push(m[1]);
        for (let i = 0; i < Math.min(titles.length, links.length, 25); i++) {
          items.push({ raw_title: titles[i], url: links[i] || 'https://ai-bot.cn', source: 'AI-Bot' });
        }
      }
      return items;
    }
  },
  { name: '猫目', url: 'https://maomu.com/news',
    extract: (html) => {
      const items = [];
      const re = /\*\*([^*]{5,120})\*\*[\s\S]{0,500}?href="(https?:\/\/[^"]+)"/gi;
      let m;
      while ((m = re.exec(html)) !== null && items.length < 25) {
        const title = m[1].trim();
        if (title.length > 5 && !title.includes('来源')) {
          items.push({ raw_title: title, url: m[2], source: '猫目' });
        }
      }
      if (items.length < 5) {
        const aiRe = /aria-label="[^"]*?([^"]{10,120})[^"]*"\s*href="([^"]+)"/gi;
        while ((m = aiRe.exec(html)) !== null && items.length < 25) {
          items.push({ raw_title: m[1].trim(), url: m[2], source: '猫目' });
        }
      }
      return items;
    }
  },
  // ── CNMO 科技（手机·汽车·AI·互联网，今日最新）──
  { name: 'CNMO科技', url: 'https://www.cnmo.com/news/',
    extract: (html) => {
      const items = [];
      // CNMO 新闻卡片: href="(http://...cnmo.com/...)" 中间有标题文本
      const re = /href="(https?:\/\/(?:phone|internet|smartcar|ai|tech|notebook)\.cnmo\.com\/[^"]+)"[^>]*>\s*([^<]{10,200})\s*</gi;
      let m;
      while ((m = re.exec(html)) !== null && items.length < 30) {
        let title = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        // 去重标题前缀
        title = title.replace(/^【CNMO科技消息】/, '').replace(/^据CNMO科技[^，]*[，,]/, '').trim();
        if (title.length > 8 && !title.includes('CNMO科技') && !title.includes('数据来源') && !items.some(i => i.raw_title === title)) {
          items.push({ raw_title: title, url: m[1], source: 'CNMO科技' });
        }
      }
      return items;
    }
  },
  // ── IT之家（直接爬取最新文章，比热榜 API 更新鲜）──
  { name: 'IT之家', url: 'https://www.ithome.com/list/',
    extract: (html) => {
      const items = [];
      // IT之家列表页: <a href="https://www.ithome.com/0/xxx/xxx.htm" target="_blank">标题</a>
      const re = /href="(https?:\/\/www\.ithome\.com\/\d+\/\d+\/\d+\.htm)"[^>]*>([^<]{10,200})<\/a>/gi;
      let m;
      while ((m = re.exec(html)) !== null && items.length < 30) {
        const title = m[2].replace(/<[^>]+>/g, '').trim();
        if (title.length > 8 && !title.includes('广告')) {
          items.push({ raw_title: title, url: m[1], source: 'IT之家' });
        }
      }
      // 备用：uapis ithome 热榜已有基础数据，这里作为补充
      if (items.length < 5) {
        const altRe = /<h2[^>]*>\s*<a[^>]*href="(https?:\/\/www\.ithome\.com[^"]+)"[^>]*>([^<]+)<\/a>/gi;
        while ((m = altRe.exec(html)) !== null && items.length < 25) {
          const t = m[2].trim();
          if (t.length > 8) items.push({ raw_title: t, url: m[1], source: 'IT之家' });
        }
      }
      return items;
    }
  },
  // ── 数码闲聊站（Weibo 实时爆料 + 百度新闻聚合）──
  { name: '数码闲聊站', url: null,
    fetch: async () => {
      const items = [];
      // 方式1: 百度搜索数码闲聊站最新爆料
      try {
        const r = await fetch('https://www.baidu.com/s?wd=%E6%95%B0%E7%A0%81%E9%97%B2%E8%81%8A%E7%AB%99+%E6%9C%80%E6%96%B0%E7%88%86%E6%96%99&rn=20&tn=json',
          { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) });
        const html = await r.text();
        // 百度搜索结果
        const re = /"title":"([^"]{10,200})"[^}]*"url":"(https?:\/\/[^"]+)"/gi;
        let m;
        while ((m = re.exec(html)) !== null && items.length < 15) {
          const title = m[1].replace(/\\"/g, '"').replace(/<[^>]+>/g, '').trim();
          const url = m[2].replace(/\\\//g, '/');
          if ((title.includes('数码') || title.includes('爆料') || title.includes('新机') || title.includes('芯片') || title.includes('手机')) && title.length > 8) {
            items.push({ raw_title: title, url, source: '数码闲聊站' });
          }
        }
      } catch(e) { /* silent */ }
      // 方式2: 中文搜索引擎聚合
      if (items.length < 3) {
        try {
          const r2 = await fetch('https://www.sogou.com/web?query=数码闲聊站+爆料+2026',
            { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
          const html2 = await r2.text();
          const re2 = /<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([^<]{10,150})<\/a>/gi;
          let m2;
          while ((m2 = re2.exec(html2)) !== null && items.length < 12) {
            const t = m2[2].replace(/<[^>]+>/g, '').trim();
            if ((t.includes('数码') || t.includes('手机') || t.includes('芯片') || t.includes('新机')) && t.length > 8) {
              items.push({ raw_title: t, url: m2[1], source: '数码闲聊站' });
            }
          }
        } catch(e) { /* silent */ }
      }
      return items;
    }
  },
  // ── GitHub Trending（今日热门仓库）──
  { name: 'GitHub Trending', url: null,
    fetch: async () => {
      try {
        const res = await fetch('https://api.github.com/search/repositories?q=created:>2026-06-24&sort=stars&order=desc&per_page=15', { headers: { 'User-Agent': 'LumaPost' } });
        const data = await res.json();
        return (data.items || []).map(r => ({
          raw_title: `[GitHub] ${r.full_name}: ${r.description || ''}`,
          url: r.html_url,
          source: 'GitHub Trending',
          raw_desc: `⭐ ${r.stargazers_count} stars | ${r.language || ''} | ${r.description || ''}`.slice(0, 120),
        }));
      } catch(e) { return []; }
    }
  },
  // ── Product Hunt 今日热门 ──
  { name: 'Product Hunt', url: null,
    fetch: async () => {
      try {
        const body = JSON.stringify({
          query: `{
            posts(order: RANKING, first: 12) {
              edges { node { name tagline url { url } } }
            }
          }`
        });
        const res = await fetch('https://api.producthunt.com/v2/api/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'LumaPost/1.0' },
          body,
          signal: AbortSignal.timeout(8000),
        });
        const data = await res.json();
        return (data.data?.posts?.edges || []).map(e => ({
          raw_title: `[Product Hunt] ${e.node.name}: ${(e.node.tagline||'').slice(0,60)}`,
          url: e.node.url?.url || `https://www.producthunt.com/products/${e.node.name?.toLowerCase().replace(/\s+/g,'-')}`,
          source: 'Product Hunt',
        }));
      } catch(e) { return []; }
    }
  },
  // ── Hacker News 热门 ──
  { name: 'Hacker News', url: null,
    fetch: async () => {
      try {
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), 8000);
        const res = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json', { signal: ctrl.signal });
        const ids = await res.json();
        const top10 = ids.slice(0, 12);
        const items = [];
        await Promise.all(top10.map(async (id) => {
          try {
            const c = new AbortController();
            setTimeout(() => c.abort(), 5000);
            const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { signal: c.signal });
            const item = await r.json();
            if (item && item.title) {
              items.push({ raw_title: `[Hacker News] ${item.title}`, url: item.url || `https://news.ycombinator.com/item?id=${id}`, source: 'Hacker News' });
            }
          } catch(e) {}
        }));
        return items;
      } catch(e) { return []; }
    }
  },
];

async function fetchExtraNewsContext() {
  const allItems = [];
  for (const src of EXTRA_SOURCES) {
    try {
      let items = [];
      if (src.fetch) {
        // 使用 fetch 函数（GitHub Trending / Product Hunt / HN）
        console.log(`  ⏳ ${src.name}: API 获取中...`);
        items = await src.fetch();
      } else if (src.url) {
        // 使用 URL + HTML 解析
        const controller = new AbortController();
        const to = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(src.url, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
        clearTimeout(to);
        if (!res.ok) { console.log(`  ⚠ ${src.name}: HTTP ${res.status}`); continue; }
        const html = await res.text();
        items = src.extract(html);
      }
      if (items.length > 0) {
        allItems.push({ source: src.name, items });
        console.log(`  ✓ ${src.name}: ${items.length} 条`);
      } else {
        console.log(`  ⚠ ${src.name}: 无数据`);
      }
    } catch (e) { console.log(`  ⚠ ${src.name}: ${e.message}`); }
  }
  return allItems;
}

// ─────────────────────────────────────────────
//  关键词过滤热榜 — 为指定版块筛选相关热榜条目
// ─────────────────────────────────────────────
function filterBoardsForSection(sectionKey, boards) {
  const keywords = SECTION_KEYWORDS[sectionKey] || [sectionKey];
  const relevant = [];

  for (const board of boards) {
    for (const item of board.items) {
      const text = (item.raw_title + ' ' + item.raw_desc).toLowerCase();
      const matches = keywords.some(kw => text.includes(kw.toLowerCase()));
      if (matches) {
        relevant.push({ ...item, sourcePlatform: board.type });
      }
    }
  }

  // 如果筛选结果太少，返回前 3 最热的条目作为兜底
  if (relevant.length < 2) {
    const allItems = boards.flatMap(b => b.items.map(i => ({ ...i, sourcePlatform: b.type })));
    allItems.sort((a, b) => (b.hot || 0) - (a.hot || 0));
    return allItems.slice(0, 3);
  }

  relevant.sort((a, b) => (b.hot || 0) - (a.hot || 0));
  return relevant.slice(0, 8);
}

function boardsItemsToText(items) {
  if (!items || items.length === 0) return '暂无相关热榜数据';
  return items.map(i =>
    `[${i.sourcePlatform || i.source}#${i.rank || '?'}] ${i.raw_title}${i.raw_desc ? ' — ' + i.raw_desc : ''}${i.updateTime ? ' (' + i.updateTime + ')' : ''}`
  ).join('\n');
}

// ─────────────────────────────────────────────
//  AI 生成一组版块（4 个版块，一次 API 调用）
// ─────────────────────────────────────────────
async function generateSectionGroup(group, periodCfg) {
  const secNames = group.map(s => s.name).join(' / ');
  const sectionsDesc = group.map(s =>
    `  - ${s.name}（sectionKey: "${s.key}"）`
  ).join('\n');

  // 合并这组版块的热榜数据（去重）
  const allItemsMap = new Map();
  for (const sec of group) {
    for (const item of (sec._filteredBoards || [])) {
      const key = item.raw_title;
      if (!allItemsMap.has(key)) allItemsMap.set(key, item);
    }
  }
  const mergedItems = [...allItemsMap.values()];
  const boardsText = boardsItemsToText(mergedItems);

  const prompt = `你是 LumaPost 光影邮报的新闻主编。当前时段：${periodCfg.label}（${periodCfg.focus}）。
当前日期：${new Date().toLocaleDateString('zh-CN')}。

━━━━━━━━━━━━━━━━━━━━━
以下是你负责的 4 个版块：
${sectionsDesc}
━━━━━━━━━━━━━━━━━━━━━

以下是可能与这些版块相关的热榜素材（优先级从高到低）：
${boardsText}

━━━━━━━━━━━━━━━━━━━━━
任务：为上述 4 个版块各生成尽可能多的新闻（至少 3 条，没有上限，获取到几条就生成几条）。

规则：
1. 每条新闻必须与版块主题严格匹配——不要把游戏新闻放到 AI 版块
2. 优先基于热榜素材中与该版块真正相关的条目生成新闻
3. 如果某版块没有相关热榜素材，基于你对当前行业动态的了解生成真实新闻
4. title 要抓眼球，**summary 必须 60-120 字**：背景+核心事实+影响，不要只写一句话
5. **【最重要】commentary（AI 深度解析）必须 100-200 字**：
   - 第一句直接回答"这意味着什么/为什么重要"
   - 用大白话分析背后的逻辑或趋势（普通人能看懂）
   - 给出正反面分析：谁受益？谁受损？有什么风险？
   - 结尾一句有态度的判断（"我认为...""值得注意的是..."）
   - 严禁空洞套话，必须有具体观点和数据/对比
6. quicknote 犀利短评(15-30字)：像脱口秀一样幽默有态度
7. source 标注来源平台（如"知乎""微博""36氪"等）
8. time 字段使用素材中标注的时间（ISO 8601 格式）；若无则用当前时间

严格返回以下 JSON 格式（只返回 JSON，不要解释）：
{
  "sections": [
    {
      "sectionKey": "${group[0].key}",
      "items": [
        {"title":"新闻标题","summary":"60-120字摘要","commentary":"100-200字AI深度解析（必填，必须有具体观点）","quicknote":"犀利短评","source":"来源","url":"https://...","time":"2026-07-01T11:30:00.000Z"}
      ]
    },
    {
      "sectionKey": "${group[1].key}",
      "items": [...]
    },
    ...
  ]
}`;

  const text = await retry(() =>
    ai.chat([{ role: 'user', content: prompt }], { temperature: 0.6, maxTokens: 16000 })
  );

  const data = safeJSON(text);

  if (!data || !data.sections) {
    console.warn(`    ⚠️ 组 [${secNames}] AI 返回格式错误，使用降级`);
    return group.map(sec => ({
      key: sec.key, name: sec.name, colorKey: sec.colorKey,
      items: fallbackItemsForSection(sec),
    }));
  }

  const results = [];
  for (const sec of group) {
    const aiSec = (data.sections || []).find(s => s.sectionKey === sec.key);
    if (aiSec && Array.isArray(aiSec.items) && aiSec.items.length > 0) {
      results.push({
        key: sec.key, name: sec.name, colorKey: sec.colorKey,
        items: aiSec.items.map((item, i) => {
          const t = item.time ? new Date(item.time) : null;
          const validTime = t && !isNaN(t.getTime()) ? t.toISOString() : new Date().toISOString();
          return {
          title: item.title || `${sec.name} 动态`,
          summary: item.summary || '',
          commentary: item.commentary || '',
          quicknote: item.quicknote || '',
          source: item.source || '综合',
          url: item.url || 'https://uapis.cn',
          time: validTime,
          stars: Math.max(2, 5 - i),
          verified: true,
        }}),
      });
    } else {
      results.push({
        key: sec.key, name: sec.name, colorKey: sec.colorKey,
        items: fallbackItemsForSection(sec),
      });
    }
  }

  return results;
}

function fallbackItemsForSection(sec) {
  return [{
    title: `${sec.name} 今日速览`,
    summary: `今日「${sec.name}」领域暂无重大热点事件，可关注后续更新。`,
    quicknote: '今日平静',
    source: 'LumaPost',
    url: 'https://uapis.cn',
    time: new Date().toISOString(),
    stars: 2, verified: true,
  }];
}

// ─────────────────────────────────────────────
//  生成头条 + TLDR + 趋势总结
// ─────────────────────────────────────────────
async function generateHeadlinesAndSummary(allSectionsData, periodCfg) {
  // 收集所有新闻供参考
  const allTitles = [];
  for (const sec of allSectionsData) {
    for (const item of (sec.items || [])) {
      allTitles.push(`[${sec.name}] ${item.title} — ${item.summary}`);
    }
  }
  const contextText = allTitles.slice(0, 20).join('\n');

  const prompt = `你是 LumaPost 光影邮报的总编辑。时段：${periodCfg.label}。
当前日期：${new Date().toLocaleDateString('zh-CN')}。

以下是今天所有版块的新闻摘要：
${contextText}

━━━━━━━━━━━━━━━━━━━━━
任务：
1. 选出 3 条最重要的新闻作为今日头条（必须是不同领域）
2. 写一句话 TLDR 总结今天最值得关注的事（30 字以内）
3. 给出 5 个关键趋势分析

每条头条包含：title / **summary(80-150字，交代来龙去脉)** / **commentary(AI主编深度解读 300-500 字，必须做到以下要求)** / source / url

**commentary 深度解读必须满足（最重要）：**
- 开头直接回答"这意味着什么/为什么重要"
- 用大白话解释技术/商业逻辑，假设读者是聪明的普通人但不是行业专家
- 给出正反两面分析（比如：利好是谁？风险在哪？谁会受损？）
- 适当加入数据、对比或历史参照（"对比去年..."、"相当于..."）
- 结尾给出你的判断或预测（"我认为..."）
- 禁止空洞套话（如"值得关注""拭目以待"），要有具体观点
- 风格像财新/虎嗅的深度专栏，不是新闻通稿

趋势包含：category(领域名+emoji) / trend(核心趋势一句话) / **detail(80-150字深度分析)**

严格返回 JSON（只返回 JSON）：
{
  "tldr": "一句话总结",
  "headlines": [
    {"title":"...","summary":"...","commentary":"...","source":"...","url":"..."},
    {"title":"...","summary":"...","commentary":"...","source":"...","url":"..."},
    {"title":"...","summary":"...","commentary":"...","source":"...","url":"..."}
  ],
  "summary": [
    {"category":"🤖 AI","trend":"...","detail":"..."},
    {"category":"💻 硬件","trend":"...","detail":"..."},
    {"category":"💰 财经","trend":"...","detail":"..."},
    {"category":"🌍 国际","trend":"...","detail":"..."},
    {"category":"🤖 人形机器人","trend":"...","detail":"..."}
  ]
}`;

  const text = await retry(() =>
    ai.chat([{ role: 'user', content: prompt }], { temperature: 0.6, maxTokens: 16000 })
  );

  const data = safeJSON(text);

  if (!data) {
    console.warn('  ⚠️ 头条生成失败，使用备用方案');
    return {
      tldr: `${periodCfg.label}新闻汇总`,
      headlines: allSectionsData.slice(0, 3).map(sec => {
        const item = sec.items[0] || {};
        return {
          title: item.title || sec.name,
          summary: item.summary || '',
          commentary: `今日「${sec.name}」最重要的一条新闻。`,
          source: item.source || '综合',
          url: item.url || 'https://uapis.cn',
          time: item.time || new Date().toISOString(),
          verified: true,
        };
      }),
      summary: [
        { category:'🤖 AI', trend:'详见各版块', detail:'基于今日热榜与 AI 分析汇总。' },
        { category:'💻 硬件', trend:'详见各版块', detail:'基于今日热榜与 AI 分析汇总。' },
        { category:'💰 财经', trend:'详见各版块', detail:'基于今日热榜与 AI 分析汇总。' },
        { category:'🌍 国际', trend:'详见各版块', detail:'基于今日热榜与 AI 分析汇总。' },
        { category:'🤖 人形机器人', trend:'详见各版块', detail:'基于今日热榜与 AI 分析汇总。' },
      ],
    };
  }

  return {
    tldr: data.tldr || '',
    headlines: (data.headlines || []).slice(0, 3).map(item => {
      const t = item.time ? new Date(item.time) : null;
      const validTime = t && !isNaN(t.getTime()) ? t.toISOString() : new Date().toISOString();
      return {
      title: item.title, summary: item.summary || '', commentary: item.commentary || '',
      source: item.source || '综合', url: item.url || 'https://uapis.cn',
      time: validTime, verified: true,
    }}),
    summary: (data.summary || []).slice(0, 5).map(item => ({
      category: item.category || '', trend: item.trend || '', detail: item.detail || '',
    })),
  };
}

// ─────────────────────────────────────────────
//  天气
// ─────────────────────────────────────────────
async function fetchWeather() {
  const lat = process.env.WEATHER_LAT || '28.20';
  const lon = process.env.WEATHER_LON || '112.97';
  try {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`, { signal: controller.signal });
    clearTimeout(to);
    const data = await res.json();
    const w = data.current_weather || {};
    const map = {0:'☀️ 晴朗',1:'🌤 少云',2:'⛅ 多云',3:'☁️ 阴天',45:'🌫 雾',48:'🌫 雾凇',51:'🌦 小雨',53:'🌦 中雨',55:'🌦 大雨',61:'🌧 雨',63:'🌧 中雨',65:'🌧 大雨',71:'🌨 小雪',73:'🌨 中雪',75:'🌨 大雪',80:'🌦 阵雨',81:'🌦 强阵雨',82:'⛈ 强阵雨',95:'⛈ 雷暴',96:'⛈ 雷暴冰雹',99:'⛈ 强雷暴'};
    const city = process.env.WEATHER_CITY || '湖南长沙';
    return { location: city, text: map[w.weathercode] || '☁️ 多云', temp: `${Math.round(w.temperature)}°C` };
  } catch (e) {
    return { location: process.env.WEATHER_CITY || '湖南长沙', text: '☁️ 多云', temp: '26°C' };
  }
}

// ─────────────────────────────────────────────
//  每日一句
// ─────────────────────────────────────────────
function getQuote(period) {
  const q = {
    morning:['每一个不曾起舞的日子，都是对生命的辜负。——尼采','晨光熹微，万物初醒。'],
    noon:['正午的阳光最烈，但知识的光芒更持久。','一天之中，此刻最宜充电。'],
    afternoon:['信息的价值在于时效，行动的价值在于决断。——彼得·德鲁克','下午的咖啡配新闻，是创作者的最佳组合。'],
    evening:['复盘今日，规划明日，是智者的习惯。——曾文正公','夜色温柔，但世界从不停止转动。'],
  };
  const list = q[period] || q.morning;
  return list[Math.floor(Math.random() * list.length)];
}

// ─────────────────────────────────────────────
//  股市数据（Sina API，GBK编码）
// ─────────────────────────────────────────────
async function fetchStockData() {
  try {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 8000);
    const codes = ['s_sh000001','s_sz399001','s_sz399006','s_hkHSI'];
    const names = ['上证指数','深证成指','创业板指','恒生指数'];
    const res = await fetch(`https://hq.sinajs.cn/list=${codes.join(',')}`, {
      headers: { 'Referer': 'https://finance.sina.com.cn' },
      signal: controller.signal,
    });
    clearTimeout(to);

    // GBK 编码解码（Sina 返回 GBK）
    const buf = Buffer.from(await res.arrayBuffer());
    const td = new TextDecoder('gbk');
    const text = td.decode(buf);

    const results = [];
    const lines = text.split('\n').filter(Boolean);
    for (let i = 0; i < Math.min(lines.length, names.length); i++) {
      const m = lines[i].match(/"([^"]+)"/);
      if (!m) continue;
      const parts = m[1].split(',');
      if (parts.length < 4) continue;
      // Sina 指数格式: 名称, 当前价, 涨跌额, 涨跌幅%, 成交量, 成交额
      const price = parseFloat(parts[1]);
      const change = parseFloat(parts[2]);
      const pct = parseFloat(parts[3]);
      if (isNaN(price) || price === 0) continue;
      results.push({
        name: names[i],
        price: price.toFixed(2),
        change: (change >= 0 ? '+' : '') + change.toFixed(2),
        pct: (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%',
      });
    }
    return results.length > 0 ? results : null;
  } catch (e) { return null; }
}

// ─────────────────────────────────────────────
//  主流程
// ─────────────────────────────────────────────
async function main() {
  const args = {};
  process.argv.slice(2).forEach(a => {
    if (a.startsWith('--')) { const [k, v] = a.slice(2).split('='); args[k] = v || true; }
  });

  const periodKey = args.period || (['morning','noon','afternoon','evening'][Math.min(3, Math.floor(new Date().getHours() / 6))]);
  const periodCfg = PERIOD_CONFIG[periodKey] || PERIOD_CONFIG.morning;
  const outputFile = args.output || `data/${periodKey}-latest.json`;

  // Run lock
  const lockPath = acquireLock(`fetch-${periodKey}`, 1800000);
  if (!lockPath) {
    console.log(`⚠️ ${periodCfg.label} 刚刚已执行过，跳过重复运行。`);
    process.exit(0);
  }

  console.log(`🚀 LumaPost ${periodCfg.label} 新闻抓取 (v2.6 多信息源)`);
  console.log(`📍 时段: ${periodCfg.label} | 重点: ${periodCfg.focus}`);
  try {
    console.log(`🤖 AI: ${ai.getConfig().providerName} (${ai.getConfig().model})`);
  } catch (e) {
    console.log(`⚠️ AI 未配置，将使用降级模式: ${e.message}`);
  }
  console.log();

  // 版块筛选
  const sections = getEnabledSections();
  if (sections.length < ALL_SECTIONS.length) {
    console.log(`📋 已筛选版块: ${sections.map(s => s.name).join(' / ')}`);
  }

  let aiMode = true;
  try { ai.getConfig(); } catch (e) {
    aiMode = false;
    console.log(`⚠️ AI 模式不可用，使用纯热榜降级模式`);
  }

  // ── 1) 热榜 ──
  console.log('📰 抓取热榜...');
  const boards = await fetchAllBoards();
  console.log(`  ✓ ${boards.length} 平台，${boards.reduce((s,b)=>s+b.items.length,0)} 条`);

  // ── 1.5) 额外信息源 ──
  console.log('\n🔗 抓取额外信息源...');
  const extraSources = await fetchExtraNewsContext();
  // 将额外信息源混入 boards（作为独立平台处理）
  for (const es of extraSources) {
    const fetchedAt = new Date().toISOString();
    boards.push({ type: es.source, items: es.items.map((item, i) => ({
      raw_title: item.raw_title,
      raw_desc: item.raw_desc || '',
      hot: 10 - Math.min(i, 9),
      rank: i + 1,
      url: item.url,
      source: item.source,
      updateTime: fetchedAt,
    }))});
  }
  console.log(`  ✓ 共计 ${boards.length} 个信息源，${boards.reduce((s,b) => s + b.items.length, 0)} 条新闻`);

  // ── 2) 为每个版块预筛选热榜 ──
  if (aiMode) {
    console.log('\n🔍 按版块关键词过滤热榜...');
    for (const sec of sections) {
      sec._filteredBoards = filterBoardsForSection(sec.key, boards);
      console.log(`  ${sec.name}: ${sec._filteredBoards.length} 条相关`);
    }
  }

  // ── 3) AI 分组生成 ──
  let tldr = '', headlines = [], sectionsData = [], summary = [];

  if (aiMode) {
    // 4 组 × 4 版块
    const groups = [];
    for (let i = 0; i < sections.length; i += 4) {
      groups.push(sections.slice(i, i + 4));
    }

    console.log(`\n🧠 AI 分组生成（${groups.length} 组，每组 4 版块）...`);

    const allResults = [];

    try {
      // 第1批：组 0,1 并行
      if (groups.length >= 2) {
        console.log('  ⏳ 第1批（组1+组2）并行...');
        const [r0, r1] = await Promise.all([
          generateSectionGroup(groups[0], periodCfg),
          generateSectionGroup(groups[1], periodCfg),
        ]);
        allResults.push(...r0, ...r1);
        console.log(`  ✓ 组1(${r0.length}版块) + 组2(${r1.length}版块)`);
      } else {
        const r0 = await generateSectionGroup(groups[0], periodCfg);
        allResults.push(...r0);
      }

      // 第2批：组 2,3 并行
      if (groups.length > 2) {
        console.log('  ⏳ 第2批（组3+组4）并行...');
        const promises = [];
        if (groups[2]) promises.push(generateSectionGroup(groups[2], periodCfg));
        if (groups[3]) promises.push(generateSectionGroup(groups[3], periodCfg));
        const results = await Promise.all(promises);
        for (const r of results) allResults.push(...r);
        console.log(`  ✓ 组3(${results[0]?.length || 0}版块) + 组4(${results[1]?.length || 0}版块)`);
      }

      sectionsData = allResults;
      const totalItems = sectionsData.reduce((s, sec) => s + sec.items.length, 0);
      console.log(`  ✅ 全部版块生成完成: ${sectionsData.length} 版块 / ${totalItems} 条新闻`);

      // ── 4) 生成头条 + TLDR + 趋势 ──
      console.log('\n📰 生成头条 & TLDR & 趋势...');
      const hsResult = await generateHeadlinesAndSummary(sectionsData, periodCfg);
      tldr = hsResult.tldr;
      headlines = hsResult.headlines;
      summary = hsResult.summary;
      console.log(`  ✓ TLDR: ${tldr.slice(0, 30)}... | 头条: ${headlines.length} | 趋势: ${summary.length}`);

    } catch (e) {
      console.log(`  ⚠ AI 生成失败: ${e.message}`);
      console.log(`  📊 使用降级模式（纯热榜数据）`);
      aiMode = false;
    }
  }

  // 降级：不用 AI
  if (!aiMode) {
    tldr = `${periodCfg.label}（降级模式）`;
    sectionsData = sections.length > 0 ? sections.map(sec => {
      const items = sec._filteredBoards && sec._filteredBoards.length > 0
        ? sec._filteredBoards.map((item, i) => ({
            title: item.raw_title,
            summary: item.raw_desc || item.raw_title,
            quicknote: `${item.sourcePlatform || '热榜'} #${item.rank || i+1}`,
            source: `${item.sourcePlatform}热榜`,
            url: item.url || 'https://uapis.cn',
            time: item.updateTime ? new Date(item.updateTime).toISOString() : new Date().toISOString(),
            stars: Math.max(2, 5 - i), verified: true,
          }))
        : fallbackItemsForSection(sec);
      return { key: sec.key, name: sec.name, colorKey: sec.colorKey, items };
    }) : [];
    headlines = sectionsData.flatMap(s => s.items.slice(0, 1).map(i => ({
      title: i.title, summary: i.summary, commentary: `今日「${s.name}」最受关注的热点话题。`,
      source: i.source, url: i.url, time: i.time, verified: true,
    }))).slice(0, 3);
    summary = [
      { category:'🤖 AI', trend:'热榜驱动趋势', detail:'基于今日热榜数据汇总的 AI 领域动态。' },
      { category:'💻 硬件', trend:'热榜驱动趋势', detail:'基于今日热榜数据汇总的硬件领域动态。' },
      { category:'💰 财经', trend:'热榜驱动趋势', detail:'基于今日热榜数据汇总的财经领域动态。' },
      { category:'🌍 国际', trend:'热榜驱动趋势', detail:'基于今日热榜数据汇总的国际领域动态。' },
    ];
  }

  // ── 5) 股市数据 ──
  const stocks = await fetchStockData();
  if (stocks) {
    console.log(`\n📈 股市: ${stocks.map(s => `${s.name} ${s.price}(${s.pct})`).join(' | ')}`);
  }

  // ── 6) 天气 ──
  const weather = await fetchWeather();

  // ── 7) 完整性检查 ──
  const totalItems = sectionsData.reduce((s, sec) => s + sec.items.length, 0);
  const quality = totalItems >= 40 ? 'GOOD' : totalItems >= 20 ? 'DEGRADED' : 'LOW';

  const data = {
    date: `${new Date().getFullYear()}年${new Date().getMonth()+1}月${new Date().getDate()}日`,
    timeWindow: periodCfg.timeWindow,
    greetingType: periodCfg.greetingType,
    greeting: periodCfg.greeting,
    dailyQuote: getQuote(periodKey),
    tldr,
    stocks,
    weather,
    headline: headlines,
    sections: sectionsData.filter(s => s.items && s.items.length > 0),
    summary,
    meta: {
      version: '2.6',
      aiMode,
      quality,
      generatedAt: new Date().toISOString(),
      period: periodKey,
    },
  };

  // ── 8) 写入文件 ──
  const dir = path.dirname(outputFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(data, null, 2), 'utf8');

  console.log(`\n✅ 完成！(${quality})`);
  console.log(`📂 ${outputFile} (${(fs.statSync(outputFile).size/1024).toFixed(1)} KB)`);
  console.log(`📊 头条 ${data.headline.length} | 版块 ${data.sections.length} | 趋势 ${data.summary.length} | 新闻 ${totalItems} 条`);
  if (quality === 'LOW') {
    console.warn(`⚠️ 内容质量偏低，请检查 AI API 余额或热榜数据源。`);
  }

  releaseLock(lockPath);
}

main().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
