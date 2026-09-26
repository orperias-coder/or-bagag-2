// 8 תרחישי-הקבלה מהמסמך המאושר + בדיקות-תשתית, בדפדפן אמיתי (Chrome) על משתמש-הבדיקה.
// הרצה: OB2_PW_FILE=<קובץ-סיסמה> node tests/scenarios.js   (OB2_URL לכתובת אחרת)
const { chromium } = require('playwright'); const fs = require('fs');
const PW = process.env.OB2_TEST_PW || fs.readFileSync(process.env.OB2_PW_FILE, 'utf8').trim();
const URL = process.env.OB2_URL || 'http://localhost:8746/';
const OUT = process.env.OB2_SHOTS || '/tmp/claude-501/ob2-shots'; fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + x : '')); if (!c) fails++; };
const TAG = 'e2e:' + Date.now();
async function login(ctx) {
  const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
  await p.goto(URL); await p.waitForSelector('#login:not([hidden])', { timeout: 15000 });
  await p.fill('#li-email', 'app2test@example.com'); await p.fill('#li-pass', PW); await p.click('#li-go');
  await p.waitForSelector('#v-customers:not([hidden])', { timeout: 20000 }); await p.waitForFunction(() => D.loadedAt > 0, null, { timeout: 20000 });
  return p;
}
const settle = (p) => p.waitForFunction(() => DB.pendingCount() === 0, null, { timeout: 60000 });

(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL' });
  const p = await login(ctx);

  // ---- תשתית: כתיבה בלי רשת נשמרת בתור ועולה כשיש רשת ----
  await ctx.setOffline(true);
  const qid = await p.evaluate(async (t) => (await DB.save('customers', { name: 'e2e תור', legacy_id: t + ':queue' })).id, TAG);
  ok('queue: id returned offline', !!qid);
  ok('queue: pending 2 (row + event)', (await p.evaluate(() => DB.pendingCount())) === 2, String(await p.evaluate(() => DB.pendingCount())));
  await ctx.setOffline(false); await p.evaluate(() => DB.sync()); await settle(p);
  const row = await p.evaluate(async (id) => (await sb.from('customers').select('id,name').eq('id', id).single()).data, qid);
  ok('queue: row reached cloud', !!row && row.name === 'e2e תור');
  const ev = await p.evaluate(async (id) => (await sb.from('events').select('action,device').eq('entity_id', id)).data, qid);
  ok('queue: event logged', Array.isArray(ev) && ev.length === 1 && ev[0].action === 'create');

  await ctx.close(); await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('CRASH', e); process.exit(2); });
