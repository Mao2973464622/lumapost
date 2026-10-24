const SMTPConnection = require('nodemailer/lib/smtp-connection');

const CANDIDATES = [
  { user: '29734646422@qq.com', pass: 'vgmxtnrbcxvcddga' },
  { user: '29734646422', pass: 'vgmxtnrbcxvcddga' },          // 不带域名
  { user: '29734646422@qq.com', pass: 'qujnjtddeisydcfj' },
  { user: '29734646422@qq.com', pass: 'rzbbtlvnbrtydcje' },
];

function test(user, pass) {
  return new Promise((resolve) => {
    const conn = new SMTPConnection({
      host: 'smtp.qq.com', port: 465, secure: true,
      auth: { user, pass },
      connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 15000,
      logger: false, debug: false,
    });
    const t0 = Date.now();
    conn.connect((err) => {
      if (err) { conn.close(); return resolve({ ok: false, code: 'CONN', msg: err.message.slice(0, 60) }); }
      conn.login({ user, pass }, (err2) => {
        try { conn.close(); } catch (e) { /* noop */ }
        if (err2) return resolve({ ok: false, code: err2.responseCode || 'N/A', msg: (err2.response || err2.message || '').slice(0, 70), ms: Date.now() - t0 });
        resolve({ ok: true, code: 235, msg: '认证成功', ms: Date.now() - t0 });
      });
    });
    setTimeout(() => { try { conn.close(); } catch (e) {} resolve({ ok: false, code: 'TIMEOUT', msg: '超时' }); }, 20000);
  });
}

(async () => {
  console.log('=== 多组合认证测试 ===\n');
  for (const c of CANDIDATES) {
    const r = await test(c.user, c.pass);
    const tag = r.ok ? 'PASS' : 'FAIL';
    console.log(tag + '  ' + c.user.padEnd(26) + ' | pass=' + c.pass.padEnd(18) + ' | ' + r.code + ' ' + r.msg + (r.ms ? ' (' + r.ms + 'ms)' : ''));
  }
})();