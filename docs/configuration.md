# LumaPost 配置详解

> 本文面向**使用者**。逐个解释 `config/app.json` 里每个变量的含义、取值范围、
> 默认值，以及「改了会发生什么」，方便你定位并修改。
>
> 配套文档：
> - `README.md` —— 快速开始与命令手册
> - `SKILL.md` —— 给 AI 看的操作规范
> - `docs/secrets.md` —— 密钥怎么拿
> - `docs/faq.md` —— 出问题怎么查

---

## 0. 怎么改配置

**推荐用 CLI**（会自动校验、自动脱敏、原子写入）：

```bash
node scripts/cli.js set <变量路径> <值>
```

例：

```bash
node scripts/cli.js set ai.maxTokens 8000
node scripts/cli.js set mail.to friend@example.com
node scripts/cli.js set sections.enabled ai,hardware,news
node scripts/cli.js set app.autoSchedule true
```

查看当前值：

```bash
node scripts/cli.js config            # 全部（密钥自动打码）
node scripts/cli.js config email       # 只看某一段
```

**不建议手改 `config/app.json`**：容易破坏 JSON 结构，且绕过类型校验。
若必须手改，改完立刻跑 `node scripts/cli.js doctor` 验证。

**改完是否要重启？** 不需要。配置每次调用都从磁盘读取（带 mtime 缓存），
`serve` 进程会自动感知。

---

## 1. `ai` —— AI 模型

决定「谁来做主编」。抓取阶段的所有摘要与解读都由这里的模型生成。

| 变量 | 类型 | 默认 | 取值范围 | 说明 |
|---|---|---|---|---|
| `ai.provider` | string | `deepseek` | 见下方清单 | AI 服务商 |
| `ai.apiKey` | string | 空 | — | **必填**。服务商密钥 |
| `ai.model` | string | 按 provider | — | 模型名。留空用服务商默认 |
| `ai.baseUrl` | string | 按 provider | — | 接口地址。`custom` 时必填 |
| `ai.maxTokens` | number | `4096` | 64 – 2000000 | 单次回复上限 |
| `ai.temperature` | number | `0.7` | 0 – 2 | 随机性 |
| `ai.timeout` | number | `60000` | 3000 – 600000 | 单次请求超时（毫秒） |
| `ai.concurrency` | number | `1` | 1 – 4 | 并发调用数 |
| `ai.groupSize` | number | `2` | 1 – 4 | 单次请求处理几个版块 |

### `ai.provider` 可选值

| 值 | 服务商 | 默认模型 | 密钥从哪拿 |
|---|---|---|---|
| `deepseek` | DeepSeek | `deepseek-v4-flash` | platform.deepseek.com |
| `openai` | OpenAI | `gpt-4o` | platform.openai.com |
| `anthropic` | Anthropic Claude | `claude-sonnet-4-20250514` | console.anthropic.com |
| `google` | Google Gemini | `gemini-2.5-flash` | aistudio.google.com |
| `qwen` | 阿里通义千问 | `qwen-max-latest` | dashscope.console.aliyun.com |
| `zhipu` | 智谱 GLM | `glm-4-plus` | open.bigmodel.cn |
| `doubao` | 字节豆包 | `doubao-pro-32k` | volcengine.com |
| `kimi` | 月之暗面 Kimi | `kimi-k2-turbo` | platform.moonshot.cn |
| `xai` | xAI Grok | `grok-3-mini` | x.ai/api |
| `stepfun` | 阶跃星辰 | `step-3-512k` | platform.stepfun.com |
| `hunyuan` | 腾讯混元 | `hy-4.0-pro` | cloud.tencent.com |
| `iflytek` | 讯飞星火 | `spark-4.0-ultra` | xfyun.cn |
| `groq` | Groq | `llama-3.3-70b-specdec` | console.groq.com |
| `openrouter` | OpenRouter | `deepseek/deepseek-chat` | openrouter.ai |
| `siliconflow` | 硅基流动 | `deepseek-ai/DeepSeek-V4` | siliconflow.cn |
| `alibabacloud` | 阿里云百炼 | `qwen-plus` | help.aliyun.com |
| `minimodel` | 面壁 MiniCPM | `minicpm-m3-pro` | modelbest.cn |
| `yi` | 零一万物 | `yi-lightning` | platform.lingyiwanwu.com |
| `together` | Together AI | `Llama-3.3-70B` | together.ai |
| `custom` | 任意 OpenAI 兼容 | — | 自填 `baseUrl` + `apiKey` |

