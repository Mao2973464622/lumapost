const SMTPConnection = require('nodemailer/lib/smtp-connection');
const PASS = 'vgmxtnrbcxvcddga';

/**
 * 测试一批可能的邮箱地址形式
 * 注意：这些是同一账号可能的不同书写方式
 */
const USERS = [
  '29734646422@qq.com',
  '29734646422',
  '2973464642@qq.com',       // 少一位
  '297346464222@qq.com',     // 多一位
];

function test(user) {
  return new Promise((resolve) => {
    const conn = new SMTPConnection({
      host: 'smtp.qq.com', port: 465, secure: true,
      auth: { user, pass: PASS },
      connectionTimeout: 12000, greetingTimeout: 12000, socketTimeout: 12000,
    });
    conn.connect((err) => {
      if (err) { try { conn.close(); } catch (e) {} return resolve({ ok: false, code: 'CONN', msg: err.message.slice(0, 50) }); }
      conn.login({ user, pass: PASS }, (e2) => {
        try { conn.close(); } catch (e) { /* noop */ }
        if (e2) return resolve({ ok: false, code: e2.responseCode, msg: (e2.response || '').slice(0, 60) });
        resolve({ ok: true, code: 235, msg: '认证成功' });
      });
    });
    setTimeout(() => { try { conn.close(); } catch (e) {} resolve({ ok: false, code: 'TO', msg: '超时' }); }, 16000);
  });
}

(async () => {
  console.log('=== 邮箱地址形式探测试 ===\n');
  for (const u of USERS) {
    const r = await test(u);
    console.log((r.ok ? 'PASS' : 'FAIL') + '  ' + u.padEnd(26) + ' ' + r.code + ' ' + r.msg);
  }

  console.log('\n=== 说明 ===');
  console.log('若全部 535，说明 QQ 对错误账号与错误密码返回相同码，');
  console.log('无法从外部区分，必须从邮箱后台「授权码管理」页核对。');
})();