#!/usr/bin/env node
/**
 * sections.js — 版块与时段配置模块
 * 版块定义、关键词、时段配置的单一数据源，供抓取/渲染/校验共用。
 */

/** 10 个阅读版块定义（key/name/colorKey） */
const ALL_SECTIONS = [
  { key: 'ai',            name: '🤖 AI · 智能体',       colorKey: 'ai' },
  { key: 'hardware',      name: '💻 硬件 · 数码',       colorKey: 'hardware' },
  { key: 'github',        name: '🌍 全球创意 · 开源',   colorKey: 'github' },
  { key: 'news',          name: '📰 国内外新闻',        colorKey: 'domestic' },
  { key: 'games',         name: '🎮 游戏 · 动漫',       colorKey: 'games' },
  { key: 'finance',       name: '💰 理财 · 财经',       colorKey: 'finance' },
  { key: 'auto',          name: '🚗 汽车 · 新能源',     colorKey: 'auto' },
  { key: 'internet',      name: '🌐 互联网大厂',        colorKey: 'internet' },
  { key: 'life',          name: '🎬 影视 · 生活 · 科技', colorKey: 'movie' },
  { key: 'space',         name: '🔬 科学 · 航天 · 健康', colorKey: 'space' },
];

/** 每个版块的关键词映射（用于过滤热榜/网页源） */
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

/** 4 个时段的差异化配置（早/午/午后/晚） */
const PERIOD_CONFIG = {
  morning: {
    label: '早报', colorKey: 'morning', timeWindow: '隔夜大事',
    greeting: '清晨好！新的一天，从一份光影邮报开始~', greetingType: 'morning',
    focus: '隔夜国际大事、美股收盘、海外科技发布',
  },
  noon: {
    label: '午报', colorKey: 'noon', timeWindow: '今天上午',
    greeting: '中午好！光影速递，陪你度过午后时光~', greetingType: 'noon',
    focus: '上午 A 股行情、国内外新闻、企业动态',
  },
  afternoon: {
    label: '午后速递', colorKey: 'afternoon', timeWindow: '中午到下午',
    greeting: '下午好！最新资讯已为你打包送达~', greetingType: 'afternoon',
    focus: '下午突发事件、新品发布、下午盘走势',
  },
  evening: {
    label: '晚间总结', colorKey: 'evening', timeWindow: '全天回顾',
    greeting: '晚上好！今日大事回顾~', greetingType: 'evening',
    focus: '全天复盘、欧美收盘、全网热榜 TOP 10',
  },
};

/** 按 key 列表筛选版块定义（保持 ALL_SECTIONS 顺序） */
function filterSections(keys) {
  const set = new Set(keys || []);
  return ALL_SECTIONS.filter((s) => set.has(s.key));
}

/** 校验一组版块 key 是否合法 */
function isValidKeys(keys) {
  const valid = new Set(ALL_SECTIONS.map((s) => s.key));
  return (keys || []).every((k) => valid.has(k));
}

module.exports = { ALL_SECTIONS, SECTION_KEYWORDS, PERIOD_CONFIG, filterSections, isValidKeys };