### `ai.maxTokens` 怎么定 ⚠️

这是最容易踩的坑。分两种情况：

**非推理模型**（deepseek-chat / gpt-4o / qwen-plus 等）

正文占大头，4096 足够。建议 `4000 – 6000`。

**推理模型**（名字含 `reasoning` / `r1` / `flash-lite` / `闪念` 等）

它先"思考"再"回答"，思考消耗的 token 也算在 `maxTokens` 里。
实测某次请求：`max_tokens=3600` 时 `reasoning_tokens=3600`，正文一个字都没有，
`content` 返回空字符串。

代码会自动检测并翻倍重试（上限 32000），但**建议直接给足**：

```bash
node scripts/cli.js set ai.maxTokens 8000
```

判断方法：

```bash
node scripts/cli.js history 3
# 若看到 quality=DEGRADED 且解读条数为 0 → 大概率是这个原因
node -e "console.log(require('./data/morning-latest.json').meta.degradeReason)"
# 出现 "reasoning_tokens" 字样即可确诊
```

### `ai.temperature`

| 值 | 效果 | 适用 |
|---|---|---|
| 0 – 0.3 | 极其保守、几乎不发挥 | 不推荐（内容呆板） |
| **0.5 – 0.7** | **稳定且有变化** | **推荐** |
| 0.8 – 1.0 | 有创意但偶尔跑偏 | 想让解读更"有观点"时可试 |
| 1.0 + | 容易写出非法 JSON | 不推荐 |

模型偶尔会输出未转义引号导致 JSON 解析失败。代码有 `json-repair.js` 兜底，
但降低 `temperature` 能从源头减少发生概率。

### `ai.concurrency` / `ai.groupSize`

| 组合 | 特点 | 适用 |
|---|---|---|
| `concurrency=1, groupSize=2` | **最稳，最慢**（约 10-20 分钟） | **默认，推荐** |
| `concurrency=2, groupSize=2` | 快一倍，免费网关易触发限流 | 付费 API 可用 |
| `concurrency=1, groupSize=4` | 请求数少，但单次输出长易被截断 | 不推荐 |

---

## 2. `mail` —— 邮件服务

决定「邮件从哪发、发给谁、长什么样」。

| 变量 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `mail.provider` | string | `qq` | 邮件服务商，见下方清单 |
| `mail.user` | string | 空 | **必填**。发件邮箱地址 |
| `mail.pass` | string | 空 | **必填**。授权码 / 应用密码 / API Key |
| `mail.from` | string | 空 | 发件人显示地址，留空用 `user` |
| `mail.to` | string | 空 | 收件人。留空则发给自己；多人用英文逗号 |
| `mail.smtpHost` | string | 空 | 仅 `custom-smtp` 需要 |
| `mail.smtpPort` | number | `0` | 仅 `custom-smtp` 需要（465 或 587） |
| `mail.smtpSecure` | boolean | `true` | 465 端口用 `true`，587 用 `false` |
| `mail.theme` | string | `sunset` | 主题，见第 3 节 |
| `mail.customTheme` | object | 见下 | `theme=custom` 时的配色 |

### `mail.provider` 可选值

