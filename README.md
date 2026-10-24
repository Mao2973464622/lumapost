# LumaPost · 光影邮报

> AI 驱动的智能新闻邮件系统 — 175 个信息源 · 13 个中文热榜 · 10 套邮件主题 · 本地 Web UI 管理后台

<p align="center">
  <img src="https://img.shields.io/badge/version-9.0.0-6366F1?style=flat-square" alt="Version 9.0.0">
  <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen?style=flat-square" alt="Node >= 20">
  <img src="https://img.shields.io/github/license/Mao2973464622/lumapost?style=flat-square" alt="License MIT">
  <img src="https://img.shields.io/badge/deps-2-blue?style=flat-square" alt="2 Dependencies">
  <img src="https://img.shields.io/github/stars/Mao2973464622/lumapost?style=flat-square&color=yellow" alt="GitHub Stars">
</p>

---

## 这是什么

一句话：**每天早上自动给你发一封排版精美的 AI 新闻邮件**。

它会从 175 个 RSS 源和 13 个中文热榜抓取新闻，交给 AI 分类整理、写摘要和快评，生成 HTML 邮件，通过 SMTP 或 API 投递到你的邮箱。

全部本地运行，配置存在一个 JSON 文件里，不依赖任何云服务。

---

## 核心能力

### 信息采集

| 类型 | 数量 | 说明 |
|------|------|------|
| RSS 信息源 | **175 个** | 17 个领域，逐个实测可用 |
| 中文热榜 | **13 个平台** | 掘金 / CSDN / V2EX / 知乎 / 微博 / 抖音 / B站 / 贴吧 / 36氪 / 少数派 / IT之家 / 澎湃 / 头条 |
| 搜索引擎 | 4 个 | Bing（默认）/ Google / 百度 / DuckDuckGo |
| AI 搜索 | 可选 | 用大模型直接生成结构化搜索结果 |
| 游戏特惠 | 2 个 | Steam 特惠榜 / Epic 限时免费 |
| 代码趋势 | 1 个 | GitHub Trending |

### AI 编排

- **31 家 AI 提供商**：DeepSeek / OpenAI / Claude / Gemini / 通义 / Kimi / 豆包 / 智谱 / Grok / 混元 / 星火 / Llama 等
- **动态模型列表**：填 API Key 后自动拉取可用模型
- **三种协议**：OpenAI 兼容 / Anthropic / Gemini
- **自定义端点**：支持中转、代理、本地部署的服务

### 邮件主题

**10 套预设主题**，Web UI 一键切换：

| 主题 | 分组 | 风格 |
|------|------|------|
| 极简白 | 明亮 | 渐变紫 + 纯白卡片（默认） |
| 墨黑 | 暗色 | 深灰底 + 暖白字 |
| 报刊 | 古典 | 米色纸 + 衬线体 |
| 深海 | 暗色 | 藏青 + 青蓝 |
| 霓虹 | 暗色 | 黑底 + 洋红青绿 |
| 森野 | 自然 | 墨绿 + 苔藓 |
| 暖阳 | 明亮 | 橙粉渐变 + 奶油底 |
| 樱粉 | 明亮 | 樱花粉 + 圆体 |
| 极光 | 暗色 | 青紫流体渐变 |
| 简约灰 | 明亮 | 黑白灰极简 |

**自定义主题**：17 个颜色字段 + 3 种字体，实时预览。

### 邮件投递

- **18 家服务商**：QQ / 163 / 126 / Gmail / Outlook / 阿里云 / 企业QQ / 自定义 SMTP / Resend / SendGrid / Mailgun / Postmark / Graph / 阿里云DM / 腾讯云SES / Mailjet

### 定时调度

- **内置调度器**，30 秒轮询，无需 crontab
- 4 个时段独立配置时间
- 每时段可分别开关「自动抓取」和「自动发送」
- 实时执行日志

---

## 界面

### Web UI

本地打开 `http://127.0.0.1:3000`，8 个页面：

```
仪表盘  系统概览 · 运行环境 · 最新头条
模型    AI 提供商 · API Key · 模型选择 · 温度调节
邮件    SMTP 配置 · 主题选择 · 自定义配色
信息源  175 个源管理 · 版块开关 · 抓取预览
定时    4 时段设置 · 自动调度 · 执行日志
历史    抓取/发送记录
预览    邮件 HTML 预览
系统    运行信息 · 监听设置 · 配置重置
```

### 邮件

杂志式排版，移动端适配：

```
品牌栏
  ↓
渐变大标题 + 三栏数据（条数 / 版块 / 摘要）
  ↓
TL;DR 金边卡片
  ↓
数据概览：环形图 + 横向条形图（SVG 动效）
  ↓
本期目录（颜色圆点 + 条数胶囊）
  ↓
各版块（左侧色条 + 新闻卡片 + 快评色块）
  ↓
每日一句
```

---

## 快速开始

### 环境要求

- Node.js >= 20
- 一个 AI API Key
- 一个邮箱账号（或 API 型邮件服务）

### 安装

