#!/usr/bin/env node
/**
 * web-server.js — LumaPost Web UI 服务器 (v4.2)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

let configStore, aiProvider;
try {
  configStore = require('./config-store');
  aiProvider = require('./ai-provider');
} catch (e) {
  console.error('❌ 缺少必要模块:', e.message);
  process.exit(1);
}

const PORT = process.env.PORT || configStore.get('app.port') || 3000;
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function sendJSON(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function sendError(res, msg, status = 500) {
  sendJSON(res, { error: msg, success: false }, status);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => {
      body += c.toString();
      if (body.length > 1e6) { req.destroy(); reject(new Error('请求体过大')); }
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { reject(new Error('无效的 JSON')); }
    });
  });
}

async function handleAPI(req, res) {
  const u = url.parse(req.url, true);
  const p = u.pathname;
  const m = req.method;
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (m === 'OPTIONS') { res.writeHead(204); return res.end(); }
  
  try {
    // Config
    if (p === '/api/config' && m === 'GET') return sendJSON(res, configStore.getAll());
    if (p === '/api/config' && m === 'POST') {
      const body = await parseBody(req);
      const ok = configStore.update(body);
      return sendJSON(res, { success: ok });
    }
    if (p === '/api/config/validate' && m === 'GET') return sendJSON(res, configStore.validate());
    if (p === '/api/config/history' && m === 'DELETE') {
      configStore.update({ history: { fetchHistory: [], sendHistory: [] } });
      return sendJSON(res, { success: true });
    }
    
    // Providers
    if (p === '/api/providers' && m === 'GET') return sendJSON(res, { providers: aiProvider.listProviders() });
    
    // Models
    if (p === '/api/models' && m === 'GET') {
      const models = await aiProvider.listModels();
      return sendJSON(res, { models });
    }
    if (p.startsWith('/api/models/') && m === 'GET') {
      const provider = p.split('/')[3];
      const models = await aiProvider.listModels(provider);
      return sendJSON(res, { provider, models });
    }
    
    // Test AI
    if (p === '/api/test-ai' && m === 'POST') {
      const body = await parseBody(req);
      const result = await aiProvider.chat([
        { role: 'user', content: body.message || '你好，请回复"连接成功"。' }
      ], { model: body.model, temperature: body.temperature || 0.7, maxTokens: 100 });
      return sendJSON(res, { success: true, message: result });
    }
    
    // Test Mail
    if (p === '/api/test-mail' && m === 'POST') {
      const body = await parseBody(req);
      const mailProvider = require('./mail-provider');
      const result = await mailProvider.send({
        to: body.to || configStore.get('mail.to') || configStore.get('mail.user'),
        subject: '🧪 LumaPost 邮件测试',
        html: '<h1>测试成功！</h1><p>如果您看到此邮件，说明 LumaPost 邮件服务配置正确。</p>',
      });
      return sendJSON(res, { success: true, result });
    }
    
    // Fetch news
    if (p === '/api/fetch' && m === 'POST') {
      const { spawn } = require('child_process');
      const child = spawn('node', ['scripts/fetch-news-ai.js', '--period=all'], {
        cwd: path.resolve(__dirname, '..'), detached: true, stdio: 'ignore',
      });
      child.unref();
      configStore.addHistory('fetchHistory', { title: '全时段新闻抓取', status: '运行中' });
      return sendJSON(res, { success: true, message: '已启动全时段抓取' });
    }
    
    // Latest news
    if (p === '/api/news/latest' && m === 'GET') {
      const dataDir = path.resolve(__dirname, '..', 'data');
      const files = ['morning-latest.json', 'noon-latest.json', 'afternoon-latest.json', 'evening-latest.json'];
      let latest = null, latestTime = 0;
      for (const f of files) {
        const fp = path.join(dataDir, f);
        if (fs.existsSync(fp)) {
          const st = fs.statSync(fp);
          if (st.mtimeMs > latestTime) { latestTime = st.mtimeMs; latest = JSON.parse(fs.readFileSync(fp, 'utf8')); }
        }
      }
      return sendJSON(res, latest || { headline: [], sections: [] });
    }
    
    // Preview
    if (p.startsWith('/api/preview/') && m === 'GET') {
      const period = p.split('/')[3];
      const valid = ['morning', 'noon', 'afternoon', 'evening'];
      if (!valid.includes(period)) return sendError(res, '无效的时段', 400);
      
      const dataFile = path.resolve(__dirname, '..', 'data', `${period}-latest.json`);
      const htmlFile = path.resolve(__dirname, '..', 'data', `${period}-email.html`);
      
      if (!fs.existsSync(dataFile)) return sendError(res, '该时段暂无数据', 404);
      
      if (fs.existsSync(htmlFile)) {
        const ds = fs.statSync(dataFile);
        const hs = fs.statSync(htmlFile);
        if (hs.mtimeMs >= ds.mtimeMs) {
          const html = fs.readFileSync(htmlFile, 'utf8');
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          return res.end(html);
        }
      }
      
      try {
        const { spawnSync } = require('child_process');
        spawnSync('node', ['scripts/gen-html.js', `--data-file=${dataFile}`, `--output=${htmlFile}`], {
          cwd: path.resolve(__dirname, '..'),
        });
        if (fs.existsSync(htmlFile)) {
          const html = fs.readFileSync(htmlFile, 'utf8');
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          return res.end(html);
        }
      } catch (e) {}
      return sendError(res, '生成预览失败');
    }
    
    return sendError(res, 'API 不存在', 404);
  } catch (e) {
    return sendError(res, e.message);
  }
}

function serveStatic(req, res) {
  let fp = url.parse(req.url).pathname;
  if (fp === '/') fp = '/index.html';
  const full = path.join(PUBLIC_DIR, fp);
  if (!full.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not Found'); }
    const ext = path.extname(full).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const p = url.parse(req.url).pathname;
  if (p.startsWith('/api/')) return handleAPI(req, res);
  return serveStatic(req, res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`
╔═══════════════════════════════════════════════╗
║  📰 LumaPost 光影邮报 Web UI v4.2              ║
║  🌐 访问地址: http://127.0.0.1:${PORT}           ║
╚═══════════════════════════════════════════════╝
`);
});

module.exports = server;