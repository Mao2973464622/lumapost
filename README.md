# LumaPost 光影邮报

> AI 驱动的智能新闻邮件系统 · **纯 CLI / AI Agent 驱动**（无 Web UI）
> 175 个信息源 · 13 个中文热榜 · 10 个阅读分区 · 10 套邮件主题

当前版本 **v10.6.0**

---

## 这是什么

每天（或按你设的时段）自动做四件事：

1. **抓** —— 175 个 RSS/网页源 + 13 个中文热榜 + Steam/Epic/行情/GitHub Trending
2. **编** —— AI 主编按 10 个版块重组、写摘要、写 100–200 字的深度解读
3. **排** —— 渲染成一份带分区导航的 HTML 邮件（+ 纯文本备选体）
4. **发** —— 通过 SMTP / API 发到你的邮箱

全流程**没有网页**，所有操作都是命令行，方便 AI Agent 直接驱动。

---

## 快速开始

```bash
# 1. 装依赖
npm install

# 2. 填配置（AI Key + 邮箱授权码）
node scripts/cli.js set ai.apiKey   sk-xxxxxxxx
node scripts/cli.js set ai.provider deepseek
node scripts/cli.js set mail.provider qq
node scripts/cli.js set mail.user   你的QQ@qq.com
node scripts/cli.js set mail.pass   你的SMTP授权码

# 3. 体检
node scripts/cli.js doctor

# 4. 跑一遍完整流程
node scripts/cli.js run morning
```

收到邮件即成。

---

## 命令行手册

### 日常

| 命令 | 作用 |
|---|---|
| `node scripts/cli.js status` | 状态面板：AI/邮件/调度/预算/最近抓发/配置体检 |
| `node scripts/cli.js sources` | 信息源启用情况 + 分类分布（`--all` 列全部） |
| `node scripts/cli.js sources:enable` | 一键启用全部信息源 |
| `node scripts/cli.js history 20` | 最近 20 条抓取/发送记录 |

### 运行

| 命令 | 作用 |
|---|---|
| `node scripts/cli.js run morning` | 抓取 → 生成 → 发送（完整流程） |
| `node scripts/cli.js fetch morning` | 只抓取 + AI 编排 |
| `node scripts/cli.js gen morning` | 只重新渲染 HTML |
| `node scripts/cli.js send morning` | 只发送 |
| `node scripts/cli.js serve` | 常驻调度器（按配置时间自动跑） |

时段：`morning` / `noon` / `afternoon` / `evening`

### 配置

| 命令 | 作用 |
|---|---|
| `node scripts/cli.js config` | 打印全部配置（**密钥自动脱敏**） |
| `node scripts/cli.js config email` | 只看某一段 |
| `node scripts/cli.js set <路径> <值>` | 改配置，如 `set email.itemsTotal 24` |
| `node scripts/cli.js doctor` | 体检（不通过则退出码 1） |
| `node scripts/cli.js reset --yes` | 重置全部配置 |

### 维护

| 命令 | 作用 |
|---|---|
| `node scripts/cli.js test-ai` | 测 AI 通道 |
| `node scripts/cli.js test-mail` | 测邮件通道 |
| `node scripts/cli.js preview morning` | 生成 `data/preview-morning.html` 可浏览器打开 |
| `npm test` | 26 项回归测试 |
| `node scripts/migrate.js --apply` | 从旧目录迁移数据 |

---

## 配置全貌

配置文件：`config/app.json`（含密钥，**已 gitignore**）
运行历史：`data/history.json`
版本号唯一来源：`package.json`

### `ai` — AI 提供商

| 键 | 默认 | 说明 |
|---|---|---|
| `provider` | `deepseek` | deepseek / openai / anthropic / google / qwen / zhipu / doubao / kimi / xai / stepfun / hunyuan / iflytek / groq / openrouter / siliconflow / custom |
| `apiKey` | — | 必填 |
| `model` | 按 provider | 留空用默认 |
| `baseUrl` | 按 provider | `custom` 时必填 |
| `timeout` | 60000 | 毫秒 |
| `maxTokens` | 4096 | 单次上限；**推理模型建议 ≥8000** |
| `temperature` | 0.7 | 0–2 |
| `concurrency` | 1 | 并发调用数（1 最稳） |
| `groupSize` | 2 | 单次请求的版块数（2 最稳） |

### `mail` — 邮件服务

| 键 | 默认 | 说明 |
|---|---|---|
| `provider` | `qq` | qq / netease / netease-126 / netease-yeah / gmail / outlook / yahoo / aliyun / qq-enterprise / custom-smtp / resend / sendgrid / mailgun / postmark / graph / mailjet |
| `user` | — | 发件邮箱 |
| `pass` | — | 授权码 / 应用密码 / API Key |
| `from` / `to` | — | 留空则用 `user`；`to` 支持逗号分隔多人 |
| `smtpHost` / `smtpPort` / `smtpSecure` | — | 仅 `custom-smtp` 需要 |
| `theme` | `minimal` | minimal / sunset / sakura / forest / sky / mint / paper / gold / mono / crimson / custom |
| `customTheme` | — | `theme=custom` 时的 16 个颜色值 |

