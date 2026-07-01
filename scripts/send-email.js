#!/usr/bin/env node
/**
 * send-email.js - 邮件发送脚本
 * 
 * 功能：通过SMTP发送HTML邮件
 * 输入：HTML文件或HTML字符串
 * 
 * 使用方法：
 *   node scripts/send-email.js --to=<收件人> --subject=<主题> --body-file=<HTML文件>
 * 
 * 示例：
 *   node scripts/send-email.js --to=test@example.com --subject="测试邮件" --body-file=/tmp/email.html
 */

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// 加载 .env 文件（如果存在）
try { require('dotenv').config(); } catch(e) {}

// ============ 配置区域 ============
function loadConfig() {
  // 从环境变量读取配置
  const config = {
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.qq.com',
      port: parseInt(process.env.SMTP_PORT) || 465,
      secure: process.env.SMTP_SECURE !== 'false',  // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS  // SMTP授权码，不是邮箱密码！
      }
    },
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to: process.env.EMAIL_TO,
    subject: '✨ LumaPost · 光影邮报'
  };

  // 验证必填配置
  if (!config.smtp.auth.user || !config.smtp.auth.pass) {
    throw new Error('❌ 错误：未配置SMTP_USER或SMTP_PASS，请在.env文件中配置');
  }

  return config;
}

// ============ 解析命令行参数 ============
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    to: null,
    subject: null,
    bodyFile: null,
    body: null,
    from: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg === '--to' || arg === '-t') && args[i + 1]) {
      options.to = args[++i];
    } else if ((arg === '--subject' || arg === '-s') && args[i + 1]) {
      options.subject = args[++i];
    } else if ((arg === '--body-file' || arg === '-f') && args[i + 1]) {
      options.bodyFile = args[++i];
    } else if ((arg === '--body' || arg === '-b') && args[i + 1]) {
      options.body = args[++i];
    } else if ((arg === '--from' || arg === '-f') && args[i + 1]) {
      options.from = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  // 验证必填参数
  if (!options.to || !(options.bodyFile || options.body)) {
    console.error('❌ 错误：缺少必填参数');
    printHelp();
    process.exit(1);
  }

  return options;
}

function printHelp() {
  console.log(`
使用方法：
  node scripts/send-email.js --to=<收件人> --subject=<主题> --body-file=<HTML文件>

必填参数：
  --to, -t              收件人邮箱
  --subject, -s          邮件主题
  --body-file, -f        HTML内容文件

可选参数：
  --body, -b            HTML内容字符串（与--body-file二选一）
  --from, -f            发件人邮箱（默认使用.env中的EMAIL_FROM）
  --help, -h             显示帮助信息

示例：
  node scripts/send-email.js --to=test@example.com --subject="测试" --body-file=/tmp/email.html
  node scripts/send-email.js -t test@example.com -s "测试" -f /tmp/email.html
  `);
}

// ============ 创建SMTP传输器 ============
function createTransporter(config) {
  console.log(`📮 正在连接SMTP服务器: ${config.smtp.host}:${config.smtp.port}`);
  
  const transporter = nodemailer.createTransport(config.smtp);

  // 验证SMTP连接
  return new Promise((resolve, reject) => {
    transporter.verify((error, success) => {
      if (error) {
        console.error('❌ SMTP连接失败:', error.message);
        reject(error);
      } else {
        console.log('✅ SMTP连接成功');
        resolve(transporter);
      }
    });
  });
}

// ============ 发送邮件 ============
async function sendEmail(config, options) {
  // 读取HTML内容
  let htmlContent = options.body;
  if (options.bodyFile) {
    if (!fs.existsSync(options.bodyFile)) {
      throw new Error(`HTML文件不存在: ${options.bodyFile}`);
    }
    htmlContent = fs.readFileSync(options.bodyFile, 'utf8');
    console.log(`📂 已读取HTML文件: ${options.bodyFile} (${(fs.statSync(options.bodyFile).size / 1024).toFixed(2)} KB)`);
  }

  // 邮件选项
  const mailOptions = {
    from: options.from || config.from,
    to: options.to,
    subject: options.subject,
    html: htmlContent
  };

  console.log(`📧 正在发送邮件...`);
  console.log(`   发件人: ${mailOptions.from}`);
  console.log(`   收件人: ${mailOptions.to}`);
  console.log(`   主题: ${mailOptions.subject}`);
  console.log(`   HTML大小: ${(htmlContent.length / 1024).toFixed(2)} KB\n`);

  // 创建传输器
  const transporter = await createTransporter(config);

  // 发送邮件
  const info = await transporter.sendMail(mailOptions);

  console.log(`\n✨ 邮件发送成功！`);
  console.log(`   Message ID: ${info.messageId}`);
  console.log(`   ✅ 已发送至: ${options.to}`);
  
  return info;
}

// ============ 主函数 ============
async function main() {
  console.log('🚀 开始发送邮件...\n');

  // 加载配置
  const config = loadConfig();

  // 解析命令行参数
  const options = parseArgs();

  // 发送邮件
  try {
    const info = await sendEmail(config, options);
    console.log('\n✅ 完成！');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ 邮件发送失败:', err.message);
    process.exit(1);
  }
}

// ============ 执行 ============
main();