| 值 | 服务商 | 默认端口 | `pass` 填什么 |
|---|---|---|---|
| `qq` | QQ 邮箱 | 465 | **授权码**（不是登录密码） |
| `netease` | 网易 163 | 465 | 授权码 |
| `netease-126` | 网易 126 | 465 | 授权码 |
| `netease-yeah` | 网易 yeah | 465 | 授权码 |
| `gmail` | Gmail | 587 | 应用专用密码（需开两步验证） |
| `outlook` | Outlook / Hotmail | 587 | 账户密码或应用密码 |
| `yahoo` | Yahoo Mail | 587 | 应用专用密码 |
| `aliyun` | 阿里云邮箱 | 465 | 登录密码或授权码 |
| `qq-enterprise` | QQ 企业邮箱 | 465 | 登录密码 |
| `custom-smtp` | 自定义 SMTP | 自填 | SMTP 密码 |
| `resend` | Resend | API | API Key |
| `sendgrid` | SendGrid | API | API Key |
| `mailgun` | Mailgun | API | API Key（需配域名） |
| `postmark` | Postmark | API | Server Token |
| `graph` | Microsoft Graph | API | OAuth Access Token |
| `mailjet` | Mailjet | API | `API_KEY:SECRET` |

> ⚠️ `aliyun-dm`（阿里云 DirectMail）与 `qcloud-ses`（腾讯云 SES）的 HTTP API
> 需要请求签名，本项目未实现，会直接报错。请改用它们的 SMTP 通道：
>
> ```bash
> node scripts/cli.js set mail.provider custom-smtp
> node scripts/cli.js set mail.smtpHost smtpdm.aliyun.com
> node scripts/cli.js set mail.smtpPort 465
> node scripts/cli.js set mail.smtpSecure true
> ```

### 多收件人

```bash
node scripts/cli.js set mail.to "a@qq.com,b@163.com,c@gmail.com"
```

### `mail.customTheme` 的 17 个颜色

仅在 `mail.theme = custom` 时生效。全部为 6 位十六进制（如 `#6366F1`）。

| 字段 | 作用 | 默认 |
|---|---|---|
| `name` | 主题名（≤20 字） | 我的主题 |
| `brand1` | 渐变起色 | `#6366F1` |
| `brand2` | 渐变中色（也用于版块色带、目录标签） | `#8B5CF6` |
| `brand3` | 渐变终色 | `#A855F7` |
| `bg` | 页面背景 | `#F5F7FC` |
| `card` | 卡片底色 | `#FFFFFF` |
| `cardBorder` | 卡片描边 | `#E8ECF3` |
| `ink` | 主文字（标题） | `#0F172A` |
| `ink2` | 次主文字（解读正文） | `#334155` |
| `ink3` | 辅助文字（摘要） | `#64748B` |
| `ink4` | 弱文字（来源、页脚） | `#94A3B8` |
| `line` | 分隔线 | `#E8ECF3` |
| `accent` | 强调色（链接、"阅读原文"） | `#6366F1` |
| `footerText` | 页脚文字 | `#94A3B8` |
| `fontFamily` | `sans` / `serif` / `round` | `sans` |
| `tlrdBg` / `tlrdBd` / `tlrdTx` / `tlrdLb` | TL;DR 区块底色/边框/文字/标签 | 暖黄系 |

---

## 3. `email` —— 内容预算 ⭐

**这是最需要理解的一段。** Gmail 在 **102 KB** 处硬截断邮件，
超出部分收件人永远看不到。这里的每个数字都在控制「多少内容能真正送达」。

