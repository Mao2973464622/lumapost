# LumaPost 常见问题备忘

## 部署问题

### Q: 为什么邮件发不出去？
A: 检查以下几点：
1. .env文件是否存在且配置正确
2. SMTP授权码是否正确（不是邮箱密码）
3. QQ邮箱是否开启了SMTP服务
4. 网络连接是否正常

### Q: 电脑关机还能发邮件吗？
A: 取决于部署方式：
- GitHub Actions: 可以，完全云端运行
- 本地WorkBuddy/SkillHub: 不行，需要电脑开机

### Q: 如何修改发送时间？
A: 修改 .github/workflows/email.yml 中的 cron 表达式：
- 0 22 * * * = 北京时间06:00
- 0 4 * * * = 北京时间12:00
- 0 8 * * * = 北京时间16:00
- 0 16 * * * = 北京时间24:00

## 数据问题

### Q: 新闻内容怎么更新？
A: 两种方式：
1. 手动修改 data/test-noon.json 中的静态数据
2. 接入实时API（NewsAPI/GNews等）

### Q: 如何增加新版块？
A: 三个步骤：
1. 在 data/*.json 的 sections 数组中添加新版块对象
2. 在 scripts/gen-html.js 的 getSectionTheme() 中添加新颜色
3. 推送更新到GitHub

### Q: 天气信息怎么来的？
A: 使用 Open-Meteo 免费API，无需注册。默认位置：湖南长沙。
修改位置：编辑 .env 中的 WEATHER_CITY 或直接修改脚本中的经纬度。

## 邮件问题

### Q: 邮件进垃圾箱了？
A: 将发件人邮箱加入白名单。如果是QQ邮箱，在设置中添加信任发件人。

### Q: 如何发给多个人？
A: 添加 EMAIL_TO secret，用英文逗号分隔多个邮箱：
2973464622@qq.com,friend1@qq.com,friend2@163.com
（注意：不要加空格，QQ邮箱一次最多20-50人）

### Q: 邮件样式能改吗？
A: 编辑 scripts/gen-html.js 中的 generateHTML() 函数。样式是内联CSS，邮件客户端兼容性好。

## 平台兼容

### Q: WorkBuddy和SkillHub有什么区别？
A: 两个不同平台，插件格式不同：
- WorkBuddy: 使用 .workbuddy/skills/ 目录，SKILL.md 格式
- SkillHub: 使用 skillhub-plugin/ 目录，meta.json + ima_api.js 格式
- 两者功能相同，只是入口文件格式不同

### Q: 其他AI客户端能用吗？
A: 可以，但只能手动执行：
- ChatGPT/Claude: 复制通用Prompt到自定义指令
- OpenCat/Claw: 导入 plugin-clawhub.json
- 都需要手动运行Node.js脚本发送邮件
