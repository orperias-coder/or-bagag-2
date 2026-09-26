// 8 תרחישי-הקבלה מהמסמך המאושר + בדיקות-תשתית, בדפדפן אמיתי (Chrome) על משתמש-הבדיקה.
// הרצה: OB2_PW_FILE=<קובץ-סיסמה> node tests/scenarios.js   (OB2_URL לכתובת אחרת)
const { chromium } = require('playwright'); const fs = require('fs');
const PW = process.env.OB2_TEST_PW || fs.readFileSync(process.env.OB2_PW_FILE, 'utf8').trim();
const URL = process.env.OB2_URL || 'http://localhost:8746/';
const OUT = process.env.OB2_SHOTS || '/tmp/claude-501/ob2-shots'; fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + x : '')); if (!c) fails++; };
const TAG = 'e2e:' + Date.now();
const N1 = 'e2e לקוח ' + String(Date.now()).slice(-5);   // שם ייחודי לריצה, כדי שריצות קודמות לא יפריעו
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

  // ---- S4: לקוח חדש → סל → שחזור עם כל הפרטים ----
  await p.click('#plus'); await p.click('[data-new="customer"]');
  await p.fill('#f-name', N1); await p.fill('#f-phone', '0501111111'); await p.fill('#f-address', 'רחוב הבדיקה 4'); await p.click('#f-save');
  await p.waitForSelector('#v-customer:not([hidden]) h2');
  ok('S4: customer created', (await p.locator('#v-customer h2').textContent()).includes(N1));
  const cid = await p.evaluate(() => S.params.id);
  await p.click('[data-act="trash-customer"]'); await p.click('#confirm-yes'); await p.waitForSelector('#v-customers:not([hidden])');
  await p.fill('#search', N1); ok('S4: not in list after trash', !(await p.locator('#cust-list').textContent()).includes(N1));
  await p.click('#tabs [data-tab="more"]'); await p.click('[data-open="trash"]'); await p.waitForSelector('#v-trash:not([hidden])');
  ok('S4: in trash', (await p.locator('#v-trash').textContent()).includes(N1));
  await p.click(`[data-restore="customers:${cid}"]`); await p.click('#tabs [data-tab="customers"]'); await p.fill('#search', N1);
  ok('S4: restored with phone+address', (await p.locator('#cust-list').textContent()).includes('0501111111'));
  await settle(p);
  const cloud = await p.evaluate(async (id) => (await sb.from('customers').select('deleted_at,address').eq('id', id).single()).data, cid);
  ok('S4: cloud shows restored', cloud && cloud.deleted_at === null && cloud.address === 'רחוב הבדיקה 4');
  await p.screenshot({ path: OUT + '/s4-customer.png' });

  // ---- S3: עבודה → "נשלחה" → ימים → מחכות לתשובה → תזכורת אחרונה ----
  await p.click('#cust-list .row'); await p.waitForSelector('#v-customer:not([hidden]) h2');
  await p.click('[data-act="new-job"]'); await p.fill('#j-title', 'e2e גג'); await p.fill('#j-problem', 'נזילה'); await p.click('#j-save'); await p.waitForSelector('#v-job:not([hidden]) .card');
  const jid = await p.evaluate(() => S.params.id);
  ok('S3: job created at lead', (await p.locator('#v-job .chip.lead').count()) === 1);
  await p.click('[data-stage="quote"]'); await p.waitForTimeout(100);
  await p.click('[data-stage="sent"]'); await p.waitForTimeout(100);
  ok('S3: sent blocked without quote', (await p.locator('#v-job .chip.quote').count()) === 1, 'stage=' + await p.evaluate(() => D.jobs.find((j) => j.id === S.params.id).stage));
  await p.evaluate(async (jid) => { await DB.save('quotes', { job_id: jid, number: 'e2e', status: 'draft', items: [], total: 0, legacy_id: 'e2e:q-s3' }); }, jid);
  await p.click('[data-stage="sent"]'); await p.waitForTimeout(100);
  ok('S3: chip 0 days', (await p.locator('#v-job .chip.days').textContent()).includes('0'));
  await p.evaluate(async (jid) => { await DB.save('jobs', { id: jid, quote_sent_at: new Date(Date.now() - 4 * 864e5).toISOString() }); render(); }, jid);
  ok('S3: 4 days', (await p.locator('#v-job .chip.days').textContent()).includes('4'));
  await p.click('#tabs [data-tab="work"]'); ok('S3: waiting section', (await p.locator('#cust-list').textContent()).includes('מחכות לתשובה'));
  await p.screenshot({ path: OUT + '/s3-work.png' });
  await p.evaluate(async (jid) => { await DB.save('jobs', { id: jid, quote_sent_at: new Date(Date.now() - 8 * 864e5).toISOString() }); render(); }, jid);
  ok('S3: last reminder at 8 days', (await p.locator('#cust-list').textContent()).includes('תזכורת אחרונה'));
  await settle(p);

  await ctx.close(); await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('CRASH', e); process.exit(2); });
