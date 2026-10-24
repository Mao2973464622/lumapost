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
  // ─── 国内邮件推送服务 ───
  'aliyun-dm': {
    name: '阿里云邮件推送 (DirectMail)',
    type: 'api',
    apiUrl: 'https://dm.aliyuncs.com/',
    apiMethod: 'POST',
    envUser: 'ALIYUN_DM_USER',
    envPass: 'ALIYUN_DM_PASS',
    envRegion: 'ALIYUN_DM_REGION',
    docs: 'https://help.aliyun.com/document_detail/29434.html',
    note: '需开通邮件推送服务，配置发件域名和发件地址',
    envAccessKey: 'ALIYUN_ACCESS_KEY',
    envAccessSecret: 'ALIYUN_ACCESS_SECRET',
  },
  'qcloud-ses': {
    name: '腾讯云 SES',
    type: 'api',
    apiUrl: 'https://ses.tencentcloudapi.com/',
    apiMethod: 'POST',
    envUser: 'QCLOUD_SES_USER',
    envPass: 'QCLOUD_SES_PASS',
    envRegion: 'QCLOUD_SES_REGION',
    docs: 'https://cloud.tencent.com/document/product/1283',
    note: '需开通 SES 服务，配置发件域名',
    envSecretId: 'QCLOUD_SECRET_ID',
    envSecretKey: 'QCLOUD_SECRET_KEY',
  },
  mailjet: {
    name: 'Mailjet',
    type: 'api',
    apiUrl: 'https://api.mailjet.com/v3.1/send',
    apiMethod: 'POST',
    envUser: 'MAILJET_USER',
    envPass: 'MAILJET_PASS',
    docs: 'https://dev.mailjet.com/email/guides/send-api-v31/',
    note: '免费 200 封/月，用户名为 API Key，密码为 Secret Key',
  },
};

// ─────────────────────────────────────────────
//  配置加载（配置文件优先，环境变量兜底）
// ─────────────────────────────────────────────
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
  const mailCfg = fileCfg.mail || {};

  const providerKey = String(
    process.env.MAIL_PROVIDER || mailCfg.provider || 'qq'
  ).toLowerCase();
  const provider = PROVIDERS[providerKey];

  if (!provider) {
    throw new Error(
      '不支持的邮件提供商: "' + providerKey + '"\n支持: ' + Object.keys(PROVIDERS).join(', ')
    );
  }

  let user = mailCfg.user
    || process.env.MAIL_USER
    || process.env.EMAIL_FROM
    || (provider.envUser ? process.env[provider.envUser] : null);

  const pass = mailCfg.pass
    || process.env.MAIL_PASS
    || process.env.MAIL_API_KEY
    || process.env.EMAIL_PASS
    || (provider.envPass ? process.env[provider.envPass] : null);

  if (providerKey === 'mailjet') {
    user = mailCfg.user || process.env.MAILJET_USER || process.env.MAIL_USER || process.env.MAIL_API_KEY;
  }

  if (!pass) {
    throw new Error(
      '未配置邮件凭证。请在 Web UI 配置页填写，或设置 MAIL_PASS。\n' +
      (provider.note || '') + '\n获取: ' + provider.docs
    );
  }
  if (provider.type === 'smtp' && !user) {
    throw new Error('未配置发件邮箱。请在 Web UI 配置页填写。');
  }

  const config = {
    provider: providerKey,
    providerName: provider.name,
    type: provider.type,
    user: user,
    pass: pass,
    from: mailCfg.from || process.env.MAIL_FROM || user || 'noreply@example.com',
    to: mailCfg.to || process.env.MAIL_TO || user,
  };

  if (provider.type === 'smtp') {
    config.host = mailCfg.smtpHost || process.env.MAIL_SMTP_HOST || provider.host;
    config.port = Number(mailCfg.smtpPort) || parseInt(process.env.MAIL_SMTP_PORT) || provider.port;
    config.secure = mailCfg.smtpSecure !== undefined
      ? !!mailCfg.smtpSecure
      : (process.env.MAIL_SMTP_SECURE !== undefined
        ? process.env.MAIL_SMTP_SECURE === 'true'
        : provider.secure);
    if (provider.requireTLS) config.requireTLS = true;

    // 兜底：非 465 端口一律要求 STARTTLS，否则 QQ/163 等服务器会返回 530
    if (config.secure === false && config.port !== 465) {
      config.requireTLS = true;
    }
    // 465 是「隐式 TLS」，必须 secure=true
    if (config.port === 465 && config.secure === false) {
      config.secure = true;
    }

    if (!config.host) {
      throw new Error('邮件提供商 "' + providerKey + '" 缺少 SMTP 服务器地址。');
    }
  } else if (provider.type === 'api') {
    let url = provider.apiUrl;
    if (provider.envDomain) {
      const domain = mailCfg.smtpHost || process.env[provider.envDomain];
      if (!domain) throw new Error(provider.name + ' 需要设置域名 (' + provider.envDomain + ')');
      url = url.replace('{domain}', domain);
    }
    config.apiUrl = url;
  }

  return config;
}

