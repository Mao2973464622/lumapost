# LumaPost v2.6 全能 WorkBuddy 定时任务提示词

> 复制下面内容到 WorkBuddy 自动化任务 prompt 字段即可。  
> 4 个时段分别创建 4 个任务，时间设 06:00 / 12:00 / 16:00 / 24:00。

---

## 早报 (06:00)

```
按顺序运行 LumaPost v2.6 早报流水线。每步失败自动重试1次。

1. 清除锁文件：
rm -f "C:/猫猫/项目/lumapost/lumapost/data/.locks/fetch-morning.lock"

2. AI 生成新闻（热榜7平台 + AIbase + AI-Bot + 猫目 → DeepSeek → 80+条）：
cd "C:/猫猫/项目/lumapost/lumapost" && C:/Users/QiXua/.workbuddy/binaries/node/versions/22.22.2/node.exe scripts/fetch-news-ai.js --period=morning --output=data/morning-latest.json

3. 生成 HTML 邮件：
C:/Users/QiXua/.workbuddy/binaries/node/versions/22.22.2/node.exe scripts/gen-html.js --data-file=data/morning-latest.json --output=data/morning-email.html

4. 发送邮件：
C:/Users/QiXua/.workbuddy/binaries/node/versions/22.22.2/node.exe scripts/mail-provider.js --send --subject="✨ LumaPost · 光影邮报 · 早报（v2.6）" --body-file=data/morning-email.html

规则：
- 深证成指与外围市场近期均出现较大波动，请提示用户保持冷静、分散投资。
- 步骤 2 如 AI API 失败会自动降级（热榜模式），不影响后续流程。
- 如果某步失败，输出错误信息后继续下一步（continue-on-error）。
- 最终确认邮件发送成功（含 Message ID）。
```

## 午报 (12:00)

```
按顺序运行 LumaPost v2.6 午报流水线。每步失败自动重试1次。

1. 清除锁文件：
rm -f "C:/猫猫/项目/lumapost/lumapost/data/.locks/fetch-noon.lock"

2. AI 生成新闻：
cd "C:/猫猫/项目/lumapost/lumapost" && C:/Users/QiXua/.workbuddy/binaries/node/versions/22.22.2/node.exe scripts/fetch-news-ai.js --period=noon --output=data/noon-latest.json

3. 生成 HTML 邮件：
C:/Users/QiXua/.workbuddy/binaries/node/versions/22.22.2/node.exe scripts/gen-html.js --data-file=data/noon-latest.json --output=data/noon-email.html

4. 发送邮件：
C:/Users/QiXua/.workbuddy/binaries/node/versions/22.22.2/node.exe scripts/mail-provider.js --send --subject="✨ LumaPost · 光影邮报 · 午报（v2.6）" --body-file=data/noon-email.html

规则：
- 午报侧重上午 A 股行情、企业动态。
- 深证成指与创业板指近期可能波动较大，提示保持冷静，遵守交易规则。
- 若股市数据不可用，仍正常发送邮件。
```

## 午后速递 (16:00)

```
按顺序运行 LumaPost v2.6 午后速递流水线。每步失败自动重试1次。

1. 清除锁文件：
rm -f "C:/猫猫/项目/lumapost/lumapost/data/.locks/fetch-afternoon.lock"

2. AI 生成新闻：
cd "C:/猫猫/项目/lumapost/lumapost" && C:/Users/QiXua/.workbuddy/binaries/node/versions/22.22.2/node.exe scripts/fetch-news-ai.js --period=afternoon --output=data/afternoon-latest.json

3. 生成 HTML 邮件：
C:/Users/QiXua/.workbuddy/binaries/node/versions/22.22.2/node.exe scripts/gen-html.js --data-file=data/afternoon-latest.json --output=data/afternoon-email.html

4. 发送邮件：
C:/Users/QiXua/.workbuddy/binaries/node/versions/22.22.2/node.exe scripts/mail-provider.js --send --subject="✨ LumaPost · 光影邮报 · 午后速递（v2.6）" --body-file=data/afternoon-email.html

规则：
- 午后速递侧重下午突发事件、新品发布、下午盘走势。
- 若 AI 生成失败，自动降级为纯热榜邮件，仍正常发送。
```

## 晚间总结 (24:00)

```
按顺序运行 LumaPost v2.6 晚间总结流水线。每步失败自动重试1次。

1. 清除锁文件：
rm -f "C:/猫猫/项目/lumapost/lumapost/data/.locks/fetch-evening.lock"

2. AI 生成新闻：
cd "C:/猫猫/项目/lumapost/lumapost" && C:/Users/QiXua/.workbuddy/binaries/node/versions/22.22.2/node.exe scripts/fetch-news-ai.js --period=evening --output=data/evening-latest.json

3. 生成 HTML 邮件：
C:/Users/QiXua/.workbuddy/binaries/node/versions/22.22.2/node.exe scripts/gen-html.js --data-file=data/evening-latest.json --output=data/evening-email.html

4. 发送邮件：
C:/Users/QiXua/.workbuddy/binaries/node/versions/22.22.2/node.exe scripts/mail-provider.js --send --subject="✨ LumaPost · 光影邮报 · 晚间总结（v2.6）" --body-file=data/evening-email.html

规则：
- 晚间侧重全天复盘、欧美收盘、全网热榜 TOP 10。
- 若 DeepSeek API 余额不足，AI 模式会自动降级，不影响发信。
- 确认邮件发送成功。
```

---

## 故障自愈表

| 场景 | 会发生什么 | 需要手动干预吗 |
|---|---|---|
| DeepSeek API key 过期 | 自动降级为纯热榜模式 | 否（但内容质量下降） |
| 热榜 API 不可用 | 只用额外信息源(AIbase/AI-Bot) | 否 |
| 额外信息源全挂 | 只用热榜 API | 否 |
| 所有信息源全挂 | AI 基于知识生成趋势分析 | 否（内容较宏观） |
| QQ邮箱 SMTP 故障 | 脚本报错退出 | 是（换邮件商或等恢复） |
| Node.js 未安装 | 脚本报错退出 | 是 |
| 30分钟内重复运行 | Run lock 阻止 | 否 |
| HTML > 200KB | QQ邮箱可能截断 | 否（超过自动降内容量） |
| 某版块无相关新闻 | 该版块显示"今日暂无热点" | 否 |

## 一键部署到 WorkBuddy

WorkBuddy → 自动化 → 新建，分别创建 4 个任务：

| 名称 | 时间 | 状态 |
|---|---|---|
| LumaPost 早报 v2.6 (06:00) | 每天 06:00 | ACTIVE |
| LumaPost 午报 v2.6 (12:00) | 每天 12:00 | ACTIVE |
| LumaPost 午后速递 v2.6 (16:00) | 每天 16:00 | ACTIVE |
| LumaPost 晚间总结 v2.6 (24:00) | 每天 24:00 | ACTIVE |
