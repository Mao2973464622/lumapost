# LumaPost - 光影邮报 v2.8 🌟

> 📰 **AI 驱动的智能新闻邮件推送** · 🌍 10+ AI 模型 · 📮 14+ 邮件服务 · 🔥 18 信息源 · 📊 10 大版块 · ☁️ GitHub Actions 云端部署

---

## ✨ v2.8 最新特性

| 特性 | 说明 |
|------|------|
| 🔥 **18 信息源** | 微博/知乎/百度/抖音/B站/36氪/IT之家等全网热榜 + GitHub Trending/Product Hunt/Hacker News |
| 📊 **10 大版块** | 合并优化：AI·硬件·开源·新闻·游戏·财经·汽车·互联网·生活·太空 |
| 💬 **AI 深度解读** | 每条新闻 100-200 字真实 LLM 分析，非模板 |
| 🕐 **相对时间** | "3分钟前"、"2小时前" 等直观时间显示 |
| 🎨 **双列目录** | 紧凑双列 TOC + 卡片分隔线 + 灰色摘要框 |
| 🌐 **猫目资讯** | 新增 HTML 爬虫信息源，覆盖更多中文媒体 |
| ⏰ **4 时段推送** | 早报06:00 / 午报12:00 / 傍晚速递17:30 / 夜间总结21:00 |

---

## 🚀 5 分钟快速开始

### 方式一：GitHub Actions 云端部署（推荐 ✅）

**电脑关机也能自动发送！**

#### 1️⃣ Fork 仓库

点击右上角 **Fork** → 复制到你的账号。

#### 2️⃣ 配置 Secrets

进入你 Fork 的仓库 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

**最少需要 3 个 Secret：**

| Name | Value | 说明 |
|------|-------|------|
| `AI_API_KEY` | `sk-xxx` | AI 模型 API Key（推荐 DeepSeek） |
| `MAIL_USER` | `your@qq.com` | 发件邮箱 |
| `MAIL_PASS` | `你的SMTP授权码` | 邮箱密码/授权码 |

#### 3️⃣ 测试发送

进入 **Actions** → **LumaPost Email** → **Run workflow** → 选时段 → **Run**

1-2 分钟后去邮箱查看！

#### 4️⃣ 自动运行

已配置好，每天 4 次自动发送：

| 北京时间 | 任务 | 内容侧重 |
|---------|------|---------|
| 06:00 | 早报 | 昨夜至今早重要新闻 |
| 12:00 | 午报 | 上午最新动态 + A股行情 |
| 17:30 | 傍晚速递 | 下午突发事件 + 新品发布 |
| 21:00 | 夜间总结 | 全天复盘 + 欧美收盘 |

---

### 方式二：本地运行

```bash
# 1. 克隆
git clone https://github.com/Mao2973464622/lumapost.git
cd lumapost/lumapost

# 2. 安装
npm install

# 3. 配置
cp .env.example .env
# 编辑 .env 填入凭证

# 4. 测试
node scripts/fetch-news-ai.js --period=morning --output=data/test.json
node scripts/gen-html.js --data-file=data/test.json --output=data/test.html

# 5. 发送邮件
node scripts/mail-provider.js --send --subject="测试" --body-file=data/test.html
```

---

## 📊 10 大版块 · 18 信息源

| # | 版块 | 关键词 | 主要信息源 |
|---|------|--------|-----------|
| 1 | 🤖 AI·机器人 | AI大模型、Agent、具身智能 | 36氪、IT之家、知乎AI话题 |
| 2 | 💻 硬件·芯片 | 半导体、HBM、新工艺 | 微博科技、IT之家、百度硬件 |
| 3 | 🌍 开源·创意 | GitHub Trending、新产品 | GitHub Trending、Product Hunt、Hacker News |
| 4 | 📰 国内新闻 | 社会热点、政策经济 | 微博热搜、百度热搜、今日头条 |
| 5 | 🎮 游戏·动漫 | 游戏大作、动漫新番 | 微博游戏、B站游戏、抖音游戏 |
| 6 | 💰 财经·理财 | A股、基金、宏观经济 | 微博财经、百度财经、36氪 |
| 7 | 🚗 汽车·出行 | 新能源车、智驾 | 微博汽车、IT之家汽车、知乎汽车 |
| 8 | 🌐 互联网·社交 | 平台动态、产品更新 | 虎扑、V2EX、少数派 |
| 9 | 🏠 生活·消费 | 美食、旅游、消费趋势 | 小红书、微博生活、知乎生活 |
| 10 | 🚀 太空·前沿 | 航天、黑科技 | 微博科普、知乎科学、IT之家 |

**18 信息源完整列表：** 微博热搜、知乎热榜、百度热搜、今日头条、新浪新闻、贴吧、V2EX、快手、少数派、IT之家、36氪、掘金、虎扑、抖音热榜、B站热榜、猫目资讯、GitHub Trending、Product Hunt + Hacker News

---

## 🤖 支持的 AI 模型（10+）

| Provider | 价格 | 推荐 | 配置 |
|----------|------|------|------|
| **DeepSeek** | ¥1/百万 token | 🥇 性价比 | `AI_PROVIDER=deepseek` |
| **MiniMax** | 官方定价 | 🥈 国产 | `AI_PROVIDER=minimax` |
| **OpenAI** | $0.15/百万 | 🥉 质量 | `AI_PROVIDER=openai` |
| **Anthropic** | $3/百万 | 长文 | `AI_PROVIDER=anthropic` |
| **Google Gemini** | 免费额度 | 速度 | `AI_PROVIDER=google` |
| **通义千问** | 每天 100 万免费 | 国内 | `AI_PROVIDER=qwen` |
| **智谱 GLM** | 新用户免费 | 国内 | `AI_PROVIDER=zhipu` |
| **豆包** | 1 折 | 便宜 | `AI_PROVIDER=doubao` |
| **Kimi** | 32k 上下文 | 长文 | `AI_PROVIDER=kimi` |
| **Ollama** | 完全免费 | 本地 | `AI_PROVIDER=custom` |

