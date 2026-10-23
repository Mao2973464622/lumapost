#!/usr/bin/env node
/**
 * ai-provider.js — 统一 AI 模型调用层 (v4.2)
 * 
 * 修复:
 *   - Google Gemini 系统消息正确传递 (systemInstruction)
 *   - Anthropic API 版本更新
 *   - 所有模型列表更新到 2026.10
 *   - 添加 listModels() 动态获取模型列表
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
try { require('dotenv').config(); } catch(e) {}

const PROVIDERS = {
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-v4-flash',
    envKey: 'DEEPSEEK_API_KEY',
    models: [
      { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', context: 128000 },
      { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', context: 128000 },
      { id: 'deepseek-r1', name: 'DeepSeek R1', context: 128000 },
      { id: 'deepseek-v3.2', name: 'DeepSeek V3.2', context: 128000 },
    ],
    docs: 'https://platform.deepseek.com',
    protocol: 'openai',
  },
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    envKey: 'OPENAI_API_KEY',
    models: [
      { id: 'gpt-4.1', name: 'GPT-4.1', context: 128000 },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', context: 128000 },
      { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', context: 128000 },
      { id: 'gpt-4o', name: 'GPT-4o', context: 128000 },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', context: 128000 },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', context: 128000 },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', context: 16000 },
      { id: 'o1-mini', name: 'o1-mini', context: 128000 },
      { id: 'o1-preview', name: 'o1-preview', context: 128000 },
    ],
    docs: 'https://platform.openai.com',
    protocol: 'openai',
  },
  anthropic: {
    name: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4-20250514',
    envKey: 'ANTHROPIC_API_KEY',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', context: 200000 },
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', context: 200000 },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', context: 200000 },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', context: 200000 },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', context: 200000 },
    ],
    docs: 'https://console.anthropic.com',
    protocol: 'anthropic',
  },
  google: {
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.5-flash',
    envKey: 'GOOGLE_API_KEY',
    models: [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', context: 1000000 },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', context: 1000000 },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', context: 1000000 },
      { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', context: 1000000 },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', context: 1000000 },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', context: 1000000 },
    ],
    docs: 'https://aistudio.google.com',
    protocol: 'gemini',
  },
  qwen: {
    name: '阿里通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-max-latest',
    envKey: 'QWEN_API_KEY',
    models: [
      { id: 'qwen-max-latest', name: 'Qwen Max', context: 32000 },
      { id: 'qwen-plus-latest', name: 'Qwen Plus', context: 128000 },
      { id: 'qwen-turbo-latest', name: 'Qwen Turbo', context: 128000 },
      { id: 'qwen-long-latest', name: 'Qwen Long', context: 1000000 },
      { id: 'qwen-vl-max', name: 'Qwen VL Max (视觉)', context: 32000 },
    ],
    docs: 'https://dashscope.console.aliyun.com',
    protocol: 'openai',
  },
  zhipu: {
    name: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-plus',
    envKey: 'ZHIPU_API_KEY',
    models: [
      { id: 'glm-4-plus', name: 'GLM-4 Plus', context: 128000 },
      { id: 'glm-4-air', name: 'GLM-4 Air', context: 128000 },
      { id: 'glm-4-flash', name: 'GLM-4 Flash', context: 128000 },
    ],
    docs: 'https://open.bigmodel.cn',
    protocol: 'openai',
  },
  doubao: {
    name: '字节豆包',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: 'doubao-pro-32k',
    envKey: 'DOUBAO_API_KEY',
    models: [
      { id: 'doubao-pro-32k', name: '豆包 Pro 32K', context: 32000 },
      { id: 'doubao-pro-256k', name: '豆包 Pro 256K', context: 256000 },
      { id: 'doubao-lite-256k', name: '豆包 Lite 256K', context: 256000 },
      { id: 'doubao-lite-128k', name: '豆包 Lite 128K', context: 128000 },
      { id: 'doubao-vision-pro', name: '豆包 Vision Pro', context: 32000 },
    ],
    docs: 'https://www.volcengine.com/product/doubao',
    protocol: 'openai',
  },
  kimi: {
    name: '月之暗面 Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'kimi-k2-turbo',
    envKey: 'KIMI_API_KEY',
    models: [
      { id: 'kimi-k2-turbo', name: 'Kimi K2 Turbo', context: 128000 },
      { id: 'kimi-k2', name: 'Kimi K2', context: 128000 },
      { id: 'moonshot-v1-128k', name: 'Moonshot V1 128K', context: 128000 },
      { id: 'moonshot-v1-32k', name: 'Moonshot V1 32K', context: 32000 },
      { id: 'moonshot-v1-8k', name: 'Moonshot V1 8K', context: 8000 },
    ],
    docs: 'https://platform.moonshot.cn',
    protocol: 'openai',
  },
  xai: {
    name: 'xAI Grok',
    baseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-3-mini',
    envKey: 'XAI_API_KEY',
    models: [
      { id: 'grok-3-mini', name: 'Grok 3 Mini', context: 128000 },
      { id: 'grok-3', name: 'Grok 3', context: 128000 },
      { id: 'grok-2', name: 'Grok 2', context: 128000 },
    ],
    docs: 'https://x.ai/api',
    protocol: 'openai',
  },
  minimodel: {
    name: '面壁智能 MiniCPM',
    baseUrl: 'https://api.modelbest.cn/v1',
    defaultModel: 'minicpm-m3-pro',
    envKey: 'MINIMODEL_API_KEY',
    models: [
      { id: 'minicpm-m3-pro', name: 'MiniCPM M3 Pro', context: 32000 },
      { id: 'minicpm-m2.6', name: 'MiniCPM M2.6', context: 32000 },
      { id: 'minicpm-m2.5', name: 'MiniCPM M2.5', context: 32000 },
    ],
    docs: 'https://modelbest.cn',
    protocol: 'openai',
  },
  yi: {
    name: '零一万物 Yi',
    baseUrl: 'https://api.lingyiwanwu.com/v1',
    defaultModel: 'yi-lightning',
    envKey: 'YI_API_KEY',
    models: [
      { id: 'yi-lightning', name: 'Yi Lightning', context: 128000 },
      { id: 'yi-large', name: 'Yi Large', context: 128000 },
      { id: 'yi-medium', name: 'Yi Medium', context: 32000 },
    ],
    docs: 'https://platform.lingyiwanwu.com',
    protocol: 'openai',
  },
  together: {
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    envKey: 'TOGETHER_API_KEY',
    models: [
      { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', name: 'Llama 3.3 70B', context: 128000 },
      { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 2.5 72B', context: 128000 },
      { id: 'deepseek-ai/DeepSeek-V4', name: 'DeepSeek V4', context: 128000 },
    ],
    docs: 'https://together.ai',
    protocol: 'openai',
  },
  stepfun: {
    name: '阶跃星辰',
    baseUrl: 'https://api.stepfun.com/v1',
    defaultModel: 'step-3-512k',
    envKey: 'STEPFUN_API_KEY',
    models: [
      { id: 'step-3-512k', name: 'Step 3 512K', context: 512000 },
      { id: 'step-2-ultra', name: 'Step 2 Ultra', context: 256000 },
      { id: 'step-1o', name: 'Step 1o', context: 128000 },
      { id: 'step-1.5-32k', name: 'Step 1.5 32K', context: 32000 },
    ],
    docs: 'https://platform.stepfun.com',
    protocol: 'openai',
  },
  hunyuan: {
    name: '腾讯混元',
    baseUrl: 'https://api.hunyuan.tencent.com/v1',
    defaultModel: 'hy-4.0-pro',
    envKey: 'HUNYUAN_API_KEY',
    models: [
      { id: 'hy-4.0-pro', name: '混元 4.0 Pro', context: 128000 },
      { id: 'hy-3.0-pro', name: '混元 3.0 Pro', context: 128000 },
      { id: 'hy-3.0-flash', name: '混元 3.0 Flash', context: 128000 },
    ],
    docs: 'https://cloud.tencent.com/product/hunyuan',
    protocol: 'openai',
  },
  iflytek: {
    name: '讯飞星火',
    baseUrl: 'https://api.iflytek.com/v1',
    defaultModel: 'spark-4.0-ultra',
    envKey: 'IFLYTEK_API_KEY',
    models: [
      { id: 'spark-4.0-ultra', name: 'Spark 4.0 Ultra', context: 128000 },
      { id: 'spark-4.0-pro', name: 'Spark 4.0 Pro', context: 128000 },
      { id: 'spark-4.0-flash', name: 'Spark 4.0 Flash', context: 128000 },
    ],
    docs: 'https://www.xfyun.cn/doc/spark',
    protocol: 'openai',
  },
  groq: {
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-specdec',
    envKey: 'GROQ_API_KEY',
    models: [
      { id: 'llama-3.3-70b-specdec', name: 'Llama 3.3 70B SpecDec', context: 8192 },
      { id: 'llama-3.1-70b', name: 'Llama 3.1 70B', context: 8192 },
      { id: 'llama-3.1-8b', name: 'Llama 3.1 8B', context: 8192 },
      { id: 'mixtral-8x7b', name: 'Mixtral 8x7B', context: 32000 },
      { id: 'gemma2-9b', name: 'Gemma 2 9B', context: 8192 },
    ],
    docs: 'https://console.groq.com',
    protocol: 'openai',
  },
  openrouter: {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'deepseek/deepseek-chat',
    envKey: 'OPENROUTER_API_KEY',
    models: [
      { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', context: 128000 },
      { id: 'openai/gpt-4o', name: 'GPT-4o', context: 128000 },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', context: 200000 },
      { id: 'google/gemini-pro', name: 'Gemini Pro', context: 1000000 },
    ],
    docs: 'https://openrouter.ai/docs',
    protocol: 'openai',
  },
  siliconflow: {
    name: '硅基流动',
    baseUrl: 'https://api.siliconflow.cn/v1',
    defaultModel: 'deepseek-ai/DeepSeek-V4',
    envKey: 'SILICONFLOW_API_KEY',
    models: [
      { id: 'deepseek-ai/DeepSeek-V4', name: 'DeepSeek V4', context: 128000 },
      { id: 'Qwen/Qwen2.5-72B', name: 'Qwen 2.5 72B', context: 128000 },
      { id: 'google/gemma-2-27b', name: 'Gemma 2 27B', context: 8000 },
    ],
    docs: 'https://docs.siliconflow.cn',
    protocol: 'openai',
  },
  alibabacloud: {
    name: '阿里云百炼',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    envKey: 'ALIBABACLOUD_API_KEY',
    models: [
      { id: 'qwen-plus', name: 'Qwen Plus', context: 128000 },
      { id: 'qwen-turbo', name: 'Qwen Turbo', context: 128000 },
      { id: 'deepseek-r1', name: 'DeepSeek R1', context: 128000 },
      { id: 'kimi-moonshot', name: 'Kimi Moonshot', context: 128000 },
    ],
    docs: 'https://help.aliyun.com/product/2712598.html',
    protocol: 'openai',
  },
  custom: {
    name: '自定义 OpenAI 兼容',
    baseUrl: '',
    defaultModel: '',
    envKey: 'CUSTOM_API_KEY',
    models: [],
    docs: '任何兼容 OpenAI Chat Completions 的服务',
    protocol: 'openai',
  },
};

let _configStore = null;
function getStore() {
  if (_configStore === null) {
    try { _configStore = require('./config-store'); } catch (e) { _configStore = false; }
  }
  return _configStore || null;
}

function loadConfig() {
  const store = getStore();
  const fileCfg = store ? store.getAll() : {};
  const aiCfg = fileCfg.ai || {};

  const providerKey = String(
    process.env.AI_PROVIDER || aiCfg.provider || 'deepseek'
  ).toLowerCase();
  const provider = PROVIDERS[providerKey];

  if (!provider) {
    throw new Error(
      '不支持 AI 提供商: "' + providerKey + '"\n支持: ' + Object.keys(PROVIDERS).join(', ')
    );
  }

  const apiKey = process.env.AI_API_KEY
    || aiCfg.apiKey
    || process.env[provider.envKey]
    || process.env[providerKey.toUpperCase() + '_API_KEY']
    || '';

  if (!apiKey && providerKey !== 'custom') {
    throw new Error(
      '未配置 API Key。请在 Web UI 配置页或 config/app.json 中设置。\n获取: ' + provider.docs
    );
  }

  const baseUrlRaw = process.env.AI_BASE_URL
    || aiCfg.baseUrl
    || provider.baseUrl
    || '';

  if (!baseUrlRaw) {
    throw new Error('提供商 "' + providerKey + '" 缺少 Base URL，请在配置页填写。');
  }

  // config-store 是单一数据源，每次调用重新读取（其内部有 mtime 缓存，开销极小）
  return {
    provider: providerKey,
    providerName: provider.name,
    apiKey: apiKey,
    baseUrl: String(baseUrlRaw).replace(/\/+$/, ''),
    model: process.env.AI_MODEL || aiCfg.model || provider.defaultModel,
    timeout: Number(process.env.AI_TIMEOUT) || Number(aiCfg.timeout) || 60000,
    maxTokens: Number(process.env.AI_MAX_TOKENS) || Number(aiCfg.maxTokens) || 4096,
    temperature: process.env.AI_TEMP !== undefined
      ? parseFloat(process.env.AI_TEMP)
      : (aiCfg.temperature !== undefined ? Number(aiCfg.temperature) : 0.7),
    protocol: provider.protocol,
  };
}

function httpRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'http:' ? http : https;
    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'http:' ? 80 : 443),
      path: parsed.pathname + parsed.search,
      method: options.method || 'POST',
      headers: options.headers || {},
      timeout: options.timeout || 60000,
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error(`响应非 JSON: ${data.slice(0, 200)}`)); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 500)}`));
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function chat(messages, options = {}) {
  const cfg = loadConfig();
  const model = options.model || cfg.model;
  const maxTokens = options.maxTokens || cfg.maxTokens;
  const temperature = options.temperature !== undefined ? options.temperature : cfg.temperature;
  const timeout = options.timeout || cfg.timeout;
  
  let url, body, headers;
  
  switch (cfg.protocol) {
    case 'anthropic': {
      const systemMsg = messages.find(m => m.role === 'system');
      const userMsgs = messages.filter(m => m.role !== 'system');
      url = `${cfg.baseUrl}/messages`;
      headers = {
        'Content-Type': 'application/json',
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01',
      };
      body = {
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemMsg ? systemMsg.content : '',
        messages: userMsgs,
      };
      break;
    }
    case 'gemini': {
      const systemMsg = messages.find(m => m.role === 'system');
      const contents = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));
      url = `${cfg.baseUrl}/models/${model}:generateContent?key=${cfg.apiKey}`;
      headers = { 'Content-Type': 'application/json' };
      body = {
        contents,
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature,
        },
      };
      if (systemMsg) {
        body.systemInstruction = { parts: [{ text: systemMsg.content }] };
      }
      break;
    }
    default: {
      url = `${cfg.baseUrl}/chat/completions`;
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.apiKey}`,
      };
      body = {
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
        stream: false,
      };
      break;
    }
  }
  
  try {
    const res = await httpRequest(url, { method: 'POST', headers, timeout }, body);
    
    switch (cfg.protocol) {
      case 'anthropic':
        return res.content?.[0]?.text || '';
      case 'gemini':
        return res.candidates?.[0]?.content?.parts?.[0]?.text || '';
      default:
        return res.choices?.[0]?.message?.content || '';
    }
  } catch (err) {
    throw new Error(`[${cfg.providerName}/${model}] 调用失败: ${err.message}`);
  }
}

async function chatJSON(messages, options = {}) {
  const cfg = loadConfig();
  const lastMsg = messages[messages.length - 1];
  const enhanced = [
    ...messages.slice(0, -1),
    {
      role: lastMsg?.role || 'user',
      content: (lastMsg?.content || '') +
               '\n\n【严格规则】只返回合法 JSON，不要任何解释、不要 markdown 代码块标记。'
    }
  ];
  const text = await chat(enhanced, options);
  const jsonMatch = text.match(/\{[\s\S]*\}/) || text.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch (e) { /* fall through */ }
  }
  try { return JSON.parse(text); }
  catch (e) {
    throw new Error(`AI 返回非 JSON: ${text.slice(0, 200)}`);
  }
}

