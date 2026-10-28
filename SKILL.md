---
name: lumapost
description: AI 驱动的智能新闻邮件系统。抓取 175+ 信息源与 13 个中文热榜，由 AI 主编按阅读版块重组、写摘要与深度解读，渲染成带分区导航的 HTML 邮件并发送。当用户要求「看项目配置」「检查配置」「改配置」「跑一次邮件」「发送早报/晚报」「排查为什么没有 AI 解读」「添加/关闭信息源」时使用本技能。
---

# LumaPost 光影邮报 · AI 技能手册

本文件面向 AI Agent。用户是项目拥有者，你需要通过 CLI 驱动本项目，
并在用户询问配置时**严格使用第 3 节规定的输出格式**。

---

## 1. 项目本质

一个**纯 CLI 的定时新闻邮件系统**，没有任何 Web 界面。
运行链路固定为三段，可单独执行也可串联：

```
fetch（抓取 + AI 编排）→ gen（渲染 HTML）→ send（发送）
```

- 语言/运行时：Node.js ≥ 18（本项目实测 v24）
- 依赖：仅 `dotenv`、`nodemailer`（零 Web 框架、零 ORM、零构建工具）
- 配置：`config/app.json`（单文件，含密钥，已 gitignore）
- 历史：`data/history.json`（运行时数据，与配置分离）
- 产物：`data/<slot>-latest.json`、`data/<slot>-email.html`、`data/<slot>-email.txt`

时段（slot）只有四个：`morning` / `noon` / `afternoon` / `evening`。

---

## 2. 命令速查

读取类命令可以直接跑；**写入类命令（会改配置或发信）必须先向用户确认**。

### 2.1 只读（可直接执行）

| 命令 | 用途 |
|---|---|
| `node scripts/cli.js status` | 总览：AI / 邮件 / 调度 / 预算 / 最近抓发 / 体检 |
| `node scripts/cli.js config` | 全部配置（密钥自动脱敏） |
| `node scripts/cli.js config email` | 单段配置 |
| `node scripts/cli.js sections` | 阅读版块启用状态（10 个逐条列出） |
| `node scripts/cli.js sources` | 信息源状态 + 分类分布；加 `--all` 列全部 |
| `node scripts/cli.js history 20` | 最近 20 条抓取/发送记录 |
| `node scripts/cli.js doctor` | 配置体检；不通过时退出码 1 |

### 2.2 写入 / 执行（先确认）

| 命令 | 用途 | 风险 |
|---|---|---|
| `node scripts/cli.js set <路径> <值>` | 改配置 | 改错会导致抓取/发送失败 |
| `node scripts/cli.js run <slot>` | 抓取→渲染→发送 | **会真的发邮件** |
| `node scripts/cli.js fetch <slot>` | 只抓取 | 消耗 AI 额度（约 3-10 分钟） |
| `node scripts/cli.js gen <slot>` | 只重新渲染 | 覆盖 `data/<slot>-email.html` |
| `node scripts/cli.js send <slot>` | 只发送 | **会真的发邮件** |
| `node scripts/cli.js test-mail` | 发测试邮件 | 会真的发一封 |
| `node scripts/cli.js test-ai` | 测 AI 通道 | 消耗少量额度 |
| `node scripts/cli.js preview <slot>` | 生成浏览器可看预览 | 无 |
| `node scripts/cli.js sections:enable` | 启用全部版块 | 无 |
| `node scripts/cli.js sources:enable` | 启用全部信息源 | 无 |
| `node scripts/cli.js serve` | 常驻调度器 | 长驻进程 |
| `node scripts/cli.js reset --yes` | 清空全部配置 | **密钥会被清掉** |

### 2.3 需要显式放行的场景

降级内容默认拒绝发送。确认要走降级：

```bash
node scripts/cli.js send morning --allow-degraded
```

`fetch` 在 `sections.enabled` 为空时会 **退出码 2 并拒绝执行**（有意的保护）。

---

## 3. 「查看配置」的标准输出格式 ⚠️

