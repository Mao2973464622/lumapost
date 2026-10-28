#!/usr/bin/env node
/**
 * fetch-news-ai.js — AI 驱动的新闻抓取脚本（v4.0）
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
const jsonRepair = require('./json-repair');

// v10.5.0：单次 AI 调用的版块数与并发数（实测 4 版块会长到被 maxTokens 截断）
const GROUP_SIZE = 2;

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

function getStore() {
  try { return require('./config-store'); } catch (e) { return null; }
}

/**
 * 取本次要抓取的版块列表。
 *
 * v10.7.0 语义变更（重要）：
 *   旧逻辑 —— `sections.enabled` 为空数组时回落到「全部版块」，
 *   导致「默认全部关闭」实际变成了「默认全开」，与用户预期相反。
 *   新逻辑 —— 空数组就是「一个版块都不抓」，返回 []，
 *   由调用方给出明确提示并终止。
 *   优先级：环境变量 ENABLED_SECTIONS > 配置文件 sections.enabled。
 */
function getEnabledSections() {
  const filter = process.env.ENABLED_SECTIONS;
  if (filter) {
    const keys = new Set(filter.split(',').map(function (s) { return s.trim(); }).filter(Boolean));
    if (!keys.size) return [];
    return ALL_SECTIONS.filter(function (s) { return keys.has(s.key); });
  }
  const store = getStore();
  const fromFile = store ? store.get('sections.enabled') : undefined;
  if (Array.isArray(fromFile)) {
    // 空数组 = 用户显式全部关闭，不再回落到全量
    if (!fromFile.length) return [];
    const keys = new Set(fromFile);
    return ALL_SECTIONS.filter(function (s) { return keys.has(s.key); });
  }
  // 配置项完全缺失（老版本配置文件）时才回落到全量
  return ALL_SECTIONS;
}

// ─────────────────────────────────────────────
//  工具
// ─────────────────────────────────────────────

/** v10.5.0：项目版本号统一来源（不再硬写 v3.0/v4.0） */
let _ver = null;
function pkgVersion() {
  if (_ver) return _ver;
  try { _ver = require('../package.json').version; } catch (e) { _ver = '0.0.0'; }
  return _ver;
}

/** v10.5.0：温度取配置值，参数仅作缺省兜底 */
function tempOf(def) {
  try {
    const cfg = ai.getConfig();
    if (cfg && Number.isFinite(Number(cfg.temperature))) return Number(cfg.temperature);
  } catch (e) { /* 用默认 */ }
  return def;
}

/**
 * v10.5.0：按配置计算单次调用 maxTokens。
 *
 * 实测诊断（本轮抓包确认）：
 *   本机使用的模型 raccoon/sn-sensenova-6-8-flash-lite 是**推理模型**，
 *   先消耗推理 token 再产出正文。实测某次请求：
 *     max_tokens=3600 → usage.completion_tokens=3600（全部被 reasoning_tokens 吃光）
 *                        finish_reason=length, message.content=""（空字符串！）
 *   旧代码把这个空串当正常返回 → JSON 解析失败 → 整组降级 → 邮件永远没有 AI 解读。
 *
 * 所以：翻译预算必须 > 推理开销 + 正文开销。给推理留 2000，正文按每版块 2200 估算，
 * 整体封顶 16000（多数模型上限内）。同时 ai-provider 已有空响应重试兜底。
 */
function groupTokenBudget(sectionCount) {
  let configured = 4096;
  try {
    const cfg = ai.getConfig();
    configured = Number(cfg.maxTokens) || 4096;
  } catch (e) { /* 默认 */ }
  const reasoningHeadroom = 2000;
  const need = reasoningHeadroom + Math.max(2200, (Number(sectionCount) || 1) * 2200);
  return Math.min(16000, Math.max(configured, need));
}

/** 从错误信息判断是否为「上下文/额度超限」类失败，便于给出可操作的提示 */
function explainTokenError(msg) {
  const m = String(msg || '');
  if (/max_tokens|max tokens|too large|context length|exceeds/i.test(m)) {
    return '疑似 maxTokens 超过模型上限，请在 设置→AI 降低 maxTokens（建议 2000-4000）或改用更大上下文的模型';
  }
  if (/401|invalid.*key|authentication|Unauthorized/i.test(m)) return 'API Key 无效或已失效';
  if (/402|insufficient|quota|balance/i.test(m)) return 'API 额度不足';
  if (/429|rate/i.test(m)) return '触发限流，稍后重试';
  if (/timeout|ETIMEDOUT|ECONN/i.test(m)) return 'AI 接口网络超时（检查 baseUrl 是否可达）';
  return '';
}

