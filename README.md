# LumaPost — 光影邮报 🌟

> **智能个性化新闻摘要系统** · 每日 4 次自动抓取全球资讯 · AI 深度解读 · 精美 HTML 邮件推送

[![Version](https://img.shields.io/badge/v3.0.0-blue)](https://github.com/Mao2973464622/lumapost)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-339933)](https://nodejs.org)
[![GitHub Actions](https://img.shields.io/github/actions/workflow/status/Mao2973464622/lumapost/LumaPost%20Email?label=email)](https://github.com/Mao2973464622/lumapost/actions)

---

## ✨ 功能亮点

- 🤖 **AI 驱动** — 支持 10+ AI 模型（DeepSeek / OpenAI / Claude / 通义千问 / 智谱 / 豆包 / Kimi 等）
- 📊 **10 大版块** — AI·硬件·开源·国内外新闻·游戏·财经·汽车·互联网·生活·科学
- 🌤 **实时天气** — 邮件头部显示当前天气（Open-Meteo，免费无需 Key）
- 💬 **AI 深度解读** — 每条新闻附 AI 编者按，理财版块含「人话版 + 专业原话」双解读
- 🎨 **精美 HTML 邮件** — 渐变头部、星级评分、卡片布局，按时段自动换色
- 🔄 **降级容错** — AI 抓取失败时自动切换热榜数据源，确保每日有内容
- ☁️ **云端运行** — GitHub Actions 部署后，电脑关机也能按时发邮件
- 🐳 **多部署方式** — 支持 GitHub Actions / Docker / systemd / crontab / WorkBuddy 自动化

---

## 🚀 快速开始

### 1. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填入你的配置：

```bash
# ── AI 模型（必填）─────────────────────────
AI_PROVIDER=deepseek
AI_API_KEY=sk-your-key-here

# ── 邮件发送（必填）───────────────────────
MAIL_PROVIDER=qq
MAIL_USER=your_email@qq.com
MAIL_PASS=your_smtp_auth_code   # QQ邮箱SMTP授权码，不是密码！

# ── 天气位置（可选，默认长沙）─────────────
WEATHER_LAT=28.20
WEATHER_LON=112.97
```

> **获取 QQ 邮箱 SMTP 授权码：** 登录 QQ 邮箱 → 设置 → 账户 → 开启 POP3/SMTP → 生成授权码

### 2. 安装依赖

```bash
npm install
```

### 3. 测试

```bash
# 测试 AI 配置
node scripts/ai-provider.js --test

# 测试邮件发送
node scripts/mail-provider.js --test

# 完整流程测试（抓取 → 生成 → 发送）
npm run all:morning
```

收到邮件说明一切正常！

---

## ⏰ 定时推送

### 方式一：GitHub Actions（推荐 ✅）

**完全云端运行，电脑关机也能发。** 适合大多数人。

1. Fork 或推送此仓库到 GitHub
2. 在仓库 **Settings → Secrets and variables → Actions** 中设置：
   - **Secrets**（敏感信息）：`AI_API_KEY`、`MAIL_USER`、`MAIL_PASS`
   - **Variables**（非敏感）：`AI_PROVIDER`、`AI_MODEL`、`MAIL_PROVIDER`、`WEATHER_LAT`、`WEATHER_LON`
3. 启用 Actions：仓库 **Actions** 标签页 → 左侧 `LumaPost Email` → Enable workflow
4. 可手动触发：Actions → `LumaPost Email` → `Run workflow`

| 中国时间 | UTC 时间 | 内容侧重 |
|----------|-----------|----------|
| 06:00 早报 | 22:00 UTC | 隔夜国际大事、美股收盘 |
| 12:00 午报 | 04:00 UTC | 上午 A 股行情、企业动态 |
| 17:30 午后速递 | 09:30 UTC | 下午突发事件、新品发布 |
| 21:00 晚间总结 | 13:00 UTC | 全天复盘、欧美收盘 |

### 方式二：本地 crontab / systemd

适合有云服务器的用户：

```bash
# crontab（每天 4 次）
0 6,12,17,21 * * * cd /path/to/lumapost && npm run all:morning >> logs/cron.log 2>&1
```

或使用 systemd timer（详见 `lumapost.service` 文件注释）。

### 方式三：Docker

```bash
# 构建
docker build -t lumapost .

# 运行（需传入环境变量）
docker run --rm \
  -e AI_API_KEY=sk-xxx \
  -e MAIL_USER=xxx@qq.com \
  -e MAIL_PASS=xxx \
  lumapost npm run all:morning
```

### 方式四：WorkBuddy 自动化

在 WorkBuddy 中配置 4 个定时自动化任务，到时间 AI 自动执行完整流程。

---

## 📋 邮件版块

每封邮件包含 10 个版块（AI 自动生成，无需手动维护）：

| 版块 | 内容 | 数据源 |
|------|------|--------|
| 🤖 AI · 智能体 | AI 大模型、Agent、具身智能 | 机器之心、36氪、腾讯云 |
| 💻 硬件 · 数码 | 半导体、手机、消费电子 | IT之家、快科技、CNMO |
| 🌍 全球创意 · 开源 | GitHub 热门开源项目 | GitHub Trending、掘金 |
| 📰 国内外新闻 | 国内外重要新闻、社会热点 | 观察者网、澎湃、环球网 |
| 🎮 游戏 · 动漫 | 游戏、动漫、新番 | 游民星空、B站 |
| 💰 理财 · 财经 | A股、财经、理财知识 | 新浪财经、东方财富、雪球 |
| 🚗 汽车 · 新能源 | 电动车、智驾、电池 | 汽车之家、电动邦 |
| 🌐 互联网大厂 | 平台动态、产品更新 | 36氪、虎嗅、晚点 |
| 🎬 影视 · 生活 · 科技 | 影视、体育、生活 | 猫眼、少数派、V2EX |
| 🔬 科学 · 航天 · 健康 | 航天、黑科技、医疗 | 果壳、丁香园、NASA |

> 💡 理财版块特色：每条新闻附「人话版 + 专业原话」双解读。

---

## 🤖 支持的 AI 模型

在 `.env` 中设置 `AI_PROVIDER` 切换模型：

| 提供商 | `AI_PROVIDER` 值 | 默认模型 | 获取地址 |
|--------|-------------------|----------|----------|
| DeepSeek | `deepseek` | deepseek-chat | https://platform.deepseek.com |
| MiniMax | `minimax` | MiniMax-Text-01 | https://www.minimaxi.com |
| OpenAI | `openai` | gpt-4o | https://platform.openai.com |
| Claude | `anthropic` | claude-sonnet-4 | https://console.anthropic.com |
| 通义千问 | `qwen` | qwen-turbo | https://dashscope.aliyun.com |
| 智谱 GLM | `zhipu` | glm-4-flash | https://open.bigmodel.cn |
| 字节豆包 | `doubao` | doubao-pro-32k | https://www.volcengine.com |
| Kimi | `kimi` | moonshot-v1-8k | https://platform.moonshot.cn |
| 自定义 | `custom` | — | 任何 OpenAI 兼容接口 |

测试 AI 配置：`node scripts/ai-provider.js --test`

---

## 📮 支持的邮件服务

在 `.env` 中设置 `MAIL_PROVIDER` 切换邮件服务商：

| 服务商 | `MAIL_PROVIDER` 值 | 认证方式 |
|--------|---------------------|----------|
| QQ 邮箱 | `qq` | SMTP 授权码 |
| 网易 163 | `netease` | SMTP 授权码 |
| 网易 126 | `netease-126` | SMTP 授权码 |
| Yeah 邮箱 | `netease-yeah` | SMTP 授权码 |
| Gmail | `gmail` | 应用专用密码 |
| Outlook | `outlook` | 账户密码 / 应用密码 |
| 阿里云邮件 | `aliyun` | SMTP 授权码 |
| Resend | `resend` | API Key |
| SendGrid | `sendgrid` | API Key |
| Mailgun | `mailgun` | API Key |
| Postmark | `postmark` | API Key |
| 自定义 SMTP | `custom-smtp` | 自定义主机/端口 |
| Microsoft Graph | `graph` | OAuth2 |

测试邮件配置：`node scripts/mail-provider.js --test`

---

## 🛠️ 命令行工具

### 抓取新闻

```bash
# AI 驱动抓取（推荐）
node scripts/fetch-news-ai.js --period=morning --output=data/morning-latest.json

# 热榜降级模式（AI 失败时的备用方案）
node scripts/fetch-cn-news.js --output=data/morning-latest.json
```

`--period` 取值：`morning` / `noon` / `afternoon` / `evening`

### 生成 HTML 邮件

```bash
node scripts/gen-html.js \
  --data-file=data/morning-latest.json \
  --output=data/morning-email.html
```

### 发送邮件

```bash
node scripts/mail-provider.js \
  --send \
  --subject="✨ LumaPost · 光影邮报 · 早报" \
  --body-file=data/morning-email.html
```

### npm scripts 快捷命令

| 命令 | 说明 |
|------|------|
| `npm run all:morning` | 抓取 + 生成 + 发送（早报） |
| `npm run all:noon` | 抓取 + 生成 + 发送（午报） |
| `npm run all:afternoon` | 抓取 + 生成 + 发送（午后） |
| `npm run all:evening` | 抓取 + 生成 + 发送（晚间） |
| `npm run ai:test` | 测试 AI 配置 |
| `npm run mail:test` | 测试邮件配置 |

---

## 📊 JSON 数据格式

`gen-html.js` 接受的 JSON 格式（AI 自动生成，无需手动编写）：

```json
{
  "date": "2026年7月4日",
  "timeWindow": "过去12小时",
  "greetingType": "morning",
  "greeting": "早安！新的一天从光影邮报开始~",
  "dailyQuote": "选择比努力更重要，方向比速度更关键。",
  "weather": {
    "location": "湖南长沙",
    "text": "☁️ 多云",
    "temp": "26°C"
  },
  "headline": [
    {
      "title": "头条标题",
      "summary": "新闻摘要",
      "commentary": "AI 深度解读",
      "source": "来源媒体",
      "url": "https://example.com/news/1"
    }
  ],
  "sections": [
    {
      "name": "🤖 AI · 智能体",
      "colorKey": "ai",
      "items": [
        {
          "title": "新闻标题",
          "summary": "摘要",
          "quicknote": "一句话短评",
          "commentary": "深度解读",
          "source": "来源",
          "url": "链接",
          "stars": 4
        }
      ]
    }
  ],
  "summary": [
    {
      "category": "🤖 AI",
      "trend": "趋势一句话",
      "detail": "详细分析"
    }
  ]
}
```

`colorKey` 取值：`ai` / `hardware` / `github` / `domestic` / `games` / `finance` / `auto` / `internet` / `movie` / `space`

---

## 📁 项目结构

```
lumapost/
├── .env.example           # 环境变量模板（不提交真实值）
├── package.json           # NPM 配置 + npm scripts
├── Dockerfile            # Docker 构建文件
├── docker-compose.yml    # Docker Compose 配置
├── lumapost.service      # systemd 服务文件
├── crontab.example       # crontab 配置示例
├── ofelia.ini            # Ofelia 定时任务配置
├── scripts/
│   ├── ai-provider.js     # 🤖 AI 模型统一调用层（10+ 模型）
│   ├── mail-provider.js   # 📮 邮件发送统一接口（14+ 服务商）
│   ├── fetch-news-ai.js  # 📰 AI 驱动新闻抓取（核心，18 数据源）
│   ├── fetch-cn-news.js  # 📡 热榜降级模式（免费备用）
│   ├── gen-html.js        # 🎨 HTML 邮件生成
│   └── send-email.js     # ⚠️ 旧版（已废弃，请用 mail-provider.js）
├── .github/
│   └── workflows/
│       └── email.yml      # GitHub Actions 工作流
└── data/                 # 运行时生成（.gitignore）
```

---

## 🐳 Docker 部署

```bash
# 构建镜像
docker build -t lumapost .

# 一次性运行
docker run --rm \
  -e AI_PROVIDER=deepseek \
  -e AI_API_KEY=sk-xxx \
  -e MAIL_PROVIDER=qq \
  -e MAIL_USER=xxx@qq.com \
  -e MAIL_PASS=xxx \
  lumapost npm run all:morning

# 使用 docker-compose
docker-compose up -d
```

---

## ❓ 常见问题

### Q: 电脑关机后定时任务还会执行吗？

**A:** 取决于运行方式：
- **GitHub Actions 方式：** ✅ 完全云端执行，电脑关机不影响
- **本地 crontab / WorkBuddy 方式：** 需要电脑开机

### Q: SMTP 授权码和邮箱密码有什么区别？

**A:** SMTP 授权码是**专门用于第三方应用发邮件**的密码，不是邮箱登录密码。QQ 邮箱获取方式：邮箱设置 → 账户 → 开启 POP3/SMTP → 生成授权码

### Q: 邮件收不到怎么办？

**A:**
1. 检查垃圾邮件箱（HTML 邮件可能被误判）
2. 运行 `npm run mail:test` 测试发送
3. 检查 `.env` 配置是否正确
4. QQ 邮箱可能需要将发件人加入白名单

### Q: 如何修改邮件样式？

**A:** 直接编辑 `scripts/gen-html.js` 中的 `generateHTML()` 函数。样式为内联 CSS（邮件兼容性好）。修改后重新运行生成即可。

### Q: 新闻内容是真实的吗？

**A:** 是的。通过 AI 实时搜索最新新闻，确保内容真实有效。每次发送的内容都不同。

### Q: 如何添加新的 AI 模型或邮件服务商？

**A:**
- 新 AI 模型：编辑 `scripts/ai-provider.js`，在 `PROVIDERS` 对象中添加配置
- 新邮件服务商：编辑 `scripts/mail-provider.js`，在 `PROVIDERS` 对象中添加配置

---

## 🔒 安全注意事项

1. **`.env` 文件包含密码，已加入 `.gitignore`，切勿提交到 Git**
2. **SMTP 授权码等同于密码，不要分享或明文存储**
3. **如果使用 GitHub Actions，敏感信息务必存在 Secrets 中**
4. **定期更换 SMTP 授权码（QQ 邮箱建议每年更换）**
5. **`.env.example` 中的值均为占位符，不含真实凭证**

---

## 🔧 技术栈

| 类型 | 技术 |
|------|------|
| 运行环境 | Node.js ≥ 18 |
| AI 调用 | 10+ 模型统一接口（OpenAI 兼容协议） |
| 邮件发送 | nodemailer v7（SMTP + HTTP API） |
| HTTP 请求 | Node.js 内置 http/https + fetch |
| 天气 API | Open-Meteo（免费，无需 API Key） |
| 自动化 | GitHub Actions / systemd / crontab / Docker |

---

## 📄 开源协议

MIT License — 可自由使用、修改和分发。

---

## 📝 更新日志

### v3.0 (2026-07-04)

#### 🔒 安全修复
- 清除 `.env.example` 中的真实凭证（API Key、邮箱密码）
- 所有示例值替换为占位符

#### 🐛 Bug 修复（20+ 项）
- **ai-provider.js**：修复 `loadConfig` 缓存缺失、`chatJSON` 重复发送消息、JSON 正则匹配数组
- **fetch-news-ai.js**：`try/finally` 确保锁释放、GitHub Trending 日期动态计算、降级路径安全解析
- **gen-html.js**：`parseArgs` 彻底重写、`esc()` 添加单引号转义、`JSON.parse` 异常处理
- **mail-provider.js**：参数解析修复、`httpJSON` 超时控制、`sendViaMailgun` 异常处理
- **fetch-cn-news.js**：`AbortController` 超时控制、热榜解析回退、天气数据动态获取
- **Dockerfile**：`COPY` 路径修正（修复 Docker 构建失败）

#### ⚡ 优化
- `loadConfig()` 增加模块级缓存，避免重复读取
- `send-email.js` 标记为 `@deprecated`，引导使用 `mail-provider.js`
- nodemailer 升级至 v7.0.5

#### 📋 统一化
- 版本号统一为 `3.0.0`（全项目）
- 时间表统一为 `06:00 / 12:00 / 17:30 / 21:00`
- 删除冗余文件：`WORKBUDDY_AUTOMATION_PROMPT.md`、`skillhub-plugin/` 目录

### v2.9 (2026-07-01)
- 新增 18 信息源（微博热搜、知乎热榜、抖音热榜、B站热榜等）
- 10 大版块合并优化（原 16 版块 → 10 版块）
- AI 深度解读（`commentary` 字段）
- 相对时间显示（"刚刚/3分钟前/2小时前"）

### v2.0 (2026-06-29)
- 完全重写 HTML 邮件模板
- 实时天气显示
- 每日一句
- AI 编者按深度解读

---

**🌟 如果这个项目对你有帮助，请给一个 Star！**

[⬆ 回到顶部](#lumapost--光影邮报-)