**当用户说以下任一表达时，必须按本节格式回答：**

> 看配置 / 查看配置 / 项目配置 / 配置详情 / 现在配置是什么 /
> 配置总览 / 检查配置 / 我的设置 / 配置状态 / settings / config

### 3.1 执行步骤

1. 跑 `node scripts/cli.js config`（若输出过长，用下面第 2 步的分段读取）
2. 对每个配置段单独确认：`config ai` / `config mail` / `config email` /
   `config sections` / `config sources.enhance` / `config schedule` / `config delivery`
3. 跑 `node scripts/cli.js sections` 与 `node scripts/cli.js sources`
4. 按 3.2 的模板输出，**不要直接贴 JSON**

### 3.2 输出模板（必须遵守）

````markdown
# LumaPost 配置总览 · v{version}

> 配置文件：`{CONFIG_FILE}`
> 密钥状态：AI Key {已设置/未设置} · 邮箱授权码 {已设置/未设置}

## 1. AI 模型 `ai`
| 键 | 当前值 | 说明 |
|---|---|---|
| provider | `{provider}` | {中文厂名} |
| model | `{model}` | |
| baseUrl | `{baseUrl}` | |
| maxTokens | `{maxTokens}` | {是否偏低/正常，附判断依据} |
| temperature | `{temperature}` | {是否合适} |
| timeout | `{timeout}` ms | |
| apiKey | `{mask}` | {已设置/未设置} |

## 2. 邮件服务 `mail`
| 键 | 当前值 |
|---|---|
| provider | `{provider}` |
| 发件 | `{user}` |
| 收件 | `{to}`（为空则发给自己） |
| 主题 | `{theme}`（{主题中文名}） |
| 授权码 | `{mask}` {已设置/未设置} |

## 3. 内容预算 `email`
```
itemsTotal       {n}   全局条目上限
itemsPerSection  {n}   单版块上限
headlineCount    {n}   今日头条
trendCount       {n}   趋势条数
summaryChars     {n}   摘要截断
commentaryChars  {n}   解读截断
quicknoteChars   {n}   内容简介截断
maxHtmlKB        {n}   体积上限（Gmail 102KB 截断线）
```
显示开关：头条 {✅/❌} · 解读 {✅/❌} · 行情 {✅/❌} · 趋势 {✅/❌} ·
图表 {✅/❌} · 目录 {✅/❌} · 每日一句 {✅/❌}

## 4. 定时 `schedule` / `delivery`
| 时段 | 时间 | 抓取 | 发送 |
|---|---|---|---|
| morning | {time} | {✅/❌} | {✅/❌} |
| noon | {time} | {✅/❌} | {✅/❌} |
| afternoon | {time} | {✅/❌} | {✅/❌} |
| evening | {time} | {✅/❌} | {✅/❌} |

调度总开关 `app.autoSchedule` = **{true/false}**
> {若全关：说明「当前不会自动发信，需要手动 run 或打开开关」}
> {若部分开：指出具体哪几个时段的组合会导致发信}

## 5. 阅读版块 `sections`（{启用数}/10）
{用 ✅/⬜ 逐条列出 10 个版块，格式：`✅ ai · 🤖 AI·智能体`}

## 6. 信息源 `sources`
| 项 | 状态 |
|---|---|
| RSS 总开关 | {开/关} |
| 已启用源 | {启用数}/{总数} |
| 网页源兜底 | {开/关} |
| 中文热榜 | {开/关} |
| Steam / Epic / 行情 / Trending | {开/关} ×4 |

分类分布：{category: n, ...}

## 7. 其他
```
weather     {city} ({lat}, {lon})
search      engine={engine} · aiSearch={bool} · useForNews={bool}
```

---

## ⚠️ 需要注意的 {N} 项

{按严重度排序，每条给出：现象 → 影响 → 修复命令}

1. **{问题标题}** —— {为什么是问题，会导致什么后果}
   ```bash
   {可直接执行的修复命令}
   ```
