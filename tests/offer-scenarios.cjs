// תרחישי כלי ההצעות בלוח (offer.html, 09.11.2026). רץ על עותק מקומי עם "שרת" בזיכרון (OFFER_FIXTURE) — בלי ענן.
// הרצה: node tests/offer-scenarios.cjs
const fs = require('fs'), path = require('path'), os = require('os');
const { chromium } = require('./node_modules/playwright');
const ROOT = path.resolve(__dirname, '..'), CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SITE = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'offer-'));
fs.copyFileSync(path.join(ROOT, 'offer.js'), path.join(SITE, 'offer.js')); fs.copyFileSync(path.join(ROOT, 'logo.png'), path.join(SITE, 'logo.png'));
fs.writeFileSync(path.join(SITE, 'offer.html'), fs.readFileSync(path.join(ROOT, 'offer.html'), 'utf8')
  .replace(/<script src="https:\/\/cdn[^"]*supabase[^"]*"><\/script>/, '<script>window.OFFER_FIXTURE = window.__FX();</script>')
  .replace(/<link rel="stylesheet" href="https:\/\/fonts[^>]*>/, ''));

const U = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const base = () => ({
  email: 'or.perias@gmail.com', writes: [], nextNumber: '2026-050',
  server: {
    jobs: [{ id: U(1), customer_id: U(9), title: 'גג רעפים', stage: 'quote', stage_changed_at: '2026-11-08T10:00:00Z', visit_at: '2026-11-08T08:00:00Z', created_at: '2026-11-01T10:00:00Z' },
      { id: U(2), customer_id: U(9), title: 'כבר אושר', stage: 'approved', stage_changed_at: '2026-11-08T10:00:00Z', created_at: '2026-11-01T10:00:00Z' }],
    customers: [{ id: U(9), name: 'לקוח בדיקה', phone: '0501234567', address: 'רחוב 1, חיפה', email: null, notes: null }],
    quotes: [], quote_versions: [], findings: [{ id: U(30), job_id: U(1), title: 'סדק בארובה', description: 'מהביקור', qty: 1, unit: "יח'", price_per_unit: 450 }],
    price_list: [{ id: 'price:1:x', work_id: 'x', work_name: 'מרזב', domain: 'פחחות', label: 'מרזב אלומיניום', unit: "מ'", price_min: 120, price_max: 120, source: 'מחירון' },
      { id: 'quote:3:y', work_id: 'y', work_name: 'איטום', domain: 'איטום', label: 'איטום גג בטון', unit: 'מ"ר', price_min: 80, price_max: 100, source: 'הצעות מחיר' }],
    settings: [],
  },
});
const results = []; let browser;
const expect = (c, m) => { if (!c) throw new Error(m); };
async function run(code, title, opts, body) {
  const page = await browser.newPage({ viewport: opts.phone ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
  page.setDefaultTimeout(4000); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message)); page.on('dialog', (d) => (opts.dismiss ? d.dismiss() : d.accept(opts.prompt)));
  const fx = base(); if (opts.fx) opts.fx(fx);
  await page.addInitScript(`window.__FX = () => (${JSON.stringify(fx)}); window.open = (u) => { window.__opened = u; };`);
  await page.goto('file://' + SITE + '/offer.html?job=' + (opts.job || U(1))); await page.waitForTimeout(500);
  let ok = true, msg = '';
  try { await body(page); } catch (e) { ok = false; msg = e.message.split('\n')[0]; }
  if (errs.length) { ok = false; msg += ' | שגיאות: ' + errs.join(' ; '); }
  results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + code + ' ' + title + (msg ? ' — ' + msg : '')); await page.close();
}
const ev = (p, f, a) => p.evaluate(f, a);
const srv = (p, t) => ev(p, (t) => OFFER_FIXTURE.server[t], t);
const wait = (p, ms = 1000) => p.waitForTimeout(ms);   // שמירה אוטומטית אחרי 700ms
const addCat = async (p, id) => { await p.click('#b-cat'); await p.waitForTimeout(450); await p.click(`[data-p="${id}"]`); await p.waitForTimeout(200); };

(async () => {
  browser = await chromium.launch({ executablePath: CHROME });
  await run('O1', 'הצעה חדשה מהמחירון נשמרת עם מספר וסכום נכון', {}, async (p) => {
    expect((await srv(p, 'quotes')).length === 0, 'נשמרה הצעה ריקה רק מפתיחה');
    await addCat(p, 'price:1:x');
    await p.fill('[data-n="0"][data-k="qty"]', '10'); await wait(p);
    const q = (await srv(p, 'quotes'))[0]; expect(q, 'לא נשמר');
    expect(q.number === '2026-050', 'מספר: ' + q.number); expect(q.items[0].total === 1200, 'סה"כ סעיף ' + q.items[0].total);
    expect(Math.round(q.total) === 1416, 'סה"כ כולל מע"מ ' + q.total); expect(q.status === 'draft', 'סטטוס ' + q.status);
    expect((await ev(p, () => document.querySelector('#paper').textContent)).includes('מרזב אלומיניום'), 'התצוגה ללקוח לא מתעדכנת');
  });
  await run('O2', 'מחיר ברירת-מחדל מטווח הצעות = אמצע; ממצאים מהביקור', {}, async (p) => {
    await addCat(p, 'quote:3:y'); await p.click('#b-find'); await wait(p);
    const q = (await srv(p, 'quotes'))[0]; expect(q.items[0].price_per_unit === 90, 'מחיר ' + q.items[0].price_per_unit);
    expect(q.items[1].title === 'סדק בארובה' && q.items[1].finding_id, 'ממצא לא נוסף'); expect(await ev(p, () => document.querySelector('#b-find').hidden), 'כפתור ממצאים לא נעלם');
  });
  await run('O3', 'פתיחת וואטסאפ לא משנה שלב', {}, async (p) => {
    await addCat(p, 'price:1:x'); await wait(p); await p.click('#b-send'); await p.waitForTimeout(500); await p.click('#b-go'); await p.waitForTimeout(300);
    expect((await ev(p, () => window.__opened || '')).startsWith('https://wa.me/972501234567?text='), 'קישור וואטסאפ: ' + (await ev(p, () => window.__opened)));
    expect((await srv(p, 'jobs'))[0].stage === 'quote', 'השלב השתנה לבד'); expect((await srv(p, 'quotes'))[0].status === 'draft', 'ההצעה סומנה לבד');
    expect(!(await ev(p, () => document.querySelector('#b-did').hidden)), 'אין כפתור ✓ נשלחה');
  });
  await run('O4', '✓ נשלחה: הצעה וכרטיס עוברים, בלי גרסה מיותרת', {}, async (p) => {
    await addCat(p, 'price:1:x'); await wait(p); await p.click('#b-did'); await wait(p, 600);
    const q = (await srv(p, 'quotes'))[0], j = (await srv(p, 'jobs'))[0];
    expect(q.status === 'sent' && q.sent_at, 'ההצעה לא סומנה'); expect(j.stage === 'sent' && j.quote_sent_at, 'הכרטיס לא עבר: ' + j.stage);
    expect((await srv(p, 'quote_versions')).length === 0, 'נוצרה גרסה מהסימון'); expect(q.version === 1, 'גרסה ' + q.version);
  });
  await run('O5', 'שינוי אחרי שליחה שומר את הקודמת פעם אחת', { fx: (f) => { f.server.quotes.push({ id: U(40), job_id: U(1), number: '2026-040', status: 'sent', version: 1, sent_at: '2026-11-08T12:00:00Z', items: [{ id: 'a', title: 'ישן', qty: 1, unit: '', price_per_unit: 100, total: 100, visible: true }], vat_rate: 18, validity_days: 30, created_at: '2026-11-08T11:00:00Z' }); f.server.jobs[0].stage = 'sent'; } }, async (p) => {
    await p.fill('[data-n="0"][data-k="price_per_unit"]', '150'); await wait(p); await p.fill('[data-n="0"][data-k="qty"]', '2'); await wait(p);
    const v = await srv(p, 'quote_versions'), q = (await srv(p, 'quotes'))[0];
    expect(v.length === 1 && v[0].snapshot.items[0].price_per_unit === 100, 'גרסאות: ' + v.length); expect(q.version === 2 && q.items[0].total === 300, 'גרסה ' + q.version + ' סה"כ ' + q.items[0].total);
  });
  await run('O6', 'הלקוח אישר → לביצוע עם הסכום', { fx: (f) => { f.server.quotes.push({ id: U(40), job_id: U(1), number: '2026-040', status: 'sent', version: 1, sent_at: '2026-11-08T12:00:00Z', items: [{ id: 'a', title: 'ישן', qty: 1, unit: '', price_per_unit: 1000, total: 1000, visible: true }], vat_rate: 18, validity_days: 30, created_at: '2026-11-08T11:00:00Z' }); f.server.jobs[0].stage = 'sent'; } }, async (p) => {
    await p.click('#b-ok'); await wait(p, 600);
    const j = (await srv(p, 'jobs'))[0], q = (await srv(p, 'quotes'))[0];
    expect(j.stage === 'approved' && +j.price_agreed === 1180, 'כרטיס ' + j.stage + ' ' + j.price_agreed); expect(q.status === 'accepted', 'הצעה ' + q.status);
    expect((await srv(p, 'quote_versions')).length === 0, 'נוצרה גרסה מהאישור');
  });
  await run('O7', 'ביטול באישור — שום דבר לא משתנה', { dismiss: true }, async (p) => {
    await addCat(p, 'price:1:x'); await wait(p); await p.click('#b-did'); await wait(p, 400);
    expect((await srv(p, 'jobs'))[0].stage === 'quote' && (await srv(p, 'quotes'))[0].status === 'draft', 'השתנה למרות ביטול');
  });
  await run('O8', 'זהרי: בלי כפתור שליחה, כן ✓ נשלחה', { fx: (f) => { f.email = 'zohariadar@gmail.com'; } }, async (p) => {
    await addCat(p, 'price:1:x'); await wait(p);
    expect(await ev(p, () => document.querySelector('#b-send').hidden), 'זהרי רואה "לשלוח"');
    expect((await srv(p, 'quotes'))[0].number == null, 'זהרי קיבלה מספר הצעה מהמונה'); expect(!(await ev(p, () => document.querySelector('#b-did').hidden)), 'אין ✓ נשלחה');
  });
  await run('O9', 'עובד (לא בעלים) — אין גישה', { fx: (f) => { f.email = 'ron@example.com'; f.role = 'crew'; } }, async (p) => {
    expect(!(await ev(p, () => document.querySelector('#gate').hidden)) && (await ev(p, () => document.querySelector('#app').hidden)), 'עובד רואה הצעות');
  });
  await run('O10', 'עריכת פרטי לקוח נשמרת', {}, async (p) => {
    await p.click('#b-edit'); await p.waitForTimeout(400); await p.fill('#e-mail', 'test@example.com'); await p.fill('#e-addr', 'רחוב 2, עכו'); await p.click('#e-save'); await p.waitForTimeout(300);
    const c = (await srv(p, 'customers'))[0]; expect(c.email === 'test@example.com' && c.address === 'רחוב 2, עכו', 'לא נשמר');
    expect((await ev(p, () => document.querySelector('#cust-line').textContent)).includes('עכו'), 'הכותרת לא התעדכנה');
  });
  await run('O11', 'מייל לא תקין נחסם', {}, async (p) => {
    await p.click('#b-edit'); await p.waitForTimeout(400); await p.fill('#e-mail', 'לא מייל'); await p.click('#e-save'); await p.waitForTimeout(300);
    expect((await srv(p, 'customers'))[0].email === null, 'נשמר מייל לא תקין');
  });
  await run('O12', 'כשל רשת — מסומן "לא נשמר"', { fx: (f) => { f.failNext = true; } }, async (p) => {
    await addCat(p, 'price:1:x'); await wait(p);
    expect((await ev(p, () => document.querySelector('#saved').textContent)).includes('לא נשמר'), 'אין הודעת כשל');
    await p.fill('[data-n="0"][data-k="qty"]', '2'); await wait(p);
    expect((await srv(p, 'quotes')).length === 1, 'לא נשמר בניסיון השני');
  });
  await run('O13', 'עבודה שכבר אושרה לא חוזרת אחורה ב-✓ נשלחה', { job: U(2) }, async (p) => {
    await addCat(p, 'price:1:x'); await wait(p); await p.click('#b-did'); await wait(p, 600);
    expect((await srv(p, 'jobs'))[1].stage === 'approved', 'הכרטיס חזר ל: ' + (await srv(p, 'jobs'))[1].stage);
  });
  await run('O14', 'טלפון: בלי גלילה לרוחב, מתג תצוגה', { phone: true }, async (p) => {
    await addCat(p, 'price:1:x'); await wait(p, 300);
    expect(await ev(p, () => document.documentElement.scrollWidth <= 390), 'גלילה לרוחב: ' + (await ev(p, () => document.documentElement.scrollWidth)));
    await p.click('#b-pv'); expect(await ev(p, () => getComputedStyle(document.querySelector('.pv-col')).display !== 'none'), 'התצוגה לא נפתחה');
    await p.screenshot({ path: path.join(SITE, 'phone.png'), fullPage: true });
  });
  await run('O15', 'הנחה באחוזים', { prompt: '10%' }, async (p) => {
    await addCat(p, 'price:1:x'); await p.click('#b-disc'); await wait(p);
    const q = (await srv(p, 'quotes'))[0]; expect(q.discount && q.discount.type === 'percent' && Math.round(q.total) === Math.round(120 * 0.9 * 1.18), 'הנחה ' + JSON.stringify(q.discount) + ' ' + q.total);
    await p.screenshot({ path: path.join(SITE, 'desk.png'), fullPage: true });
  });
  await browser.close();
  const pass = results.filter(Boolean).length; console.log(`\n${pass}/${results.length} עברו · צילומים: ${SITE}`); process.exit(pass === results.length ? 0 : 1);
})();
