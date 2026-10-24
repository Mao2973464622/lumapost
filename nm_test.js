const nodemailer = require('nodemailer');

// 直接构造，绕过项目代码，看 nodemailer 到底发了什么
const USER = '29734646422@qq.com';
const PASS = 'vgmxtnrbcxvcddga';

console.log('期望的 AUTH PLAIN:');
console.log('  base64 =', Buffer.from('\u0000' + USER + '\u0000' + PASS).toString('base64'));
console.log('  预期解码 = \\0' + USER + '\\0' + PASS);

(async () => {
  const t = nodemailer.createTransport({
    host: 'smtp.qq.com',
    port: 465,
    secure: true,
    auth: { user: USER, pass: PASS },
    logger: true,
    debug: true,
  });
  try {
    await t.verify();
    console.log('verify OK');
  } catch (e) {
    console.log('verify 失败:', e.responseCode);
  }
  process.exit(0);
})();