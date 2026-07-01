---
name: lumapost
version: "2.9.0"
description: "LumaPost 光影邮报 - AI Agent 主动搜索最新新闻+深度分析+邮件推送。10大版块、主动WebSearch实时新闻（非热榜旧数据）、真实时间戳、零外部API费用、GitHub Actions云端部署。"
author: "QiXua"
category: "automation"
tags: ["news", "email", "automation", "ai", "daily", "github-actions", "deepseek", "minimax", "multi-model", "multi-provider"]
---

# LumaPost · 光影邮报 Skill v2.9

> 🔍 **主动搜索** 实时新闻 · 🧠 AI Agent 深度分析 · 📮 自动推送 — **零外部API费** ✨

## ✨ 这是什么

LumaPost 是一个**主动搜索+AI深度分析**的智能新闻邮件系统。每天 4 个时间点自动：

1. **主动搜索** 用 WebSearch 实时搜索各领域最新新闻（非被动抓热榜旧数据）
2. **Agent 深度解析** AI Agent 亲自分析每条新闻，写 100-200 字有深度、有观点的解读
3. **真实时间戳** 每条新闻标注真实发布时间，不是抓取时间
4. **生成** 精美 HTML 邮件（双列目录 + TOP3 头条 + 10 大版块 + 相对时间 + 趋势解读）
5. **推送** 到你的邮箱（QQ/网易/Gmail/Outlook/Resend/SendGrid 等 14+ 服务商）

**核心优势：**
- 🔍 **主动搜索**：不是被动抓热榜旧数据，而是主动用搜索引擎找最新内容
- 🧠 **AI Agent 亲自写**：每条新闻有 100-200 字深度分析，有观点有判断
- 🕐 **真实时间戳**：每条新闻显示真实的发布时间，不是统一的假时间
- 📋 **双列紧凑目录**：固定入口 + 双列版块网格，一屏搞定
- 🃏 **卡片边界清晰**：分隔线 + 灰底摘要框，信息层次分明
- 🆓 **零 API 费用**：Agent 自己分析，不调用 DeepSeek/MiniMax 等外部模型
- ☁️ **云端运行**：GitHub Actions 或 WorkBuddy 定时任务，**电脑关机照发不误**

---

## 🆕 v2.9 新特性

| v2.8 | v2.9 |
|---|---|
| 被动抓 uapis 热榜旧数据 | ✅ **主动 WebSearch** 搜索各领域最新新闻 |
| 时间戳全是假的时间 | ✅ **每条新闻真实发布时间**（如6月23日10:10） |
| 调用 DeepSeek API 花钱 | ✅ **AI Agent 亲自分析**，零外部API费用 |
| — | ✅ 分析更有深度、有个人观点和正反判断 |

---

### 10 大版块（v2.9）

| # | 版块 | 搜索关键词 |
|---|------|-----------|
| 1 | 🤖 AI·智能体 | AI大模型、人形机器人、具身智能 |
| 2 | 💻 硬件·数码 | 芯片、手机、消费电子 |
| 3 | 🌍 开源·创意 | GitHub Trending、开源项目 |
| 4 | 📰 国内外新闻 | 社会热点、政策 |
| 5 | 🎮 游戏·动漫 | 游戏大作、动漫 |
| 6 | 💰 理财·财经 | A股、基金、财经 |
| 7 | 🚗 汽车·新能源 | 电动车、智驾 |
| 8 | 🌐 互联网大厂 | 平台动态、产品更新 |
| 9 | 🎬 影视·生活·体育 | 影视娱乐、体育赛事 |
| 10 | 🔬 科学·航天 | 航天、黑科技、健康 |

---

## 🚀 5 分钟快速开始（GitHub Actions 推荐）

### 1️⃣ Fork 仓库

点击本仓库右上角 **Fork** → 复制到你的账号。

### 2️⃣ 配置 Secrets（密码箱）

进入你 Fork 的仓库 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

按下面顺序**逐个添加**：

#### 🤖 AI 模型（必填 1 项）

