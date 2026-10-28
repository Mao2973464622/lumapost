<div align="center">

# LumaPost · 光影邮报

**AI 驱动的智能新闻邮件系统**

175 个信息源 · 13 个中文热榜 · 10 个阅读分区 · 纯 CLI 驱动

[![Node](https://img.shields.io/badge/node-%E2%89%A518-brightgreen?style=flat-square)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Version](https://img.shields.io/badge/version-10.7.0-orange?style=flat-square)](#版本历史)
[![Tests](https://img.shields.io/badge/tests-26%20passed-brightgreen?style=flat-square)](#测试)
[![No Web UI](https://img.shields.io/badge/Web%20UI-removed-lightgrey?style=flat-square)](#设计取舍)

[快速开始](#快速开始) · [命令手册](#命令手册) · [配置](#配置) · [邮件长什么样](#邮件长什么样) · [工作原理](#工作原理) · [文档](#文档)

</div>

---

## 这是什么

每天（或你指定的时段）自动做四件事：

| 步骤 | 动作 | 产出 |
|---|---|---|
| ① **抓** | 175 个 RSS/Atom 源 + 13 个中文热榜 + Steam/Epic/行情/GitHub Trending | 原始素材 |
| ② **编** | AI 主编按 10 个阅读版块重组，写摘要、写 100–200 字深度解读 | 结构化 JSON |
| ③ **排** | 渲染成带分区导航的 HTML 邮件 + 纯文本备选体 | HTML / TXT |
| ④ **发** | 通过 SMTP 或 HTTP API 投递 | 你的邮箱 |

全程**没有网页界面**，所有操作都是命令行，方便你自己或 AI Agent 直接驱动。

### 它解决的问题

普通新闻聚合器只给你一堆标题。LumaPost 多做三件事：

- **AI 主编**：不是罗列，而是重写标题、写摘要、写有观点的解读
- **分区导航**：10 个版块，每个都有序号徽章、进度计数、下一站预告，读到哪都知道
- **投递守门**：体积超 92KB 自动瘦身、降级内容默认拒发、数据过期拒发

---

## 快速开始

### 环境要求

| 项 | 要求 |
|---|---|
| Node.js | ≥ 18（推荐 20 / 22） |
| 操作系统 | Linux / macOS / Windows / Android(proot) / Docker |
| 网络 | 能访问 AI 服务商与邮件服务商 |
| 磁盘 | 约 50 MB（含 node_modules） |

### 三步跑通

```bash
# 1. 安装
git clone https://github.com/<你的账号>/lumapost.git
cd lumapost
npm install

# 2. 填配置（最少 4 项）
node scripts/cli.js set ai.provider   deepseek
node scripts/cli.js set ai.apiKey     sk-你的密钥
node scripts/cli.js set mail.provider qq
node scripts/cli.js set mail.user     你的邮箱@qq.com
node scripts/cli.js set mail.pass     你的SMTP授权码

# 3. 先小范围试：只开 2 个版块 + 1 个热榜
node scripts/cli.js set sections.enabled ai,hardware
node scripts/cli.js set sources.enhance.enableHotboard true
node scripts/cli.js doctor          # 体检
node scripts/cli.js run morning     # 抓取→渲染→发送
```

收到邮件即成。之后想全量开启：

```bash
node scripts/cli.js sections:enable   # 10 个版块全开
node scripts/cli.js sources:enable    # 175 个源全开
```

> ⚠️ **默认状态是「全部关闭」**：版块、信息源、定时任务都关着。
> 这是有意的——先让你用最小配置确认链路通，再逐项打开，避免一上来就烧 AI 额度。

### 只想先看效果不花钱

```bash
# 用已有数据生成预览，浏览器打开 data/preview-morning.html
node scripts/cli.js preview morning
```

---

## 命令手册

所有命令统一入口是 `scripts/cli.js`。

```bash
node scripts/cli.js <命令> [参数]
```

### 查看类

| 命令 | 作用 |
|---|---|
| `status` | 总览面板：AI / 邮件 / 调度 / 预算 / 最近抓发 / 体检结果 |
| `config` | 全部配置（密钥自动打码） |
| `config ai` | 只看某一段 |
| `sections` | 10 个阅读版块的启用状态 |
| `sources` | 信息源状态 + 分类分布；`sources --all` 列全部 175 条 |
| `history 20` | 最近 20 条抓取/发送记录 |
| `doctor` | 配置体检（退出码 0 通过 / 1 有错） |
| `help` | 打印内置说明 |

### 运行类

| 命令 | 作用 | 说明 |
|---|---|---|
| `run <slot>` | 抓取 → 渲染 → 发送 | 完整流程 |
| `fetch <slot>` | 只抓取 + AI 编排 | 约 3–20 分钟 |
| `gen <slot>` | 只重新渲染 HTML | 秒级 |
| `send <slot>` | 只发送 | 需已有数据 |
| `serve` | 常驻调度器 | 按配置时间自动跑 |
| `preview <slot>` | 生成浏览器可看预览 | 不发信 |

`<slot>` 取值：`morning` / `noon` / `afternoon` / `evening`

### 配置类

| 命令 | 作用 |
|---|---|
| `set <路径> <值>` | 改单项配置，如 `set email.itemsTotal 24` |
| `set sections.enabled ai,hardware` | 数组项用逗号分隔 |
| `sections:enable` | 启用全部 10 个版块 |
| `sources:enable` | 启用全部信息源 |
| `reset --yes` | 恢复默认配置（**密钥会被清空**） |

### 调试类

| 命令 | 作用 |
|---|---|
| `test-ai` | 测 AI 通道能否正常返回 |
| `test-mail` | 发一封测试邮件 |

### 常用示例

```bash
# 只发早报，每天 08:30
node scripts/cli.js set delivery.morning.fetch true
node scripts/cli.js set delivery.morning.send true
node scripts/cli.js set schedule.morning 08:30
node scripts/cli.js set app.autoSchedule true
node scripts/cli.js serve

# 邮件太长，压缩到 24 条
node scripts/cli.js set email.itemsTotal 24
node scripts/cli.js set email.itemsPerSection 3

# AI 没产出解读 → 提高预算
node scripts/cli.js set ai.maxTokens 8000

# 允许发送降级内容（无 AI 解读的纯热榜）
node scripts/cli.js send morning --allow-degraded
```

---

## 配置

配置文件：`config/app.json`（含密钥，**已在 .gitignore**）
完整逐项说明见 **[docs/configuration.md](docs/configuration.md)**

### 六个配置段

| 段 | 管什么 | 关键项 |
|---|---|---|
| `ai` | AI 模型 | `provider` `apiKey` `model` `maxTokens` `temperature` |
| `mail` | 邮件服务 | `provider` `user` `pass` `to` `theme` |
| `email` | 内容预算 ⭐ | `itemsTotal` `itemsPerSection` `commentaryChars` `maxHtmlKB` |
| `sections` | 阅读版块 | `enabled[]` |
| `sources` | 信息源 | `enableRss` `rss[]` `enhance{}` |
| `schedule` / `delivery` | 定时 | `autoSchedule` `schedule{}` `delivery{}` |

### 默认值一览（全部关闭）

```jsonc
{
  "app":      { "autoSchedule": false },
  "sections": { "enabled": [] },                                    // 版块全关
  "sources":  { "enableRss": false, "useWebFallback": false,        // 源全关
                "enhance": { "enableHotboard": false, "steam": false,
                             "epic": false, "stocks": false, "trending": false } },
  "delivery": { "morning":   { "fetch": false, "send": false },     // 定时全关
                "noon":      { "fetch": false, "send": false },
                "afternoon": { "fetch": false, "send": false },
                "evening":   { "fetch": false, "send": false } }
}
```

### 三个必须理解的数字

| 数字 | 为什么重要 |
|---|---|
| `email.maxHtmlKB = 92` | Gmail 在 **102 KB** 硬截断。留 10 KB 余量 |
| `email.itemsTotal = 40` | 40 条 × 约 2.3 KB ≈ 92 KB，正好卡在上限内 |
| `ai.maxTokens = 4096` | **推理模型建议改 8000**，否则思考会吃光预算导致正文为空 |

---

## 邮件长什么样

```
┌────────────────────────────────────────┐
│  LumaPost  光影邮报          2026/10/28 │  ← 品牌栏
├────────────────────────────────────────┤
│  ╭──────────────────────────────────╮  │
│  │  DAILY DIGEST                    │  │
│  │  清晨好！新的一天…                │  │  ← Hero
│  │  湖南长沙 · 多云 21°C             │  │
│  │  ─────────────────────────────   │  │
│  │  40 条精选 │ 10 个版块 │ 1 条摘要  │  │
│  ╰──────────────────────────────────╯  │
├────────────────────────────────────────┤
│  TL;DR  一句话说清今天最值得关注的      │
├────────────────────────────────────────┤
│  上证 3677.99   深证 11473.52  …        │  ← 行情条
│   +0.76%          +1.71%               │
├────────────────────────────────────────┤
│  ★ TODAY'S HEADLINES                   │
│  01  今日头条 · TOP 1                   │
│      标题 / 摘要 / 深度解读             │
│  02  …            03  …                │
├────────────────────────────────────────┤
│  CONTENTS               共 10 个版块     │
│  01 ▌🤖 AI·智能体        4条  3解读     │  ← 目录
│  02 ▌💻 硬件·数码        4条  2解读     │    可点击跳转
│  …                                     │
├────────────────────────────────────────┤
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│  ┃ [SEC]  🤖 AI · 智能体        01   ┃  │  ← 分区色带
│  ┃  01     4条资讯 · 3条深度解读  OF 10┃ │    ① 序号徽章
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │    ② 计数 + ③ 总进度
│    ╭──────────────────────────────╮    │
│    │ 新闻标题                      │    │
│    │ 摘要 60–150 字                │    │
│    │ ┌ 内容简介 ─────────────────┐ │    │
│    │ │ AI 读完后的一句话概括       │ │    │
│    │ └──────────────────────────┘ │    │
│    │ ▎AI 深度解读                  │    │
│    │ ▎100–200 字有观点的分析       │    │
│    │ 知乎 · ★★★★   阅读原文 →      │    │
│    ╰──────────────────────────────╯    │
│  ─ AI·智能体 · 完 · 下一版块：硬件 ─    │  ← ④ 出口指示
│                             ↑ 目录     │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│  ┃ [SEC]  💻 硬件 · 数码        02   ┃  │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
│    …                                   │
├────────────────────────────────────────┤
│  今日趋势观察（5 条）                    │
├────────────────────────────────────────┤
│  “ 每日一句 ”                           │
├────────────────────────────────────────┤
│  LumaPost 光影邮报                       │
│  由 AI 自动编排 · 2026/10/28 · 主题：暖阳 │
└────────────────────────────────────────┘
```

### 每个分区有 4 处定位信息

滚到任何位置都知道「我在哪、还剩多少、下一个是什么」：

1. 色带左侧 `SEC 01` 序号徽章
2. 色带内 `4条资讯 · 3条深度解读`
3. 色带右上 `01 / OF 10` 总进度
4. 版块尾部 `下一版块：硬件 · 数码` + `↑ 目录`

### 关于「内容简介」与「AI 深度解读」

| 字段 | 字数 | 定位 |
|---|---|---|
| `summary`（普通摘要） | 60–150 字 | 交代背景 + 核心事实 + 影响 |
| `quicknote`（**内容简介**） | 50–80 字 | **AI 读完后的信息浓缩**，只讲事实不讲态度 |
| `commentary`（**AI 深度解读**） | 100–200 字 | 有观点的分析，回答「这意味着什么」 |

---

## 工作原理

```
                  ┌──────────────┐
                  │  信息源（三层）│
                  ├──────────────┤
                  │ RSS 175 个   │
                  │ 中文热榜 13 个│
                  │ 网页/API 源   │
                  └──────┬───────┘
                         │ 并发抓取 + 去重
                         ▼
              ┌─────────────────────┐
              │  素材池（按版块过滤） │
              │  每版块保留 6 条     │
              └──────────┬──────────┘
                         │ 每 2 个版块一组
                         ▼
              ┌─────────────────────┐
              │  AI 主编（容错链）   │
              ├─────────────────────┤
              │ 空响应 → 翻倍重试    │
              │ 非法 JSON → 修复     │
              │ 被截断 → 抢救部分    │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  data/<slot>-latest.json │
              │  meta: aiMode/quality/    │
              │        commentaryCoverage │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  渲染（体积预算）    │
              ├─────────────────────┤
              │ 超 92KB → 13 级瘦身  │
              │ 目录/解读最后牺牲     │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  发送（四道闸门）    │
              ├─────────────────────┤
              │ 数据 >240min → 拒    │
              │ 降级内容 → 拒        │
              │ HTML >95KB → 拒      │
              │ 0 条内容 → 拒        │
              └─────────────────────┘
```

### AI 调用的三层容错

这是项目最核心的健壮性设计，因为大模型输出天然不可靠。

| 故障 | 现象 | 处理 |
|---|---|---|
| **推理吃光预算** | `reasoning_tokens` 占满 `max_tokens`，`content` 返回空串 | 检测到后**自动翻倍 maxTokens** 重试（最高 32000） |
| **非法 JSON** | 模型在字符串里写未转义英文引号，如 `冲刺"第一股"` | `json-repair.js` 逐字符修复，内容零丢失 |
| **输出被截断** | JSON 括号不闭合 | `salvage()` 从后往前找完整对象，补齐括号，抢救已生成部分 |

### 降级模式

**降级 = 拿到新闻但没有 AI 加工**：无深度解读、无头条分析、无趋势观察，邮件顶部有黄色提示条。

**默认拒绝发送降级内容**：

```bash
node scripts/cli.js send morning
# ❌ 本期为降级内容（无 AI 深度解读）。若确实要发送，加 --allow-degraded
```

想排查为什么降级：

```bash
node scripts/cli.js history 3
node -e "console.log(require('./data/morning-latest.json').meta.degradeReason)"
```

---

## 设计取舍

### 为什么删掉 Web UI

v10.6.0 之前有一套 126 KB 的单页管理后台。删掉的理由：

| 删掉后 | 收益 |
|---|---|
| 无 HTTP 端口 | 无攻击面，无鉴权/CSRF/XSS 隐患 |
| 无前端代码 | 少 1000+ 行维护成本 |
| 纯 CLI | AI Agent 可直接驱动，比点网页更可靠 |
| 配置即文件 | 用户能用 Git 管理自己的配置差异 |

代价是「改配置要看文档」。所以配了 `docs/configuration.md`（620 行逐项说明）
和 `SKILL.md`（让 AI 替你改）。

### 为什么只留一套主题

原本有 10 套配色。实际使用中：

- 用户只用 1 套
- 每套主题的测试/维护成本 × 10
- 换主题不如改 `customTheme` 的 17 个颜色精确

现在保留 `sunset（暖阳）` 作为内置主题，另有 `custom` 可完全自定义配色。

### 为什么默认全部关闭

新手第一次跑，如果 175 个源 + 13 个热榜 + 10 个版块同时开：

- 抓取要 10–20 分钟
- AI 消耗几百次调用
- 一旦某个环节配错，很难定位

所以默认全关，让用户从小配置开始，逐项打开。`doctor` 会提示「都关着抓不到内容」。

---

## 部署

### 本机常驻（pm2）

```bash
pm2 start scripts/cli.js --name lumapost -- serve
pm2 save
pm2 startup    # 开机自启
```

### systemd

```bash
sudo cp lumapost.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now lumapost
journalctl -u lumapost -f
```

### Docker

```bash
# 常驻调度器（无常驻端口）
docker compose up -d
docker compose exec lumapost node scripts/cli.js status

# 只跑一次
docker compose run --rm lumapost run morning
```

### GitHub Actions

见 `.github/workflows/email.yml`。需要配置 3 个 Secret：

| Secret | 值 |
|---|---|
| `AI_API_KEY` | AI 服务商密钥 |
| `MAIL_USER` | 发件邮箱 |
| `MAIL_PASS` | SMTP 授权码 |

可选 Variables：`AI_PROVIDER` `AI_MODEL` `MAIL_PROVIDER` `MAIL_TO` 等。

> ⚠️ **Actions 场景下定时默认关闭**。若想让 GitHub 定时发信，
> 请在仓库 Variables 里设置 `ENABLE_SCHEDULE=true`（模板已处理），
> 或直接用 Actions 的 `workflow_dispatch` 手动触发。

### 环境变量覆盖

配置文件的值等于默认值时，环境变量优先（方便 CI）：

```bash
AI_PROVIDER=deepseek AI_API_KEY=sk-xxx MAIL_USER=a@qq.com MAIL_PASS=xxx \
  node scripts/cli.js run morning
```

完整清单见 [docs/configuration.md#8-环境变量覆盖](docs/configuration.md#8-环境变量覆盖)。

---

## 测试

```bash
npm test
```

26 项回归测试，覆盖：

| 分组 | 项数 | 覆盖内容 |
|---|---|---|
| `json-repair` | 5 | 裸引号修复、合法 JSON 不破坏、markdown 围栏、非法转义、空输入 |
| `config-pref` | 4 | env/文件优先级、默认值回落、类型转换 |
| `scheduler` | 2 | 日期键补零、同日同时段键一致性 |
| `config-store` | 2 | 密钥脱敏、空密钥不误报 |
| `gen-html` | 13 | 预算裁剪、URL 白名单、体积瘦身、分区标记、公平分配、内容保真、简介清洗 |

测试全部是纯函数/可注入，**不依赖网络与 AI**，可在 CI 里跑。

---

## 项目结构

```
lumapost/
├── scripts/
│   ├── cli.js              ← 所有操作的统一入口
│   ├── config-store.js       配置读写 + 脱敏 + 历史 + 校验
│   ├── config-pref.js        env/文件优先级统一规则
│   ├── fetch-news-ai.js      抓取 + AI 编排（核心，1300 行）
│   ├── fetch-cn-news.js      纯热榜降级抓取
│   ├── rss-fetcher.js        RSS/Atom/JSON Feed 引擎（零依赖）
│   ├── hotboard.js           中文热榜 + Steam/Epic/行情/Trending
│   ├── sources-catalog.js    175 个内置源目录
│   ├── ai-provider.js        20 家 AI 提供商 + 空响应重试
│   ├── mail-provider.js      16 家邮件服务适配
│   ├── gen-html.js           邮件渲染 + 分区导航 + 体积预算
│   ├── mail-themes.js        主题（sunset + custom）
│   ├── mail-charts.js        SVG 图表
│   ├── send-mail.js          发送 + 四道闸门
│   ├── scheduler.js          内置调度器
│   ├── json-repair.js        容错 JSON 解析
│   ├── migrate.js            目录迁移
│   └── web-search.js         搜索工具（独立）
├── tests/run.js            26 项回归测试
├── docs/
│   ├── configuration.md     ← 配置逐项详解（给用户）
│   ├── secrets.md             密钥获取指南
│   └── faq.md                 常见问题
├── config/app.json         配置（含密钥，gitignore）
├── data/                   运行时数据（gitignore）
├── SKILL.md                ← 给 AI 看的操作规范
├── README.md               本文件
├── Dockerfile
├── docker-compose.yml
└── lumapost.service
```

---

## 文档

| 文档 | 读者 | 内容 |
|---|---|---|
| **README.md** | 用户 | 本文件 · 快速开始 + 命令手册 |
| **[docs/configuration.md](docs/configuration.md)** | 用户 | 620 行 · 每个配置项的含义/默认值/取值范围/改动影响 |
| **[docs/secrets.md](docs/secrets.md)** | 用户 | 各邮箱与 AI 厂商的密钥获取步骤 |
| **[docs/faq.md](docs/faq.md)** | 用户 | 常见故障排查 |
| **[SKILL.md](SKILL.md)** | **AI** | 操作规范 + 「查看配置」的标准输出格式 |

---

## 安全

- `config/` 与 `data/` 已 gitignore，密钥不入库
- `cli.js config` 输出时 `ai.apiKey` / `mail.pass` 自动替换为掩码
- 渲染层对所有 URL 做协议白名单（拒 `javascript:` / `data:`）
- 邮件内容全部 HTML 转义
- **历史提交里曾有真实 SMTP 授权码**（`nm_*.js`，提交 `2979c08`）。
  若你 Fork 自该历史，请重置邮箱授权码。

---

## 已知限制

| 限制 | 说明 |
|---|---|
| Gmail 102 KB 截断 | 邮件超长会被截断。已实现 13 级自动瘦身 |
| Outlook 不支持内联 SVG | `showCharts=true` 时图表区空白，建议关闭 |
| 邮件内锚点 | 目录跳转 `#sec-ai` 在 Gmail/Outlook 多数被吞，仅部分客户端生效 |
| 推理模型不稳定 | `reasoning_tokens` 波动大，可能返回空串。代码自动重试但不保证 100% |
| 调度不补发 | 30 秒轮询 + 1 分钟容差。晚于触发分钟启动则不执行 |
| 阿里云/腾讯云直连 | 其 HTTP API 需请求签名，本项目未实现。请改用 SMTP |

---

## 版本历史

| 版本 | 主要变更 |
|---|---|
| **10.7.0** | 主题精简为 1 套 · 版块/源/定时默认全关 · `enhance` 并入 `sources` · 移除补跑窗口 · 新增 `sections` 命令 · 文档四件套 |
| 10.6.0 | 移除 Web UI 改纯 CLI · 分区导航重做 · 预算公平分配 · 卡片体积优化 4.5 倍 · `json-repair.js` |
| 10.5.x | 修复 AI 解读从未渲染 · 配置脱敏 · 发送四道闸门 · 内容简介替换元数据噪声 |
| 10.4.x | 补齐 `send-mail.js` · 修复定时发送从未成功 |
| 10.0.0 | 10 套浅色主题 · 自定义配色系统 |
| 9.0.0 | 主题系统 |
| 8.0.0 | 移动端适配 · 图表静态兜底 |

---

## 贡献

```bash
npm test                      # 提 PR 前必须通过
node scripts/cli.js doctor    # 确认配置未破坏
```

代码风格：CommonJS、零第三方依赖（除 `dotenv`/`nodemailer`）、
纯函数优先、中文注释说明「为什么」而不是「做什么」。

---

## 许可证

[MIT](LICENSE) © QiXua

<div align="center">

**如果这个项目帮你省下了每天读新闻的时间，给个 ⭐ 吧**

</div>