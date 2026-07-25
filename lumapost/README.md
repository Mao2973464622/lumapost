# 📰 LumaPost · 光影邮报

> 🤖 **AI 驱动的智能新闻邮件系统** — 每日 4 次自动推送 · 22+ AI 模型 · 14+ 邮件服务 · 零 API 费用方案

<p align="center">
  <img src="https://img.shields.io/badge/version-4.0.0-blue?style=flat-square" alt="Version 4.0.0">
  <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=flat-square" alt="Node >= 18">
  <img src="https://img.shields.io/github/license/Mao2973464622/lumapost?style=flat-square" alt="License MIT">
  <img src="https://img.shields.io/badge/PRs-welcome-orange?style=flat-square" alt="PRs Welcome">
  <img src="https://img.shields.io/github/stars/Mao2973464622/lumapost?style=flat-square&color=yellow" alt="GitHub Stars">
</p>

---

## 📬 邮件预览

| 早报 🌅 | 午报 ☀️ | 午后速递 🌇 | 晚间总结 🌙 |
|:------:|:------:|:---------:|:---------:|
| 紫蓝渐变头部 | 粉红渐变头部 | 蓝青渐变头部 | 深蓝渐变头部 |
| 隔夜大事回顾 | 上午行情速递 | 午后新品发布 | 全天深度复盘 |
| ⚡ TL;DR + 📈 股市 | ⚡ TL;DR + 📈 股市 | ⚡ TL;DR + 📈 股市 | ⚡ TL;DR + 📈 股市 |

每封邮件包含：**TOP 3 头条**（带 AI 主编 300-500 字深度解读）→ **10 大版块**（星级评分 + 快评 + AI 解析）→ **📈 趋势解读** → **💬 每日一句**

---

## ✨ 核心特性

| | 特性 | 说明 |
|:---:|------|------|
| 🤖 | **22+ AI 模型** | DeepSeek / MiniMax / OpenAI / Claude / 通义千问 / 智谱 / 豆包 / Kimi / 阶跃星辰 / 腾讯混元 / 华为盘古 / Groq / 硅基流动 等 |
| 📮 | **14+ 邮件服务** | QQ邮箱 / 网易163/126/yeah / Gmail / Outlook / Yahoo / 阿里云 / Resend / SendGrid / Mailgun / Postmark / Microsoft Graph |
| 🌐 | **22 个信息源** | 知乎/微博/百度/头条/B站/抖音/36氪/虎扑/贴吧/V2EX/IT之家/掘金/快手/少数派 + AIbase/AI-Bot/猫目/CNMO科技/数码闲聊站 + GitHub Trending/Product Hunt/Hacker News |
| 📊 | **10 大版块** | AI·智能体 / 硬件·数码 / 全球创意·开源 / 国内外新闻 / 游戏·动漫 / 理财·财经 / 汽车·新能源 / 互联网大厂 / 影视·生活·科技 / 科学·航天·健康 |
| ☁️ | **云端部署** | GitHub Actions 免费运行，电脑关机也能发 |
| 🆓 | **零费用方案** | Google Gemini / 通义千问免费额度 / Groq 免费额度均可使用 |
| 🎨 | **精美 HTML** | 响应式邮件设计 · 4 时段渐变配色 · 星级评分 · AI 深度解读 |

---

## 🎯 为什么选择 LumaPost？

| 对比项 | LumaPost | 传统 RSS 邮件 | 商业新闻聚合 |
|--------|----------|-------------|------------|
| 💰 价格 | **完全免费** | 免费 | ¥99+/月 |
| 🧠 AI 深度解读 | ✅ **每条新闻都有** | ❌ 无 | ❌ 无 |
| 🔍 信息源 | **22 个** | 自定义有限 | 固定 |
| 🤖 AI 模型 | **22+ 种可选** | ❌ | ❌ |
| 📮 邮箱支持 | **14+ 服务商** | 仅 SMTP | 仅站内 |
| 📊 股市+天气 | ✅ **内置** | ❌ | ✅ |
| ☁️ 云端运行 | ✅ **免费** | ❌ 需服务器 | ✅ |

---

## 🚀 快速开始（GitHub Actions · 推荐）

### 1️⃣ Fork 仓库

