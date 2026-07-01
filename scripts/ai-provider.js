#!/usr/bin/env node
/**
 * ai-provider.js — 统一 AI 模型调用层
 *
 * 作用：屏蔽不同 AI 提供商的 API 差异，用同一套接口调用任何 LLM。
 *
 * 支持的提供商（在 .env 用 AI_PROVIDER 指定）：
 *   - deepseek       → DeepSeek (推荐，¥1/百万 token)
 *   - minimax        → MiniMax (官方模型)
 *   - openai         → OpenAI (GPT-4o, GPT-5)
 *   - anthropic      → Claude (Sonnet, Opus)
 *   - google         → Google Gemini
 *   - qwen           → 阿里通义千问
 *   - zhipu          → 智谱 GLM-4
 *   - doubao         → 字节豆包
 *   - kimi           → 月之暗面 Kimi
 *   - moonshot       → Moonshot
 *   - custom         → 自定义 OpenAI 兼容协议
 *
 * 用法（在其他脚本里）：
 *   const ai = require('./ai-provider');
 *   const text = await ai.chat([
 *     { role: 'system', content: '你是新闻编辑' },
 *     { role: 'user',   content: '总结今天的新闻' }
 *   ]);
 *
 * 环境变量（在 .env / GitHub Secrets 设置）：
 *   AI_PROVIDER  = deepseek             # 选哪家
 *   AI_API_KEY   = sk-xxx               # 你的 API Key
 *   AI_MODEL     = deepseek-chat        # 模型名（可选，有默认值）
 *   AI_BASE_URL  = https://api.deepseek.com  # 自定义 base URL（可选）
 *   AI_TIMEOUT   = 60000                # 超时（毫秒，可选）
 *   AI_MAX_TOKENS= 4096                 # 单次最大输出（可选）
 *   AI_TEMP      = 0.7                  # 创造性（0-1，可选）
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

try { require('dotenv').config(); } catch(e) {}

// ─────────────────────────────────────────────
//  各大提供商的预设（base URL + 默认模型）
// ─────────────────────────────────────────────
const PROVIDERS = {
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    envKey: 'DEEPSEEK_API_KEY',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    docs: 'https://platform.deepseek.com',
  },
  minimax: {
    name: 'MiniMax',
    baseUrl: 'https://api.minimax.chat/v1',
    defaultModel: 'MiniMax-Text-01',
    envKey: 'MiniMax_API_KEY',
    models: ['MiniMax-Text-01', 'MiniMax-Text-01-250515', 'abab6.5s-chat'],
    docs: 'https://api.minimax.chat',
  },
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    envKey: 'OPENAI_API_KEY',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    docs: 'https://platform.openai.com',
  },
  anthropic: {
    name: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-sonnet-20241022',
    envKey: 'ANTHROPIC_API_KEY',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    docs: 'https://console.anthropic.com',
    useAnthropicFormat: true,  // Anthropic 用自己的协议
  },
  google: {
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-1.5-flash',
    envKey: 'GOOGLE_API_KEY',
    models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-exp'],
    docs: 'https://aistudio.google.com',
    useGoogleFormat: true,
  },
  qwen: {
    name: '阿里通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    envKey: 'QWEN_API_KEY',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen-long'],
    docs: 'https://dashscope.console.aliyun.com',
  },
  zhipu: {
    name: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-plus',
    envKey: 'ZHIPU_API_KEY',
    models: ['glm-4-plus', 'glm-4-air', 'glm-4-flash'],
    docs: 'https://open.bigmodel.cn',
  },
  doubao: {
    name: '字节豆包',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: 'doubao-pro-32k',
    envKey: 'DOUBAO_API_KEY',
    models: ['doubao-pro-32k', 'doubao-lite-32k', 'doubao-pro-128k'],
    docs: 'https://www.volcengine.com/product/doubao',
  },
  kimi: {
    name: '月之暗面 Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-32k',
    envKey: 'KIMI_API_KEY',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    docs: 'https://platform.moonshot.cn',
  },
  moonshot: {
    name: 'Moonshot',
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-32k',
    envKey: 'MOONSHOT_API_KEY',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    docs: 'https://platform.moonshot.cn',
  },
  custom: {
    name: '自定义 OpenAI 兼容',
    baseUrl: '',  // 必须自己填
    defaultModel: '',
    envKey: 'CUSTOM_API_KEY',
    models: [],
    docs: '任何兼容 OpenAI Chat Completions 的服务',
  },
};

// ─────────────────────────────────────────────
//  配置加载：智能识别 API Key
// ─────────────────────────────────────────────
function loadConfig() {
  const providerKey = (process.env.AI_PROVIDER || 'deepseek').toLowerCase();
  const provider = PROVIDERS[providerKey];

  if (!provider) {
    throw new Error(
      `❌ 不支持的 AI 提供商: "${providerKey}"\n` +
      `支持: ${Object.keys(PROVIDERS).join(', ')}`
    );
  }

  // 1. 优先用 AI_API_KEY（通用），没有则用提供商专用 env
  const apiKey = process.env.AI_API_KEY
                 || process.env[provider.envKey]
                 || process.env[providerKey.toUpperCase() + '_API_KEY'];

  if (!apiKey) {
    throw new Error(
      `❌ 未配置 API Key。\n` +
      `请在 .env / GitHub Secrets 设置 AI_API_KEY 或 ${provider.envKey}\n` +
      `获取: ${provider.docs}`
    );
  }

  return {
    provider: providerKey,
    providerName: provider.name,
    apiKey,
    baseUrl: (process.env.AI_BASE_URL || provider.baseUrl).replace(/\/+$/, ''),
    model: process.env.AI_MODEL || provider.defaultModel,
    timeout: parseInt(process.env.AI_TIMEOUT) || 60000,
    maxTokens: parseInt(process.env.AI_MAX_TOKENS) || 4096,
    temperature: parseFloat(process.env.AI_TEMP) || 0.7,
    useAnthropicFormat: provider.useAnthropicFormat,
    useGoogleFormat: provider.useGoogleFormat,
  };
}

// ─────────────────────────────────────────────
//  HTTP 请求（不依赖第三方库）
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
//  核心：对话接口
// ─────────────────────────────────────────────
async function chat(messages, options = {}) {
  const cfg = loadConfig();
  const model = options.model || cfg.model;
  const maxTokens = options.maxTokens || cfg.maxTokens;
  const temperature = options.temperature !== undefined ? options.temperature : cfg.temperature;
  const timeout = options.timeout || cfg.timeout;

  let url, body, headers;

  if (cfg.useAnthropicFormat) {
    // Anthropic 协议
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
  } else if (cfg.useGoogleFormat) {
    // Google Gemini 协议
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
  } else {
    // OpenAI 兼容协议（DeepSeek/MiniMax/OpenAI/通义/智谱/豆包/Kimi/Moonshot/Custom）
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
  }

  try {
    const res = await httpRequest(url, { method: 'POST', headers, timeout }, body);

    // 统一解析不同格式
    if (cfg.useAnthropicFormat) {
      return res.content?.[0]?.text || '';
    } else if (cfg.useGoogleFormat) {
      return res.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      return res.choices?.[0]?.message?.content || '';
    }
  } catch (err) {
    throw new Error(`[${cfg.providerName}/${model}] 调用失败: ${err.message}`);
  }
}

// ─────────────────────────────────────────────
//  JSON 模式：让 AI 返回结构化数据
// ─────────────────────────────────────────────
async function chatJSON(messages, options = {}) {
  const cfg = loadConfig();
  const enhanced = [
    ...messages,
    {
      role: 'user',
      content: (messages[messages.length - 1]?.content || '') +
               '\n\n【严格规则】只返回合法 JSON，不要任何解释、不要 markdown 代码块标记。'
    }
  ];

  const text = await chat(enhanced, options);
  // 尝试提取 JSON
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); }
    catch (e) { /* fall through */ }
  }
  try { return JSON.parse(text); }
  catch (e) {
    throw new Error(`AI 返回非 JSON: ${text.slice(0, 200)}`);
  }
}

// ─────────────────────────────────────────────
//  工具方法
// ─────────────────────────────────────────────
function listProviders() {
  return Object.entries(PROVIDERS).map(([k, v]) => ({
    key: k,
    name: v.name,
    envKey: v.envKey,
    defaultModel: v.defaultModel,
    models: v.models,
    docs: v.docs,
  }));
}

function getConfig() { return loadConfig(); }

// ─────────────────────────────────────────────
//  CLI 测试入口
// ─────────────────────────────────────────────
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
  } else {
    console.log(`
ai-provider.js — 统一 AI 模型调用

用法:
  node ai-provider.js --list                    # 列出所有支持的提供商
  node ai-provider.js --test "你的问题"          # 测试当前配置的 AI
  node ai-provider.js --config                  # 查看当前配置
`);
  }
}

module.exports = { chat, chatJSON, listProviders, getConfig, PROVIDERS };
