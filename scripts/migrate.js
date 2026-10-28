#!/usr/bin/env node
/**
 * migrate.js — 从旧目录结构迁移到持久化目录 (v10.5.0)
 *
 * 背景：原项目被放在 /tmp/lumapost（tmpfs），设备重启后配置、历史、
 * 已生成的邮件全部丢失，而 config/app.json 里是唯一的真实凭据。
 * 本脚本用于把旧位置的数据搬到新位置并补全缺失配置段。
 *
 * 用法：
 *   node scripts/migrate.js                 # 只检查、报告要做什么
 *   node scripts/migrate.js --apply         # 实际执行
 *   node scripts/migrate.js --from=/tmp/lumapost --apply
 */
const fs = require('fs');
const path = require('path');

const args = {};
process.argv.slice(2).forEach(a => {
  if (a.startsWith('--')) {
    const i = a.indexOf('=');
    if (i > 0) args[a.slice(2, i)] = a.slice(i + 1);
    else args[a.slice(2)] = true;
  }
});

const ROOT = path.resolve(__dirname, '..');
const APPLY = args.apply === true;
const FROM = path.resolve(args.from || '/tmp/lumapost');

function log(s) { console.log((APPLY ? '' : '[dry-run] ') + s); }

function copyIfMissing(src, dest, label) {
  if (!fs.existsSync(src)) { log('跳过（源不存在）: ' + label + ' ← ' + src); return; }
  if (fs.existsSync(dest)) {
    const ss = fs.statSync(src), ds = fs.statSync(dest);
    if (ss.mtimeMs > ds.mtimeMs) {
      log('⚠ 目标较旧，建议人工比对: ' + dest);
    } else {
      log('已存在，不覆盖: ' + label);
    }
    return;
  }
  log('复制 ' + label + ': ' + src + ' → ' + dest);
  if (APPLY) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (fs.statSync(src).isDirectory()) {
      fs.cpSync(src, dest, { recursive: true });
    } else {
      fs.copyFileSync(src, dest);
    }
  }
}

console.log('源目录 : ' + FROM + (fs.existsSync(FROM) ? '' : '  ❌ 不存在'));
console.log('目标   : ' + ROOT);
console.log('模式   : ' + (APPLY ? '执行' : '预演（加 --apply 生效）'));
console.log('');

copyIfMissing(path.join(FROM, 'config'), path.join(ROOT, 'config'), '配置（含密钥）');
copyIfMissing(path.join(FROM, 'data'), path.join(ROOT, 'data'), '运行数据与历史');

// 补全配置段：老版本 app.json 只有 app/ai/mail 等少数段
console.log('\n检查配置完整性…');
const store = require('./config-store');
const before = store.getAll();
const need = [];
const ensure = (key, def) => {
  const cur = store.get(key);
  if (cur === undefined || cur === null) need.push(key);
};
['email', 'enhance', 'schedule', 'delivery', 'sections', 'sources', 'search',
 'weather', 'app.makeUpWindowMin'].forEach(k => ensure(k));
if (need.length) {
  log('需要补全的配置段: ' + need.join(', '));
  if (APPLY) {
    // 直接把当前配置落盘一次即可：readConfig 已用 DEFAULT_CONFIG 深合并
    store.update({});
    console.log('已补全。当前 email 段: ' + JSON.stringify(store.get('email')).slice(0, 160) + '…');
  }
} else {
  log('配置完整，无需补全');
}

// 历史迁移：老版本历史塞在 app.json 的 history 字段
console.log('\n检查历史记录…');
try {
  const hist = store.getHistory();
  const n = (hist.fetchHistory || []).length + (hist.sendHistory || []).length;
  log('当前 history.json 记录数: ' + n + '（' + store.HISTORY_FILE + '）');
  if (APPLY && !fs.existsSync(store.HISTORY_FILE)) {
    store.addHistory('fetchHistory', { title: '迁移脚本运行', status: '完成' });
    console.log('已创建 history.json');
  }
} catch (e) {
  log('历史读取失败: ' + e.message);
}

console.log('\n完成。' + (APPLY ? '' : '（预演模式，未改动任何文件）'));
console.log('提示：迁移后请运行 npm run doctor 复核配置，再用 npm test 确认代码健康。');