| 变量 | 类型 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `email.itemsTotal` | number | `40` | 5 – 200 | **全局条目上限**（所有版块加起来） |
| `email.itemsPerSection` | number | `5` | 1 – 20 | **单版块条目上限** |
| `email.headlineCount` | number | `3` | 0 – 10 | 今日头条条数 |
| `email.trendCount` | number | `5` | 0 – 10 | 趋势观察条数 |
| `email.titleChars` | number | `120` | 20 – 300 | 标题截断字数 |
| `email.summaryChars` | number | `150` | 20 – 600 | 摘要截断字数 |
| `email.commentaryChars` | number | `640` | 0 – 2000 | AI 深度解读截断字数 |
| `email.quicknoteChars` | number | `120` | 0 – 300 | 内容简介截断字数 |
| `email.maxHtmlKB` | number | `92` | 20 – 95 | **体积上限**，超出自动瘦身 |
| `email.subjectPrefix` | string | `✨ LumaPost · 光影邮报` | ≤80 字 | 邮件主题前缀 |

### 显示开关

| 变量 | 默认 | 关闭后 |
|---|---|---|
| `email.showHeadlines` | `true` | 不显示今日头条区 |
| `email.showCommentary` | `true` | 不显示 AI 深度解读（邮件价值大减） |
| `email.showStocks` | `true` | 不显示行情条 |
| `email.showTrends` | `true` | 不显示今日趋势观察 |
| `email.showCharts` | `true` | 不显示数据图表（**Outlook 不支持 SVG，建议关**） |
| `email.showToc` | `true` | 不显示本期目录（阅读导航，建议留） |
| `email.showQuote` | `true` | 不显示每日一句 |

### 投递相关

| 变量 | 默认 | 说明 |
|---|---|---|
| `email.plainTextAlternative` | `true` | 同时生成纯文本版（提升可达性/送达率） |
| `email.listUnsubscribe` | `true` | 加 `List-Unsubscribe` 头（Gmail 群发要求） |

### 体积与条数的换算

实测数据（中文 3 字节/字）：

```
单张卡片 HTML 包装 ≈ 2.5 KB
每条正文（标题+摘要+简介+解读）≈ 1.5 KB
→ 40 条 ≈ 160 KB 原始体积
→ 经内联样式优化后 ≈ 90 KB
```

所以：

| 想要的效果 | 建议设置 |
|---|---|
| 内容尽量全 | `itemsTotal=40, itemsPerSection=5, maxHtmlKB=92` |
| 邮件更短更好读 | `itemsTotal=24, itemsPerSection=3, commentaryChars=420` |
| 只看标题速览 | `showCommentary=false, itemsTotal=60` |
| 解读优先 | `itemsTotal=24, commentaryChars=800`（条数让位给深度） |

### `maxHtmlKB` 与自动瘦身

当渲染结果超过 `maxHtmlKB` 时，按以下顺序**逐级**放弃内容，直到达标：

```
1. 每日一句        → 关
2. 数据图表        → 关
3. 趋势条数        → 降到 3
4. 条目 40 → 30，单版块 5 → 4
5. 条目 → 24
6. 条目 → 20
7. 条目 → 16
8. 摘要字数 → 110
9. 解读字数 → 420
10. 条目 → 12
11. 解读字数 → 260
12. 目录           → 关
13. 解读           → 关
```

> **目录和解读排在最后**，因为它们分别是「阅读导航」和「核心价值」。
> 早期版本把目录排在第 3 步，导致明明内容很多却丢了导航。

---

## 4. `sections` —— 阅读版块

| 变量 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `sections.enabled` | string[] | `[]`（空） | 要抓取哪些版块 |

### 10 个可选版块

| key | 名称 | 覆盖内容 |
|---|---|---|
| `ai` | 🤖 AI · 智能体 | 大模型、AI 应用、智能体、机器人 |
| `hardware` | 💻 硬件 · 数码 | 芯片、手机、显卡、外设 |
| `github` | 🌍 全球创意 · 开源 | 开源项目、开发者工具 |
| `news` | 📰 国内外新闻 | 政策、社会、国际 |
| `games` | 🎮 游戏 · 动漫 | 游戏、电竞、番剧 |
| `finance` | 💰 理财 · 财经 | 股市、基金、加密、宏观 |
| `auto` | 🚗 汽车 · 新能源 | 电动车、自动驾驶 |
| `internet` | 🌐 互联网大厂 | 字节/腾讯/阿里/美团等 |
| `life` | 🎬 影视 · 生活 · 科技 | 电影、剧集、生活方式 |
| `space` | 🔬 科学 · 航天 · 健康 | 科研、航天、医疗 |