打开 [github.com/Mao2973464622/lumapost](https://github.com/Mao2973464622/lumapost) → 点右上角 **Fork**

### 2️⃣ 配置 Secrets

进入你 Fork 的仓库 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

**最少只需 3 个：**

```env
AI_API_KEY = sk-your-deepseek-api-key    # DeepSeek API Key
MAIL_USER  = your-email@qq.com           # 发件邮箱
MAIL_PASS  = your-smtp-auth-code         # SMTP 授权码（不是登录密码！）
```

> 💡 DeepSeek 注册：https://platform.deepseek.com
> 💡 QQ邮箱授权码：设置 → 账户 → POP3/SMTP → 开启 → 生成授权码

### 3️⃣ 测试

仓库 **Actions** → **LumaPost Email** → **Run workflow** → 选时段 → **Run workflow**

### 4️⃣ 自动化运行

已内置定时任务，每天 4 次：
| 时段 | 北京时间 | 内容 |
|------|----------|------|
| 🌅 早报 | **06:00** | 隔夜大事、美股收盘 |
| ☀️ 午报 | **12:00** | 上午行情、企业动态 |
| 🌇 午后速递 | **17:30** | 午后新品、突发事件 |
| 🌙 晚间总结 | **21:00** | 全天复盘、热榜 TOP |

---

## � 数据处理流程

```
🌐 22 个信息源
  │
  ├─ uapis.cn 热榜（15 平台·串行·300ms 间隔）
  ├─ AI 资讯站（AIbase/AI-Bot/猫目/CNMO科技/IT之家/数码闲聊站）
  └─ 国际热门（GitHub Trending / Product Hunt / Hacker News）
  │
  ▼
🧠 fetch-news-ai.js
  │  ① 关键词过滤 → 10 版块各自匹配
  │  ② 分 2 批并行调用 AI（每组 ≤4 版块）
  │  ③ 生成头条 TOP3 + TL;DR + 5 趋势分析
  │  ④ 股市数据（新浪·GBK解码）+ 天气（Open-Meteo）
  │  ⑤ 完整性检查（GOOD ≥40 / DEGRADED 20-39 / LOW <20）
  │
  ▼  data/{period}-latest.json
  │
🎨 gen-html.js
  │  渲染响应式 HTML 邮件（4 时段配色 + 双列目录 + 相对时间）
  │
  ▼  data/{period}-email.html
  │
📮 mail-provider.js
  │  SMTP / HTTP API → 你的邮箱
  │
  ▼
✅ 邮件推送完成
```

---

## �🛠 本地运行

```bash
# 1. 克隆
git clone https://github.com/Mao2973464622/lumapost.git
cd lumapost

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 填入 AI_API_KEY / MAIL_USER / MAIL_PASS

# 4. 测试
npm run ai:test       # 测试 AI 是否可用
npm run send:test     # 测试邮件能否发送

# 5. 生成并发送
npm run all:morning   # 发送早报
npm run all:noon      # 发送午报
npm run all:afternoon # 发送午后速递
npm run all:evening   # 发送晚间总结
```

---

## 🐳 Docker 部署

```bash
docker compose build
docker compose run --rm lumapost all:morning  # 测试运行
docker compose up -d                           # 启动定时任务
```

---

## 🤖 支持的 AI 模型

| 标识符 | 提供商 | 默认模型 | 费用 |
|--------|--------|---------|------|
| `deepseek` | DeepSeek | deepseek-v4-flash | ¥1/百万 token |
| `minimax` | MiniMax | MiniMax-M3 | 官方定价 |
| `openai` | OpenAI | gpt-4o-mini | $0.15/百万 |
| `anthropic` | Anthropic Claude | claude-3-7-sonnet | $3/百万 |
| `google` | Google Gemini | gemini-2.5-flash | 🆓 免费额度 |
| `qwen` | 阿里通义千问 | qwen3.7-plus | 🆓 100万 token/天 |
| `zhipu` | 智谱 GLM | glm-4.5-plus | 新用户免费 |
| `doubao` | 字节豆包 | doubao-pro-256k | 1 折起 |
| `kimi` | 月之暗面 Kimi | moonshot-v1-128k | 官方定价 |
| `stepfun` | 阶跃星辰 | step-1.5-32k | 官方定价 |
| `hunyuan` | 腾讯混元 | hy-3.0-pro | 官方定价 |
| `pangu` | 华为盘古 | pangu-ultra | 企业级 |
| `groq` | Groq | llama-3.3-70b-specdec | 🆓 免费额度 |
| `ernie` | 百度文心一言 | ernie-4.0-turbo | 官方定价 |
| `siliconflow` | 硅基流动 | deepseek-ai/DeepSeek-V4 | 官方定价 |
| `openrouter` | OpenRouter | deepseek/deepseek-chat | 聚合平台 |
| `custom` | 自定义 | 任意 | Ollama 本地 |

> 切换方式：`AI_PROVIDER=xxx` + 对应 `AI_API_KEY`

---

## 📮 支持的邮件服务

**SMTP 协议：** `qq` · `netease` · `netease-126` · `netease-yeah` · `gmail` · `outlook` · `yahoo` · `aliyun` · `qq-enterprise` · `custom-smtp`

**HTTP API 协议：** `resend`（🥇 海外推荐，免费 3000 封/月） · `sendgrid` · `mailgun` · `postmark` · `graph`

> 切换方式：`MAIL_PROVIDER=xxx` + 对应凭证

---

## 📁 项目结构

```
lumapost/
├── .github/workflows/email.yml     # GitHub Actions 工作流
├── scripts/
│   ├── ai-provider.js              # 22+ AI 模型统一接口
│   ├── mail-provider.js            # 14+ 邮件服务统一接口
│   ├── fetch-news-ai.js            # AI 驱动新闻抓取（主流程）
│   ├── fetch-cn-news.js            # 静态热榜降级方案
│   └── gen-html.js                 # HTML 邮件生成
├── data/                           # 输出目录
├── .env.example                    # 环境变量模板
├── package.json                    # 依赖 + npm scripts
├── Dockerfile                      # Docker 镜像
├── docker-compose.yml              # Docker Compose + Ofelia 定时器
├── ofelia.ini                      # Ofelia 定时任务
├── crontab.example                 # Crontab 示例
├── lumapost.service                # systemd 服务
├── SKILL.md                        # WorkBuddy 插件
├── plugin.json                     # 通用插件格式
├── plugin-clawhub.json             # 龙虾/OpenCat 插件
├── plugin-skillhub.yaml            # SkillHub 插件
├── 技术说明.md                      # 技术文档
├── 使用说明.md                      # 用户手册
├── 问题.md                          # FAQ
└── README.md                       # 本文件
```

---

## 📚 文档导航

| 文档 | 适合谁 | 内容 |
|------|--------|------|
| [📖 使用说明](./使用说明.md) | **所有用户** | 9 种部署方式、配置表、进阶玩法 |
| [🔧 技术说明](./技术说明.md) | **开发者** | 架构图、数据流、API、协议、环境变量 |
| [❓ 常见问题](./问题.md) | **遇到问题的用户** | 发送失败、AI 问题、邮件问题、Docker 问题 |
| [📋 4.0 更新日志](./4.0更新日志.md) | **升级用户** | AI Provider v2.0 更新详情 |
| [🔐 Secrets 配置指南](./4.0secret配置文件.md) | **新手** | GitHub Secrets 完整配置教程 |

---

## 🤝 参与贡献

欢迎各种形式的贡献！方式包括但不限于：

- 🐛 **提 Issue**：发现 Bug 或有功能建议
- 🚀 **Pull Request**：改进代码或文档
- ⭐ **Star**：让更多人看到这个项目
- 📢 **推荐**：推荐给朋友或同事

**开发指引：**
```bash
git clone https://github.com/Mao2973464622/lumapost.git
cd lumapost
npm install
# 修改代码后确保 npm run all:morning 能正常运行
```

---

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Mao2973464622/lumapost&type=Date)](https://star-history.com/#Mao2973464622/lumapost&Date)

---

## 📜 License

MIT License — 免费开源，欢迎 Star ⭐

<p align="center">
  <b>项目地址</b>：<a href="https://github.com/Mao2973464622/lumapost">github.com/Mao2973464622/lumapost</a>
  <br>
  <b>问题反馈</b>：提 Issue 或加 QQ <b>2973464622</b>
  <br><br>
  <img src="https://img.shields.io/github/stars/Mao2973464622/lumapost?style=social" alt="stars">
  <img src="https://img.shields.io/github/forks/Mao2973464622/lumapost?style=social" alt="forks">
</p>
