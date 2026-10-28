#!/usr/bin/env node
/**
 * tests/run.js — 回归测试 (v10.5.0)
 *
 * 覆盖本次修复的关键行为，全部是纯函数/可注入测试，不依赖网络与 AI。
 * 运行：npm test
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
const results = [];

function test(name, fn) {
  try {
    fn();
    pass++; results.push('✅ ' + name);
  } catch (e) {
    fail++; results.push('❌ ' + name + '\n     ' + String(e.message).split('\n')[0]);
  }
}

/* ---------- 1. json-repair ---------- */
const jr = require('../scripts/json-repair');

test('json-repair: 修复未转义裸引号（线上降级根因）', () => {
  const bad = '{"summary":"冲刺"超级智能第一股"。","b":"c"}';
  const r = jr.parseLoose(bad);
  assert.ok(r, '应解析成功');
  assert.strictEqual(r.b, 'c');
  assert.ok(r.summary.includes('超级智能第一股'), '内容不得丢失');
});

test('json-repair: 合法 JSON 不被破坏', () => {
  const good = '{"a":"正常","b":[1,2],"c":{"d":"含\\"引号\\""}}';
  const r = jr.parseLoose(good);
  assert.deepStrictEqual(r, JSON.parse(good));
});

test('json-repair: markdown 围栏 + 夹杂说明文字', () => {
  assert.deepStrictEqual(jr.parseLoose('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepStrictEqual(jr.parseLoose('结果如下：{"a":1} 完毕'), { a: 1 });
});

test('json-repair: 非法转义与控制符', () => {
  assert.ok(jr.parseLoose('{"u":"A\\xB0"}'));
  assert.strictEqual(jr.parseLoose('{"a":"x\ny"}').a, 'x y');
});

test('json-repair: 空输入与非 JSON 返回 null', () => {
  assert.strictEqual(jr.parseLoose(''), null);
  assert.strictEqual(jr.parseLoose('抱歉，无法完成', { verbose: false }), null);
});

/* ---------- 2. config-pref 优先级统一 ---------- */
const pref = require('../scripts/config-pref');

test('config-pref: 文件为默认值时 env 优先（CI 场景）', () => {
  process.env.__LP_T = 'from-env';
  assert.strictEqual(pref.pickFrom('provider', { provider: 'qq' }, 'qq', ['__LP_T']), 'from-env');
  delete process.env.__LP_T;
});

test('config-pref: 文件被显式改过则文件优先', () => {
  process.env.__LP_T = 'from-env';
  assert.strictEqual(pref.pickFrom('provider', { provider: 'sendgrid' }, 'qq', ['__LP_T']), 'sendgrid');
  delete process.env.__LP_T;
});

test('config-pref: 无 env 时回落默认值', () => {
  assert.strictEqual(pref.pickFrom('provider', {}, 'qq', ['__LP_MISSING']), 'qq');
});

test('config-pref: number 转换', () => {
  process.env.__LP_N = '7000';
  assert.strictEqual(pref.pickFrom('maxTokens', {}, 4096, ['__LP_N'], { number: true }), 7000);
  delete process.env.__LP_N;
});

/* ---------- 3. 调度器日期键（旧 bug：未补零导致清理失效） ---------- */
const sched = require('../scripts/scheduler');

test('scheduler: fireKey 日期补零可安全字典序比较', () => {
  const d1 = new Date(2026, 9, 9, 6, 0);    // 10月9日
  const d2 = new Date(2026, 9, 28, 6, 0);   // 10月28日
  const k1 = sched.fireKey(d1, 'morning', '06:00');
  const k2 = sched.fireKey(d2, 'morning', '06:00');
  assert.ok(k1 < k2, `旧实现会得 ${k1} > ${k2} 的错误结论`);
  assert.ok(/-09@/.test(k1), '月/日必须补零');
});

test('scheduler: 同 slot 同日同时段键一致（去重前提）', () => {
  const d = new Date(2026, 9, 28, 6, 1);
  assert.strictEqual(sched.fireKey(d, 'morning', '06:00'), sched.fireKey(d, 'morning', '06:00'));
});

/* ---------- 4. 配置脱敏（旧 bug：只加 mask 字段，明文照发） ---------- */
const store = require('../scripts/config-store');

test('config-store: sanitizeForOutput 抹掉全部密钥', () => {
  // v10.6.0：Web UI 已移除，config 里只剩 ai.apiKey 与 mail.pass 两个机密字段
  const src = {
    ai: { apiKey: 'sk-secret-abcdef', provider: 'deepseek' },
    mail: { pass: 'smtpauthcode', user: 'a@b.com' },
    app: { port: 3000 },
  };
  const out = store.sanitizeForOutput(src);
  assert.strictEqual(out.ai.apiKey, '');
  assert.strictEqual(out.mail.pass, '');
  assert.strictEqual(out.ai.apiKeySet, true);
  assert.strictEqual(out.mail.user, 'a@b.com', '非敏感字段不得动');
  const json = JSON.stringify(out);
  assert.ok(!json.includes('sk-secret') && !json.includes('smtpauthcode'), '输出不得含明文');
});

test('config-store: 空密钥不产生 Set=true 误导', () => {
  const out = store.sanitizeForOutput({ ai: { apiKey: '' }, mail: {}, app: {} });
  assert.strictEqual(out.ai.apiKeySet, false);
});

/* ---------- 5. gen-html 预算与渲染 ---------- */
const gen = require('../scripts/gen-html');

test('gen-html: applyBudget 裁剪到上限并统计丢弃量', () => {
  const L = Object.assign({}, gen.LIMITS);
  const big = {
    headline: Array.from({ length: 9 }, (_, i) => ({ title: 'H' + i })),
    summary: Array.from({ length: 9 }, (_, i) => ({ category: 'c', trend: 't' + i })),
    sections: [{
      key: 'ai', name: 'AI',
      items: Array.from({ length: 30 }, (_, i) => ({ title: 'T' + i, summary: 's', stars: 5 - (i % 4) })),
    }],
  };
  const r = gen.applyBudget(big, L);
  assert.strictEqual(r.data.headline.length, L.headlineCount);
  assert.strictEqual(r.data.summary.length, L.trendCount);
  assert.ok(r.data.sections[0].items.length <= L.itemsPerSection, '单版块不得超上限');
  assert.ok(r.dropped.items > 0, '应记录被丢弃条数');
});

test('gen-html: safeUrl 拦截 javascript: 等危险协议', () => {
  assert.strictEqual(gen.safeUrl('javascript:alert(1)'), '');
  assert.strictEqual(gen.safeUrl('data:text/html,<script>'), '');
  assert.strictEqual(gen.safeUrl('https://ok.com/x'), 'https://ok.com/x');
});

test('gen-html: 超大输入自动瘦身到 Gmail 线以下', () => {
  const mk = (n) => Array.from({ length: n }, (_, i) => ({
    key: 'sec' + (i % 10), name: '版块' + i,
    items: Array.from({ length: 8 }, (_, j) => ({
      title: '标题'.repeat(20) + i + '-' + j,
      summary: '摘要'.repeat(120),
      commentary: '解读'.repeat(400),      // 超长解读，模拟最坏情况
      quicknote: '快评'.repeat(40),
      source: 'src', url: 'https://example.com/' + i + j, stars: 4,
    })),
  }));
  const data = {
    date: '2026年10月28日', greeting: 'g', tldr: 't', dailyQuote: 'q',
    headline: Array.from({ length: 3 }, (_, i) => ({ title: '头条' + i, summary: 'x'.repeat(300), commentary: 'y'.repeat(1500), url: 'https://e.com' })),
    stocks: [{ name: '上证指数', price: '3600', pct: '+0.5%' }],
    summary: Array.from({ length: 5 }, (_, i) => ({ category: 'c', trend: 't'.repeat(100), detail: 'd'.repeat(200) })),
    sections: mk(10),
    meta: { aiMode: true },
  };
  const html = gen.generateHTML(data, 'sunset', null);
  const kb = Buffer.byteLength(html, 'utf8') / 1024;
  assert.ok(kb <= 100, '邮件必须 ≤100KB（Gmail 102KB 截断），实际 ' + kb.toFixed(1) + 'KB');
});

test('gen-html: 头条/行情/趋势确实被渲染（旧版全部丢失）', () => {
  const data = {
    date: 'D', greeting: 'g', tldr: 'TLDR测试',
    headline: [{ title: '独特头条XYZ', summary: 's', commentary: '独特解读ABC', url: 'https://e.com/1' }],
    stocks: [{ name: '上证指数', price: '3667', pct: '+0.51%' }],
    summary: [{ category: '🤖 AI', trend: '独特趋势Q', detail: 'd' }],
    sections: [{ key: 'ai', name: 'AI', items: [{ title: 'T1', summary: 's', commentary: '条目解读ZZZ', url: 'https://e.com/2', stars: 5 }] }],
    meta: { aiMode: true },
  };
  const html = gen.generateHTML(data, 'minimal', null);
  for (const probe of ['独特头条XYZ', '独特解读ABC', '上证指数', '独特趋势Q', '条目解读ZZZ', 'AI 深度解读']) {
    assert.ok(html.includes(probe), '邮件应包含: ' + probe);
  }
});

test('gen-html: 降级模式显示提示横幅且不编造解读', () => {
  const data = {
    date: 'D', greeting: 'g', headline: [], stocks: [], summary: [],
    sections: [{ key: 'ai', name: 'AI', items: [{ title: 'T', summary: 's', url: 'https://e.com' }] }],
    meta: { aiMode: false },
  };
  const html = gen.generateHTML(data, 'minimal', null);
  assert.ok(html.includes('热榜直连模式'), '降级必须显式告知读者');
  assert.ok(!html.includes('AI 深度解读'), '降级不得出现解读栏位');
});

test('gen-html: generateText 产出纯文本备选体', () => {
  const txt = gen.generateText({
    date: 'D', greeting: '早安', tldr: '摘要',
    sections: [{ key: 'ai', name: 'AI', items: [{ title: 'T1', summary: 'S1', url: 'https://e.com' }] }],
  });
  assert.ok(txt.includes('早安') && txt.includes('T1') && txt.includes('摘要'));
  assert.ok(!txt.includes('<'), '纯文本不应含 HTML 标签');
});

test('gen-html: 体积超限时优先砍条数而非砍解读（核心价值优先）', () => {
  const mkItems = () => Array.from({ length: 5 }, (_, j) => ({
    title: '标题' + j, summary: '摘要'.repeat(50),
    commentary: '解读'.repeat(200), quicknote: '快评', source: 's',
    url: 'https://e.com/' + j, stars: 4,
  }));
  const data = {
    date: 'D', greeting: 'g', tldr: 't', dailyQuote: 'quote',
    headline: [{ title: 'H', summary: 'x'.repeat(200), commentary: 'y'.repeat(800), url: 'https://e.com' }],
    stocks: [{ name: '上证指数', price: '3600', pct: '+0.5%' }],
    summary: Array.from({ length: 5 }, (_, i) => ({ category: 'c', trend: 't'.repeat(60), detail: 'd'.repeat(150) })),
    sections: [
      { key: 'ai', name: 'AI', items: mkItems() },
      { key: 'hardware', name: '硬件', items: mkItems() },
      { key: 'news', name: '新闻', items: mkItems() },
    ],
    meta: { aiMode: true },
  };
  const html = gen.generateHTML(data, 'minimal', null);
  const kb = Buffer.byteLength(html, 'utf8') / 1024;
  assert.ok(kb <= 100, '必须 ≤100KB，实际 ' + kb.toFixed(1));
  assert.ok(html.includes('AI 深度解读'), '解读是核心价值，不得为了体积先牺牲它');
});

test('gen-html: 内容保真 —— 解读正文进入 HTML 且未被静默丢弃', () => {
  const probe = '这是一段必须出现在邮件里的独特解读文本';
  const data = {
    date: 'D', greeting: 'g', tldr: 't',
    headline: [], stocks: [], summary: [],
    sections: [{ key: 'ai', name: 'AI', items: [{
      title: 'T', summary: 'S', commentary: probe, url: 'https://e.com', stars: 5,
    }] }],
    meta: { aiMode: true },
  };
  const html = gen.generateHTML(data, 'minimal', null);
  assert.ok(html.includes(probe), '解读正文必须原样出现在邮件中');
});

test('gen-html: cleanBrief 剔除「来源 #排名」元数据（截图中的空框 bug）', () => {
  // 这些都必须被判为「无有效简介」
  for (const bad of ['csdn #1', 'v2ex #1', '知乎#3', '新智元 #1', '量子位 #2', 'csdn', '36氪']) {
    assert.strictEqual(gen.cleanBrief(bad), '', '应剔除: ' + JSON.stringify(bad));
  }
  // 真实简介必须保留
  const good = '蚂蚁集团旗下百灵大模型正式开源 Ling-3.1-flash-1019，主打轻量推理与本地部署。';
  assert.ok(gen.cleanBrief(good).includes('Ling-3.1'), '真实简介不得被丢弃');
  // 带排名尾巴的正文：只去掉尾巴
  const tailed = '某公司发布新模型参数量 700 亿 #1';
  const r = gen.cleanBrief(tailed);
  assert.ok(r.includes('700 亿') && !r.includes('#1'), '应保留正文、去掉排名尾巴，实际: ' + r);
});

test('gen-html: 含 #排名 的 quicknote 不得渲染成空框', () => {
  const data = {
    date: 'D', greeting: 'g', tldr: 't',
    headline: [], stocks: [], summary: [],
    sections: [{ key: 'ai', name: 'AI', items: [
      { title: '无简介条目', summary: 'S', quicknote: 'csdn #1', url: 'https://e.com/1', stars: 5 },
      { title: '有简介条目', summary: 'S', quicknote: '这是一段真正的内容简介，说明这条新闻讲了什么。', url: 'https://e.com/2', stars: 5 },
    ] }],
    meta: { aiMode: true },
  };
  const html = gen.generateHTML(data, 'minimal', null);
  assert.ok(!html.includes('csdn #1'), '元数据不得出现在邮件里');
  assert.ok(html.includes('这是一段真正的内容简介'), '真实简介必须渲染');
  assert.ok(html.includes('内容简介'), '应使用「内容简介」而非裸框');
});

test('gen-html v10.6: 每个版块都有显著分区标记（SEC 序号 / 第N-M / 下一版块）', () => {
  const mk = (n) => ({
    key: 'k' + n, name: '版块' + n,
    items: [{ title: 'T' + n, summary: 'S', url: 'https://e.com/' + n, stars: 5 }],
  });
  const data = {
    date: 'D', greeting: 'g', tldr: 't',
    headline: [], stocks: [], summary: [],
    sections: [mk(1), mk(2), mk(3)],
    meta: { aiMode: true },
  };
  const html = gen.generateHTML(data, 'minimal', null);
  // 每个版块必须有：SEC 徽章、第 N/M 进度、OF NN 总进度
  assert.strictEqual((html.match(/SEC<\/div>/g) || []).length, 3, '每个版块都要有 SEC 序号徽章');
  assert.strictEqual((html.match(/第 \d+ \/ \d+ 个版块/g) || []).length, 3, '每个版块都要有「第 N/M 个版块」');
  assert.strictEqual((html.match(/OF \d{2}/g) || []).length, 3, '每个版块都要有 OF NN 进度');
  // 前两个必须有「下一版块」预告，最后一个必须是「本期最后一个版块」
  assert.strictEqual((html.match(/下一版块：/g) || []).length, 2, '应为前 N-1 个版块提供下一站');
  assert.ok(html.includes('本期最后一个版块'), '最后一个版块需明确收尾');
  // 目录锚点与回到目录
  assert.ok(html.includes('id="toc"'), '目录必须可作锚点');
  assert.strictEqual((html.match(/↑ 目录/g) || []).length, 3, '每个版块都要能跳回目录');
});

test('gen-html v10.6: 预算裁剪公平分配（每个版块都必须出现）', () => {
  // 旧实现是贪心填充：前面版块吃满 itemsTotal，后面整块消失
  const mk = (n, cnt) => ({
    key: 'k' + n, name: '版块' + n,
    items: Array.from({ length: cnt }, (_, i) => ({
      title: 'T' + n + '-' + i, summary: 'S', url: 'https://e.com/' + n + '/' + i, stars: 5 - (i % 3),
    })),
  });
  const L = Object.assign({}, gen.LIMITS);
  L.itemsTotal = 10;          // 10 个版块只给 10 条配额
  L.itemsPerSection = 5;
  const data = {
    headline: [], summary: [],
    sections: Array.from({ length: 10 }, (_, i) => mk(i, 5)),
  };
  const r = gen.applyBudget(data, L);
  assert.strictEqual(r.data.sections.length, 10, '10 个版块必须全部保留，不能有整块消失');
  r.data.sections.forEach(s => {
    assert.ok(s.items.length >= 1, s.name + ' 至少要有 1 条内容');
  });
  const total = r.data.sections.reduce((a, s) => a + s.items.length, 0);
  assert.ok(total <= 10, '总条数不得超过预算，实际 ' + total);
});

test('gen-html v10.6: 体积瘦身不得先砍目录（导航是核心体验）', () => {
  const mk = (n) => ({
    key: 'k' + n, name: '版块' + n,
    items: Array.from({ length: 5 }, (_, i) => ({
      title: '标题' + i, summary: '摘要'.repeat(40),
      commentary: '解读'.repeat(150), quicknote: '简介'.repeat(20),
      source: 's', url: 'https://e.com/' + n + i, stars: 4,
    })),
  });
  const data = {
    date: 'D', greeting: 'g', tldr: 't', dailyQuote: 'q',
    headline: [{ title: 'H', summary: 'x'.repeat(200), commentary: 'y'.repeat(600), url: 'https://e.com' }],
    stocks: [{ name: '上证指数', price: '3600', pct: '+0.5%' }],
    summary: Array.from({ length: 5 }, (_, i) => ({ category: 'c', trend: 't'.repeat(60), detail: 'd'.repeat(150) })),
    sections: Array.from({ length: 10 }, (_, i) => mk(i)),
    meta: { aiMode: true },
  };
  const html = gen.generateHTML(data, 'minimal', null);
  const kb = Buffer.byteLength(html, 'utf8') / 1024;
  assert.ok(kb <= 100, '必须 ≤100KB，实际 ' + kb.toFixed(1));
  assert.ok(html.includes('id="toc"'), '目录在瘦身顺序中应靠后，不该被优先砍掉');
});

/* ---------- 汇总 ---------- */
console.log(results.join('\n'));
console.log('\n' + '='.repeat(46));
console.log('通过 ' + pass + ' · 失败 ' + fail);
process.exit(fail ? 1 : 0);