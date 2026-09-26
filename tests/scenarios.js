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
  const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('PAGEERROR', String(e))); p.on('console', (m) => { if (m.type() === 'warning' && m.text().includes('[queue]')) console.log('QUEUEWARN', m.text().slice(0, 400)); });
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

  // ---- תשתית: פריט שהענן דוחה לא חוסם את התור ----
  await p.evaluate(async (t) => { await DB.save('customers', { name: 'e2e דחוי', legacy_id: t + ':dup' }); await DB.save('customers', { name: 'e2e דחוי 2', legacy_id: t + ':dup' }); await DB.save('customers', { name: 'e2e אחרי', legacy_id: t + ':after' }); }, TAG);
  await settle(p);
  ok('queue: rejected row moved to failed, rest sent', (await p.evaluate(async (t) => (await DB._failed()).filter((f) => f.row && f.row.legacy_id === t + ':dup').length, TAG)) === 1
     && !!(await p.evaluate(async (t) => (await sb.from('customers').select('id').eq('legacy_id', t + ':after').maybeSingle()).data, TAG)));

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
  await p.evaluate(async ([jid, t]) => { await DB.save('quotes', { job_id: jid, number: 'e2e', status: 'draft', items: [], total: 0, legacy_id: t + ':q-s3' }); }, [jid, TAG]);
  await p.click('[data-stage="sent"]'); await p.waitForTimeout(100);
  ok('S3: chip 0 days', (await p.locator('#v-job .chip.days').textContent()).includes('0'));
  await p.evaluate(async (jid) => { await DB.save('jobs', { id: jid, quote_sent_at: new Date(Date.now() - 4 * 864e5).toISOString() }); render(); }, jid);
  ok('S3: 4 days', (await p.locator('#v-job .chip.days').textContent()).includes('4'));
  await p.click('#tabs [data-tab="work"]'); ok('S3: waiting section', (await p.locator('#cust-list').textContent()).includes('מחכות לתשובה'));
  await p.screenshot({ path: OUT + '/s3-work.png' });
  await p.evaluate(async (jid) => { await DB.save('jobs', { id: jid, quote_sent_at: new Date(Date.now() - 8 * 864e5).toISOString() }); render(); }, jid);
  ok('S3: last reminder at 8 days', (await p.locator('#cust-list').textContent()).includes('תזכורת אחרונה'));
  await settle(p);

  // ---- S1: בלי רשת: לקוח + עבודה + 3 תמונות + הערות → רשת → במחשב הכל שם ----
  const N2 = 'e2e ביקור ' + String(Date.now()).slice(-5);
  await ctx.setOffline(true); await p.click('#tabs [data-tab="customers"]'); await p.click('#plus'); await p.click('[data-new="customer"]');
  await p.fill('#f-name', N2); await p.click('#f-save'); await p.waitForSelector('#v-customer:not([hidden]) h2');
  await p.click('[data-act="new-job"]'); await p.fill('#j-title', 'e2e ביקור'); await p.click('#j-save'); await p.waitForSelector('#v-job:not([hidden]) .card');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4AWP4z8DwHwyBNBAAAP4dA/0Xm0J3AAAAAElFTkSuQmCC', 'base64');
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-act="add-photos"]')]);
  await fc.setFiles([1, 2, 3].map((i) => ({ name: `p${i}.png`, mimeType: 'image/png', buffer: png })));
  await p.waitForFunction(() => document.querySelectorAll('#v-job .thumbs .th').length === 3, null, { timeout: 15000 });
  ok('S1: 3 thumbs offline, marked pending', (await p.locator('#v-job .thumbs .th.pending').count()) === 3);
  await p.fill('#j-notes', 'רוכבים 20 מטר'); await p.locator('#j-notes').blur(); await p.waitForTimeout(200);
  await ctx.setOffline(false); await p.evaluate(() => DB.sync()); await settle(p);
  const ctx2 = await b.newContext({ viewport: { width: 1280, height: 800 }, locale: 'he-IL' }); const p2 = await login(ctx2);
  await p2.fill('#search', N2); await p2.click('#cust-list .row'); await p2.click('#v-customer .row[data-job]'); await p2.waitForSelector('#v-job:not([hidden]) .card');
  ok('S1: desktop sees 3 photos, none pending', (await p2.locator('#v-job .thumbs .th').count()) === 3 && (await p2.locator('#v-job .thumbs .th.pending').count()) === 0);
  ok('S1: desktop sees notes', (await p2.locator('#j-notes').inputValue()).includes('רוכבים 20 מטר'));
  ok('S1: full photo url works', !!(await p2.evaluate(async () => { const m = D.media.find((m) => m.storage_path && m.job_id === S.params.id); return m && (await DB.photoUrl(m.storage_path)); })));
  await p2.screenshot({ path: OUT + '/s1-desktop-job.png', fullPage: true }); await ctx2.close();

  // ---- S2: הצעה במחשב, סגירה באמצע → בטלפון אותה טיוטה ----
  const pd = await login(await b.newContext({ viewport: { width: 1280, height: 800 }, locale: 'he-IL' }));
  await pd.fill('#search', N2); await pd.click('#cust-list .row'); await pd.click('#v-customer .row[data-job]'); await pd.waitForSelector('#v-job:not([hidden]) .card');
  await pd.click('[data-act="new-quote"]'); await pd.waitForSelector('#v-quote:not([hidden]) #q-items');
  await pd.click('[data-act="add-item"]'); await pd.fill('#i-title', 'חידוש רוכבים'); await pd.fill('#i-qty', '20'); await pd.fill('#i-unit', 'מטר'); await pd.fill('#i-ppu', '300'); await pd.click('#i-save'); await pd.waitForSelector('#sheet-wrap', { state: 'detached' });
  await pd.click('[data-act="add-item"]'); await pd.fill('#i-title', 'קופינג'); await pd.fill('#i-qty', '10'); await pd.fill('#i-ppu', '250'); await pd.click('#i-save'); await pd.waitForSelector('#sheet-wrap', { state: 'detached' });
  const tot = await pd.locator('#q-totals').textContent();
  ok('S2: totals 8,500 / 10,030', tot.includes('8,500') && tot.includes('10,030'), tot.replace(/\s+/g, ' ').slice(0, 120));
  const qnum = (await pd.locator('#q-number').textContent()).trim(); ok('S2: number assigned YYYY-NNN', /^\d{4}-\d{3}$/.test(qnum), qnum);
  await pd.screenshot({ path: OUT + '/s2-desktop-quote.png', fullPage: true });
  await settle(pd); await pd.context().close();
  await p.evaluate(() => DB.loadAll().then(render)); await p.click('#tabs [data-tab="customers"]'); await p.fill('#search', N2); await p.click('#cust-list .row'); await p.click('#v-customer .row[data-job]'); await p.waitForSelector('#v-job [data-quote]'); await p.click('#v-job [data-quote]'); await p.waitForSelector('#v-quote:not([hidden]) #q-items');
  ok('S2: phone shows same draft', (await p.locator('#q-totals').textContent()).includes('10,030') && (await p.locator('#v-quote').textContent()).includes('חידוש רוכבים'));
  await p.screenshot({ path: OUT + '/s2-phone-quote.png', fullPage: true });
  // ---- S5: עריכה אחרי "נשלחה" → גרסה 1 נשמרת, גרסה 2 מוצגת ----
  await p.click('[data-act="mark-sent"]'); await p.waitForFunction(() => document.querySelector('#v-quote .chip.sent'));
  ok('S5: job stage sent', (await p.evaluate(() => D.jobs.find((j) => j.id === Q.cur(S.params.id).job_id).stage)) === 'sent');
  await p.click('[data-act="edit-item"][data-idx="0"]'); await p.fill('#i-ppu', '320'); await p.click('#i-save'); await p.waitForSelector('#sheet-wrap', { state: 'detached' });
  ok('S5: version 2', (await p.locator('#q-version').textContent()).trim() === '2');
  await p.click('[data-act="versions"]'); ok('S5: version 1 kept with old price', (await p.locator('#v-versions').textContent()).includes('300') && (await p.locator('#v-versions').textContent()).includes('גרסה 1'));
  await settle(p);
  const vrows = await p.evaluate(async () => (await sb.from('quote_versions').select('version').eq('quote_id', S.params.id)).data);
  ok('S5: version row in cloud', Array.isArray(vrows) && vrows.length === 1 && vrows[0].version === 1);

  // ---- S7: תצוגת-הדפסה מכילה את כל חלקי הפורמט הקיים ----
  await p.click('[data-act="pdf"]'); await p.waitForSelector('#v-print:not([hidden]) .page');
  const pr = await p.locator('#v-print').textContent();
  for (const s of ['אור בגג', 'אור פריאס', '054-5725681', 'ח.פ. 307951517', 'הצעת מחיר #', 'בתוקף עד', 'לכבוד', 'תיאור הסעיף', 'סה"כ לפני מע"מ', 'מע"מ 18%', 'סה"כ לתשלום', 'מקדמה 30%', 'תנאי תשלום', 'עבודות בלתי-צפויות', 'תנאים כלליים', 'חתימת הלקוח', 'חתימת הקבלן', 'הופק מאפליקציית']) ok('S7: print has "' + s + '"', pr.includes(s));
  await p.pdf({ path: OUT + '/quote.pdf', format: 'A4', printBackground: true });
  await p.click('#v-print [data-back]'); await p.waitForSelector('#v-quote:not([hidden])');
  // ---- כסף: אישור → סוכם מההצעה; תשלום חלקי; חשבונית; תשלום מלא → שולם ----
  await p.click('#v-quote [data-back]'); await p.waitForSelector('#v-job:not([hidden]) .card');
  await p.click('[data-stage="approved"]'); await p.waitForFunction(() => document.querySelector('#v-job .chip.approved'));
  const agreed = await p.evaluate(() => D.jobs.find((j) => j.id === S.params.id).price_agreed);
  ok('money: price agreed from quote (10,502 = 8,900+vat)', Math.round(agreed) === 10502, String(agreed));
  await p.click('[data-stage="doing"]'); await p.waitForFunction(() => document.querySelector('#v-job .chip.doing'));
  await p.click('[data-act="add-payment"]'); await p.fill('#p-amount', '5000'); await p.click('#p-save'); await p.waitForSelector('#sheet-wrap', { state: 'detached' });
  ok('money: remaining shown', (await p.locator('#v-job').textContent()).includes('5,502'));
  await p.click('#tabs [data-tab="money"]'); await p.waitForSelector('#v-money:not([hidden])');
  const mt = await p.locator('#v-money').textContent(); ok('money: screen lists debt and no-invoice payment', mt.includes('5,502') && mt.includes('הוצאתי חשבונית'));
  await p.screenshot({ path: OUT + '/money.png' });
  await p.click('#v-money [data-inv]'); await p.waitForTimeout(200);
  await p.click('#tabs [data-tab="customers"]'); await p.fill('#search', N2); await p.click('#cust-list .row'); await p.click('#v-customer .row[data-job]'); await p.waitForSelector('#v-job:not([hidden]) .card');
  ok('money: invoice marked', (await p.locator('#v-job').textContent()).includes('חשבונית הוצאה'));
  await p.click('[data-act="add-payment"]'); await p.click('#p-save'); await p.waitForSelector('#sheet-wrap', { state: 'detached' });
  await p.waitForFunction(() => document.querySelector('#v-job .chip.paid'), null, { timeout: 5000 }).catch(() => {});
  ok('money: full payment closes job (paid)', (await p.locator('#v-job .chip.paid').count()) === 1);
  await settle(p);

  // ---- עוד: הגדרות, קטלוג, גיבוי לקובץ, התראה ----
  await p.click('#tabs [data-tab="more"]'); await p.click('[data-open="settings"]'); await p.waitForSelector('#v-settings:not([hidden]) #s-biz');
  await p.fill('#s-biz', 'אור בגג'); await p.fill('#s-valid', '45'); await p.click('[data-act="save-settings"]'); await settle(p);
  ok('more: settings saved in cloud', (await p.evaluate(async () => (await sb.from('settings').select('quote_template').maybeSingle()).data.quote_template.validityDays)) === 45);
  await p.click('#tabs [data-tab="more"]'); await p.click('[data-open="catalog"]'); await p.waitForSelector('#v-catalog:not([hidden])');
  await p.click('[data-act="cat-add"]'); await p.fill('#c-name', 'e2e פריט'); await p.fill('#c-price', '123'); await p.click('#c-save'); await p.waitForSelector('#sheet-wrap', { state: 'detached' });
  ok('more: catalog item added', (await p.locator('#v-catalog').textContent()).includes('e2e פריט'));
  await p.click('#tabs [data-tab="more"]');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act="backup-file"]')]);
  const bk = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  ok('more: backup file has all keys', ['customers', 'jobs', 'quotes', 'payments', 'settings'].every((k) => k in bk) && bk.customers.length > 0);
  await p.evaluate(async () => { await sb.from('alerts').insert({ user_id: D.uid, kind: 'test', message: 'e2e התראת בדיקה' }); await DB.loadAll(); render(); });
  ok('more: alert banner shown', (await p.locator('#alerts .alert').count()) >= 1, String(await p.locator('#alerts .alert').count()));
  while (await p.locator('#alerts [data-seen]').count()) { await p.click('#alerts [data-seen]'); await p.waitForTimeout(150); }
  ok('more: alert dismissed', (await p.locator('#alerts .alert').count()) === 0);
  await settle(p);

  // ---- ממצאי ביקורת-השבירה ----
  // (1) שני מכשירים עורכים שדות שונים של אותו לקוח — שניהם שורדים
  const cc = await p.evaluate(async () => (await DB.save('customers', { name: 'e2e מקבילי', phone: '0500000001', address: 'כתובת מקורית' })).id); await settle(p);
  const ctxB = await b.newContext({ viewport: { width: 1280, height: 800 }, locale: 'he-IL' }); const pB = await login(ctxB);
  await p.evaluate(async (id) => { await DB.save('customers', { id, address: 'כתובת חדשה מ-A' }); }, cc); await settle(p);
  await pB.evaluate(async (id) => { await DB.save('customers', { id, phone: '0500000002' }); }, cc); await settle(pB); await ctxB.close();
  const merged = await p.evaluate(async (id) => (await sb.from('customers').select('phone,address').eq('id', id).single()).data, cc);
  ok('adv: concurrent field edits both survive', merged && merged.phone === '0500000002' && merged.address === 'כתובת חדשה מ-A', JSON.stringify(merged));
  // (2-4) כמות שלילית/אפס נחסמת; הנחה מוגבלת
  await p.click('#tabs [data-tab="customers"]'); await p.fill('#search', N2); await p.click('#cust-list .row'); await p.click('#v-customer .row[data-job]'); await p.waitForSelector('#v-job [data-quote]'); await p.click('#v-job [data-quote]'); await p.waitForSelector('#v-quote:not([hidden]) #q-items');
  const nBefore = await p.evaluate(() => Q.cur(S.params.id).items.length);
  await p.click('[data-act="add-item"]'); await p.fill('#i-title', 'שלילי'); await p.fill('#i-qty', '-5'); await p.fill('#i-ppu', '100'); await p.click('#i-save'); await p.waitForTimeout(200);
  ok('adv: negative qty blocked', (await p.evaluate(() => Q.cur(S.params.id).items.length)) === nBefore && (await p.locator('#sheet-wrap').count()) === 1);
  await p.fill('#i-qty', '0'); await p.click('#i-save'); await p.waitForTimeout(200);
  ok('adv: zero qty blocked', (await p.evaluate(() => Q.cur(S.params.id).items.length)) === nBefore);
  await p.click('#sheet-wrap [data-close]');
  await p.click('[data-act="discount"]'); await p.selectOption('#d-type', 'percent'); await p.fill('#d-value', '150'); await p.click('#d-save'); await p.waitForSelector('#sheet-wrap', { state: 'detached' });
  const kq = await p.evaluate(() => { const q = Q.cur(S.params.id); return { d: q.discount.value, ...Q.calc(q) }; });
  ok('adv: discount capped at 100% and not above sum', kq.d === 100 && kq.disc === kq.sum && kq.before === 0, JSON.stringify(kq));
  await p.click('[data-act="discount"]'); await p.fill('#d-value', '0'); await p.click('#d-save'); await p.waitForSelector('#sheet-wrap', { state: 'detached' });
  // (5) כפתור-אחורה של הדפדפן חוזר מסך אחד
  await p.goBack(); await p.waitForTimeout(200); ok('adv: browser back → job screen', (await p.locator('#v-job:not([hidden])').count()) === 1, 'view=' + await p.evaluate(() => S.view));
  await p.goBack(); await p.waitForTimeout(200); ok('adv: browser back → customer screen', (await p.evaluate(() => S.view)) === 'customer');
  await settle(p);

  await ctx.close(); await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('CRASH', e); process.exit(2); });
