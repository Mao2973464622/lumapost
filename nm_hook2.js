const SMTPConnection = require('nodemailer/lib/smtp-connection');
const USER = '29734646422@qq.com';
const PASS = 'vgmxtnrbcxvcddga';

// 直接劫持原型方法，捕获所有实例
const orig = SMTPConnection.prototype._sendCommand;
SMTPConnection.prototype._sendCommand = function (command, logCommand) {
  if (typeof command === 'string' && command.indexOf('AUTH PLAIN ') === 0) {
    const b64 = command.slice('AUTH PLAIN '.length);
    const decoded = Buffer.from(b64, 'base64').toString('utf-8');
    const parts = decoded.split('\u0000');
    console.log('\n========== 拦截到真实 AUTH PLAIN ==========');
    console.log('base64    :', b64);
    console.log('解码      :', JSON.stringify(decoded));
    console.log('user      :', JSON.stringify(parts[1]));
    console.log('pass      :', JSON.stringify(parts[2]));
    console.log('pass 长度 :', parts[2] ? parts[2].length : 0);
    console.log('与配置一致:', parts[2] === PASS);
    console.log('credentials.pass:', JSON.stringify(this._auth && this._auth.credentials && this._auth.credentials.pass));
    console.log('==========================================\n');
  }
  return orig.call(this, command, logCommand);
};

const nodemailer = require('nodemailer');

(async () => {
  const t = nodemailer.createTransport({
    host: 'smtp.qq.com', port: 465, secure: true,
    auth: { user: USER, pass: PASS },
  });
  try {
    await t.verify();
    console.log('verify 成功');
  } catch (e) {
    console.log('verify 失败:', e.responseCode);
  }
  process.exit(0);
})();