# LumaPost - 光影邮报 🌟

> 📰 **智能个性化新闻摘要系统** · 每日4次自动抓取全球资讯 · AI深度解读 · 精美HTML邮件推送

---

## ✨ 效果预览

邮件样式参考：[LumaPost 午报 PDF 示例](examples/)

**邮件包含：**
- 🎨 渐变头部（按时段不同配色：早=紫蓝 / 午=粉红 / 午后=蓝青 / 晚=深蓝）
- 🔥 TOP 3 头条新闻（带 AI 编者按深度解读）
- 📦 8 大版块新闻卡片（星级评分 + 快评 + 编者按）
- 📈 今日趋势深度解读
- 💬 每日一句（励志/财经/人生哲理）
- 📧 专业页脚

---

## 🚀 快速开始

### 1️⃣ 配置

复制环境变量模板并填入你的配置：

```bash
cp .env.example .env
```

编辑 `.env`：

```bash
# 邮件配置（必填）
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your_email@qq.com
SMTP_PASS=your_smtp_authorization_code   # QQ邮箱的SMTP授权码，不是密码！
EMAIL_FROM=your_email@qq.com
EMAIL_TO=recipient_email@qq.com

# 天气配置（可选，邮件头部显示天气）
WEATHER_CITY=湖南

# 日志
LOG_DIR=./logs
```

> **获取QQ邮箱SMTP授权码：** 登录QQ邮箱 → 设置 → 账户 → POP3/IMAP/SMTP服务 → 开启 → 生成授权码

### 2️⃣ 安装依赖

```bash
npm install
```

### 3️⃣ 测试邮件发送

用真实新闻数据测试完整流程：

```bash
# 第1步：生成HTML（使用测试数据）
node scripts/gen-html.js --data-file data/test-noon.json --output data/preview.html

# 第2步：发送邮件
SMTP_HOST=smtp.qq.com SMTP_PORT=465 SMTP_SECURE=true \
  SMTP_USER=your_email@qq.com SMTP_PASS=your_auth_code \
  EMAIL_FROM=your_email@qq.com \
  node scripts/send-email.js \
  --to your_email@qq.com \
  --subject "✨ LumaPost · 光影邮报 · 测试" \
  --body-file data/preview.html
```

收到邮件说明配置正确！

---

## ⏰ 定时自动推送（核心功能）

### 方式一：WorkBuddy 自动化（推荐 ✅）

本项目已配置好 4 个 WorkBuddy 自动化任务，到时间 AI 会自动：
1. 搜索最新新闻（WebSearch）
2. 构建 JSON 数据
3. 生成 HTML 邮件
4. 通过 SMTP 发送

| 时间 | 任务 | 内容侧重 |
|------|------|----------|
| 06:00 | 早报 | 昨夜至今早重要新闻 |
| 12:00 | 午报 | 上午最新动态 |
| 16:00 | 午后速递 | 下午时段新闻 |
| 24:00 | 晚间总结 | 全天回顾总结 |

**启动自动化：**
在 WorkBuddy 中执行：
```
/automation list
```
查看是否已有这 4 个任务，状态应为 `ACTIVE`。

**⚠️ 重要说明（关于电脑关机）：**

WorkBuddy 自动化任务的调度在**服务端**，但执行时需要：
- WorkBuddy 桌面端**保持运行**（可最小化到托盘）
- 电脑**不能关机**（或设置定时唤醒）

如果想实现**完全云端运行**（电脑关机也能发邮件），需要把项目部署到云服务器，然后配置系统 crontab。详见下方「部署到云服务器」章节。

### 方式二：系统 crontab（云端部署用）

将项目部署到云服务器后，配置 crontab：

```bash
crontab -e
```

添加：
```bash
# 早报 06:00
0 6 * * * cd /path/to/lumapost && node scripts/cron-handler.js --task=morning >> logs/morning.log 2>&1

# 午报 12:00
0 12 * * * cd /path/to/lumapost && node scripts/cron-handler.js --task=noon >> logs/noon.log 2>&1

# 午后速递 16:00
0 16 * * * cd /path/to/lumapost && node scripts/cron-handler.js --task=afternoon >> logs/afternoon.log 2>&1

# 晚间总结 24:00
0 0 * * * cd /path/to/lumapost && node scripts/cron-handler.js --task=evening >> logs/evening.log 2>&1
```

---

## 📦 邮件版块说明

每封邮件包含以下 8 个版块（自动生成，无需手动维护）：

| 版块 | 内容 | 信息源 |
|------|------|--------|
| 🤖 AI · 机器人 | AI大模型、Agent、具身智能 | 机器之心、36氪、腾讯云 |
| 💻 硬件 · 芯片 | 半导体、存储芯片、HBM | IT之家、快科技、SEMI |
| 🌍 全球创意项目 | GitHub热门开源项目 | GitHub Trending、掘金 |
| 🏛️ 国内新闻 | 国内重要新闻、社会热点 | 观察者网、澎湃、新华网 |
| 🌍 国际新闻 | 国际大事、地缘政治 | 环球网、央视网、新浪国际 |
| 📱 手机数码 | 手机、平板、消费电子 | CNMO科技、快科技 |
| 🎮 游戏 · 动漫 | 游戏、动漫、新番 | 游民星空、GTA6资讯 |
| 💰 理财小课堂 | A股、财经、理财知识 | 新浪财经、东方财富、雪球 |