```bash
git clone https://github.com/Mao2973464622/lumapost.git
cd lumapost
npm install
npm start
```

打开 `http://127.0.0.1:3000`。

### 配置

1. **模型页**：选提供商，填 API Key，点「拉取」选模型
2. **邮件页**：填邮箱和授权码，选主题
3. **信息源页**：默认已启用 175 个，可以关掉不要的
4. **定时页**：设置时间并打开「启用内置自动调度」

所有配置自动写入 `config/app.json`，改完无需重启。

### 手动跑一次

```bash
# 抓取 + AI 生成
npm run fetch:morning

# 生成 HTML
npm run gen:morning

# 发送
npm run send:morning

# 或者一条龙
npm run all:morning
```

---

## 目录结构

```
lumapost/
├── scripts/
│   ├── web-server.js        Web 服务器 + REST API
│   ├── config-store.js      配置中心（单一数据源）
│   ├── scheduler.js         内置定时调度器
│   ├── ai-provider.js       AI 统一调用层（31 家）
│   ├── mail-provider.js     邮件统一发送层（18 家）
│   ├── rss-fetcher.js       RSS/Atom/JSON Feed 解析引擎
│   ├── hotboard.js          中文热榜 + 游戏 + 行情
│   ├── web-search.js        搜索聚合
│   ├── sources-catalog.js   175 个信息源库
│   ├── mail-charts.js       SVG 图表库（7 种）
│   ├── mail-themes.js       10 套主题定义
│   ├── gen-html.js          邮件 HTML 生成器
│   ├── fetch-news-ai.js     新闻抓取 + AI 编排
│   └── fetch-cn-news.js     中文新闻抓取
├── public/
│   └── index.html           单文件 Web UI（约 110 KB）
├── config/
│   └── app.json             配置文件（自动生成）
└── package.json
```

---

## API 一览

```
GET    /api/config              读取配置（密钥掩码）
POST   /api/config              保存配置
GET    /api/config/validate     配置校验
GET    /api/system              运行信息

GET    /api/providers           AI 提供商列表
GET    /api/models/:provider    模型列表（支持临时密钥）

GET    /api/sources             已配置信息源
GET    /api/sources/catalog     内置源库
POST   /api/sources/import      批量导入
POST   /api/sources/test        单源测试
POST   /api/sources/fetch       批量抓取预览

GET    /api/hotboard            热榜总览
GET    /api/steam               Steam 榜单
GET    /api/epic                Epic 限免
GET    /api/stocks              A 股指数
GET    /api/trending            GitHub Trending

GET    /api/themes              主题列表
GET    /api/themes/preview      主题预览

GET    /api/search?q=&mode=     搜索

GET    /api/scheduler           调度状态
POST   /api/scheduler/trigger   手动触发

POST   /api/fetch               启动抓取
GET    /api/news/latest         最新新闻
GET    /api/preview/:period     邮件预览
POST   /api/test-ai             AI 连通测试
POST   /api/test-mail           邮件发送测试
```

---

## 命令

```bash
npm start               启动 Web 服务
npm run fetch:morning   抓取早报
npm run gen:morning     生成早报 HTML
npm run send:morning    发送早报
npm run all:morning     全流程
npm run hot             热榜 + 游戏 + 行情
npm run hot:stock       只看股市
npm run sources:list    信息源统计
npm run sources:test    实测信息源
npm run config:show     查看配置
npm run doctor          配置体检
```

---

## 设计说明

### 为什么依赖这么少

只有 2 个：`dotenv` 和 `nodemailer`。

RSS 解析、热榜抓取、SVG 图表、搜索聚合、Web 服务器全部手写。原因是这类工具越简单越可靠——不用管三方库的破坏性更新，也不会有版本冲突。

### 邮件图表为什么用 SMIL

`<animate>` 而非 CSS 动画，因为邮件客户端会剥离 `<style>` 块，SMIL 属性内联在 SVG 里能活下来。

**关键原则：静态即正确。** 每个图形先用最终属性值绘制，动画只做「从 0 长出来」的增强。这样即使客户端把 `<animate>` 全剥了（QQ 邮箱常见），图形依然完整。

### 邮件为什么不用毛玻璃

`backdrop-filter` 在 QQ / Outlook / Gmail 全部被剥离。邮件只能用「半透明色块 + 细边框」模拟层次感。

Web UI 上是真毛玻璃（`blur(18px)`）。

---

## 已知限制

| 限制 | 说明 |
|------|------|
| pRoot/proot 环境 | 容器网络隔离，手机浏览器访问不到容器内的 127.0.0.1。建议用 Termux。 |
| QQ 邮箱授权码 | 需要先在邮箱后台开启 SMTP 服务，否则会返回 535。 |
| 部分信息源 | 少数站点有反爬或地区限制，已从源库剔除。 |
| 邮件体积 | 完整一期约 190 KB，图片多的话可能触发邮箱限流。 |

---

## License

MIT

---

<p align="center">
  <sub>Built with AI · 175 sources · 10 themes · 2 dependencies</sub>
</p>