/**
 * v10.5.0：修复「字符串值内含未转义双引号」的非法 JSON。
 *
 * 实测根因：模型写中文内容时会用 ASCII 双引号包术语，例如
 *   {"summary":"Anthropic正式递交招股书，冲刺"超级智能第一股"。..."}
 * 这在 JSON 里非法，JSON.parse 直接抛错 → safeJSON 返回 null → 整组降级。
 * 这才是"AI 解读长期消失"的真正原因（与 maxTokens、额度都无关）。
 *
 * 策略：逐字符扫描，在字符串内部遇到 " 时向后窥探首个非空白字符：
 *   - 是 , } ] : 或已到末尾 → 视为合法的字符串结束
 *   - 否则 → 是内嵌裸引号，转义为 \"
 * 另处理反斜杠转义与非法控制符。失败则原样返回，交由上层继续兜底。
 */
function safeJSON(text) {
  // v10.5.0：实现下沉到 json-repair.js（模型常在 JSON 字符串里写未转义引号，
  // 旧版直接判定"格式错误"并整组降级 —— 这是 AI 解读长期消失的真正根因）
  return jsonRepair.parseLoose(text);
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
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * v10.5.0：热榜抓取统一交给 hotboard 模块（并发 + 可配置平台）。
 * 旧实现在这里又串行抓 15 个平台 + 每平台 sleep 300ms，
 * 与 fetchExtraNewsContext() 里的 hot.fetchAll() 完全重复，白白多花 20~30 秒且喂给 AI 一堆重复条目。
 */
async function fetchAllBoards() {
  const out = [];
  try {
    const hot = require('./hotboard');
    const store = getStore();
    const enh = (store && store.get('sources.enhance')) || {};   // v10.7.0：enhance 已并入 sources
    const types = Array.isArray(enh.hotTypes) && enh.hotTypes.length ? enh.hotTypes : null;
    const results = await hot.fetchAllHotboards(types, { limit: 6, concurrency: 6 });
    for (const r of results) {
      if (r.error || !r.items.length) continue;
      out.push({
        type: r.type,
        name: r.name,
        category: r.category,
        items: r.items.map((it) => ({
          raw_title: it.title,
          raw_desc: (it.summary || '').slice(0, 100),
          hot: 10 - Math.min((it.rank || 1) - 1, 9),
          rank: it.rank || 1,
          url: it.link,
          source: r.name,
          updateTime: it.publishedAt,
        })),
      });
    }
  } catch (e) {
    console.warn('  ⚠ 热榜抓取失败:', e.message);
  }
  return out;
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
          const r2 = await fetch('https://www.sogou.com/web?query=数码闲聊站+爆料+' + new Date().getFullYear(),
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
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
        const res = await fetch(`https://api.github.com/search/repositories?q=created:>${weekAgo}&sort=stars&order=desc&per_page=15`, { headers: { 'User-Agent': 'LumaPost' } });
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

  // ── A0) Steam / Epic / 行情 / GitHub Trending ──
  //     v10.5.0：中文热榜已改由 fetchAllBoards() 统一抓取，此处不再重复；
  //     并把股票数据作为正常返回值传出（旧代码用 global.__LUMAPOST_STOCKS__ 且无人读取）。
  const extras = { stocks: [], steam: [], epic: [], trending: [] };
  try {
    const hot = require('./hotboard');
    const store0 = getStore();
    const enhCfg = (store0 && store0.get('sources.enhance')) || {};   // v10.7.0：enhance 已并入 sources
    if (enhCfg.enableHotboard !== false) {
      console.log('  ⏳ Steam / Epic / 行情 / GitHub Trending...');
      const t0 = Date.now();
      const r = await hot.fetchAll({
        limit: 8,
        hotTypes: [],           // 传空数组：跳过热榜（由 fetchAllBoards 负责）
        steam: enhCfg.steam !== false,
        epic: enhCfg.epic !== false,
        stocks: enhCfg.stocks !== false,
        trending: enhCfg.trending !== false,
      });

      const pushGroup = (r2, name, cat) => {
        if (r2 && r2.items && r2.items.length) {
          allItems.push({
            source: name,
            category: cat,
            items: r2.items.map((it, i) => ({
              raw_title: it.title,
              raw_desc: it.summary || '',
              hot: 10 - Math.min(i, 9),
              rank: i + 1,
              url: it.link,
              source: name,
              updateTime: it.publishedAt,
            })),
          });
          extras[cat === 'games' ? (name.indexOf('Epic') >= 0 ? 'epic' : 'steam') : 'trending'] = r2.items;
        } else if (r2 && r2.error) {
          console.log('    · ' + name + ' 不可用: ' + r2.error);
        }
      };
      pushGroup(r.steam, 'Steam 特惠', 'games');
      pushGroup(r.epic, 'Epic 限免', 'games');
      pushGroup(r.trending, 'GitHub Trending', 'github');

      if (r.stocks && r.stocks.items && r.stocks.items.length) extras.stocks = r.stocks.items;

      console.log(`  ✓ Steam ${extras.steam.length} · Epic ${extras.epic.length} · GitHub ${extras.trending.length} · 行情 ${extras.stocks.length}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    }
  } catch (e) {
    console.log(`  ⚠ 增强数据源不可用: ${e.message}`);
  }

  // ── A) RSS 订阅源（内置目录 + 用户自定义，优先）──
  //     v10.5.0 修复：旧代码在这里 `return allItems`，导致一旦配置了 RSS，
  //     后面的 AIbase / IT之家 / Hacker News / Product Hunt 等源永不执行。
  //     现在 RSS 与网页源并存，由 sourceMix 开关决定。
  let rssOk = false;
  try {
    const rssFetcher = require('./rss-fetcher');
    const store = getStore();
    const srcCfg = (store && store.get('sources')) || {};
    const userRss = Array.isArray(srcCfg.rss) ? srcCfg.rss.filter((s) => s && s.enabled !== false && s.url) : [];

    if (srcCfg.enableRss !== false && userRss.length) {
      console.log(`  ⏳ RSS 订阅源: ${userRss.length} 个...`);
      const t0 = Date.now();
      const results = await rssFetcher.fetchAll(userRss, { concurrency: 8, limit: 8, timeout: 15000 });
      const agg = rssFetcher.aggregate(results, { limit: 20 });

      for (const r of results) {
        if (!r.error && r.items.length) {
          allItems.push({
            source: r.name,
            category: r.category,
            items: r.items.map((it, i) => ({
              raw_title: it.title,
              raw_desc: it.summary || '',
              hot: 10 - Math.min(i, 9),
              rank: i + 1,
              url: it.link,
              source: r.name,
              updateTime: it.publishedAt || new Date().toISOString(),
            })),
          });
        }
      }

      const okCount = results.filter((r) => !r.error && r.items.length).length;
      const failed = results.filter((r) => r.error);
      rssOk = okCount > 0;
      console.log(`  ✓ RSS: ${okCount}/${results.length} 成功，去重后 ${agg.total} 条，耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      if (failed.length) {
        console.log(`    ├ 失败源 ${failed.length} 个，Top3: ` + failed.slice(0, 3).map(f => f.name + '(' + (f.error || '?') + ')').join(', '));
        extras.rssErrors = failed.map(f => ({ name: f.name, error: f.error }));
      }
      extras.rssStats = { total: results.length, ok: okCount, items: agg.total };
    }
  } catch (e) {
    console.log(`  ⚠ RSS 引擎不可用: ${e.message}`);
  }

  // ── B) 网页/API 源：RSS 不通时必跑；RSS 正常时按配置决定是否并跑 ──
  const store1 = getStore();
  const mix = (store1 && store1.get('sources.useWebFallback')) !== false; // 默认 true
  if (!rssOk || mix) {
    console.log(rssOk ? '  ⏳ 网页源补充（useWebFallback=开）...' : '  ⏳ 网页源抓取（RSS 无数据，必须启用）...');
    for (const src of EXTRA_SOURCES) {
      try {
        let items = [];
        if (src.fetch) {
          items = await src.fetch();
        } else if (src.url) {
          const controller = new AbortController();
          const to = setTimeout(() => controller.abort(), 10000);
          const res = await fetch(src.url, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
          clearTimeout(to);
          if (!res.ok) { console.log(`  ⚠ ${src.name}: HTTP ${res.status}`); continue; }
          const html = await res.text();
          items = src.extract(html);
        }
        if (items.length > 0) {
          allItems.push({ source: src.name, category: guessCategory(src.name), items: items.map((it, i) => Object.assign({
            hot: 10 - Math.min(i, 9), rank: i + 1, raw_desc: it.raw_desc || '',
          }, it)) });
          console.log(`  ✓ ${src.name}: ${items.length} 条`);
        } else {
          console.log(`  ⚠ ${src.name}: 无数据`);
        }
      } catch (e) { console.log(`  ⚠ ${src.name}: ${e.message}`); }
    }
  }

  extras.allItems = allItems;
  return extras;
}

/** 网页源分类推断（供关键词过滤用） */
function guessCategory(name) {
  const n = String(name || '');
  if (/AI|ai-bot|猫目/i.test(n)) return 'ai';
  if (/IT之家|数码|CNMO/i.test(n)) return 'hardware';
  if (/GitHub|Product Hunt|Hacker/i.test(n)) return 'github';
  return 'news';
}

// ─────────────────────────────────────────────
//  关键词过滤热榜 — 为指定版块筛选相关热榜条目
// ─────────────────────────────────────────────
/**
 * v10.5.0：按版块过滤素材，并通过 MATERIAL_LIMIT 控制喂给 AI 的条数。
 *
 * 为什么限制：本机模型是**推理型**，prompt 越长推理 token 越多，
 * 实测喂 30+ 条素材时 reasoning_tokens 直接飙到 12800+ 把正文预算吃光，
 * 返回空 content。把素材压到每版块 6 条后推理开销明显下降。
 */
const MATERIAL_LIMIT = 6;

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
  return relevant.slice(0, MATERIAL_LIMIT);
}

/** v10.5.0：素材行也做长度压缩 —— 长摘要会显著推高推理模型的 reasoning_tokens */
function boardsItemsToText(items, maxDesc) {
  if (!items || items.length === 0) return '暂无相关热榜数据';
  const cap = Number(maxDesc) || 40;
  return items.map(i => {
    const desc = i.raw_desc ? String(i.raw_desc).slice(0, cap) : '';
    return '[' + (i.sourcePlatform || i.source || '热榜') + '#' + (i.rank || '?') + '] '
      + String(i.raw_title || '').slice(0, 70) + (desc ? ' — ' + desc : '');
  }).join('\n');
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
  const boardsText = boardsItemsToText(mergedItems, 40);

  const prompt = `你是 LumaPost 光影邮报的新闻主编。当前时段：${periodCfg.label}（${periodCfg.focus}）。
当前日期：${new Date().toLocaleDateString('zh-CN')}。

━━━━━━━━━━━━━━━━━━━━━
以下是你负责的 4 个版块：
${sectionsDesc}
━━━━━━━━━━━━━━━━━━━━━

以下是可能与这些版块相关的热榜素材（优先级从高到低）：
${boardsText}

━━━━━━━━━━━━━━━━━━━━━
任务：为上述 4 个版块各生成 3-4 条新闻（每版块最多 5 条；总量有预算上限，超出的会被丢弃，请勿堆量）。

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
6. **quicknote 是「读完后的简要概括」**（50-80 字）：
   - 你要假设读者只读这一句就知道这条新闻到底讲了什么
   - 用一句话把核心事实 + 最关键的那个数字/结论说清楚
   - 不要评价、不要态度、不要「值得关注」这类空话，就是纯粹的信息浓缩
   - 严禁写来源、平台名、排名、"#1" 之类元信息
7. source 标注来源平台（如"知乎""微博""36氪"等）
8. time 字段使用素材中标注的时间（ISO 8601 格式）；若无则用当前时间

【JSON 合法性要求（极重要，违反会导致整组内容被丢弃）】
- 字段值内禁止出现未转义的英文双引号 " ；需要引用术语时使用中文引号「」或『』
- 字段值内禁止出现换行符；保持单行
- 只输出 JSON 本身，不要 markdown 代码块围栏，不要任何解释文字

严格返回以下 JSON 格式（只返回 JSON，不要解释）：
{
  "sections": [
    {
      "sectionKey": "${group[0].key}",
      "items": [
        {"title":"新闻标题","summary":"60-120字摘要","commentary":"100-200字AI深度解析（必填，必须有具体观点）","quicknote":"50-80字读完后的简要概括，只讲事实不讲态度","source":"来源","url":"https://...","time":"2026-07-01T11:30:00.000Z"}
      ]
    },
    {
      "sectionKey": "${group[1].key}",
      "items": [...]
    },
    ...
  ]
}`;

  // v10.5.0：maxTokens 尊重配置（旧代码硬写 16000，让 UI 里的 AI_MAX_TOKENS 完全失效，
  //          且小上下文模型直接超限报错 → 被 catch 吞掉 → 静默降级）
  const budget = groupTokenBudget(group.length);
  const text = await retry(() =>
    ai.chat([{ role: 'user', content: prompt }], { temperature: tempOf(0.6), maxTokens: budget })
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
          url: item.url || '',          // v10.5.0：不再用 https://uapis.cn 冒充原文链接
          time: validTime,
          stars: Math.max(2, 5 - i),
          verified: false,              // v10.5.0：AI 生成内容不做"已核实"承诺
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

/**
 * v10.5.1：降级/兜底条目的一句话概括。
 *
 * 旧实现把 quicknote 写成 `来源 #排名`（如 `csdn #1`），
 * 这在邮件里表现为一个显眼的淡紫色空框 —— 它既不是信息也不是概括，
 * 只是把内部分类元数据泄漏给了读者。现在改为：
 *   优先用素材自带的描述浓缩成一句话；没有描述就直接留空，不生成占位噪声。
 */
function plainBrief(item) {
  const desc = String((item && (item.raw_desc || item.summary)) || '').trim();
  if (desc.length >= 12) {
    // 去掉常见的站内噪声前缀，压到 60 字以内，作为「读完后的简要概括」
    const cleaned = desc
      .replace(/^(【[^】]{1,12}】|据[^，,]{1,20}[，,])/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned.length >= 12) {
      return cleaned.length > 60 ? cleaned.slice(0, 60) + '…' : cleaned;
    }
  }
  return '';
}

/**
 * v10.5.0：AI 某版块返回缺失时的兜底 —— 用该版块已过滤的真实热榜条目，
 * 不再编造「XX 今日速览 / 今日平静」这类占位假新闻发给收件人。
 */
function fallbackItemsForSection(sec) {
  const real = (sec._filteredBoards || [])
    .filter(it => it && it.raw_title && it.sourcePlatform)   // 只认真实来源，过滤掉兜底塞入的无关条目
    .slice(0, 5)
    .map((item, i) => ({
      title: item.raw_title,
      summary: item.raw_desc || '',
      commentary: '',
      quicknote: plainBrief(item),
      source: String(item.sourcePlatform || '热榜'),
      url: item.url || '',
      time: item.updateTime || new Date().toISOString(),
      stars: Math.max(2, 5 - i),
      verified: false,
      degraded: true,
    }));
  if (real.length) {
    console.warn(`    · ${sec.name}: AI 未返回，回落 ${real.length} 条真实热榜（无解读）`);
    return real;
  }
  console.warn(`    · ${sec.name}: AI 未返回且无真实素材 → 丢弃该版块（不编造内容）`);
  return [];
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

【同上 JSON 合法性要求：值内不得有未转义英文双引号（用「」）、不得有换行符、只输出 JSON】

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

  // v10.5.0：maxTokens 取配置（旧硬写 16000）
  const text = await retry(() =>
    ai.chat([{ role: 'user', content: prompt }], { temperature: tempOf(0.5), maxTokens: groupTokenBudget(4) })
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
  const store = getStore();
  const wCfg = (store && store.get('weather')) || {};
  const lat = process.env.WEATHER_LAT || wCfg.lat || '28.20';
  const lon = process.env.WEATHER_LON || wCfg.lon || '112.97';
  const city = process.env.WEATHER_CITY || wCfg.city || '湖南长沙';
  try {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 6000);
    const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&current_weather=true&timezone=auto', { signal: controller.signal });
    clearTimeout(to);
    const data = await res.json();
    const w = data.current_weather || {};
    const map = {0:'晴朗',1:'少云',2:'多云',3:'阴天',45:'雾',48:'雾凇',51:'小雨',53:'中雨',55:'大雨',61:'雨',63:'中雨',65:'大雨',71:'小雪',73:'中雪',75:'大雪',80:'阵雨',81:'强阵雨',82:'强阵雨',95:'雷暴',96:'雷暴冰雹',99:'强雷暴'};
    return { location: city, text: map[w.weathercode] || '多云', temp: Math.round(w.temperature) + '°C' };
  } catch (e) {
    return { location: city, text: '多云', temp: '26°C' };
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
/**
 * v10.5.0：Sina 行情兜底（正常情况由 hotboard.fetchStocks 提供）。
 * s_ 简式返回：名称,现价,涨跌额,涨跌幅%,成交量,成交额
 * （注意与全量格式 hq_str_sh000001 的字段顺序不同，全量格式现价在 p[3]）
 */
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

  console.log(`🚀 LumaPost ${periodCfg.label} 新闻抓取 (v${pkgVersion()})`);
  console.log(`📍 时段: ${periodCfg.label} | 重点: ${periodCfg.focus}`);
  const tStart = Date.now();
  try {
    console.log(`🤖 AI: ${ai.getConfig().providerName} (${ai.getConfig().model}) · maxTokens≤${ai.getConfig().maxTokens}`);
  } catch (e) {
    console.log(`⚠️ AI 未配置，将使用降级模式: ${String(e.message).split('\n')[0]}`);
  }
  console.log();

  // 版块筛选
  const sections = getEnabledSections();
  // v10.7.0：sections.enabled 为空 = 用户全部关闭，直接终止并给出可操作提示，
  // 不再静默抓一堆数据却生成 0 个版块。
  if (!sections.length) {
    console.error('❌ 没有任何启用的版块（sections.enabled 为空）。');
    console.error('   抓取已中止。要启用版块，任选其一：');
    console.error('     · node scripts/cli.js sections:enable        # 启用全部 10 个版块');
    console.error('     · node scripts/cli.js set sections.enabled ai,hardware,news');
    releaseLock(lockPath);
    process.exit(2);
  }
  if (sections.length < ALL_SECTIONS.length) {
    console.log(`📋 已筛选版块: ${sections.map(s => s.name).join(' / ')}`);
  }

  let aiMode = true;
  let aiDegradeReason = null;
  try { ai.getConfig(); } catch (e) {
    aiMode = false;
    aiDegradeReason = 'AI 未配置/不可用';
    console.log(`⚠️ [degraded] AI 模式不可用 → 纯热榜模式（无深度解读）`);
  }

  try {

  // ── 1) 热榜 ──
  console.log('📰 抓取热榜...');
  const boards = await fetchAllBoards();
  console.log(`  ✓ ${boards.length} 平台，${boards.reduce((s,b)=>s+b.items.length,0)} 条`);

  // ── 1.5) 额外信息源（RSS + 网页源 + Steam/Epic/行情/Trending）──
  console.log('\n🔗 抓取额外信息源...');
  const extras = await fetchExtraNewsContext();
  const extraSources = extras.allItems || [];
  // v10.5.0：额外源并入 boards 时按 source 去重，避免同一标题反复喂给 AI
  const seenBoardItem = new Set();
  for (const es of extraSources) {
    const fetchedAt = new Date().toISOString();
    const items = (es.items || []).filter((item) => {
      const k = String(item.raw_title || '').trim().toLowerCase();
      if (!k || seenBoardItem.has(k)) return false;
      seenBoardItem.add(k);
      return true;
    }).map((item, i) => ({
      raw_title: item.raw_title,
      raw_desc: item.raw_desc || '',
      hot: 10 - Math.min(i, 9),
      rank: i + 1,
      url: item.url,
      source: item.source,
      updateTime: item.updateTime || fetchedAt,
    }));
    if (items.length) boards.push({ type: es.source, name: es.source, category: es.category, items });
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
    // v10.5.0：每组版块数由 GROUP_SIZE 控制（默认 2）。
    // 实测：一次让模型输出 4 版块 × 3-4 条含长解读的内容，响应会被 maxTokens 截断，
    // JSON 不闭合 → 整组降级。改成每组 2 个版块后输出量减半，可稳定解析。
    // 由 fetch-news-ai.GROUP_SIZE 或 config.ai.groupSize 控制，并发数由 AI_CONCURRENCY 控制。
    const cfgAll = getStore() ? (getStore().getAll() || {}) : {};
    const groupSize = Math.max(1, Math.min(4, Number(process.env.AI_GROUP_SIZE)
      || Number((cfgAll.ai || {}).groupSize) || GROUP_SIZE));
    const concurrency = Math.max(1, Math.min(4, Number(process.env.AI_CONCURRENCY)
      || Number((cfgAll.ai || {}).concurrency) || 1));

    const groups = [];
    for (let i = 0; i < sections.length; i += groupSize) {
      groups.push(sections.slice(i, i + groupSize));
    }

    console.log(`\n🧠 AI 分组生成（${groups.length} 组，每组 ${groupSize} 版块，并发 ${concurrency}）...`);

    const allResults = [];
    let failedGroups = 0;

    try {
      // 分批并行，批内并发受 concurrency 限制
      for (let g = 0; g < groups.length; g += concurrency) {
        const batch = groups.slice(g, g + concurrency);
        const labels = batch.map((_, i) => '组' + (g + i + 1)).join('+');
        console.log(`  ⏳ 第${Math.floor(g / concurrency) + 1}批（${labels}）并行...`);
        const results = await Promise.all(batch.map(grp =>
          generateSectionGroup(grp, periodCfg).catch(e => {
            console.log(`    ⚠ 组异常: ${String(e.message).slice(0, 120)}`);
            return grp.map(sec => ({
              key: sec.key, name: sec.name, colorKey: sec.colorKey,
              items: fallbackItemsForSection(sec),
            }));
          })
        ));
        for (const r of results) {
          const before = r.filter(x => (x.items || []).some(i => i.commentary)).length;
          if (before === 0) failedGroups++;
          allResults.push(...r);
        }
        console.log(`  ✓ ${labels} 完成（累计 ${allResults.length} 版块）`);
      }

      sectionsData = allResults;
      const totalItems = sectionsData.reduce((s, sec) => s + sec.items.length, 0);
      const withCm = sectionsData.reduce((s, sec) => s + (sec.items || []).filter(i => i.commentary).length, 0);
      console.log(`  ✅ 全部版块生成完成: ${sectionsData.length} 版块 / ${totalItems} 条新闻 / ${withCm} 条含解读`);
      if (failedGroups > 0) {
        console.log(`    ⚠ ${failedGroups}/${groups.length} 组未拿到 AI 内容（已用真实热榜补位，无解读）`);
      }

      // ── 4) 生成头条 + TLDR + 趋势 ──
      console.log('\n📰 生成头条 & TLDR & 趋势...');
      const hsResult = await generateHeadlinesAndSummary(sectionsData, periodCfg);
      tldr = hsResult.tldr;
      headlines = hsResult.headlines;
      summary = hsResult.summary;
      console.log(`  ✓ TLDR: ${tldr.slice(0, 30)}... | 头条: ${headlines.length} | 趋势: ${summary.length}`);

      // v10.5.0：全部版块都没有解读 = 实质降级，必须如实标记，不能靠条数粉饰
      const withCmAll = sectionsData.reduce((s, sec) => s + (sec.items || []).filter(i => i.commentary).length, 0);
      if (withCmAll === 0) {
        aiDegradeReason = 'AI 调用成功但所有版块均未产出解读内容（可能被截断或模型能力不足）';
        aiMode = false;
        console.error('  ⚠ [degraded] ' + aiDegradeReason);
      }

    } catch (e) {
      // v10.5.0：降级不再静默 —— 明确记录原因并打 [degraded] 标记
      const why = explainTokenError(e.message);
      aiDegradeReason = String(e.message).slice(0, 300) + (why ? ' ▸ ' + why : '');
      console.error(`  ⚠ [degraded] AI 生成失败: ${aiDegradeReason}`);
      if (why) console.error(`  💡 建议: ${why}`);
      console.error(`  📊 回落为热榜直连模式（无 AI 解读、无头条深度分析）`);
      aiMode = false;
    }
  }

  // 降级：不用 AI
  // v10.5.0 修复：旧实现只要 aiMode=false 就整体重建 sectionsData，
  // 会把「部分组成功、部分组失败」时已经拿到的 AI 内容全部丢掉。
  // 现在的规则：只要已经有带解读的版块，就保留它们；仅失败版块用真实热榜补位。
  const hasAiContent = sectionsData.some(sec => (sec.items || []).some(i => i.commentary));
  if (!aiMode && !hasAiContent) {
    tldr = `${periodCfg.label} · 热榜直选（AI 主编未参与）`;
    sectionsData = sections.length > 0 ? sections.map(sec => {
      const items = (sec._filteredBoards || [])
        .filter(item => item && item.raw_title)
        .map((item, i) => ({
            title: item.raw_title,
            summary: item.raw_desc || '',
            commentary: '',                 // v10.5.0：降级时不再编造"AI 解读"
            quicknote: plainBrief(item),    // v10.5.1：不再输出「来源 #排名」元数据
            source: `${item.sourcePlatform || '热榜'}`,
            url: item.url || '',
            time: (() => {
              if (!item.updateTime) return new Date().toISOString();
              const t = new Date(item.updateTime);
              return (t && !isNaN(t.getTime())) ? t.toISOString() : new Date().toISOString();
            })(),
            stars: Math.max(2, 5 - i),
            verified: false,                 // v10.5.0：降级条目不再标 verified:true
            degraded: true,
          }))
        .slice(0, 6);
      // v10.5.0：无内容的版块直接丢弃，不再用"今日速览/今日平静"占位造假新闻
      return { key: sec.key, name: sec.name, colorKey: sec.colorKey, items };
    }).filter(sec => sec.items.length > 0) : [];

    headlines = sectionsData.slice(0, 3).map(s => {
      const i = s.items[0];
      return {
        title: i.title, summary: i.summary, commentary: '',
        source: i.source, url: i.url, time: i.time, degraded: true,
      };
    });
    summary = [];
    if (!sectionsData.length) {
      console.error('  ❌ [degraded] 降级模式下也没有任何热榜内容 —— 请检查网络/热榜接口可用性');
    }
  }

  // ── 5) 股市数据（v10.5.0：优先复用 extras 已抓到的，避免重复请求新浪）──
  let stocks = null;
  if (extras && Array.isArray(extras.stocks) && extras.stocks.length) {
    stocks = extras.stocks.map(s => ({
      name: s.name,
      price: s.current != null ? Number(s.current).toFixed(2) : (s.price || ''),
      change: (s.change >= 0 ? '+' : '') + (typeof s.change === 'number' ? s.change.toFixed(2) : (s.change || '')),
      pct: (s.pct >= 0 ? '+' : '') + (typeof s.pct === 'number' ? s.pct.toFixed(2) : (s.pct || '')) + '%',
    }));
  } else {
    stocks = await fetchStockData();
  }
  if (stocks) {
    console.log(`\n📈 行情: ${stocks.map(s => `${s.name} ${s.price}(${s.pct})`).join(' | ')}`);
  } else {
    console.log('\n📈 行情: 未取到数据');
  }

  // ── 6) 天气 ──
  const weather = await fetchWeather();

  // ── 7) 质量判定（v10.5.0：不再只看条数，必须看 AI 参与度与解读覆盖率）──
  const totalItems = sectionsData.reduce((s, sec) => s + sec.items.length, 0);
  const withCommentary = sectionsData.reduce((s, sec) => s + (sec.items || []).filter(i => i.commentary).length, 0);
  const commentaryCoverage = totalItems ? Math.round(withCommentary / totalItems * 100) / 100 : 0;
  let quality;
  if (!aiMode) quality = 'DEGRADED';
  else if (totalItems >= 12 && commentaryCoverage >= 0.6) quality = 'GOOD';
  else if (totalItems >= 6) quality = 'FAIR';
  else quality = 'LOW';

  const data = {
    date: `${new Date().getFullYear()}年${new Date().getMonth() + 1}月${new Date().getDate()}日`,
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
      version: pkgVersion(),
      schema: '4.0',
      aiMode,
      degradeReason: aiDegradeReason,
      quality,
      itemCount: totalItems,
      commentaryCount: withCommentary,
      commentaryCoverage,
      headlineCount: headlines.length,
      sourceCount: boards.length,
      rssStats: (extras && extras.rssStats) || null,
      failedSources: (extras && extras.rssErrors) || [],
      durationMs: Date.now() - tStart,
      generatedAt: new Date().toISOString(),
      period: periodKey,
    },
  };

  // ── 8) 写入文件（原子写，避免 send-mail 读到半截 JSON）──
  const dir = path.dirname(outputFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmpOut = outputFile + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmpOut, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpOut, outputFile);

  // ── 9) 回写抓取历史（v10.5.0：旧版只由 scheduler 补写，UI 入口的记录永远停在"运行中"）──
  try {
    const st = getStore();
    if (st) {
      st.addHistory('fetchHistory', {
        title: `${periodCfg.label}抓取 · ${data.date}`,
        status: quality === 'LOW' ? '失败' : '完成',
        quality: quality,
        aiMode: aiMode,
        items: totalItems,
        commentary: withCommentary,
        sources: boards.length,
        seconds: Math.round((Date.now() - tStart) / 1000),
        error: aiDegradeReason || undefined,
      });
    }
  } catch (e) { console.warn('  ⚠ 历史写入失败:', e.message); }

  console.log(`\n✅ 完成！质量=${quality} 用时=${((Date.now() - tStart) / 1000).toFixed(1)}s`);
  console.log(`📂 ${outputFile} (${(fs.statSync(outputFile).size / 1024).toFixed(1)} KB)`);
  console.log(`📊 头条 ${data.headline.length} | 版块 ${data.sections.length} | 趋势 ${data.summary.length} | 新闻 ${totalItems} 条 | 含解读 ${withCommentary} 条 (${Math.round(commentaryCoverage * 100)}%)`);
  if (!aiMode) {
    console.warn(`⚠️ [degraded] 本期为热榜直连模式，无 AI 解读。原因: ${aiDegradeReason || 'AI 未配置'}`);
  } else if (quality === 'LOW') {
    console.warn(`⚠️ 内容量偏低（${totalItems} 条 / 解读覆盖 ${Math.round(commentaryCoverage * 100)}%），请检查 AI 额度或数据源。`);
  }

  } finally {
    // 确保 lock 在任何情况下（包括异常）都被释放
    releaseLock(lockPath);
  }
}

// v10.5.0：加 require.main 守卫。
// 旧版没有守卫，而 package.json 的 main 指向本文件 ——
// 任何 `require('lumapost')` 都会立刻触发一次完整抓取并向 AI 狂发请求。
if (require.main === module) {
  main().catch(err => {
    console.error('❌', err.message);
    process.exit(1);
  });
}

module.exports = {
  main: main,
  safeJSON: safeJSON,
  repairJSON: jsonRepair.repairJSON,
  PERIOD_CONFIG: PERIOD_CONFIG,
  ALL_SECTIONS: ALL_SECTIONS,
  SECTION_KEYWORDS: SECTION_KEYWORDS,
  filterBoardsForSection: filterBoardsForSection,
  fetchAllBoards: fetchAllBoards,
  fetchExtraNewsContext: fetchExtraNewsContext,
  fetchWeather: fetchWeather,
  fetchStockData: fetchStockData,
  getQuote: getQuote,
  safeJSON: safeJSON,
  groupTokenBudget: groupTokenBudget,
  pkgVersion: pkgVersion,
  acquireLock: acquireLock,
  releaseLock: releaseLock,
};