### `email` — 邮件内容预算 ⭐

Gmail 在 **102 KB** 处截断邮件。这里的数字决定"有多少内容能真正送到读者眼前"。

| 键 | 默认 | 说明 |
|---|---|---|
| `itemsTotal` | 40 | 全局条目上限 |
| `itemsPerSection` | 5 | 单版块上限 |
| `headlineCount` | 3 | 今日头条条数 |
| `trendCount` | 5 | 趋势条数 |
| `titleChars` | 120 | 标题截断 |
| `summaryChars` | 150 | 摘要截断 |
| `commentaryChars` | 640 | 解读截断 |
| `quicknoteChars` | 120 | 内容简介截断 |
| `maxHtmlKB` | 92 | 体积上限（超出自动分级瘦身） |
| `showHeadlines` | true | 头条区 |
| `showCommentary` | true | AI 深度解读 |
| `showStocks` | true | 行情条 |
| `showTrends` | true | 趋势观察 |
| `showCharts` | true | 图表（Outlook 不支持 SVG，建议关） |
| `showToc` | true | 目录 |
| `showQuote` | true | 每日一句 |
| `subjectPrefix` | `✨ LumaPost · 光影邮报` | 主题前缀 |
| `plainTextAlternative` | true | 生成纯文本备选体 |
| `listUnsubscribe` | true | 加 List-Unsubscribe 头 |

**体积超标时的瘦身顺序**（重要）：每日一句 → 图表 → 趋势条数 → 条数 → 摘要字数 → 解读字数 → **目录** → **解读**。
目录和解读是阅读体验的核心，排在最后才牺牲。

### `sections` — 启用的版块

```json
{ "enabled": ["ai","hardware","github","news","games","finance","auto","internet","life","space"] }
```

对应 10 个阅读分区，顺序即邮件里的呈现顺序。

### `sources` — 信息源

| 键 | 默认 | 说明 |
|---|---|---|
| `enableRss` | true | RSS 总开关 |
| `useWebFallback` | true | RSS 之外是否并跑网页源 |
| `rss[]` | 175 项 | `{name, url, category, enabled}` |

**当前状态：175/175 全部启用**（`node scripts/cli.js sources` 可核对）。

### `enhance` — 增强数据源

| 键 | 默认 | 说明 |
|---|---|---|
| `enableHotboard` | true | 中文热榜总开关 |
| `hotTypes[]` | 13 个 | juejin/csdn/v2ex/zhihu/weibo/douyin/bilibili/tieba/36kr/sspai/ithome/thepaper/toutiao |
| `steam` / `epic` | true | 游戏特惠/限免 |
| `stocks` | true | A 股指数 |
| `trending` | true | GitHub Trending |

### `schedule` + `delivery` — 定时

```json
{ "schedule": { "morning":"09:00", "noon":"12:00", "afternoon":"17:30", "evening":"21:00" } }
```

`delivery.<slot>.fetch / .send` 控制该时段是否抓取/发送。
`app.autoSchedule` 为总开关；`app.makeUpWindowMin`（默认 5）是补跑窗口——服务晚启动几分钟仍会补发。

### 其他

| 键 | 说明 |
|---|---|
| `app.port` / `host` | 仅历史兼容，已无 HTTP 服务 |
| `app.autoSchedule` | 调度总开关 |
| `app.makeUpWindowMin` | 补跑窗口（分钟） |
| `weather.lat/lon/city` | 天气定位 |
| `search.engine` | bing/google/baidu/ddg（仅 `cli.js preview` 外的搜索工具用） |

---

## 邮件长什么样

