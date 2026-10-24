#!/usr/bin/env node
/**
 * sources-catalog.js — 内置信息源库（v5.1）
 *
 * 75 个信息源，覆盖 17 个领域，全部逐个实测可用。
 * 用户可在 Web UI「信息源」页增删改，改动写入 config/app.json。
 */

const CATALOG = [
  { name: "人民网-科技", url: "http://www.people.com.cn/rss/it.xml", category: "ai", lang: "zh" },
  { name: "量子位", url: "https://www.qbitai.com/feed", category: "ai", lang: "zh" },
  { name: "雷锋网", url: "https://www.leiphone.com/feed", category: "ai", lang: "zh" },
  { name: "人民网-教育", url: "http://www.people.com.cn/rss/edu.xml", category: "education", lang: "zh" },
  { name: "豆瓣电影", url: "https://www.douban.com/feed/subject/1764796/reviews", category: "entertainment", lang: "zh" },
  { name: "人民网-财经", url: "http://www.people.com.cn/rss/finance.xml", category: "finance", lang: "zh" },
  { name: "华尔街见闻", url: "https://api-one-wscn.awtmt.com/apiv1/content/lives?channel=global-channel&limit=30", category: "finance", lang: "zh" },
  { name: "新华网-财经", url: "http://www.news.cn/fortune/news_fortune.xml", category: "finance", lang: "zh" },
  { name: "机核网", url: "https://www.gcores.com/rss", category: "games", lang: "zh" },
  { name: "InfoQ中文", url: "https://www.infoq.cn/feed", category: "github", lang: "zh" },
  { name: "开源中国", url: "https://www.oschina.net/news/rss", category: "github", lang: "zh" },
  { name: "IT之家", url: "https://www.ithome.com/rss/", category: "hardware", lang: "zh" },
  { name: "爱范儿", url: "https://www.ifanr.com/feed", category: "hardware", lang: "zh" },
  { name: "钛媒体", url: "https://www.tmtpost.com/rss.xml", category: "internet", lang: "zh" },
  { name: "少数派", url: "https://sspai.com/feed", category: "life", lang: "zh" },
  { name: "WHO 新闻", url: "https://www.who.int/rss-feeds/news-english.xml", category: "medical", lang: "zh" },
  { name: "人民网-健康", url: "http://www.people.com.cn/rss/health.xml", category: "medical", lang: "zh" },
  { name: "中国新闻网", url: "https://www.chinanews.com.cn/rss/scroll-news.xml", category: "news", lang: "zh" },
  { name: "界面新闻", url: "https://a.jiemian.com/index.php?m=article&a=rss", category: "news", lang: "zh" },
  { name: "人民网-国际", url: "http://www.people.com.cn/rss/world.xml", category: "politics", lang: "zh" },
  { name: "人民网-时政", url: "http://www.people.com.cn/rss/politics.xml", category: "politics", lang: "zh" },
  { name: "新华网-国际", url: "http://www.news.cn/world/news_world.xml", category: "politics", lang: "zh" },
  { name: "新华网-时政", url: "http://www.news.cn/politics/news_politics.xml", category: "politics", lang: "zh" },
  { name: "人民网-体育", url: "http://www.people.com.cn/rss/sports.xml", category: "sports", lang: "zh" },
  { name: "新浪体育", url: "https://rss.sina.com.cn/sports/global/focus.xml", category: "sports", lang: "zh" },
  { name: "DeepMind Blog", url: "https://deepmind.google/blog/rss.xml", category: "ai", lang: "en" },
  { name: "MIT Tech Review", url: "https://www.technologyreview.com/feed/", category: "ai", lang: "en" },
  { name: "OpenAI Blog", url: "https://openai.com/blog/rss.xml", category: "ai", lang: "en" },
  { name: "Ars Technica Cars", url: "https://feeds.arstechnica.com/arstechnica/cars", category: "auto", lang: "en" },
  { name: "Electrek", url: "https://electrek.co/feed/", category: "auto", lang: "en" },
  { name: "InsideEVs", url: "https://insideevs.com/rss/news/all/", category: "auto", lang: "en" },
  { name: "Motor1", url: "https://www.motor1.com/rss/news/all/", category: "auto", lang: "en" },
  { name: "EdSurge", url: "https://www.edsurge.com/articles_rss", category: "education", lang: "en" },
  { name: "Inside Higher Ed", url: "https://www.insidehighered.com/rss.xml", category: "education", lang: "en" },
  { name: "Billboard", url: "https://www.billboard.com/feed/", category: "entertainment", lang: "en" },
  { name: "Hollywood Reporter", url: "https://www.hollywoodreporter.com/feed/", category: "entertainment", lang: "en" },
  { name: "IndieWire", url: "https://www.indiewire.com/feed/", category: "entertainment", lang: "en" },
  { name: "Pitchfork", url: "https://pitchfork.com/feed/feed-news/rss", category: "entertainment", lang: "en" },
  { name: "Rolling Stone", url: "https://www.rollingstone.com/feed/", category: "entertainment", lang: "en" },
  { name: "Variety", url: "https://variety.com/feed/", category: "entertainment", lang: "en" },
  { name: "CNBC Finance", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html", category: "finance", lang: "en" },
  { name: "MarketWatch", url: "https://feeds.content.dowjones.io/public/rss/mw_topstories", category: "finance", lang: "en" },
  { name: "Eurogamer", url: "https://www.eurogamer.net/feed", category: "games", lang: "en" },
  { name: "IGN", url: "https://feeds.ign.com/ign/all", category: "games", lang: "en" },
  { name: "PC Gamer", url: "https://www.pcgamer.com/rss/", category: "games", lang: "en" },
  { name: "Dev.to", url: "https://dev.to/feed", category: "github", lang: "en" },
  { name: "GitHub Blog", url: "https://github.blog/feed/", category: "github", lang: "en" },
  { name: "Hacker News", url: "https://hnrss.org/frontpage", category: "github", lang: "en" },
  { name: "Smashing Magazine", url: "https://www.smashingmagazine.com/feed/", category: "github", lang: "en" },
  { name: "Solidot", url: "https://www.solidot.org/index.rss", category: "github", lang: "en" },
  { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", category: "hardware", lang: "en" },
  { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", category: "hardware", lang: "en" },
  { name: "Wired", url: "https://www.wired.com/feed/rss", category: "hardware", lang: "en" },
  { name: "TechCrunch", url: "https://techcrunch.com/feed/", category: "internet", lang: "en" },
  { name: "ABA Journal", url: "https://www.abajournal.com/rss/news", category: "law", lang: "en" },
  { name: "SCOTUSblog", url: "https://www.scotusblog.com/feed/", category: "law", lang: "en" },
  { name: "Atlas Obscura", url: "https://www.atlasobscura.com/feeds/latest", category: "life", lang: "en" },
  { name: "Lifehacker", url: "https://lifehacker.com/rss", category: "life", lang: "en" },
  { name: "Nature Medicine", url: "https://www.nature.com/nm.rss", category: "medical", lang: "en" },
  { name: "The Lancet", url: "https://www.thelancet.com/rssfeed/lancet_current.xml", category: "medical", lang: "en" },
  { name: "Army Times", url: "https://www.armytimes.com/arc/outboundfeeds/rss/", category: "military", lang: "en" },
  { name: "Defense News", url: "https://www.defensenews.com/arc/outboundfeeds/rss/", category: "military", lang: "en" },
  { name: "Military Times", url: "https://www.militarytimes.com/arc/outboundfeeds/rss/", category: "military", lang: "en" },
  { name: "Navy Times", url: "https://www.navytimes.com/arc/outboundfeeds/rss/", category: "military", lang: "en" },
  { name: "The War Zone", url: "https://www.twz.com/feed", category: "military", lang: "en" },
  { name: "NPR World", url: "https://feeds.npr.org/1004/rss.xml", category: "politics", lang: "en" },
  { name: "The Hill", url: "https://thehill.com/feed/", category: "politics", lang: "en" },
  { name: "NASA", url: "https://www.nasa.gov/rss/dyn/breaking_news.rss", category: "space", lang: "en" },
  { name: "Nature", url: "https://www.nature.com/nature.rss", category: "space", lang: "en" },
  { name: "Phys.org", url: "https://phys.org/rss-feed/", category: "space", lang: "en" },
  { name: "Quanta Magazine", url: "https://www.quantamagazine.org/feed/", category: "space", lang: "en" },
  { name: "Science", url: "https://www.science.org/rss/news_current.xml", category: "space", lang: "en" },
  { name: "Science Daily", url: "https://www.sciencedaily.com/rss/all.xml", category: "space", lang: "en" },
  { name: "Space.com", url: "https://www.space.com/feeds/all", category: "space", lang: "en" },
  { name: "ESPN", url: "https://www.espn.com/espn/rss/news", category: "sports", lang: "en" },
];

const CATEGORIES = {
  "ai": "人工智能",
  "hardware": "硬件数码",
  "github": "开源技术",
  "internet": "互联网",
  "news": "综合新闻",
  "politics": "时事政治",
  "finance": "财经金融",
  "medical": "医疗健康",
  "law": "法律法规",
  "education": "教育",
  "sports": "体育",
  "entertainment": "娱乐",
  "military": "军事",
  "space": "科学太空",
  "games": "游戏动漫",
  "auto": "汽车出行",
  "life": "生活方式",
};

const SEARCH_ENGINES = {
  "bing": { name: "Bing", url: "https://www.bing.com/search?q={q}" },
  "google": { name: "Google", url: "https://www.google.com/search?q={q}" },
  "baidu": { name: "百度", url: "https://www.baidu.com/s?wd={q}" },
  "ddg": { name: "DuckDuckGo", url: "https://duckduckgo.com/?q={q}" },
};

/** 按分类取样，用于「一键导入推荐」 */
function getByCategory(cat) {
  return CATALOG.filter(function (s) { return s.category === cat; });
}

function getRecommended(perCategory) {
  perCategory = perCategory || 2;
  const out = [];
  Object.keys(CATEGORIES).forEach(function (cat) {
    getByCategory(cat).slice(0, perCategory).forEach(function (s) { out.push(s); });
  });
  return out;
}

module.exports = { CATALOG, CATEGORIES, SEARCH_ENGINES, getByCategory, getRecommended };
