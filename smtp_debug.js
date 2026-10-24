/**
 * 深度诊断：把 nodemailer 实际发出的每一个字节都抓出来
 */
const nodemailer = require('nodemailer');
const store = require('/tmp/lumapost/scripts/config-store');

const c = store.getAll().mail;
console.log('=== 配置值 ===');
console.log('user      :', JSON.stringify(c.user));
console.log('pass      :', JSON.stringify(c.pass));
console.log('pass 长度 :', c.pass.length);
console.log('pass 字符码:', [...c.pass].map((ch) => ch.charCodeAt(0)).join(','));
console.log('provider  :', c.provider);
console.log('smtpHost  :', JSON.stringify(c.smtpHost));
console.log('smtpPort  :', c.smtpPort);

(async () => {
  console.log('\n=== 构造 transporter ===');
  const opt = {
    host: 'smtp.qq.com',
    port: 465,
    secure: true,
    auth: { user: c.user, pass: c.pass },
    logger: true,
    debug: true,
  };
  console.log('options:', JSON.stringify({ host: opt.host, port: opt.port, secure: opt.secure, authUser: opt.auth.user, authPassLen: opt.auth.pass.length }));

  const t = nodemailer.createTransport(opt);

  try {
    console.log('\n=== verify() ===');
    const ok = await t.verify();
    console.log('verify 结果:', ok);
  } catch (e) {
    console.log('verify 失败:', e.message);
    console.log('错误码:', e.code, '响应码:', e.responseCode, '命令:', e.command);
  }

  try {
    console.log('\n=== sendMail() ===');
    const r = await t.sendMail({
      from: c.user,
      to: c.user,
      subject: 'LumaPost 诊断测试',
      text: '如果收到这封邮件，说明配置正确。',
    });
    console.log('发送成功:', r.messageId, '| 服务器响应:', r.response);
  } catch (e) {
    console.log('发送失败:', e.message.slice(0, 200));
    console.log('错误码:', e.code, '| 响应码:', e.responseCode, '| 命令:', e.command);
  }

  process.exit(0);
})();