const nodemailer = require('nodemailer');

const USER = '29734646422@qq.com';
const PASS = 'vgmxtnrbcxvcddga';

(async () => {
  const t = nodemailer.createTransport({
    host: 'smtp.qq.com',
    port: 465,
    secure: true,
    auth: { user: USER, pass: PASS },
  });

  // 劫持 _sendCommand，拦截真正要发出的字节
  const origSend = t.transporter.smtp._sendCommand.bind(t.transporter.smtp);
  t.transporter.smtp._sendCommand = function (command, logCommand) {
    let real = command;
    let shown = logCommand || command;

    if (typeof command === 'string' && command.indexOf('AUTH PLAIN ') === 0) {
      const b64 = command.slice('AUTH PLAIN '.length);
      const decoded = Buffer.from(b64, 'base64').toString('utf-8');
      const parts = decoded.split('\u0000');
      console.log('\n>>> 拦截 AUTH PLAIN');
      console.log('    base64   :', b64);
      console.log('    解码     :', JSON.stringify(decoded));
      console.log('    user     :', JSON.stringify(parts[1]));
      console.log('    pass     :', JSON.stringify(parts[2]));
      console.log('    pass 长度:', parts[2] ? parts[2].length : 0);
      console.log('    与配置一致:', parts[2] === PASS);
    }
    return origSend(real, shown);
  };

  try {
    await t.verify();
    console.log('\nverify 成功');
  } catch (e) {
    console.log('\nverify 失败:', e.responseCode, e.message.slice(0, 60));
  }
  process.exit(0);
})();