````

### 3.3 输出硬规则

| 规则 | 说明 |
|---|---|
| **密钥永不显示** | `apiKey` / `pass` 只显示掩码或「已设置」，绝不显示明文 |
| **必须带判断** | 不能只列数值，要给「这个值合不合适」的结论 |
| **必须带「需要注意」** | 有风险就列，没有就写「无」。不能省略这一节 |
| **修复命令必须可执行** | 给完整 `node scripts/cli.js set ...`，不要写「建议修改」 |
| **不贴原始 JSON** | 用户要的是可读表格，不是 JSON 转储 |
| **数值带单位** | `60000` → `60000 毫秒`；`92` → `92 KB` |
| **时段用中文** | 正文用「早报/午报/午后速递/晚间总结」，配置键保留英文 |

---

## 4. 配置项逐项判定规则

AI 在「需要注意」一节里必须按以下规则判断，不要凭感觉。

### 4.1 `ai` 段

| 条件 | 判定 | 修复建议 |
|---|---|---|
| `maxTokens < 6000` 且模型名含 `reasoning`/`r1`/`闪念`/`flash-lite` | ⚠ 推理模型预算不足，易返回空内容 | `set ai.maxTokens 8000` |
| `maxTokens < 2000` | ⚠ 任何模型都偏小 | `set ai.maxTokens 4096` |
| `temperature > 0.8` | ⚠ 结构化输出易破 JSON | `set ai.temperature 0.6` |
| `temperature < 0.2` | ⚠ 内容过于呆板 | `set ai.temperature 0.6` |
| `provider = custom` 且 `baseUrl` 指向 `127.0.0.1` / `localhost` | ℹ 走本地网关，稳定性取决于网关 | 提示用户网关可能间歇性返回空 |
| `apiKey` 为空 | ❌ 致命，抓取必失败 | 见 `docs/configuration.md` 获取 Key |
| `timeout < 30000` | ⚠ 长文编排易超时 | `set ai.timeout 90000` |

### 4.2 `mail` 段

| 条件 | 判定 | 修复建议 |
|---|---|---|
| `pass` 为空 | ❌ 致命，发送必失败 | 填 SMTP 授权码（注意：不是登录密码） |
| `to` 为空 | ℹ 只会发给自己 | `set mail.to 目标@example.com` |
| `provider = qq/netease` 且 `pass` 长度 < 12 | ⚠ 授权码长度可疑 | 重新生成授权码 |
| `provider = custom-smtp` 且 `smtpHost` 为空 | ❌ 致命 | `set mail.smtpHost smtp.example.com` |

### 4.3 `email` 段

| 条件 | 判定 | 修复建议 |
|---|---|---|
| `maxHtmlKB > 95` | ⚠ 超 Gmail 102KB 截断线的余量不足 | `set email.maxHtmlKB 92` |
| `itemsPerSection > 8` | ⚠ 单版块过长，易触体积上限 | `set email.itemsPerSection 5` |
| `quicknoteChars < 60` | ⚠ 内容简介是 50-80 字，会被截断 | `set email.quicknoteChars 120` |
| `commentaryChars < 200` | ⚠ 解读会被切碎 | `set email.commentaryChars 640` |
| `summaryChars < 80` | ⚠ 摘要过短，信息量不足 | `set email.summaryChars 150` |
| `showCharts = true` | ℹ Outlook 不支持内联 SVG，图表会空白 | 可保留，提示用户 |

### 4.4 `sections` / `sources` / `delivery`