**理财版块特色：** 每条新闻附「人话版 + 专业原话」双解读。

---

## 🔧 命令行工具

### 生成 HTML 邮件

```bash
node scripts/gen-html.js --data-file=<JSON数据文件> --output=<输出HTML文件>
```

示例：
```bash
node scripts/gen-html.js --data-file data/morning-latest.json --output data/morning-email.html
```

### 发送邮件

```bash
node scripts/send-email.js --to=<收件人> --subject=<主题> --body-file=<HTML文件>
```

也可用环境变量传 SMTP 配置（推荐）：
```bash
SMTP_HOST=smtp.qq.com SMTP_PORT=465 SMTP_SECURE=true \
  SMTP_USER=xxx@qq.com SMTP_PASS=xxx \
  node scripts/send-email.js --to=xxx@qq.com --subject="标题" --body-file=email.html
```

### 抓取 GitHub 项目

```bash
node scripts/fetch-github.js --output data/github-raw.txt --count 5
```

---

## 📊 JSON 数据格式

`gen-html.js` 接受的 JSON 格式：

```json
{
  "date": "2026年6月29日",
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
      "summary": "新闻摘要（50-100字）",
      "commentary": "AI编辑深度解读（100-200字）",
      "source": "来源媒体",
      "time": "2026-06-29",
      "url": "https://example.com/news/1",
      "verified": true
    }
  ],
  "sections": [
    {
      "name": "🤖 AI · 机器人",
      "colorKey": "ai",
      "items": [
        {
          "title": "新闻标题",
          "summary": "摘要",
          "quicknote": "一句话短评",
          "commentary": "深度解读（可选）",
          "source": "来源",
          "time": "2026-06-29",
          "url": "链接",
          "stars": 4,
          "verified": true
        }
      ]
    }
  ],
  "summary": [
    {
      "category": "🤖 AI",
      "trend": "一句话看懂趋势",
      "detail": "详细分析（80-150字）"
    }
  ]
}
```

**`greetingType` 取值：** `morning` / `noon` / `afternoon` / `evening`（影响头部配色）

**`colorKey` 取值：** `ai` / `hardware` / `github` / `domestic` / `international` / `mobile` / `games` / `finance`

**星级说明：** ★★★★★ 极重要 / ★★★★ 很重要 / ★★★ 一般重要

---

## 🖥️ 运行环境说明

### Windows 本地运行

- **不需要开 IDE 或 VS Code**
- 只需要 **WorkBuddy 桌面端保持运行**（可最小化到托盘）
- 自动化任务由 WorkBuddy 后台 Agent 执行
- **电脑关机 = 任务不执行**（本地脚本无法在关机状态运行）

### 云端部署（推荐用于生产）

部署到云服务器（阿里云/腾讯云/AWS）后：
1. 用系统 crontab 代替 WorkBuddy 自动化
2. 24/7 运行，不受本地电脑开关机影响
3. 详见下方「部署到云服务器」

---

## 🌐 部署到云服务器

### 步骤

```bash
# 1. 上传项目到服务器
scp -r lumapost/ user@your-server:/home/user/lumapost/

# 2. SSH登录服务器
ssh user@your-server

# 3. 安装 Node.js（推荐 v18+）
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 4. 安装依赖
cd /home/user/lumapost && npm install

# 5. 配置 .env
cp .env.example .env
nano .env   # 填入SMTP配置

# 6. 配置 crontab
crontab -e
# 添加4个定时任务（见上方「方式二」）

# 7. 查看日志确认运行
tail -f logs/morning.log
```

---

## ❓ 常见问题 (FAQ)

### Q1: 电脑关机后定时任务还会执行吗？

**A:** 取决于运行方式：
- **WorkBuddy 自动化方式：** 需要电脑开机 + WorkBuddy 运行。关机=不执行。
- **云服务器 crontab 方式：** 24/7 执行，不受本地电脑影响。✅ 推荐

### Q2: 必须开 VS Code 或 IDE 吗？

**A:** 不需要。WorkBuddy 自动化在后台运行，不需要任何 IDE。只要 WorkBuddy 桌面端开着就行。

### Q3: SMTP 授权码和邮箱密码有什么区别？

**A:** SMTP授权码是**专门用于第三方应用发邮件**的密码，不是邮箱登录密码。
- QQ邮箱获取方式：邮箱设置 → 账户 → 开启POP3/SMTP → 生成授权码
- 授权码长这样：`rzbbtlvnbrtydcje`（16位字母）

### Q4: 邮件收不到怎么办？