### ⚠️ 空数组 = 全部关闭

```bash
# 默认就是空数组，此时抓取会【直接中止】并提示，退出码 2
node scripts/cli.js fetch morning
# ❌ 没有任何启用的版块（sections.enabled 为空）。

# 启用全部
node scripts/cli.js sections:enable

# 只启用少数
node scripts/cli.js set sections.enabled ai,hardware,news

# 查看当前状态
node scripts/cli.js sections
```

> 老版本语义是「空数组 = 全部启用」，v10.7.0 起改为「空数组 = 全部关闭」，
> 与「默认全部关闭」的预期一致。

---

## 5. `sources` —— 信息源

一个段统管三类来源。

| 变量 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `sources.enableRss` | boolean | `false` | RSS 订阅总开关 |
| `sources.useWebFallback` | boolean | `false` | 网页/API 源兜底开关 |
| `sources.rss` | array | 175 项 | 订阅源清单，每项 `enabled` 默认 `false` |
| `sources.enhance` | object | 见下 | 热榜 + 游戏 + 行情 + Trending |

### `sources.rss[]` 单项结构

```jsonc
{
  "name": "IT之家",              // 显示名
  "url": "https://www.ithome.com/rss/",   // RSS/Atom/JSON Feed 地址
  "category": "hardware",        // 分类（仅用于统计，不影响抓取）
  "enabled": false               // 是否启用
}
```

内置 175 个源，分类分布：

| 分类 | 数量 | 分类 | 数量 |
|---|---|---|---|
| github | 28 | military | 10 |
| ai | 17 | medical | 9 |
| hardware | 14 | auto | 9 |
| games | 13 | politics | 6 |
| space | 13 | sports | 6 |
| entertainment | 12 | internet | 5 |
| finance | 11 | education | 4 |
| life | 11 | news | 4 |
| law | 3 | | |

### `sources.enhance` 增强源

| 变量 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `enhance.enableHotboard` | boolean | `false` | 中文热榜总开关 |
| `enhance.hotTypes` | string[] | 13 项 | 启用哪些热榜平台 |
| `enhance.steam` | boolean | `false` | Steam 特惠/新品/热销 |
| `enhance.epic` | boolean | `false` | Epic 限时免费 |
| `enhance.stocks` | boolean | `false` | A 股指数（新浪财经） |
| `enhance.trending` | boolean | `false` | GitHub Trending |

`hotTypes` 可选值（13 个）：

```
juejin 掘金    csdn CSDN      v2ex V2EX      zhihu 知乎
weibo 微博     douyin 抖音    bilibili B站    tieba 贴吧
36kr 36氪      sspai 少数派   ithome IT之家   thepaper 澎湃
toutiao 头条
```

### 常见组合

```bash
# 全部打开（信息最全，抓取最慢，约 3-5 分钟）
node scripts/cli.js sources:enable

# 只要热榜 + 行情，不要 RSS（快速出稿）
node scripts/cli.js set sources.enableRss false
node scripts/cli.js set sources.enhance.enableHotboard true
node scripts/cli.js set sources.enhance.stocks true

# 只开中文源中的几个
node -e "
const c=require('./scripts/config-store');
const rss=c.get('sources.rss').map(s=>({...s,enabled:/ithome|36kr|sspai|zhihu/.test(s.name)}));
c.update({sources:{enableRss:true,rss}});
console.log('已启用', rss.filter(s=>s.enabled).length, '个');
"
```

---

## 6. `schedule` + `delivery` —— 定时

