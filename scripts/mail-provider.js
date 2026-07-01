#!/usr/bin/env node
/**
 * mail-provider.js — 统一邮件发送层
 *
 * 支持的邮件服务商（用 MAIL_PROVIDER 切换）：
 *   - qq          → QQ邮箱 SMTP (smtp.qq.com:465)
 *   - netease     → 网易163 SMTP (smtp.163.com:465/25)
 *   - netease-126 → 网易126 SMTP (smtp.126.com:465/25)
 *   - gmail       → Gmail SMTP (smtp.gmail.com:587)
 *   - outlook     → Outlook/Hotmail SMTP (smtp-mail.outlook.com:587)
 *   - yahoo       → Yahoo SMTP
 *   - aliyun      → 阿里云邮箱 (smtp.aliyun.com:465)
 *   - qq-enterprise → QQ企业邮箱 (smtp.exmail.qq.com:465)
 *   - custom-smtp → 自定义 SMTP 服务器
 *   - resend      → Resend API (resend.com，海外推荐)
 *   - sendgrid    → SendGrid API
 *   - mailgun     → Mailgun API
 *   - postmark    → Postmark API
 *   - graph       → Microsoft Graph API (企业 Office365)
 *
 * 用法：
 *   const mail = require('./mail-provider');
 *   await mail.send({ to, subject, html });
 *
 * 环境变量：
 *   MAIL_PROVIDER = qq
 *   MAIL_USER     = your@qq.com
 *   MAIL_PASS     = smtp_auth_code
 *   MAIL_FROM     = your@qq.com   (可选，默认用 MAIL_USER)
 *   MAIL_TO       = a@x.com,b@y.com   (可选，默认用 MAIL_USER)
 *   MAIL_API_KEY  = xxx          (Resend/SendGrid/Mailgun 等用)
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

try { require('dotenv').config(); } catch(e) {}

// 让 nodemailer 在 SMTP 模式下工作
let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch(e) {
  console.warn('⚠️  nodemailer 未安装，API 模式仍可用。运行: npm install nodemailer');
}

// ─────────────────────────────────────────────
//  各大邮箱预设
// ─────────────────────────────────────────────
const PROVIDERS = {
  qq: {
    name: 'QQ邮箱',
    type: 'smtp',
    host: 'smtp.qq.com',
    port: 465,
    secure: true,
    envUser: 'QQ_USER',
    envPass: 'QQ_AUTH_CODE',
    docs: 'https://service.mail.qq.com/detail/0/75',
    note: 'PASS 是授权码（在QQ邮箱→设置→账户→生成授权码），不是登录密码',
  },
  netease: {
    name: '网易163邮箱',
    type: 'smtp',
    host: 'smtp.163.com',
    port: 465,
    secure: true,
    envUser: 'NETEASE_USER',
    envPass: 'NETEASE_AUTH_CODE',
    docs: 'https://help.mail.163.com/faqDetail.do?code=d7a5dc8471cd0c0e8b4a8f4f0af206d2afeae6b0573a3e58',
    note: 'PASS 是授权码（设置→POP3/SMTP/IMAP→开启→客户端授权密码）',
  },
  'netease-126': {
    name: '网易126邮箱',
    type: 'smtp',
    host: 'smtp.126.com',
    port: 465,
    secure: true,
    envUser: 'NETEASE126_USER',
    envPass: 'NETEASE126_AUTH_CODE',
    docs: 'https://help.mail.163.com',
    note: 'PASS 是授权码',
  },
  'netease-yeah': {
    name: '网易yeah邮箱',
    type: 'smtp',
    host: 'smtp.yeah.net',
    port: 465,
    secure: true,
    envUser: 'YEAH_USER',
    envPass: 'YEAH_AUTH_CODE',
    docs: 'https://help.mail.163.com',
    note: 'PASS 是授权码',
  },
  gmail: {
    name: 'Gmail',
    type: 'smtp',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,  // Gmail 用 STARTTLS
    requireTLS: true,
    envUser: 'GMAIL_USER',
    envPass: 'GMAIL_APP_PASSWORD',
    docs: 'https://support.google.com/accounts/answer/185833',
    note: 'PASS 是应用专用密码（需开启两步验证后生成）',
  },
  outlook: {
    name: 'Outlook / Hotmail / Live',
    type: 'smtp',
    host: 'smtp-mail.outlook.com',
    port: 587,
    secure: false,
    requireTLS: true,
    envUser: 'OUTLOOK_USER',
    envPass: 'OUTLOOK_PASS',
    docs: 'https://support.microsoft.com/en-us/office/pop-imap-and-smtp-settings-for-outlook-com',
    note: 'PASS 是账户密码或应用密码',
  },
  yahoo: {
    name: 'Yahoo Mail',
    type: 'smtp',
    host: 'smtp.mail.yahoo.com',
    port: 587,
    secure: false,
    requireTLS: true,
    envUser: 'YAHOO_USER',
    envPass: 'YAHOO_APP_PASSWORD',
    docs: 'https://help.yahoo.com/kb/SLN15241',
    note: 'PASS 是应用专用密码',
  },
  aliyun: {
    name: '阿里云邮箱',
    type: 'smtp',
    host: 'smtp.aliyun.com',
    port: 465,
    secure: true,
    envUser: 'ALIYUN_MAIL_USER',
    envPass: 'ALIYUN_MAIL_PASS',
    docs: 'https://mail.aliyun.com',
    note: 'PASS 是登录密码或授权码',
  },
  'qq-enterprise': {
    name: 'QQ企业邮箱',
    type: 'smtp',
    host: 'smtp.exmail.qq.com',
    port: 465,
    secure: true,
    envUser: 'QQ_ENT_USER',
    envPass: 'QQ_ENT_PASS',
    docs: 'https://exmail.qq.com',
    note: 'PASS 是登录密码或客户端专用密码',
  },
  'custom-smtp': {
    name: '自定义 SMTP',
    type: 'smtp',
    host: '',  // 必须用 MAIL_SMTP_HOST 设置
    port: 465,
    secure: true,
    envUser: 'MAIL_USER',
    envPass: 'MAIL_PASS',
    docs: '任何支持 SMTP 的邮件服务器',
    note: '需额外设置 MAIL_SMTP_HOST 和可选 MAIL_SMTP_PORT/MAIL_SMTP_SECURE',
  },

  // ─── HTTP API 模式（无需 SMTP 端口，全球通用）───
  resend: {
    name: 'Resend',
    type: 'api',
    apiUrl: 'https://api.resend.com/emails',
    apiMethod: 'POST',
    envUser: null,
    envPass: 'RESEND_API_KEY',
    docs: 'https://resend.com/docs',
    note: '免费 3000 封/月，需在 resend.com 注册并验证发件域名',
  },
  sendgrid: {
    name: 'SendGrid',
    type: 'api',
    apiUrl: 'https://api.sendgrid.com/v3/mail/send',
    apiMethod: 'POST',
    envUser: null,
    envPass: 'SENDGRID_API_KEY',
    docs: 'https://docs.sendgrid.com',
    note: '免费 100 封/天',
  },
  mailgun: {
    name: 'Mailgun',
    type: 'api',
    apiUrl: 'https://api.mailgun.net/v3/{domain}/messages',
    apiMethod: 'POST',
    envUser: 'MAILGUN_USER',  // 通常是 'api'
    envPass: 'MAILGUN_API_KEY',
    envDomain: 'MAILGUN_DOMAIN',
    docs: 'https://documentation.mailgun.com',
    note: '免费 5000 封/月，需要验证域名',
  },
  postmark: {
    name: 'Postmark',
    type: 'api',
    apiUrl: 'https://api.postmarkapp.com/email',
    apiMethod: 'POST',
    envUser: null,
    envPass: 'POSTMARK_API_KEY',
    docs: 'https://postmarkapp.com/developer',
    note: '免费 100 封/月（测试邮箱无限制）',
  },
  graph: {
    name: 'Microsoft Graph (Office365)',
    type: 'api',
    apiUrl: 'https://graph.microsoft.com/v1.0/me/sendMail',
    apiMethod: 'POST',
    envUser: 'GRAPH_USER',
    envPass: 'GRAPH_ACCESS_TOKEN',
    docs: 'https://learn.microsoft.com/graph/api/user-sendmail',
    note: '需要 Azure AD 应用 + OAuth 令牌',
  },
};

// ─────────────────────────────────────────────
//  配置加载
// ─────────────────────────────────────────────
function loadConfig() {
  const providerKey = (process.env.MAIL_PROVIDER || 'qq').toLowerCase();
  const provider = PROVIDERS[providerKey];

  if (!provider) {
    throw new Error(
      `❌ 不支持的邮件提供商: "${providerKey}"\n` +
      `支持: ${Object.keys(PROVIDERS).join(', ')}`
    );
  }

  // 1. 优先用通用变量
  const user = process.env.MAIL_USER
               || process.env.EMAIL_FROM
               || (provider.envUser ? process.env[provider.envUser] : null);

  const pass = process.env.MAIL_PASS
               || process.env.MAIL_API_KEY
               || process.env.EMAIL_PASS
               || (provider.envPass ? process.env[provider.envPass] : null);

  if (!pass) {
    throw new Error(
      `❌ 未配置邮件凭证。\n` +
      `请设置 MAIL_PASS 或 ${provider.envPass}\n` +
      `${provider.note}\n` +
      `获取: ${provider.docs}`
    );
  }

  if (provider.type === 'smtp' && !user) {
    throw new Error(
      `❌ 未配置发件邮箱。\n` +
      `请设置 MAIL_USER 或 ${provider.envUser}`
    );
  }

  // SMTP 特定配置
  const config = {
    provider: providerKey,
    providerName: provider.name,
    type: provider.type,
    user,
    pass,
    from: process.env.MAIL_FROM || user || 'noreply@example.com',
    to: process.env.MAIL_TO || user,
  };

  if (provider.type === 'smtp') {
    config.host = process.env.MAIL_SMTP_HOST || provider.host;
    config.port = parseInt(process.env.MAIL_SMTP_PORT) || provider.port;
    config.secure = process.env.MAIL_SMTP_SECURE !== undefined
                    ? process.env.MAIL_SMTP_SECURE === 'true'
                    : provider.secure;
    if (provider.requireTLS) config.requireTLS = true;
  } else if (provider.type === 'api') {
    let url = provider.apiUrl;
    if (provider.envDomain) {
      const domain = process.env[provider.envDomain];
      if (!domain) {
        throw new Error(`❌ ${provider.name} 需要设置 ${provider.envDomain}`);
      }
      url = url.replace('{domain}', domain);
    }
    config.apiUrl = url;
  }

  return config;
}

// ─────────────────────────────────────────────
//  HTTP 工具
// ─────────────────────────────────────────────
function httpJSON(url, method, headers, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'http:' ? http : https;
    const data = body ? JSON.stringify(body) : null;

    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'http:' ? 80 : 443),
      path: parsed.pathname + parsed.search,
      method,
      headers: { ...headers, ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) },
    }, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(buf ? JSON.parse(buf) : {}); }
          catch (e) { resolve(buf); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${buf.slice(0, 500)}`));
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ─────────────────────────────────────────────
//  SMTP 发送
// ─────────────────────────────────────────────
async function sendViaSMTP(cfg, mail) {
  if (!nodemailer) {
    throw new Error('SMTP 模式需要 nodemailer：npm install nodemailer');
  }

  const transportOpts = {
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  };
  if (cfg.requireTLS) transportOpts.requireTLS = true;

  console.log(`📮 [SMTP] 连接 ${cfg.providerName} ${cfg.host}:${cfg.port}`);
  const transporter = nodemailer.createTransport(transportOpts);
  await transporter.verify();

  const info = await transporter.sendMail({
    from: `"${mail.fromName || 'LumaPost 光影邮报'}" <${cfg.from}>`,
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });

  console.log(`✅ 邮件已发送，Message ID: ${info.messageId}`);
  return { provider: cfg.provider, type: 'smtp', messageId: info.messageId, to: mail.to };
}

// ─────────────────────────────────────────────
//  Resend API
// ─────────────────────────────────────────────
async function sendViaResend(cfg, mail) {
  const res = await httpJSON(
    cfg.apiUrl,
    'POST',
    { 'Authorization': `Bearer ${cfg.pass}`, 'Content-Type': 'application/json' },
    { from: cfg.from, to: mail.to.split(',').map(s => s.trim()), subject: mail.subject, html: mail.html }
  );
  return { provider: cfg.provider, type: 'api', id: res.id, to: mail.to };
}

// ─────────────────────────────────────────────
//  SendGrid API
// ─────────────────────────────────────────────
async function sendViaSendGrid(cfg, mail) {
  const res = await httpJSON(
    cfg.apiUrl,
    'POST',
    { 'Authorization': `Bearer ${cfg.pass}`, 'Content-Type': 'application/json' },
    {
      personalizations: [{ to: mail.to.split(',').map(s => ({ email: s.trim() })) }],
      from: { email: cfg.from },
      subject: mail.subject,
      content: [{ type: 'text/html', value: mail.html }],
    }
  );
  return { provider: cfg.provider, type: 'api', to: mail.to };
}

// ─────────────────────────────────────────────
//  Mailgun API（支持 form-data）
// ─────────────────────────────────────────────
async function sendViaMailgun(cfg, mail) {
  const parsed = new URL(cfg.apiUrl);
  const formData = new URLSearchParams();
  formData.append('from', cfg.from);
  formData.append('subject', mail.subject);
  formData.append('html', mail.html);
  mail.to.split(',').forEach(t => formData.append('to', t.trim()));

  const auth = Buffer.from(`api:${cfg.pass}`).toString('base64');
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(formData.toString()),
      },
    }, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        if (res.statusCode < 300) resolve(JSON.parse(buf || '{}'));
        else reject(new Error(`HTTP ${res.statusCode}: ${buf}`));
      });
    });
    req.on('error', reject);
    req.write(formData.toString());
    req.end();
  });
}

// ─────────────────────────────────────────────
//  Postmark API
// ─────────────────────────────────────────────
async function sendViaPostmark(cfg, mail) {
  const res = await httpJSON(
    cfg.apiUrl,
    'POST',
    { 'X-Postmark-Server-Token': cfg.pass, 'Accept': 'application/json', 'Content-Type': 'application/json' },
    {
      From: cfg.from,
      To: mail.to,
      Subject: mail.subject,
      HtmlBody: mail.html,
      TextBody: mail.text || '',
      MessageStream: 'outbound',
    }
  );
  return { provider: cfg.provider, type: 'api', messageId: res.MessageID, to: mail.to };
}

// ─────────────────────────────────────────────
//  Microsoft Graph API
// ─────────────────────────────────────────────
async function sendViaGraph(cfg, mail) {
  const res = await httpJSON(
    cfg.apiUrl,
    'POST',
    { 'Authorization': `Bearer ${cfg.pass}`, 'Content-Type': 'application/json' },
    {
      message: {
        subject: mail.subject,
        body: { contentType: 'HTML', content: mail.html },
        from: { emailAddress: { address: cfg.from } },
        toRecipients: mail.to.split(',').map(t => ({ emailAddress: { address: t.trim() } })),
      },
      saveToSentItems: false,
    }
  );
  return { provider: cfg.provider, type: 'api', to: mail.to };
}

// ─────────────────────────────────────────────
//  统一发送入口
// ─────────────────────────────────────────────
async function send(mail) {
  if (!mail || !mail.subject || !mail.html) {
    throw new Error('❌ 缺少必填字段: subject, html');
  }
  if (!mail.to) {
    const cfg0 = loadConfig();
    mail.to = cfg0.to;
  }

  const cfg = loadConfig();
  mail.to = mail.to || cfg.to;

  console.log(`📧 准备发送邮件`);
  console.log(`   服务商: ${cfg.providerName} (${cfg.type})`);
  console.log(`   发件人: ${cfg.from}`);
  console.log(`   收件人: ${mail.to}`);
  console.log(`   主题: ${mail.subject}`);

  switch (cfg.type) {
    case 'smtp': return sendViaSMTP(cfg, mail);
    case 'api':
      switch (cfg.provider) {
        case 'resend':   return sendViaResend(cfg, mail);
        case 'sendgrid': return sendViaSendGrid(cfg, mail);
        case 'mailgun':  return sendViaMailgun(cfg, mail);
        case 'postmark': return sendViaPostmark(cfg, mail);
        case 'graph':    return sendViaGraph(cfg, mail);
        default: throw new Error(`API 提供商未实现: ${cfg.provider}`);
      }
    default: throw new Error(`未知类型: ${cfg.type}`);
  }
}

// ─────────────────────────────────────────────
//  工具方法
// ─────────────────────────────────────────────
function listProviders() {
  return Object.entries(PROVIDERS).map(([k, v]) => ({
    key: k,
    name: v.name,
    type: v.type,
    envUser: v.envUser,
    envPass: v.envPass,
    docs: v.docs,
    note: v.note,
  }));
}

function getConfig() { return loadConfig(); }

// ─────────────────────────────────────────────
//  CLI 入口
// ─────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === '--list') {
    console.log(JSON.stringify(listProviders(), null, 2));
  } else if (args[0] === '--test') {
    send({
      to: process.env.MAIL_TO || process.env.MAIL_USER,
      subject: '🧪 LumaPost 测试邮件',
      html: '<h1>测试成功！</h1><p>如果你收到这封邮件，说明 LumaPost 邮件通道配置正确 ✅</p>',
    }).then(r => {
      console.log('✅ 发送成功:', r);
      process.exit(0);
    }).catch(e => {
      console.error('❌ 发送失败:', e.message);
      process.exit(1);
    });
  } else if (args[0] === '--config') {
    console.log(JSON.stringify(loadConfig(), null, 2));
  } else if (args[0] === '--send') {
    // --send --to=x@y.com --subject=xxx --body-file=path
    const opts = {};
    for (let i = 1; i < args.length; i++) {
      const [k, v] = args[i].slice(2).split('=');
      opts[k] = v || true;
    }
    const fs = require('fs');
    if (opts['body-file'] && fs.existsSync(opts['body-file'])) {
      opts.html = fs.readFileSync(opts['body-file'], 'utf8');
    }
    send(opts).then(r => {
      console.log('✅', r);
      process.exit(0);
    }).catch(e => {
      console.error('❌', e.message);
      process.exit(1);
    });
  } else {
    console.log(`
mail-provider.js — 统一邮件发送层

用法:
  node mail-provider.js --list                          列出所有支持的邮件服务
  node mail-provider.js --test                          给自己的邮箱发测试邮件
  node mail-provider.js --config                        查看当前邮件配置
  node mail-provider.js --send --to=x@y.com --subject=hi --body-file=mail.html
`);
  }
}

module.exports = { send, listProviders, getConfig, PROVIDERS };
