// LumaPost Web UI v4.2

let config = {};
let providers = [];
let models = [];

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  loadDashboard();
  initConfigForm();
  initProviders();
  initPreview();
});

function initNav() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const page = item.dataset.page;
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById(`page-${page}`).classList.add('active');
      if (page === 'config') loadConfig();
      if (page === 'providers') loadProviders();
      if (page === 'history') loadHistory();
    });
  });
}

async function api(url, opts = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  return res.json();
}

function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
}

function showLoading() { document.getElementById('loading').classList.remove('hidden'); }
function hideLoading() { document.getElementById('loading').classList.add('hidden'); }

async function loadDashboard() {
  try {
    const res = await fetch('/api/config');
    config = await res.json();
    
    document.getElementById('stat-provider').textContent = config.ai?.provider || '未设置';
    document.getElementById('stat-mail').textContent = config.mail?.provider || '未设置';
    
    const val = await fetch('/api/config/validate').then(r => r.json());
    updateStatus('status-config', val.valid ? '✓ 已配置' : '✗ 未配置', val.valid);
    updateStatus('status-ai', config.ai?.apiKey ? '✓ 已设置' : '✗ 未设置', !!config.ai?.apiKey);
    updateStatus('status-mail', config.mail?.user ? '✓ 已设置' : '✗ 未设置', !!config.mail?.user);
    
    // Latest news
    const news = await fetch('/api/news/latest').then(r => r.json()).catch(() => ({}));
    const list = document.getElementById('latestNews');
    if (news.headline?.length > 0) {
      list.innerHTML = news.headline.slice(0, 5).map(h => `
        <div class="news-item"><div class="news-title">${h.title}</div><div class="news-meta">${h.source || ''}</div></div>
      `).join('');
    } else {
      list.innerHTML = '<div class="empty">暂无新闻数据</div>';
    }
  } catch (e) {
    toast('加载仪表盘失败', 'error');
  }
}

function updateStatus(id, text, ok) {
  const el = document.getElementById(id);
  if (el) { el.textContent = text; el.className = 'status-value ' + (ok ? 'ok' : 'error'); }
}

function initConfigForm() {
  document.getElementById('configForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const cfg = {};
    fd.forEach((v, k) => {
      const keys = k.split('.');
      let obj = cfg;
      keys.slice(0, -1).forEach(key => { if (!obj[key]) obj[key] = {}; obj = obj[key]; });
      obj[keys[keys.length - 1]] = v;
    });
    try {
      showLoading();
      const res = await fetch('/api/config', { method: 'POST', body: JSON.stringify(cfg) }).then(r => r.json());
      hideLoading();
      toast(res.success ? '配置保存成功' : '保存失败', res.success ? 'success' : 'error');
    } catch (err) { hideLoading(); toast('保存失败', 'error'); }
  });
  
  document.getElementById('btnValidate')?.addEventListener('click', async () => {
    const res = await fetch('/api/config/validate').then(r => r.json());
    toast(res.valid ? '配置有效' : res.errors.join(', '), res.valid ? 'success' : 'error');
  });
}

async function loadConfig() {
  try {
    config = await fetch('/api/config').then(r => r.json());
    const set = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
    set('cfg-ai-provider', config.ai?.provider);
    set('cfg-ai-apiKey', config.ai?.apiKey);
    set('cfg-ai-model', config.ai?.model);
    set('cfg-ai-baseUrl', config.ai?.baseUrl);
    set('cfg-ai-temperature', config.ai?.temperature);
    set('cfg-ai-maxTokens', config.ai?.maxTokens);
    set('cfg-mail-provider', config.mail?.provider);
    set('cfg-mail-user', config.mail?.user);
    set('cfg-mail-pass', config.mail?.pass);
    set('cfg-mail-to', config.mail?.to);
  } catch (e) {}
}

async function loadProviders() {
  try {
    const res = await fetch('/api/providers');
    providers = (await res.json()).providers || [];
    const grid = document.getElementById('providerGrid');
    grid.innerHTML = providers.map(p => `
      <div class="provider-card" onclick="selectProvider('${p.key}')">
        <div class="provider-name">${p.name}</div>
        <div class="provider-models">${p.defaultModel || ''}</div>
      </div>
    `).join('');
  } catch (e) {}
}

async function selectProvider(key) {
  document.querySelectorAll('.provider-card').forEach(c => c.classList.remove('active'));
  event.currentTarget.classList.add('active');
  try {
    const res = await fetch(`/api/models/${key}`);
    models = (await res.json()).models || [];
    const list = document.getElementById('modelList');
    list.innerHTML = models.map(m => `
      <div class="model-item" onclick="selectModel('${m.id}')">
        <div class="model-radio"></div>
        <div class="model-info">
          <div class="model-name">${m.name || m.id}</div>
          <div class="model-desc">${m.context ? '上下文: ' + m.context : ''}</div>
        </div>
      </div>
    `).join('');
  } catch (e) {}
}

function selectModel(id) {
  document.querySelectorAll('.model-item').forEach(i => i.classList.toggle('active', i.querySelector('.model-name').textContent === id || i.querySelector('.model-desc').textContent.includes(id)));
  document.getElementById('cfg-ai-model').value = id;
  toast(`已选择: ${id}`, 'info');
}

async function loadHistory() {
  try {
    const res = await fetch('/api/config/history');
    const data = await res.json();
    const fl = document.getElementById('historyFetch');
    const sl = document.getElementById('historySend');
    fl.innerHTML = data.fetchHistory?.length ? data.fetchHistory.map(h => `
      <div class="history-item"><div class="history-info"><div class="history-title">${h.title || '抓取'}</div><div class="history-time">${new Date(h.time).toLocaleString('zh-CN')}</div></div><span>${h.status || '完成'}</span></div>
    `).join('') : '<div class="empty">暂无记录</div>';
    sl.innerHTML = data.sendHistory?.length ? data.sendHistory.map(h => `
      <div class="history-item"><div class="history-info"><div class="history-title">${h.title || '发送'}</div><div class="history-time">${new Date(h.time).toLocaleString('zh-CN')}</div></div><span>${h.status || '完成'}</span></div>
    `).join('') : '<div class="empty">暂无记录</div>';
  } catch (e) {}
}

function initPreview() {
  document.getElementById('btnPreview')?.addEventListener('click', async () => {
    const period = document.getElementById('previewPeriod').value;
    const frame = document.getElementById('previewFrame');
    try {
      showLoading();
      const res = await fetch(`/api/preview/${period}`);
      const html = await res.text();
      hideLoading();
      frame.srcdoc = html;
    } catch (e) { hideLoading(); toast('生成预览失败', 'error'); }
  });
}

document.getElementById('btnRunFetch')?.addEventListener('click', async () => {
  try {
    showLoading();
    const res = await fetch('/api/fetch', { method: 'POST' }).then(r => r.json());
    hideLoading();
    toast(res.success ? '已启动抓取' : '启动失败', res.success ? 'success' : 'error');
  } catch (e) { hideLoading(); toast('启动失败', 'error'); }
});

document.getElementById('btnRefresh')?.addEventListener('click', () => {
  loadDashboard();
  toast('已刷新', 'info');
});

document.getElementById('btnLoadModels')?.addEventListener('click', async () => {
  try {
    showLoading();
    const res = await fetch('/api/models');
    models = (await res.json()).models || [];
    hideLoading();
    toast(`已加载 ${models.length} 个模型`, 'success');
  } catch (e) { hideLoading(); toast('加载失败', 'error'); }
});