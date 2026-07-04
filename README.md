# LumaPost · AI 每日邮件推送   

> 自动抓取 GitHub 热门项目 / 新闻 / 天气
> 生成精美 HTML 邮件并通过 SMTP 定时发送到你的邮箱

![Node](<https://img.shields.io/badge/node-%3E%3D16-brightgreen>)
![License](https://img.shields.io/github/license/Mao2973464622/lumapost)

---

## ✨ 功能特性

- 📰 GitHub Trending 项目抓取
- 🌤️ Open-Meteo 实时天气
- 🧠 AI 摘要（可选）
- 📧 HTML 邮件渲染（nodemailer）
- ⏰ GitHub Actions 每日定时发送

---

## 📦 快速开始

### 1️⃣ 克隆项目

```bash
git clone https://github.com/Mao2973464622/lumapost.git
cd lumapost
```

### 2️⃣ 安装依赖

```bash
npm install
```

### 3️⃣ 配置环境变量

复制模板：

```bash
cp .env.example .env
```

编辑 `.env`：

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your@email.com
SMTP_PASS=your_smtp_password
MAIL_TO=receiver@example.com
```

### 4️⃣ 本地运行

```bash
node scripts/gen-html.js
node scripts/send-email.js
```

---

## ⚙️ 定时运行（推荐）

使用 GitHub Actions（已内置）：

```
.github/workflows/email.yml
```

每天自动执行（北京时间 06:00 / 12:00 / 17:30 / 21:00）。

---

## 📁 项目结构

```
lumapost github版/       
├── .github/
│   └── workflows/
│       └── email.yml     # GitHub Actions 定时触发
├── .workbuddy/
│   └── memory/
│       ├── 2026-7-04.md
        └── MEMORY.md
├── scripts/
│   ├── ai-provider.js    #统一 AI 模型调用层
│   ├── fetch-cn-news.js  #获取中文实时热榜新闻
│   ├── fetch-news-ai.js  #AI 驱动的新闻抓取脚本（v3.0）
│   ├── gen-html.js        #光影邮报 HTML 邮件生成脚本 v3.0
│   ├── mail-provider.js    #统一邮件发送层
│   └── send-email.js     #邮件发送脚本（已废弃）
│
│
│
├── .env.example             # 环境变量模板
└── .gitighore               #不提交内容
├── 技术说明.md
├── 使用说明.md
├── 问题.md
├── crontab.example         #定时任务的早中晚
├── docker-compose.yml      #定时任务
├── package-lock.json      
├── Dockerfile             
├── LlCENSE             
├── lumapost.service            
├── ofelia.ini            
├── package-lock.json     
├── package.json   
├── plugin-clawhub.json   
├── plugin-skillhub.yaml   
├── plugin.json   
├── README.md           
└── SKILLS.md

```

---

## 📜 License

MIT