// ─────────────────────────────────────────────
//  HTTP 工具
// ─────────────────────────────────────────────
function httpJSON(url, method, headers, body, timeoutMs = 30000) {
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
      timeout: timeoutMs,
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
    req.on('timeout', () => { req.destroy(); reject(new Error('邮件 API 请求超时')); });
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
        if (res.statusCode < 300) {
          try { resolve(JSON.parse(buf || '{}')); }
          catch (e) { resolve({ raw: buf }); }
        }
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
//  Mailjet API
// ─────────────────────────────────────────────
async function sendViaMailjet(cfg, mail) {
  const auth = Buffer.from(`${cfg.user}:${cfg.pass}`).toString('base64');
  const res = await httpJSON(
    cfg.apiUrl,
    'POST',
    { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
    {
      Messages: [{
        From: { Email: cfg.from },
        To: mail.to.split(',').map(t => ({ Email: t.trim() })),
        Subject: mail.subject,
        HTMLPart: mail.html,
        TextPart: mail.text || '',
      }]
    }
  );
  return { provider: cfg.provider, type: 'api', to: mail.to };
}

// ─────────────────────────────────────────────
//  阿里云邮件推送 API (简化版，实际需要签名)
// ─────────────────────────────────────────────
async function sendViaAliyunDM(cfg, mail) {
  const region = process.env.ALIYUN_DM_REGION || 'cn-hangzhou';
  const action = 'SingleSendMail';
  const params = {
    Action: action,
   AccountName: process.env.ALIYUN_DM_ACCOUNT || cfg.from,
    ReplyToAddress: 'false',
    AddressType: '1',
    ToAddress: mail.to.split(',').map(s => s.trim()).join(','),
    FromAlias: 'LumaPost',
    Subject: mail.subject,
    HtmlBody: mail.html,
    RegionId: region,
    Version: '2015-11-23',
  };
  // 简化版：实际需要 HMAC-SHA1 签名
  const url = `https://dm.${region}.aliyuncs.com/?${new URLSearchParams(params).toString()}`;
  const res = await httpJSON(url, 'POST', { 'Content-Type': 'application/x-www-form-urlencoded' }, null, 30000);
  return { provider: cfg.provider, type: 'api', to: mail.to };
}

// ─────────────────────────────────────────────
//  腾讯云 SES API (简化版，实际需要 TC3-HMAC-SHA256 签名)
// ─────────────────────────────────────────────
async function sendViaQcloudSES(cfg, mail) {
  const region = process.env.QCLOUD_SES_REGION || 'ap-guangzhou';
  const params = {
    FromEmailAddress: cfg.from,
    ToAddresses: mail.to.split(',').map(s => s.trim()),
    Subject: mail.subject,
    HtmlBody: mail.html,
  };
  const res = await httpJSON(
    cfg.apiUrl,
    'POST',
    {
      'Content-Type': 'application/json; charset=utf-8',
      'X-TC-Action': 'SendEmail',
      'X-TC-Version': '2020-10-02',
      'X-TC-Region': region,
    },
    params,
    30000
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

  const cfg = loadConfig();
  if (!mail.to) {
    mail.to = cfg.to;
  }

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
        case 'mailjet':  return sendViaMailjet(cfg, mail);
        case 'aliyun-dm': return sendViaAliyunDM(cfg, mail);
        case 'qcloud-ses': return sendViaQcloudSES(cfg, mail);
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
      const raw = args[i];
      if (raw.startsWith('--')) {
        const eqIdx = raw.indexOf('=');
        if (eqIdx > 0) {
          const k = raw.slice(2, eqIdx);
          const v = raw.slice(eqIdx + 1);
          opts[k] = v;
        }
      }
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
