# LumaPost · AI 每日邮件推送

> 自动抓取 GitHub 热门项目 / 新闻 / 天气
> 生成精美 HTML 邮件并通过 SMTP 定时发送到你的邮箱

![Node](https://img.shields.io/badge/node-%3E%3D16-brightgreen)
![License](https://img.shields.io/github/license/yourname/lumapost)

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
git clone https://github.com/yourname/lumapost.git
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
.github/workflows/daily.yml
```

每天 UTC 00:00 自动执行。

---

## 📁 项目结构

```
lumapost/
├── .env                    # 环境变量（SMTP账号/密码，不提交Git）
├── .env.example             # 环境变量模板
├── .gitignore               # Git忽略规则
├── .github/
│   └── workflows/
│       └── daily.yml        # GitHub Actions 定时触发
├── package.json
├── package-lock.json
├── README.md
├── 技术说明.md
├── 问题.md
├── scripts/
│   ├── gen-html.js          # ⭐ HTML邮件正文生成（核心）
│   ├── send-email.js        # ⭐ SMTP发送邮件（核心）
│   ├── fetch-github.js      # GitHub Trending 抓取
│   └── cron-handler.js      # 定时任务入口
├── data/
│   ├── test-noon.json       # 测试用新闻数据
│   ├── preview.html         # 本地HTML预览
│   └── YYYY-MM-DD.json      # 每次运行生成当日数据缓存
├── logs/
│   └── .gitkeep             # 日志目录占位
└── node_modules/            # npm install 生成（被 .gitignore 忽略）
```

---

## 📜 License

MIT