**A:**
1. 检查垃圾邮件箱（HTML邮件可能被误判）
2. 检查 SMTP 配置是否正确（运行测试发送）
3. 查看日志：`tail -f logs/morning.log`
4. QQ邮箱可能需要将发件人加入白名单

### Q5: 如何修改邮件样式？

**A:**
- 直接编辑 `scripts/gen-html.js` 中的 `generateHTML()` 函数
- 样式为内联 CSS（邮件兼容性好）
- 修改后重新运行 `gen-html.js` 生成预览

### Q6: 新闻内容是真实的吗？

**A:** 是的。自动化任务通过 WebSearch 实时搜索最新新闻，确保内容真实有效。每次发送的内容都不同。

### Q7: 如何添加/删除版块？

**A:** 编辑自动化任务的 prompt，在「第3步：构建JSON数据」部分修改 `sections` 数组。可以添加新的版块或删除不需要的版块。

---

## 📁 项目结构

```
lumapost/
├── .env                 # 环境变量配置（不提交）
├── .env.example         # 环境变量模板
├── package.json         # NPM配置
├── README.md           # 本文件
├── scripts/
│   ├── gen-html.js     # ⭐ HTML邮件生成（核心）
│   ├── send-email.js   # ⭐ SMTP邮件发送（核心）
│   ├── fetch-github.js # GitHub项目抓取
│   └── cron-handler.js # 定时任务处理器（备用）
├── data/
│   ├── test-noon.json  # 测试数据（真实新闻）
│   ├── preview.html    # 预览HTML
│   └── *.json          # 每次运行生成的数据文件
└── logs/               # 运行日志
```

---

## 🛠️ 技术栈

| 类型 | 技术 |
|------|------|
| 运行环境 | Node.js 16+ |
| 邮件发送 | nodemailer (SMTP/SSL) |
| HTTP请求 | axios |
| 天气API | Open-Meteo (免费，无需API Key) |
| 新闻搜索 | WebSearch (AI工具) |
| 自动化 | WorkBuddy Automation / 系统 crontab |

---

## 🔒 安全注意事项

1. **`.env` 文件包含密码，已加入 `.gitignore`，切勿提交到 Git**
2. **SMTP授权码等同于密码，不要分享或明文存储**
3. **定期更换SMTP授权码（QQ邮箱建议每年更换）**
4. **如果使用GitHub Actions或云服务器，用 Secrets 管理敏感信息**

---

## 📄 开源协议

MIT License — 可自由使用、修改和分发。

---

## 🔄 更新日志

### v2.8 (2026-07-01)

#### ✨ 新增
- 🔥 **18 信息源**：新增微博热搜、知乎热榜、抖音热榜、B站热榜、猫目资讯等热榜API接入（uapis.cn 15平台）
- 🌐 **猫目资讯**：新增 HTML 爬虫信息源，覆盖更多中文媒体
- 📊 **10 大版块**：将原 16 版块合并优化为 10 个（AI·硬件·开源·新闻·游戏·财经·汽车·互联网·生活·太空），去重减少冗余
- 💬 **AI 深度解读**：每条新闻新增 `commentary` 字段，由 LLM 生成 100-200 字真实分析（非模板）

#### 🎨 优化
- 🕐 **相对时间**：时间显示改为"刚刚/3分钟前/2小时前/1天前"等直观格式
- 📋 **双列目录**：TOC 改为紧凑双列布局，减少滚动
- 📱 **卡片分隔**：新闻卡片间增加 2px 分隔线，提升边界感
- 📝 **摘要样式**：摘要文字改为灰色背景框，AI 解读更突出
- 🔄 **串行抓取**：热榜抓取改为串行（300ms 间隔），避免 429 限流

#### 🐛 修复
- 修复 UTF-8 中文乱码（用 `Buffer.concat` 替代 `data += chunk`）
- 修复 uapis.cn API 字段映射（`hot_value` → `hot`，`extra.desc` → `raw_desc`）
- 修复 xueqiu API 404（移除雪球源，替换为 B站）
- 修复定时任务名称未随版本更新

---

### v2.0.0 (2026-06-29)

#### ✨ 重构
- 🎨 完全重写 HTML 邮件模板，参考 PDF 样式设计
- 🤖 改用 AI 自动化（WorkBuddy Automation）替代本地 cron
- 📰 新闻来源改为实时 WebSearch，内容更真实有效

#### ✨ 新增
- 🌤️ 邮件头部实时天气显示
- 💬 每日一句（按时段不同类型）
- 🧠 AI 编者按深度解读（TOP3头条 + 重点新闻）
- 💰 理财版块「人话版 + 专业原话」双解读
- 📈 今日趋势深度解读版块

#### 🐛 修复
- 修复 `nodemailer.createTransporter` → `createTransport` API 错误
- 修复命令行参数解析（支持 `--key=value` 和 `--key value`）

---

**🌟 如果这个项目对你有帮助，请给一个 Star！🌟**

[⬆ 回到顶部](#lumapost---光影邮报-)
