// תרחישי כלי ההצעות בלוח (offer.html, 09.11.2026). רץ על עותק מקומי עם "שרת" בזיכרון (OFFER_FIXTURE) — בלי ענן.
// הרצה: node tests/offer-scenarios.cjs
const fs = require('fs'), path = require('path'), os = require('os');
const { chromium } = require('./node_modules/playwright');
const ROOT = path.resolve(__dirname, '..'), SRC = process.env.OFFER_SRC || ROOT, CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SITE = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'offer-'));
fs.copyFileSync(path.join(SRC, 'offer.js'), path.join(SITE, 'offer.js')); fs.mkdirSync(path.join(SITE, 'vendor')); fs.copyFileSync(path.join(ROOT, 'vendor/html2pdf.bundle.min.js'), path.join(SITE, 'vendor/html2pdf.bundle.min.js')); fs.copyFileSync(path.join(ROOT, 'logo.png'), path.join(SITE, 'logo.png'));
fs.writeFileSync(path.join(SITE, 'offer.html'), fs.readFileSync(path.join(SRC, 'offer.html'), 'utf8')
  .replace(/<script src="[^"]*supabase[^"]*"><\/script>/, '<script>window.OFFER_FIXTURE = window.__FX();</script>')
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
// שרת מקומי קטן (לא file://): בקובץ מקומי הדפדפן חוסם את הלוגו מלהיכנס ל-PDF
const http = require('http'); let ORIGIN = '';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png' };
const server = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(SITE) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
const results = []; let browser;
const expect = (c, m) => { if (!c) throw new Error(m); };
async function run(code, title, opts, body) {
  const page = await browser.newPage({ viewport: opts.phone ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
  page.setDefaultTimeout(4000); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message)); page.on('dialog', (d) => (opts.dismiss ? d.dismiss() : d.accept(opts.prompt)));
  const fx = base(); if (opts.fx) opts.fx(fx);
  await page.addInitScript(`window.__FX = () => (${JSON.stringify(fx)}); window.open = (u) => { window.__opened = u; };`);
  if (opts.init) await page.addInitScript(opts.init);
  await page.goto(ORIGIN + '/offer.html?job=' + (opts.job || U(1)) + (opts.qs || '')); await page.waitForTimeout(500);
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
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok)); ORIGIN = 'http://127.0.0.1:' + server.address().port;
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
  // O16-O17: שיתוף עם PDF (09.11). הספרייה מקומית ב-vendor/
  const SHARE_STUB = `navigator.canShare = (d) => !!(d && d.files && d.files.length); navigator.share = async (d) => { const f = d.files[0]; window.__shared = { name: f.name, type: f.type, size: f.size, text: d.text, b64: await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.readAsDataURL(f); }) }; };`;
  await run('O16', 'טלפון: "שתף עם PDF" משתף קובץ PDF עם שם וההודעה, בלי לשנות שלב', { phone: true, init: SHARE_STUB }, async (p) => {
    await addCat(p, 'price:1:x'); await p.fill('[data-n="0"][data-k="qty"]', '10'); await wait(p); await p.click('#b-send'); await p.waitForTimeout(500);
    await p.click('#b-share'); await p.waitForFunction(() => window.__shared, null, { timeout: 30000 });
    const sh = await ev(p, () => window.__shared);
    expect(sh.type === 'application/pdf' && sh.size > 20000, 'קובץ: ' + sh.type + ' ' + sh.size); expect(sh.name === 'הצעת מחיר 2026-050 - לקוח בדיקה.pdf', 'שם: ' + sh.name);
    expect(Buffer.from(sh.b64, 'base64').subarray(0, 5).toString() === '%PDF-', 'לא PDF'); expect(sh.text.includes('2026-050'), 'ההודעה לא צורפה');
    fs.writeFileSync(path.join(SITE, 'share.pdf'), Buffer.from(sh.b64, 'base64'));
    expect((await srv(p, 'jobs'))[0].stage === 'quote' && (await srv(p, 'quotes'))[0].status === 'draft', 'השלב השתנה לבד');
    expect(!(await ev(p, () => document.querySelector('#sh-send').classList.contains('on'))), 'החלונית לא נסגרה אחרי שיתוף');
  });
  await run('O17', 'מחשב בלי שיתוף קבצים: ה-PDF יורד', { init: 'navigator.canShare = undefined; navigator.share = undefined;' }, async (p) => {
    await addCat(p, 'price:1:x'); await wait(p); await p.click('#b-send'); await p.waitForTimeout(500);
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.click('#b-share')]);
    expect(dl.suggestedFilename().endsWith('.pdf'), 'שם ההורדה ' + dl.suggestedFilename());
  });
  // ----- תיקוני 10.11: שמירה שלא דורסת (רק מה ששונה · מצב רק מהכפתורים · "שונתה במכשיר אחר") · רצף "נשלחה" בטוח · ?new=1 -----
  const DRAFT = (o) => Object.assign({ id: U(40), job_id: U(1), number: '2026-040', status: 'draft', version: 1, sent_at: null, items: [{ id: 'a', title: 'ישן', qty: 1, unit: '', price_per_unit: 100, total: 100, visible: true }], vat_rate: 18, validity_days: 30, notes: 'הערה', payment_terms: 'תנאים', total_before_vat: 100, total: 118, created_at: '2026-11-08T11:00:00Z', updated_at: '2026-11-08T11:00:00.000Z' }, o);
  const savedTxt = (p) => ev(p, () => document.querySelector('#saved').textContent);
  await run('O18', 'שמירה אוטומטית שולחת רק את מה ששונה — בלי מצב/תאריך-שליחה ובלי שדות שלא נגעו בהם', { fx: (f) => { f.server.quotes.push(DRAFT()); } }, async (p) => {
    await p.fill('[data-n="0"][data-k="qty"]', '3'); await wait(p);
    const w = (await ev(p, () => OFFER_FIXTURE.writes)).filter((x) => x[0] === 'update' && x[1] === 'quotes');
    expect(w.length === 1, 'כתיבות: ' + w.length); const keys = Object.keys(w[0][3]).sort().join();
    expect(keys === 'items,total,total_before_vat,updated_at', 'נשלח: ' + keys);
    expect((await srv(p, 'quotes'))[0].items[0].qty === 3, 'לא נשמר'); expect((await savedTxt(p)).includes('נשמר'), 'חיווי: ' + (await savedTxt(p)));
  });
  await run('O19', 'ההצעה שונתה במכשיר אחר → לא דורסים, מודיעים בעברית פשוטה, ולא כותבים יותר עד רענון', { fx: (f) => { f.server.quotes.push(DRAFT()); } }, async (p) => {
    await ev(p, () => { Object.assign(OFFER_FIXTURE.server.quotes[0], { notes: 'מהמכשיר השני', status: 'sent', sent_at: '2026-11-10T09:00:00Z', updated_at: '2026-11-10T09:00:00.000Z' }); });
    await p.fill('[data-n="0"][data-k="qty"]', '5'); await wait(p);
    const q = (await srv(p, 'quotes'))[0];
    expect(q.items[0].qty === 1 && q.notes === 'מהמכשיר השני' && q.status === 'sent' && q.sent_at, 'נדרס: ' + JSON.stringify([q.items[0].qty, q.notes, q.status]));
    expect((await savedTxt(p)).includes('שונתה במכשיר אחר'), 'חיווי: ' + (await savedTxt(p)));
    expect((await ev(p, () => document.querySelector('#toast').textContent)).includes('שונתה במכשיר אחר'), 'אין הודעה');
    const n = (await ev(p, () => OFFER_FIXTURE.writes.length)); await p.fill('[data-n="0"][data-k="qty"]', '6'); await wait(p);
    expect((await ev(p, () => OFFER_FIXTURE.writes.length)) === n, 'ממשיך לכתוב אחרי ההודעה'); expect((await srv(p, 'quotes'))[0].items[0].qty === 1, 'נדרס בניסיון השני');
  });
  await run('O20', '✓ נשלחה: העבודה לא נשמרה (רשת) → שום דבר לא חצי-מסומן, הכפתור נשאר, ולחיצה נוספת משלימה', { fx: (f) => { f.server.quotes.push(DRAFT()); } }, async (p) => {
    await ev(p, () => { const w = OFFER_FIXTURE.writes, push = w.push.bind(w); let done = false; w.push = (x) => { if (!done && x[1] === 'jobs') { done = true; OFFER_FIXTURE.failNext = true; } return push(x); }; });   // הכתיבה הראשונה לעבודה נכשלת
    await p.click('#b-did'); await wait(p, 600);
    let q = (await srv(p, 'quotes'))[0], j = (await srv(p, 'jobs'))[0];
    expect(q.status === 'draft' && j.stage === 'quote', 'מצב-ביניים: הצעה ' + q.status + ', עבודה ' + j.stage);
    expect(await ev(p, () => !document.querySelector('#b-did').hidden), 'הכפתור נעלם — אי-אפשר לנסות שוב');
    await p.click('#b-did'); await wait(p, 600); q = (await srv(p, 'quotes'))[0]; j = (await srv(p, 'jobs'))[0];
    expect(q.status === 'sent' && q.sent_at && j.stage === 'sent' && j.quote_sent_at, 'אחרי ניסיון חוזר: ' + q.status + ' / ' + j.stage);
  });
  await run('O21', '✓ נשלחה: העבודה עברה אבל ההצעה לא נשמרה → הכפתור נשאר ולחיצה נוספת משלימה', { fx: (f) => { f.server.quotes.push(DRAFT()); } }, async (p) => {
    await ev(p, () => { const w = OFFER_FIXTURE.writes, push = w.push.bind(w); let done = false; w.push = (x) => { if (!done && x[1] === 'quotes' && x[3] && x[3].status) { done = true; OFFER_FIXTURE.failNext = true; } return push(x); }; });
    await p.click('#b-did'); await wait(p, 600);
    let q = (await srv(p, 'quotes'))[0], j = (await srv(p, 'jobs'))[0];
    expect(q.status === 'draft' && j.stage === 'sent', 'אחרי הכשל: הצעה ' + q.status + ', עבודה ' + j.stage);
    expect(await ev(p, () => !document.querySelector('#b-did').hidden), 'הכפתור נעלם');
    await p.click('#b-did'); await wait(p, 600); q = (await srv(p, 'quotes'))[0]; j = (await srv(p, 'jobs'))[0];
    expect(q.status === 'sent' && j.stage === 'sent', 'אחרי ניסיון חוזר: ' + q.status + ' / ' + j.stage);
    await p.fill('[data-n="0"][data-k="qty"]', '2'); await wait(p);   // אחרי הסימון ממשיכים לערוך בלי "שונתה במכשיר אחר" שגוי
    expect((await srv(p, 'quotes'))[0].items[0].qty === 2 && !(await savedTxt(p)).includes('במכשיר אחר'), 'עריכה אחרי סימון: ' + (await savedTxt(p)));
  });
  await run('O22', '"הלקוח אישר" כשמכשיר אחר כבר שינה את ההצעה → לא דורסים ולא מקדמים את העבודה', { fx: (f) => { f.server.quotes.push(DRAFT({ status: 'sent', sent_at: '2026-11-08T12:00:00Z' })); f.server.jobs[0].stage = 'sent'; } }, async (p) => {
    await ev(p, () => { Object.assign(OFFER_FIXTURE.server.quotes[0], { items: [{ id: 'a', title: 'עודכן שם', qty: 1, unit: '', price_per_unit: 900, total: 900, visible: true }], updated_at: '2026-11-10T09:00:00.000Z' }); });
    await p.fill('[data-n="0"][data-k="qty"]', '4'); await p.click('#b-ok'); await wait(p, 700);
    const q = (await srv(p, 'quotes'))[0], j = (await srv(p, 'jobs'))[0];
    expect(q.status === 'sent' && q.items[0].price_per_unit === 900, 'ההצעה נדרסה: ' + q.status + ' ' + q.items[0].price_per_unit); expect(j.stage === 'sent' && !j.price_agreed, 'העבודה קודמה: ' + j.stage + ' ' + j.price_agreed);
  });
  await run('O23', '"+ הצעה חדשה" (?new=1): אחרי השמירה הראשונה הכתובת מצביעה על ההצעה — רענון לא פותח עוד אחת', { qs: '&new=1', fx: (f) => { f.server.quotes.push(DRAFT()); } }, async (p) => {
    await addCat(p, 'price:1:x'); await wait(p);
    const qs = await srv(p, 'quotes'); expect(qs.length === 2, 'הצעות: ' + qs.length);
    const url = await ev(p, () => location.search); expect(!url.includes('new=1') && url.includes('q=' + qs[1].id), 'הכתובת: ' + url);
  });
  await run('O24', 'פרטי לקוח: נשלח רק מה ששונה — שדה שעודכן במכשיר אחר לא נדרס', {}, async (p) => {
    await p.click('#b-edit'); await p.waitForTimeout(400);
    await ev(p, () => { OFFER_FIXTURE.server.customers[0].phone = '0509999999'; });
    await p.fill('#e-addr', 'רחוב 2, עכו'); await p.click('#e-save'); await p.waitForTimeout(300);
    const c = (await srv(p, 'customers'))[0]; expect(c.address === 'רחוב 2, עכו' && c.phone === '0509999999', 'כתובת ' + c.address + ' טלפון ' + c.phone);
    const w = (await ev(p, () => OFFER_FIXTURE.writes)).filter((x) => x[1] === 'customers'); expect(w.length === 1 && Object.keys(w[0][3]).sort().join() === 'address,updated_at', 'נשלח: ' + JSON.stringify(w.map((x) => Object.keys(x[3]))));
  });
  // ----- 23.11: שלבים / אופציות בתוך הצעה אחת (q.options.split + item.group) -----
  const SHOTS = process.env.OFFER_SHOTS || SITE;
  const mode = (p, md) => p.click(`#mode [data-mode="${md}"]`);
  const toGroup = async (p, n) => { const id = await ev(p, (n) => OFFER_FIXTURE && document.querySelectorAll('.grp')[n].dataset.g, n); const b = await p.$(`[data-gcur="${id}"]`); if (b) await b.click(); return id; };
  const SPLIT = (md, o) => { const ga = 'g-a', gb = 'g-b'; return DRAFT(Object.assign({ status: 'sent', sent_at: '2026-11-08T12:00:00Z', options: { unforeseen: true, signatures: true, split: { mode: md, groups: [{ id: ga, name: md === 'options' ? "אופציה א'" : "שלב א'" }, { id: gb, name: md === 'options' ? "אופציה ב'" : "שלב ב'" }] } },
    items: [{ id: 'a', title: 'זפת', qty: 1, unit: '', price_per_unit: 1000, total: 1000, visible: true, group: ga }, { id: 'b', title: 'יריעות', qty: 1, unit: '', price_per_unit: 500, total: 500, visible: true, group: gb }] }, o)); };
  await run('O25', 'שלבים: כל סעיף בשלב שלו, סכום לכל שלב, סה"כ לכל השלבים בהצעה ובהודעה', {}, async (p) => {
    await mode(p, 'stages'); await addCat(p, 'price:1:x');
    await toGroup(p, 1); await addCat(p, 'quote:3:y'); await wait(p);
    const q = (await srv(p, 'quotes'))[0], sp = q.options.split;
    expect(sp.mode === 'stages' && sp.groups.length === 2 && sp.groups[0].name === "שלב א'", 'חלוקה: ' + JSON.stringify(sp));
    expect(q.items[0].group === sp.groups[0].id && q.items[1].group === sp.groups[1].id, 'שיוך: ' + q.items.map((i) => i.group));
    expect(Math.round(q.total * 100) === Math.round(210 * 1.18 * 100), 'סה"כ ' + q.total);
    const gs = await ev(p, () => [...document.querySelectorAll('[data-gsum]')].map((e) => e.textContent)); expect(gs.join() === '₪120,₪90', 'סכומי שלבים: ' + gs);
    const pap = await ev(p, () => document.querySelector('#paper').textContent);
    expect(pap.includes("סה\"כ שלב א'") && pap.includes("סה\"כ שלב ב'") && pap.includes('סה"כ לכל השלבים') && pap.includes('₪248'), 'מסמך: ' + pap.slice(0, 300));
    expect(await ev(p, () => !document.querySelector('#t-total').closest('.tr').hidden), 'סה"כ בעורך נעלם');
    await p.click('#b-send'); await p.waitForTimeout(500); const msg = await p.inputValue('#msg');
    expect(msg.includes('ב-2 שלבים') && msg.includes('₪248'), 'הודעה: ' + msg);
  });
  await run('O26', 'אופציות: מחיר מלא לכל אופציה, בלי סה"כ, טווח בפס ובהודעה', {}, async (p) => {
    await mode(p, 'options'); await addCat(p, 'price:1:x');
    await toGroup(p, 1); await addCat(p, 'quote:3:y'); await wait(p);
    const q = (await srv(p, 'quotes'))[0]; expect(q.options.split.mode === 'options' && q.options.split.groups[1].name === "אופציה ב'", 'חלוקה');
    expect(Math.round(q.total * 10) === 1062, 'total = הזולה: ' + q.total);
    const bt = await ev(p, () => document.querySelector('#bar-total').textContent); expect(bt === 'מ-₪106 עד ₪142 כולל מע"מ', 'פס: ' + bt);
    const pap = await ev(p, () => document.querySelector('#paper').textContent);
    expect(pap.includes('יש לבחור אחת מהאופציות') && pap.includes("לתשלום באופציה א'") && pap.includes("לתשלום באופציה ב'") && !pap.includes('לכל השלבים'), 'מסמך: ' + pap.slice(0, 300));
    expect((pap.match(/לפני מע"מ/g) || []).length === 2, 'בלוק מחיר לכל אופציה');
    expect(await ev(p, () => document.querySelector('#t-total').closest('.tr').hidden && !document.querySelector('#t-opts').hidden), 'בעורך מוצג סה"כ');
    await p.click('#b-send'); await p.waitForTimeout(500); const msg = await p.inputValue('#msg');
    expect(msg.includes('2 אופציות') && msg.includes('מ-₪106 עד ₪142'), 'הודעה: ' + msg);
  });
  await run('O27', 'הלקוח אישר באופציות: בוחרים אופציה בחלונית → הסכום שסוכם = האופציה, הבחירה נרשמת בהצעה', { fx: (f) => { f.server.quotes.push(SPLIT('options')); f.server.jobs[0].stage = 'sent'; } }, async (p) => {
    await p.click('#b-ok'); await p.waitForTimeout(450);
    expect(await ev(p, () => document.querySelector('#sh-ok').classList.contains('on') && document.querySelector('#ok-go').disabled), 'החלונית לא נפתחה / אפשר לאשר בלי בחירה');
    expect((await srv(p, 'jobs'))[0].stage === 'sent', 'אושר לפני בחירה');
    await p.check('#ok-list input[value="g-b"]'); await p.click('#ok-go'); await wait(p, 600);
    const j = (await srv(p, 'jobs'))[0], q = (await srv(p, 'quotes'))[0];
    expect(j.stage === 'approved' && +j.price_agreed === 590, 'כרטיס ' + j.stage + ' ' + j.price_agreed);
    expect(q.status === 'accepted' && q.options.split.chosen.groups.join() === 'g-b' && q.options.split.chosen.total === 590 && +q.total === 590, 'הצעה: ' + JSON.stringify(q.options.split.chosen) + ' ' + q.total);
    expect((await srv(p, 'quote_versions')).length === 0, 'נוצרה גרסה מהאישור');
    expect((await ev(p, () => document.querySelector('#bar-sub').textContent)).includes("אופציה ב'"), 'הבחירה לא מוצגת');
  });
  await run('O28', 'הלקוח אישר בשלבים: רק שלב א\' (הנחה בשקלים מתחלקת) → הסכום שסוכם = שלב א\' כולל מע"מ', { fx: (f) => { f.server.quotes.push(SPLIT('stages', { discount: { type: 'amount', value: 150 } })); f.server.jobs[0].stage = 'sent'; } }, async (p) => {
    await p.click('#b-ok'); await p.waitForTimeout(450);
    expect(await ev(p, () => [...document.querySelectorAll('#ok-list input')].every((i) => i.checked)), 'ברירת מחדל: לא כל השלבים מסומנים');
    expect((await ev(p, () => document.querySelector('#ok-go').textContent)).includes('₪1,593'), 'כל השלבים: ' + (await ev(p, () => document.querySelector('#ok-go').textContent)));
    await p.uncheck('#ok-list input[value="g-b"]'); await p.click('#ok-go'); await wait(p, 600);
    const j = (await srv(p, 'jobs'))[0], q = (await srv(p, 'quotes'))[0];
    expect(j.stage === 'approved' && +j.price_agreed === 1062, 'סוכם ' + j.price_agreed);   // (1000 − 100) × 1.18
    expect(q.status === 'accepted' && q.options.split.chosen.groups.join() === 'g-a', 'נרשם: ' + JSON.stringify(q.options.split.chosen));
  });
  // הצעה ישנה (בלי חלוקה): המסמך זהה לגרסה שלפני השינוי (HEAD בגיט), ושום דבר לא נכתב רק מפתיחה
  let oldJs = null; try { const cp = require('child_process'); oldJs = cp.execSync('git show HEAD:offer.js', { cwd: ROOT }).toString(); if (/groupCalcs/.test(oldJs)) oldJs = null; fs.writeFileSync(path.join(SITE, 'offer-old.js'), oldJs || '');
    fs.writeFileSync(path.join(SITE, 'offer-old.html'), cp.execSync('git show HEAD:offer.html', { cwd: ROOT }).toString().replace(/<script src="[^"]*supabase[^"]*"><\/script>/, '<script>window.OFFER_FIXTURE = window.__FX();</script>').replace(/<link rel="stylesheet" href="https:\/\/fonts[^>]*>/, '').replace('src="offer.js"', 'src="offer-old.js"')); } catch (e) { oldJs = null; }
  const OLDQ = (f) => { f.server.quotes.push(DRAFT({ discount: { type: 'percent', value: 5 }, items: [{ id: 'a', title: 'ישן', description: 'פירוט', qty: 2, unit: "מ'", price_per_unit: 100, total: 200, visible: true }, { id: 'b', title: 'שני', qty: 1, unit: '', price_per_unit: 300, total: 300, visible: true }] })); };
  let oldPaper = null;
  if (oldJs) await run('O29a', '(הכנה) המסמך של הצעה ישנה בקוד הקודם', { fx: OLDQ, qs: '' }, async (p) => {
    await p.goto(ORIGIN + '/offer-old.html?job=' + U(1)); await p.waitForTimeout(500); oldPaper = await ev(p, () => document.querySelector('#paper').innerHTML); expect(oldPaper.includes('ישן'), 'לא נטען');
  });
  await run('O29', 'הצעה ישנה בלי חלוקה: נראית בדיוק כמו קודם, מצב "רגיל", בלי כתיבה', { fx: OLDQ }, async (p) => {
    const now = await ev(p, () => document.querySelector('#paper').innerHTML);
    if (oldPaper) expect(now === oldPaper, 'המסמך שונה מהקוד הקודם');
    expect(await ev(p, () => document.querySelector('#mode [data-mode="plain"]').classList.contains('on') && document.querySelector('#b-grp').hidden && !document.querySelector('.grp') && !document.querySelector('[data-k="group"]')), 'מוצג כמו חלוקה');
    expect(await ev(p, () => !document.querySelector('#t-total').closest('.tr').hidden && document.querySelector('#t-opts').hidden), 'סה"כ חסר');
    await wait(p); expect((await ev(p, () => OFFER_FIXTURE.writes)).length === 0, 'נכתב משהו רק מפתיחה');
    expect((await ev(p, () => document.querySelector('#bar-total').textContent)) === '₪561 כולל מע"מ', 'פס');
  });
  await run('O30', 'העברת סעיף בין שלבים, שינוי שם, ומחיקת שלב שמעבירה את הסעיפים (לא מוחקת אותם)', { fx: (f) => { f.server.quotes.push(SPLIT('stages', { status: 'draft', sent_at: null })); } }, async (p) => {
    await p.selectOption('[data-n="1"][data-k="group"]', 'g-a'); await wait(p);
    let q = (await srv(p, 'quotes'))[0]; expect(q.items[1].group === 'g-a', 'לא הועבר');
    await p.fill('[data-gname="g-b"]', 'גג עליון'); await wait(p); q = (await srv(p, 'quotes'))[0];
    expect(q.options.split.groups[1].name === 'גג עליון', 'שם: ' + q.options.split.groups[1].name);
    await p.selectOption('[data-n="1"][data-k="group"]', 'g-b'); await p.click('[data-gdel="g-b"]'); await wait(p);
    q = (await srv(p, 'quotes'))[0]; expect(q.options.split.groups.length === 1 && q.items.length === 2 && q.items.every((i) => i.group === 'g-a'), 'מחיקה: ' + JSON.stringify([q.options.split.groups, q.items.map((i) => i.group)]));
    await mode(p, 'plain'); await wait(p); q = (await srv(p, 'quotes'))[0];
    expect(q.options.split.mode === 'plain' && q.items.length === 2 && Math.round(q.total) === 1770, 'חזרה לרגיל: ' + q.options.split.mode + ' ' + q.total);
    expect(!(await ev(p, () => document.querySelector('#paper').textContent)).includes("שלב א'"), 'ברגיל המסמך עדיין מחולק');
  });
  await run('O31', 'טלפון 390: עורך שלבים ומסמך אופציות בלי גלילה לרוחב (צילומים)', { phone: true, fx: (f) => { f.server.quotes.push(SPLIT('stages', { status: 'draft', sent_at: null })); } }, async (p) => {
    expect(await ev(p, () => document.documentElement.scrollWidth <= 390), 'גלילה לרוחב: ' + (await ev(p, () => document.documentElement.scrollWidth)));
    await p.screenshot({ path: path.join(SHOTS, 'phone-stages-editor.png'), fullPage: true });
    await p.click('#b-pv'); await p.waitForTimeout(300); await p.screenshot({ path: path.join(SHOTS, 'phone-stages-doc.png'), fullPage: true });
    await p.click('#b-pv'); await mode(p, 'options'); await p.waitForTimeout(300);
    expect(await ev(p, () => document.documentElement.scrollWidth <= 390), 'גלילה לרוחב באופציות');
    await p.screenshot({ path: path.join(SHOTS, 'phone-options-editor.png'), fullPage: true });
    await p.click('#b-pv'); await p.waitForTimeout(300); await p.screenshot({ path: path.join(SHOTS, 'phone-options-doc.png'), fullPage: true });
  });
  // O32: PDF של הצעה בשלבים ובאופציות (23.11) — יורד ונשמר לבדיקה בעין
  for (const md of ['stages', 'options']) await run('O32-' + md, 'PDF ' + (md === 'stages' ? 'שלבים' : 'אופציות') + ' יורד ותקין', { init: 'navigator.canShare = undefined; navigator.share = undefined;', fx: (f) => { f.server.quotes.push(SPLIT(md, { status: 'draft', sent_at: null })); } }, async (p) => {
    await p.click('#b-send'); await p.waitForTimeout(500);
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.click('#b-share')]);
    const out = path.join(SHOTS, 'quote-' + md + '.pdf'); await dl.saveAs(out);
    expect(fs.readFileSync(out).subarray(0, 5).toString() === '%PDF-', 'לא PDF');
  });
  // O33: דחיפות לכל סעיף (23.11): לחיצה מסמנת, לחיצה שנייה מבטלת, מופיע במסמך ובשמירה
  await run('O33', 'דחיפות לסעיף: מסמנים, מופיע במסמך, לחיצה שנייה מבטלת', { init: 'navigator.canShare = undefined; navigator.share = undefined;', fx: (f) => { f.server.quotes.push(SPLIT('stages', { status: 'draft', sent_at: null })); } }, async (p) => {
    await p.click('[data-un="0"][data-urg="גבוהה"]'); await p.click('[data-un="1"][data-urg="נמוכה"]'); await wait(p);
    let q = (await srv(p, 'quotes'))[0]; expect(q.items[0].urgency === 'גבוהה' && q.items[1].urgency === 'נמוכה', 'נשמר: ' + q.items.map((i) => i.urgency));
    const pap = await ev(p, () => document.querySelector('#paper').textContent); expect(pap.includes('דחיפות גבוהה') && pap.includes('דחיפות נמוכה'), 'מסמך');
    expect(await ev(p, () => document.querySelector('[data-un="0"][data-urg="גבוהה"]').getAttribute('aria-pressed') === 'true'), 'הכפתור לא מסומן');
    await p.click('#b-send'); await p.waitForTimeout(500);
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.click('#b-share')]); await dl.saveAs(path.join(SHOTS, 'quote-urgency.pdf'));
    await p.click('#sh-send [data-close], #sh-send .x').catch(() => {}); await p.keyboard.press('Escape').catch(() => {});
    await ev(p, () => { const b = document.querySelector('[data-un="1"][data-urg="נמוכה"]'); b.click(); }); await wait(p);
    q = (await srv(p, 'quotes'))[0]; expect(q.items[1].urgency === '', 'לא בוטל: ' + q.items[1].urgency);
  });
  await browser.close();
  server.close(); const pass = results.filter(Boolean).length; console.log(`\n${pass}/${results.length} עברו · צילומים: ${SITE}`); process.exit(pass === results.length ? 0 : 1);
})();