---

## 📮 支持的邮件服务商（14+）

### SMTP 协议（10 家）

| 服务 | 配置 | 说明 |
|------|------|------|
| QQ 邮箱 | `MAIL_PROVIDER=qq` | 国内最方便 |
| 网易163 | `MAIL_PROVIDER=netease` | 稳定 |
| Gmail | `MAIL_PROVIDER=gmail` | 需翻墙 |
| Outlook | `MAIL_PROVIDER=outlook` | 微软 |
| 自定义 SMTP | `MAIL_PROVIDER=custom-smtp` | 通用 |

### HTTP API 协议（4 家）

| 服务 | 免费额度 | 配置 |
|------|---------|------|
| **Resend** | 3000 封/月 | `MAIL_PROVIDER=resend` |
| SendGrid | 100 封/天 | `MAIL_PROVIDER=sendgrid` |
| Mailgun | 5000 封/月 | `MAIL_PROVIDER=mailgun` |

---

## 📁 项目结构

```
lumapost/
├── .github/workflows/email.yml     # GitHub Actions 工作流
├── .env.example                     # 环境变量模板
├── README.md                        # 本文件
├── SKILL.md                         # WorkBuddy Skill
├── 使用说明.md                       # 详细使用说明
├── 技术说明.md                       # 技术文档
├── plugin.json                      # 通用插件
├── plugin-clawhub.json              # OpenCat/Claw 插件
├── plugin-skillhub.yaml             # SkillHub 插件
├── skillhub-plugin/                 # SkillHub 完整包
│   └── SKILL.md
└── lumapost/
    ├── package.json                 # NPM 配置
    ├── scripts/
    │   ├── ai-provider.js           # 🤖 AI 模型统一接口（UTF-8 修复）
    │   ├── mail-provider.js         # 📮 邮件服务统一接口
    │   ├── fetch-news-ai.js         # 🧠 AI 驱动新闻抓取（18源·10版块）
    │   ├── fetch-cn-news.js         # 📊 静态热榜（降级备用）
    │   ├── gen-html.js              # 🎨 HTML 生成（双列TOC·相对时间）
    │   └── send-email.js            # 旧版 SMTP（兼容）
    └── data/                        # 生成文件
```

---

## 🔧 命令行工具

### 生成新闻 + HTML + 发送（完整流程）

```bash
# 早报
node scripts/fetch-news-ai.js --period=morning --output=data/morning.json
node scripts/gen-html.js --data-file=data/morning.json --output=data/morning.html
node scripts/mail-provider.js --send --subject="早报" --body-file=data/morning.html
```

### 参数说明

| 参数 | 说明 |
|------|------|
| `--period` | `morning` / `noon` / `afternoon` / `evening` |
| `--output` | JSON 输出文件路径 |
| `--data-file` | 输入 JSON 文件路径 |
| `--body-file` | HTML 邮件内容文件 |

---

## ❓ 常见问题

### Q1: 中文乱码怎么办？

**A:** v2.8 已修复 UTF-8 编码问题（`Buffer.concat` 替代 `data += chunk`）。如果还有乱码，检查 Node.js 版本是否 >= 18。

### Q2: 邮件内容太少/不够丰富？

**A:** 确保配置了 `AI_API_KEY`，v2.8 的 `fetch-news-ai.js` 会调用 AI 生成深度解读。没有 AI 时降级为纯热榜模式。

### Q3: 怎么添加更多信息源？

**A:** 编辑 `scripts/fetch-news-ai.js` 的 `ALL_SECTIONS` 和 `fetchAllBoards()` 的 `types` 数组。uapis.cn 支持 15+ 平台热榜。

### Q4: GitHub Actions 时区问题？

**A:** GitHub Actions 使用 **UTC 时间**。`cron: '0 22 * * *'` = 北京时间 06:00（UTC+8）。本项目已正确配置。

### Q5: 怎么修改推送时间？

**A:** 编辑 `.github/workflows/email.yml` 的 cron 表达式，或在使用 WorkBuddy 自动化时修改任务 cron。

---

## 🔒 安全

- ✅ `.env` 已加入 `.gitignore`
- ✅ GitHub Secrets 加密存储  
- ✅ `MAIL_PASS` 是授权码（不是登录密码）
- ✅ API Key 可在 AI 平台单独撤销

---

## 📜 更新日志

### v2.8 (2026-07-01)

#### ✨ 新增
- 🔥 新增 **猫目资讯** HTML 爬虫信息源
- 🔥 新增 **抖音热榜、B站热榜** 信息源（uapis.cn API）
- 📊 版块从 16 合并为 **10 大版块**，去重优化
- 💬 每条新闻增加 **100-200 字 AI 深度解读**（commentary 字段）
- 🕐 时间显示改为**相对时间**（X分钟前/X小时前）

#### 🎨 优化
- 双列紧凑目录（TOC）
- 新闻卡片间增加 **2px 分隔线**
- 摘要框改为灰色背景，AI 解读更突出
- 串行抓取热榜（300ms 间隔）避免 429 限流

#### 🐛 修复
- 修复 UTF-8 中文乱码（Buffer.concat）
- 修复 uapis.cn 字段映射（hot_value → hot）
- 修复 xueqiu API 404（移除雪球源）

---

**🌟 如果这个项目对你有帮助，请给一个 Star！🌟**