| 条件 | 判定 | 修复建议 |
|---|---|---|
| `sections.enabled` 为空 | ⚠ **抓取会直接中止（退出码 2）** | `sections:enable` 或 `set sections.enabled ai,hardware,...` |
| `sources.enableRss = false` 且 `enhance.enableHotboard = false` 且 `useWebFallback = false` | ⚠ 一个源都没有，抓不到内容 | `sources:enable` |
| `sources.rss` 全部 `enabled:false` | ⚠ 等于没配源 | `sources:enable` 或逐个开 |
| `delivery.*` 全为 `{fetch:false,send:false}` | ℹ 定时永不发信 | 手动 `run` 或按需打开 |
| `delivery.<slot>.send = true` 但 `fetch = false` | ⚠ 会发送**上一次**的旧数据 | 把 fetch 也设为 true |
| `app.autoSchedule = false` | ℹ 调度器不会自动触发 | `set app.autoSchedule true` |
| `schedule` 时间格式非 `HH:MM` | ❌ 该校验不通过 | `set schedule.morning 09:00` |

### 4.5 版本一致性

跑 `node scripts/cli.js status` 看 `version`，应与 `package.json` 一致。
不一致说明 `config/app.json` 残留旧版本号（代码会自动收敛，属正常）。

---

## 5. 处理用户请求的决策树

### 5.1 「看配置」类

→ 按第 3 节格式输出，**必须包含「需要注意」节**。见 3.1 步骤。

### 5.2 「跑一次 / 发我一封」

```bash
# 1. 先确认能发（不消耗额度）
node scripts/cli.js doctor
node scripts/cli.js status

# 2. 若 sections.enabled 为空，必须先问用户是否启用
node scripts/cli.js sections            # 检查
# 用户同意后：node scripts/cli.js sections:enable

# 3. 检查数据是否新鲜
#    data/<slot>-latest.json 存在且 meta.generatedAt 在 4 小时内 → 可直接 gen+send
#    否则必须先 fetch

# 4. 执行
node scripts/cli.js run morning         # 或分步 fetch / gen / send
```

发送前必须报告：收件人、主题、体积 KB、解读条数。

### 5.3 「为什么邮件没有 AI 解读 / 内容像热榜」

按顺序排查（这是最高频问题）：

```bash
# ① 看最近一次抓取的 meta
node scripts/cli.js history 3
#   quality=DEGRADED 或 aiMode=false → 确认是降级

# ② 看降级原因（写入在 data/<slot>-latest.json 的 meta.degradeReason）
node -e "const m=require('./data/morning-latest.json').meta;console.log(m.degradeReason||'(无)')"

# ③ 测 AI 通道
node scripts/cli.js test-ai
```

对应处置：

| degradeReason 关键词 | 含义 | 处置 |
|---|---|---|
| `连续 N 次返回空内容` + `reasoning_tokens` | 推理模型烧光预算 | `set ai.maxTokens 8000`，或换非推理模型 |
| `JSON 解析失败` | 模型写了非法 JSON | 已由 `json-repair.js` 兜住；若仍失败，降低 `temperature` |
| `401` / `invalid.*key` | Key 失效 | 换 Key |
| `402` / `insufficient` | 额度不足 | 充值或换模型 |
| `429` | 限流 | 调低 `ai.concurrency` 到 1 |
| `超时` / `ETIMEDOUT` | 网关不可达 | 检查 `ai.baseUrl` |

### 5.4 「加一个信息源」

```bash
# ① 先看内置目录里有没有
node scripts/cli.js sources --all | grep -i <关键词>

# ② 要加自定义源，改 sources.rss 数组（用 Node 脚本，不要手改 JSON）
node -e "
const c=require('./scripts/config-store');
const rss=c.get('sources.rss')||[];
rss.push({name:'源名称',url:'https://example.com/feed.xml',category:'news',enabled:true});
c.update({sources:{enableRss:true,rss}});
console.log('已添加，共',rss.length,'个源');
"

# ③ 验证连通性
node -e "
require('./scripts/rss-fetcher')
  .fetchFeed({name:'源名称',url:'https://example.com/feed.xml'},{limit:3,timeout:15000})
  .then(r=>console.log(r.error?'失败: '+r.error:'成功: '+r.items.length+' 条'));
"
```

### 5.5 「改主题 / 改预算」

```bash
# 主题只剩一套（sunset 暖阳）+ custom
node scripts/cli.js set mail.theme sunset

# 想让邮件更短
node scripts/cli.js set email.itemsTotal 24
node scripts/cli.js set email.commentaryChars 420
```