| Name | Value | 说明 |
|------|-------|------|
| `AI_API_KEY` | `sk-xxx` | 你的 API Key（推荐用 [DeepSeek](https://platform.deepseek.com)，充 10 块用半年） |
| ~~`DEEPSEEK_API_KEY`~~ | - | 也可用提供商专用名 |

> 💡 **白嫖推荐**：
> - [DeepSeek](https://platform.deepseek.com) 注册送 10 元，1 块钱能发 1000 封
> - [通义千问](https://dashscope.console.aliyun.com) 每天 100 万 token 免费
> - [智谱 GLM](https://open.bigmodel.cn) 新用户送 2000 万 token

#### 📮 邮件服务（必填 1 项）

**方式 A：QQ 邮箱**（国内最方便）

| Name | Value |
|------|-------|
| `MAIL_PROVIDER` | `qq` |
| `MAIL_USER` | `你的QQ邮箱@qq.com` |
| `MAIL_PASS` | `你的SMTP授权码`（16位） |

获取授权码：QQ邮箱 → 设置 → 账户 → POP3/IMAP/SMTP → 开启 → 发送短信 → 生成授权码

**方式 B：网易163**

| Name | Value |
|------|-------|
| `MAIL_PROVIDER` | `netease` |
| `MAIL_USER` | `你的163邮箱@163.com` |
| `MAIL_PASS` | `你的客户端授权密码` |

**方式 C：Gmail（需翻墙）**

| Name | Value |
|------|-------|
| `MAIL_PROVIDER` | `gmail` |
| `MAIL_USER` | `your@gmail.com` |
| `MAIL_PASS` | `你的应用专用密码`（需开启两步验证） |

**方式 D：Resend（海外推荐，免费 3000 封/月）**

| Name | Value |
|------|-------|
| `MAIL_PROVIDER` | `resend` |
| `MAIL_API_KEY` | `re_xxx` |
| `MAIL_FROM` | `noreply@yourdomain.com`（需在 Resend 验证域名） |
| `MAIL_USER` | `your@gmail.com`（收件人） |

#### 👥 群发收件人（可选）

| Name | Value | 说明 |
|------|-------|------|
| `EMAIL_TO` | `a@x.com,b@y.com` | 多个邮箱用**英文逗号**分隔，不留空格 |

### 3️⃣ 测试发送

进入仓库 **Actions** → 左侧 **LumaPost Email** → 右侧 **Run workflow** → 选时段 → **Run workflow**

1-2 分钟后去邮箱查看！

### 4️⃣ 自动化（已配置好）

无需操作，GitHub Actions 每天自动 4 次发送：
- **06:00** 北京时间 → 早报
- **12:00** 北京时间 → 午报
- **16:00** 北京时间 → 午后速递
- **24:00** 北京时间 → 晚间总结

---

## 🛠 本地运行（高级用户）

```bash
# 1. 克隆
git clone https://github.com/Mao2973464622/lumapost.git
cd lumapost/lumapost

# 2. 安装
npm install

# 3. 配置
cp .env.example .env
# 编辑 .env 填入 AI_API_KEY 和 MAIL_USER/MAIL_PASS

# 4. 测试邮件通道
npm run send:test

# 5. 测试 AI 通道
npm run ai:test

# 6. 完整跑一次早报
npm run all:morning
```

---

## 🤖 支持的 AI 模型（10+）

| Provider | 模型 | 价格 | 推荐场景 |
|----------|------|------|----------|
| **DeepSeek** | deepseek-chat | ¥1/百万 token | 🥇 性价比首选 |
| **MiniMax** | MiniMax-Text-01 | 官方定价 | 国产备用 |
| **OpenAI** | gpt-4o-mini | $0.15/百万 | 质量最高 |
| **Anthropic** | claude-3-5-sonnet | $3/百万 | 长文最佳 |
| **Google** | gemini-1.5-flash | 免费额度 | 速度快 |
| **通义千问** | qwen-plus | 每天免费 100 万 token | 国内备用 |
| **智谱 GLM** | glm-4-flash | 新用户免费 | 国内备用 |
| **豆包** | doubao-lite | 1 折起 | 极致便宜 |
| **Kimi** | moonshot-v1-32k | 32k 上下文 | 长文本 |
| **Moonshot** | 同上 | 同上 | 同上 |
| **Custom** | 任意 | 自定义 | 自建/Ollama |

切换方式：改 `AI_PROVIDER=xxx` + 设对应 `AI_API_KEY`

---

## 📮 支持的邮件服务商（14+）

### SMTP 协议（10 家）
- ✅ QQ 邮箱 (`qq`)
- ✅ 网易163 (`netease`)
- ✅ 网易126 (`netease-126`)
- ✅ 网易yeah (`netease-yeah`)
- ✅ Gmail (`gmail`)
- ✅ Outlook/Hotmail (`outlook`)
- ✅ Yahoo Mail (`yahoo`)
- ✅ 阿里云邮箱 (`aliyun`)
- ✅ QQ企业邮箱 (`qq-enterprise`)
- ✅ 自定义 SMTP (`custom-smtp`)

### HTTP API 协议（4 家，无需 SMTP 端口）
- ✅ Resend (`resend`) — 🥇 海外推荐，**免费 3000 封/月**
- ✅ SendGrid (`sendgrid`) — 100 封/天免费
- ✅ Mailgun (`mailgun`) — 5000 封/月免费
- ✅ Postmark (`postmark`) — 测试邮箱无限
- ✅ Microsoft Graph (`graph`) — Office365 企业

切换方式：改 `MAIL_PROVIDER=xxx` + 设对应凭证

---

## 📦 邮件内容结构

每封邮件包含：

1. **🌅 渐变头部**（按时段不同配色）
   - 早报 = 紫蓝渐变
   - 午报 = 粉红渐变
   - 午后 = 蓝青渐变
   - 晚间 = 深蓝渐变
2. **🌤 实时天气**（基于你的经纬度，默认长沙）
3. **💬 问候语**（按时段）
4. **🔥 TOP 3 头条**（带 AI 深度解读 100-200 字）
5. **📦 10 大版块**（每版 3-8 条新闻 + AI 深度解析 + 快评 + 星级）
   - 🤖 AI · 智能体（AI + 人形机器人）
   - 💻 硬件 · 数码（芯片 + 手机）
   - 🌍 全球创意 · 开源（GitHub + PH + HN）
   - 📰 国内外新闻（国内 + 国际）
   - 🎮 游戏 · 动漫
   - 💰 理财 · 财经
   - 🚗 汽车 · 新能源
   - 🌐 互联网大厂
   - 🎬 影视 · 生活 · 科技
   - 🔬 科学 · 航天 · 健康
6. **📈 今日趋势解读**（5 条 AI 趋势分析）
7. **💬 每日一句**（按时段精选名言）
8. **📧 专业页脚**

---

## 🔧 完整配置变量参考

### GitHub Secrets 必填（最少 2 个）

| Name | 示例 | 必填 |
|------|------|------|
| `AI_API_KEY` | `sk-xxx` | ✅ |
| `MAIL_USER` | `your@qq.com` | ✅ |
| `MAIL_PASS` | `auth_code_xxx` | ✅ |

### GitHub Secrets 可选

| Name | 默认值 | 说明 |
|------|--------|------|
| `MAIL_PROVIDER` | `qq` | 邮件服务商 |
| `AI_PROVIDER` | `deepseek` | AI 提供商 |
| `AI_MODEL` | 自动 | 模型名 |
| `AI_BASE_URL` | 自动 | 自定义 endpoint（custom 模式用） |
| `AI_TEMP` | `0.7` | AI 创造性 |
| `AI_MAX_TOKENS` | `4096` | 单次最大输出 |
| `MAIL_FROM` | `MAIL_USER` | 发件邮箱 |
| `EMAIL_TO` | `MAIL_USER` | 收件人（多邮箱用逗号分隔） |
| `SMTP_HOST` | 自动 | 自定义 SMTP 主机 |
| `SMTP_PORT` | 自动 | 自定义 SMTP 端口 |
| `SMTP_SECURE` | `true` | SMTP SSL |
| `MAILGUN_DOMAIN` | - | Mailgun 域名 |

### Workflow Inputs（运行时参数）

| Name | 类型 | 选项 | 默认 |
|------|------|------|------|
| `period` | choice | auto/morning/noon/afternoon/evening | auto |
| `preview` | boolean | true/false | false |
| `skip_ai` | boolean | true/false | false |

---

## 📁 项目结构

```
lumapost/
├── .github/workflows/email.yml     # GitHub Actions 工作流
├── .env.example                     # 环境变量模板
├── README.md                        # 项目说明
├── SKILL.md                         # 本文件（WorkBuddy Skill）
├── plugin.json                      # 通用插件格式
├── plugin-clawhub.json              # OpenCat/Claw 格式
├── plugin-skillhub.yaml             # SkillHub 格式
├── skillhub-plugin/                 # SkillHub 完整包
└── lumapost/
    ├── package.json                 # 依赖 + 30+ npm scripts
    ├── scripts/
    │   ├── ai-provider.js           # 🤖 10+ AI 模型统一接口
    │   ├── mail-provider.js         # 📮 14+ 邮件服务统一接口
    │   ├── fetch-news-ai.js         # 🧠 AI 驱动的新闻抓取
    │   ├── fetch-cn-news.js         # 📊 静态热榜（降级用）
    │   ├── gen-html.js              # 🎨 HTML 邮件生成
    │   └── send-email.js            # 旧版 SMTP 发送（保留兼容）
    └── data/                        # 生成文件
```

---

## ❓ 常见问题

### Q1: 4 个时段内容为啥一样？
**A:** v1.x 版本的"AI 解读"是写死的模板。**v2.0 改用真 LLM**，每个时段用不同关键词重新生成。请升级到 v2.0 + 配 `AI_API_KEY`。

### Q2: 邮件收到但内容是英文？
**A:** 在 prompt 里强调"请用中文回答"。已修复。检查 `AI_MODEL` 是否支持中文。

### Q3: 邮件发到垃圾箱？
**A:**
- QQ/163 邮箱：把发件地址加白名单
- Gmail：检查 All Mail / Spam
- Resend：确保域名 DKIM/SPF 配好

### Q4: Actions 跑失败？
**A:** 看 Actions 日志的报错。常见原因：
- AI_API_KEY 余额不足
- MAIL_PASS 错了（不是登录密码，是授权码）
- MAIL_PROVIDER 没设置

### Q5: 能用 Ollama 本地模型吗？
**A:** 可以！设：
```
AI_PROVIDER=custom
AI_BASE_URL=http://your-server:11434/v1
AI_MODEL=llama3
AI_API_KEY=ollama
```

### Q6: 能改成只发一次吗？
**A:** 编辑 `.github/workflows/email.yml`，删掉其他 cron：
```yaml
schedule:
  - cron: '0 22 * * *'   # 只保留早报
```

### Q7: 能加更多新闻源吗？
**A:** 编辑 `scripts/fetch-news-ai.js` 的 `SECTIONS` 数组 + prompt 即可。

### Q8: 我想换其他 AI 模型但没钱？
**A:** 推荐这些**完全免费**的方案：
- **Google Gemini Flash**：每天 1500 次免费
- **通义千问 qwen-turbo**：每天 100 万 token 免费
- **智谱 GLM-4-Flash**：新用户送 2000 万 token
- **Ollama 本地**：完全免费（要自己跑模型）

---

## 🔌 跨平台插件支持

| 平台 | 文件 | 安装 |
|------|------|------|
| **WorkBuddy** | `SKILL.md`（本文件） | 复制到 `~/.workbuddy/skills/lumapost/` |
| **OpenCat/Claw** | `plugin-clawhub.json` | 导入 JSON |
| **通用 AI** | `plugin.json` | 复制 prompt 到自定义指令 |
| **SkillHub** | `plugin-skillhub.yaml` | 导入 YAML |
| **SkillHub 完整** | `skillhub-plugin/` | 上传整个目录 |

---

## 🔒 安全

- ✅ `.env` 已加入 `.gitignore`
- ✅ GitHub Secrets 加密存储
- ✅ `MAIL_PASS` 是授权码（不是登录密码），泄露后可单独重置
- ✅ API Key 可在 AI 平台单独撤销
- ✅ 邮件中所有链接都是真实新闻来源

---

## 📜 License

MIT — 随便用，欢迎 Star ⭐

---

**🌟 Star 一下，让更多人看到这个项目！🌟**