**两段配合才生效**，缺一不发。

| 变量 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `app.autoSchedule` | boolean | `false` | **总开关**。为 `false` 时调度器不触发任何任务 |
| `schedule.morning` | string | `06:00` | 早报时间，格式 `HH:MM`（24 小时制） |
| `schedule.noon` | string | `12:00` | 午报时间 |
| `schedule.afternoon` | string | `17:30` | 午后速递时间 |
| `schedule.evening` | string | `21:00` | 晚间总结时间 |
| `delivery.<slot>.fetch` | boolean | `false` | 该时段是否抓取 |
| `delivery.<slot>.send` | boolean | `false` | 该时段是否发送 |

### 触发条件（三个都满足才执行）

```
app.autoSchedule === true
且 delivery.<当前时段>.fetch === true      → 触发抓取
且 delivery.<当前时段>.send === true       → 抓取成功后再发送
```

### ⚠️ 危险组合

| 组合 | 后果 |
|---|---|
| `send=true, fetch=false` | 发送**上一次**的旧数据（如果有） |
| `autoSchedule=false` 但 `delivery` 全为 `true` | 什么都不发生（总开关关着） |
| `schedule` 时间格式错（如 `9:00`） | 配置校验不通过，所有检查报错 |

### 默认状态：**全部关闭**

```jsonc
{
  "app": { "autoSchedule": false },
  "delivery": {
    "morning":   { "fetch": false, "send": false },
    "noon":      { "fetch": false, "send": false },
    "afternoon": { "fetch": false, "send": false },
    "evening":   { "fetch": false, "send": false }
  }
}
```

即：**装好之后不会自动发任何邮件**，必须手动 `run` 或显式打开。

### 想开启自动发信

```bash
# 方式一：只发早报
node scripts/cli.js set delivery.morning.fetch true
node scripts/cli.js set delivery.morning.send true
node scripts/cli.js set app.autoSchedule true
node scripts/cli.js set schedule.morning 08:30

# 方式二：早晚两次
node scripts/cli.js set delivery.evening.fetch true
node scripts/cli.js set delivery.evening.send true
node scripts/cli.js set schedule.evening 20:00

# 全部四次
for s in morning noon afternoon evening; do
  node scripts/cli.js set delivery.$s.fetch true
  node scripts/cli.js set delivery.$s.send true
done
node scripts/cli.js set app.autoSchedule true
```

### 调度精度

- 轮询间隔：**30 秒**
- 触发容差：**1 分钟**
- 含义：在 `HH:MM` 那一分钟内任意一次轮询都会触发；晚于该分钟启动则**不补发**

> 已移除早期的「可配置补跑窗口」——它会让服务晚启动 5 分钟就补发一封过时早报。

---

## 7. 其他配置

### `weather` —— 天气定位

| 变量 | 默认 | 说明 |
|---|---|---|
| `weather.lat` | `28.20` | 纬度 |
| `weather.lon` | `112.97` | 经度 |
| `weather.city` | `湖南长沙` | 显示名 |

数据源 Open-Meteo，免费无需 Key。改城市：

```bash
node scripts/cli.js set weather.city 北京
node scripts/cli.js set weather.lat 39.90
node scripts/cli.js set weather.lon 116.41
```

### `search` —— 搜索引擎

| 变量 | 默认 | 说明 |
|---|---|---|
| `search.engine` | `bing` | `bing` / `google` / `baidu` / `ddg` |
| `search.aiSearch` | `false` | 是否同时用大模型搜索 |
| `search.useForNews` | `false` | 抓取时是否把搜索结果并入 |

> 这三个字段**当前不参与主抓取流程**，仅供独立的搜索工具（`web-search.js`）使用。
> 若你想让抓取也用上搜索，需要自行改造 `fetch-news-ai.js`。
> 想改用 AI 大模型搜索，把 `engine` 设为 `ai`（同样需自行接线）。