/**
 * 获取模型列表
 * @param {string|null} providerKey 指定提供商；null 表示当前配置的提供商
 * @param {object} override 临时覆盖 { apiKey, baseUrl }
 */
async function listModels(providerKey, override) {
  override = override || {};

  // 解析目标提供商
  let key = providerKey;
  if (!key) {
    const store = getStore();
    key = process.env.AI_PROVIDER
      || (store && store.get('ai.provider'))
      || 'deepseek';
  }
  key = String(key).toLowerCase();

  const provider = PROVIDERS[key];
  if (!provider) throw new Error('未知的提供商: ' + key);

  // 解析 Key 与 BaseUrl：显式传入 > 配置文件 > 环境变量 > 提供商默认
  const store = getStore();
  const isCurrent = !providerKey
    || (store && store.get('ai.provider') === key);

  const apiKey = override.apiKey
    || (isCurrent && store ? store.get('ai.apiKey') : '')
    || process.env.AI_API_KEY
    || process.env[provider.envKey]
    || '';

  const baseUrl = (override.baseUrl
    || (isCurrent && store ? store.get('ai.baseUrl') : '')
    || process.env.AI_BASE_URL
    || provider.baseUrl
    || '').replace(/\/+$/, '');

  // 无 Key / 无端点时返回静态内置列表
  if (!apiKey || !baseUrl) {
    return provider.models || [];
  }

  try {
    if (provider.protocol === 'openai') {
      const res = await httpRequest(baseUrl + '/models', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + apiKey },
      }, null);
      const raw = res.data || res.models || (Array.isArray(res) ? res : null);
      if (Array.isArray(raw) && raw.length) {
        return raw.map(function (m) {
          const id = m.id || m.name || String(m);
          return {
            id: id,
            name: m.name || m.display_name || id,
            context: m.context_length || m.context_window || m.max_tokens || 0,
          };
        }).filter(function (m) { return m.id; })
          .sort(function (a, b) { return a.id.localeCompare(b.id); });
      }
    } else if (provider.protocol === 'gemini') {
      const res = await httpRequest(baseUrl + '/models?key=' + encodeURIComponent(apiKey), {
        method: 'GET',
      }, null);
      if (res.models && Array.isArray(res.models)) {
        return res.models
          .filter(function (m) {
            return !m.supportedGenerationMethods
              || m.supportedGenerationMethods.indexOf('generateContent') >= 0;
          })
          .map(function (m) {
            return {
              id: String(m.name || '').replace('models/', ''),
              name: m.displayName || m.name,
              context: m.inputTokenLimit || 0,
            };
          });
      }
    } else if (provider.protocol === 'anthropic') {
      const res = await httpRequest(baseUrl + '/models', {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
      }, null);
      if (res.data && Array.isArray(res.data)) {
        return res.data.map(function (m) {
          return { id: m.id, name: m.display_name || m.id, context: m.context_window || 0 };
        });
      }
    }
  } catch (e) {
    console.warn('[models] ' + key + ' 动态拉取失败，回退静态列表: ' + e.message);
    const err = new Error(e.message);
    err.staticFallback = provider.models || [];
    throw err;
  }

  return provider.models || [];
}