```
┌──────────────────────────────────┐
│  LumaPost  光影邮报        2026/10/28 │
├──────────────────────────────────┤
│  [渐变 Hero] 问候 + 天气            │
│   40 条精选 | 10 个版块 | 1 条摘要   │
├──────────────────────────────────┤
│  TL;DR  一句话摘要                  │
├──────────────────────────────────┤
│  上证 3677 +0.76%  深证 ... │ ← 行情条
├──────────────────────────────────┤
│  ★ TODAY'S HEADLINES               │
│  01 今日头条 · TOP 1                │
│     标题 / 摘要 / 深度解读           │
│  02 03 ...                         │
├──────────────────────────────────┤
│  CONTENTS  共 10 个版块             │
│  01 ▌🤖 AI·智能体      4条  3解读   │ ← 目录（可点跳转）
│  02 ▌💻 硬件·数码      4条  2解读   │
│  ...                               │
├──────────────────────────────────┤
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │
│ ┃ [SEC]  🤖 AI · 智能体     01  ┃ │ ← 分区色带
│ ┃  01     4条资讯·3条解读   OF 10┃ │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
│   ┌────────────────────────┐     │
│   │ 新闻标题                 │     │
│   │ 摘要 60-150 字           │     │
│   │ ▸ 内容简介（AI 读后概括） │     │
│   │ ▸ AI 深度解读 100-200 字 │     │
│   │ 来源 · ★★★★  阅读原文 →  │     │
│   └────────────────────────┘     │
│   ─ AI · 智能体 · 完 · 下一版块：硬件 ─ │ ← 版块尾注
│                          ↑ 目录    │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │
│ ┃ [SEC]  💻 硬件 · 数码     02  ┃ │
│  ...                               │
├──────────────────────────────────┤
│  今日趋势观察（5 条）                │
├──────────────────────────────────┤
│  每日一句                           │
├──────────────────────────────────┤
│  页脚                              │
└──────────────────────────────────┘
```

**每个分区有 4 处定位信息**，滚动到任何位置都知道自己在哪：

1. 色带上的 `SEC 01` 序号徽章
2. `第 1 / 10 个版块` 进度说明
3. 右上角 `01 / OF 10` 总进度
4. 版块尾注 `下一版块：硬件 · 数码` + `↑ 目录`

---

## 降级模式

**降级 = 拿到新闻但没有 AI 加工**：无深度解读、无头条分析、无趋势观察，邮件顶部显示黄色提示条。

| 触发原因 | 现在的处理 |
|---|---|
| 推理模型把 `max_tokens` 全烧在思考上，正文返回空串 | 检测 `reasoning_tokens ≥ 预算×95%` → **自动翻倍重试**（最高 32000）；仍失败才降级 |
| 模型在 JSON 字符串里写未转义引号 | `json-repair.js` 逐字符修复，内容零丢失 |
| 输出被截断、括号不闭合 | `salvage()` 从后往前抢救已生成的部分 |
| Key 无效 / 额度不足 / 限流 / 超时 | 错误分类器给出可操作建议，写入 `meta.degradeReason` |
| 所有版块都没解读 | 如实标记 DEGRADED，不再用条数粉饰 |

**默认拒绝发送降级内容**：

```bash
node scripts/cli.js send morning
# ❌ 本期为降级内容（无 AI 深度解读）。若确实要发送，加 --allow-degraded

node scripts/cli.js send morning --allow-degraded   # 显式放行
```

其他发送闸门：数据超过 240 分钟就拒绝（`MAIL_MAX_DATA_AGE_MIN` 可调）、HTML 超过 95 KB 就拒绝、内容为空就拒绝。

---

## 项目结构

```
scripts/
  cli.js              命令行入口（所有操作的统一入口）
  config-store.js     配置读写 + 脱敏 + 历史 + 校验
  config-pref.js      env / 文件优先级统一规则
  fetch-news-ai.js    抓取 + AI 编排（核心）
  fetch-cn-news.js    纯热榜降级抓取
  rss-fetcher.js      RSS/Atom/JSON Feed 引擎（零依赖）
  hotboard.js         13 个中文热榜 + Steam/Epic/行情/Trending
  sources-catalog.js  175 个内置信息源目录
  ai-provider.js      16 家 AI 提供商适配 + 空响应重试
  mail-provider.js    16 家邮件服务适配
  gen-html.js         邮件渲染（分区导航 + 体积预算）
  mail-themes.js      10 套主题
  mail-charts.js      SVG 图表
  send-mail.js        发送（含四道闸门）
  scheduler.js        内置调度器
  json-repair.js      容错 JSON 解析
  migrate.js          目录迁移
  web-search.js       搜索工具
tests/run.js          26 项回归测试
```

---

## 部署

### 本机常驻

```bash
# pm2
pm2 start scripts/cli.js --name lumapost -- serve
pm2 save

# 或 systemd
sudo cp lumapost.service /etc/systemd/system/
sudo systemctl enable --now lumapost
```

### Docker（无常驻端口）

```bash
docker compose up -d
docker compose exec lumapost node scripts/cli.js status
```

### GitHub Actions

`.github/workflows/email.yml`：`npm test` 门禁 → 抓取 → 渲染 → 发送。
需在仓库 Secrets 配 `AI_API_KEY` / `MAIL_USER` / `MAIL_PASS`。

---

## 安全

- `config/` 与 `data/` 已在 `.gitignore`，密钥不入库
- `cli.js config` 输出时 `ai.apiKey` / `mail.pass` 自动替换为掩码
- 历史提交里曾有真实授权码（`nm_*.js`，提交 `2979c08`）——若曾推送请重置授权码

---

## 许可

MIT · 作者 QiXua