### `app` —— 应用级

| 变量 | 默认 | 说明 |
|---|---|---|
| `app.autoSchedule` | `false` | 调度总开关（见第 6 节） |

> Web UI 时代的 `app.port` / `app.host` / `app.language` / `app.theme` 已彻底移除。
> 本项目为纯 CLI + 调度器，无任何 HTTP 服务监听。

---

## 8. 环境变量覆盖

以下环境变量会覆盖配置文件（用于 CI / Docker）：

| 环境变量 | 覆盖 |
|---|---|
| `AI_PROVIDER` / `AI_API_KEY` / `AI_MODEL` | `ai.*` |
| `AI_BASE_URL` / `AI_MAX_TOKENS` / `AI_TEMP` / `AI_TIMEOUT` | `ai.*` |
| `AI_GROUP_SIZE` / `AI_CONCURRENCY` | `ai.groupSize` / `ai.concurrency` |
| `MAIL_PROVIDER` / `MAIL_USER` / `MAIL_PASS` / `MAIL_FROM` / `MAIL_TO` | `mail.*` |
| `MAIL_SMTP_HOST` / `MAIL_SMTP_PORT` / `MAIL_SMTP_SECURE` | `mail.smtp*` |
| `ENABLED_SECTIONS` | `sections.enabled`（逗号分隔） |
| `WEATHER_LAT` / `WEATHER_LON` / `WEATHER_CITY` | `weather.*` |
| `MAIL_ALLOW_DEGRADED=1` | 允许发送降级内容 |
| `MAIL_MAX_DATA_AGE_MIN` | 数据过期上限（默认 240 分钟） |

**优先级规则**（`config-pref.js`）：

```
配置文件里的值 ≠ 默认值  →  配置文件优先（用户显式设置）
配置文件里的值 = 默认值  →  环境变量优先（CI 场景）
两者都没有              →  用默认值
```

---

## 9. 配置自检

```bash
node scripts/cli.js doctor
```

输出示例：

```json
{
  "valid": true,
  "errors": [],
  "warnings": []
}
```

| 字段 | 含义 |
|---|---|
| `errors` | 致命问题，会导致抓取/发送失败 |
| `warnings` | 建议修改，不影响运行 |

会检查：

- AI Key 是否设置
- `custom` 提供商是否有 `baseUrl`
- 发件邮箱与授权码是否设置
- `custom-smtp` 是否有 `smtpHost`
- 4 个时段的时间格式是否合法
- 版块是否至少启用一个
- 信息源是否至少有一个可用通道
- `maxTokens` 是否偏高/偏低

退出码：`0` = 通过，`1` = 有错误。

---

## 10. 一键速查表

| 我想…… | 命令 |
|---|---|
| 看全部配置 | `node scripts/cli.js config` |
| 看最近抓发记录 | `node scripts/cli.js history` |
| 检查配置是否可用 | `node scripts/cli.js doctor` |
| 跑一次发我邮箱 | `node scripts/cli.js run morning` |
| 只抓取不发送 | `node scripts/cli.js fetch morning` |
| 预览邮件（不发送） | `node scripts/cli.js preview morning` |
| 测 AI 通不通 | `node scripts/cli.js test-ai` |
| 测邮件通不通 | `node scripts/cli.js test-mail` |
| 启用全部版块 | `node scripts/cli.js sections:enable` |
| 启用全部信息源 | `node scripts/cli.js sources:enable` |
| 开启定时发信 | 见第 6 节 |
| 邮件太长要短一点 | `set email.itemsTotal 24` |
| 解读被截断 | `set email.commentaryChars 800` |
| AI 没产出解读 | `set ai.maxTokens 8000` |
| 换成 DeepSeek | `set ai.provider deepseek` + `set ai.apiKey sk-xxx` |
| 清空重来 | `node scripts/cli.js reset --yes` |