---

## 6. 数据契约

### 6.1 `data/<slot>-latest.json`

```jsonc
{
  "date": "2026年10月28日",
  "tldr": "一句话摘要",
  "headline": [ {title, summary, commentary, source, url} ],   // 头条，默认 3 条
  "stocks":   [ {name, price, pct} ],                          // 行情
  "weather":  {location, text, temp},
  "sections": [
    {
      "key": "ai",                    // 版块标识，决定配色与目录锚点
      "name": "🤖 AI · 智能体",
      "items": [{
        "title": "...",
        "summary": "60-150 字",
        "quicknote": "50-80 字 · 读完后的简要概括",   // 渲染为「内容简介」
        "commentary": "100-200 字 · AI 深度解读",     // 渲染为「AI 深度解读」
        "source": "知乎",
        "url": "https://...",
        "stars": 4,
        "time": "ISO8601"
      }]
    }
  ],
  "summary": [ {category, trend, detail} ],        // 趋势观察
  "meta": {
    "version": "10.7.0",
    "aiMode": true,                 // false = 降级
    "degradeReason": "…",           // 降级原因（aiMode=false 时）
    "quality": "GOOD|FAIR|LOW|DEGRADED",
    "itemCount": 40,
    "commentaryCount": 30,
    "commentaryCoverage": 0.75,
    "generatedAt": "ISO8601"
  }
}
```

### 6.2 质量判定

```js
if (!aiMode)                              quality = 'DEGRADED'
else if (itemCount >= 12 && coverage >= 0.6) quality = 'GOOD'
else if (itemCount >= 6)                  quality = 'FAIR'
else                                      quality = 'LOW'
```

`coverage = commentaryCount / itemCount`。**不看条数总量，只看解读覆盖率**，
避免「40 条热榜标题」被误判为高质量。

---

## 7. 已知限制（不要向用户承诺这些）

| 限制 | 事实 |
|---|---|
| 推理模型 | 长 prompt 下 `reasoning_tokens` 可飙到 12800+，把 `max_tokens` 吃光后正文返回空串。代码会自动翻倍重试，但不能保证 100% 成功 |
| 邮件体积 | Gmail 在 **102 KB** 处硬截断。已实现 13 级自动瘦身，但极长内容仍可能被截断 |
| Outlook | 不支持内联 SVG，`showCharts=true` 时图表区空白 |
| 邮件内锚点 | 目录跳转（`#sec-ai`）在 Gmail/Outlook 多数被吞，仅在部分客户端生效 |
| 无 Web UI | v10.6.0 起已删除，不要再指导用户在浏览器里打开 `:3000` |
| 调度精度 | 30 秒轮询 + 1 分钟容差。服务在触发分钟之外启动则不发（不补发） |

---

## 8. 绝对禁止

1. ❌ 显示 `ai.apiKey` / `mail.pass` 的明文
2. ❌ 未经确认就执行 `run` / `send` / `test-mail` / `reset`
3. ❌ 手改 `config/app.json`（会绕过脱敏与校验，用 `cli.js set`）
4. ❌ 在用户没要求时清空 `data/`（里面是历史与已生成邮件）
5. ❌ 把 `sections.enabled` 为空说成「默认全部启用」
6. ❌ 说「打开 Web UI」—— 它已经不存在了
7. ❌ 承诺「保证不会降级」—— 只能降低概率

---

## 9. 相关文档

| 文档 | 读者 | 内容 |
|---|---|---|
| `README.md` | 用户 | 快速开始、命令手册、邮件结构图 |
| `docs/configuration.md` | **用户** | 每个配置项的含义、默认值、取值范围、改动影响 |
| `docs/secrets.md` | 用户 | GitHub Secrets / 各邮箱与 AI 厂商的密钥获取 |
| `docs/faq.md` | 用户 | 常见故障排查 |
| `SKILL.md` | **AI** | 本文件 |