function listProviders() {
  return Object.entries(PROVIDERS).map(([k, v]) => ({
    key: k,
    name: v.name,
    envKey: v.envKey,
    defaultModel: v.defaultModel,
    models: v.models,
    docs: v.docs,
    protocol: v.protocol,
  }));
}

function getConfig() { return loadConfig(); }

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === '--list') {
    console.log(JSON.stringify(listProviders(), null, 2));
  } else if (args[0] === '--test') {
    chat([
      { role: 'user', content: args[1] || '你好，请用一句话自我介绍。' }
    ]).then(t => {
      console.log('✅ AI 响应:');
      console.log(t);
    }).catch(e => {
      console.error('❌', e.message);
      process.exit(1);
    });
  } else if (args[0] === '--config') {
    const c = loadConfig();
    console.log(JSON.stringify(c, null, 2));
  } else if (args[0] === '--models') {
    listModels(args[1]).then(models => {
      console.log(JSON.stringify(models, null, 2));
    }).catch(e => {
      console.error('❌', e.message);
      process.exit(1);
    });
  } else {
    console.log(`
ai-provider.js — 统一 AI 模型调用

用法:
  node ai-provider.js --list                    # 列出所有支持的提供商
  node ai-provider.js --test "你的问题"          # 测试当前配置的 AI
  node ai-provider.js --config                  # 查看当前配置
  node ai-provider.js --models [provider]        # 获取模型列表
`);
  }
}

module.exports = { chat, chatJSON, listModels, listProviders, getConfig, PROVIDERS };
