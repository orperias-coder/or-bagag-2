// בדיקת-קצה בדפדפן אמיתי (Chrome) על השרת המקומי: התחברות, לקוחות, כרטיס, עבודה, כסף, חיפוש, בלי-רשת.
// הרצה: node tests/e2e.js   (משתמש-בדיקה app2test@example.com; הסיסמה בקובץ הסקראצ'פד או במשתנה OB2_TEST_PW)
const { chromium } = require('playwright');
const fs = require('fs');
const PW = process.env.OB2_TEST_PW || fs.readFileSync(process.env.OB2_PW_FILE, 'utf8').trim();
const URL = process.env.OB2_URL || 'http://localhost:8746/';
const OUT = process.env.OB2_SHOTS || '/tmp/claude-501/ob2-shots'; fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const ok = (name, cond, extra) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' — ' + extra : '')); if (!cond) fails++; };

(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  for (const [label, vp] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 800 }]]) {
    const ctx = await b.newContext({ viewport: vp, locale: 'he-IL' });
    const p = await ctx.newPage(); const errors = [];
    p.on('pageerror', (e) => errors.push(String(e))); p.on('console', (m) => { if (m.type() === 'error' && !/ERR_INTERNET_DISCONNECTED|Failed to fetch/.test(m.text())) errors.push(m.text()); });
    await p.goto(URL); await p.waitForSelector('#login:not([hidden])', { timeout: 15000 });
    await p.fill('#li-email', 'app2test@example.com'); await p.fill('#li-pass', PW); await p.click('#li-go');
    await p.waitForSelector('[data-act="all-customers"]', { timeout: 20000 }); await p.click('[data-act="all-customers"]');
    await p.waitForFunction(() => document.querySelectorAll('#cust-list .row').length >= 2, null, { timeout: 15000 }).catch(() => {});
    const rows = await p.locator('#cust-list .row').count();
    ok(`${label}: login + customers list`, rows >= 2, rows + ' rows');
    await p.screenshot({ path: `${OUT}/${label}-1-customers.png` });
    await p.fill('#search', 'דני'); await p.waitForTimeout(200);
    ok(`${label}: search`, (await p.locator('#cust-list .row').count()) === 1 && (await p.locator('#cust-list .row .name').first().textContent()).includes('דני'));
    await p.click('#cust-list .row'); await p.waitForSelector('#v-customer:not([hidden]) .card');
    const jobs = await p.locator('#v-customer .row[data-job]').count();
    ok(`${label}: customer card with jobs`, jobs === 2, jobs + ' jobs');
    ok(`${label}: days-since-sent chip`, await p.locator('#v-customer .chip.days').count() === 1, await p.locator('#v-customer .chip.days').first().textContent().catch(() => ''));
    await p.screenshot({ path: `${OUT}/${label}-2-customer.png` });
    await p.click('#v-customer .row[data-job]'); await p.waitForSelector('#v-job:not([hidden]) .card');
    const jobText = await p.locator('#v-job').textContent();
    ok(`${label}: job screen shows quote total`, jobText.includes('10,030'), '');
    ok(`${label}: job screen shows visit notes`, jobText.includes('רוכבים 20 מטר'));
    await p.screenshot({ path: `${OUT}/${label}-3-job.png`, fullPage: true });
    await p.click('#v-job [data-back]'); await p.waitForSelector('#v-customer:not([hidden])');
    await p.click('#v-customer [data-back]'); await p.waitForSelector('#v-customers:not([hidden])');
    ok(`${label}: back navigation`, true);
    await p.click('#tabs [data-tab="money"]'); await p.waitForSelector('#v-money:not([hidden])');
    const money = await p.locator('#v-money').textContent();
    ok(`${label}: money screen (owed 7,000, no-invoice payment)`, money.includes('7,000') && money.includes('5,000'));
    await p.screenshot({ path: `${OUT}/${label}-4-money.png` });
    await p.click('#tabs [data-tab="work"]'); await p.waitForSelector('#cust-list .row');
    ok(`${label}: work tab grouped by stage`, (await p.locator('#cust-list .section').count()) >= 2);
    // בלי רשת: המסך נפתח מהעותק המקומי
    await ctx.setOffline(true); await p.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await p.waitForSelector('[data-act="all-customers"]', { timeout: 15000 }).catch(() => {}); await p.click('[data-act="all-customers"]').catch(() => {});
    ok(`${label}: offline reload shows cached customers`, (await p.locator('#cust-list .row').count()) >= 2);
    await ctx.setOffline(false);
    ok(`${label}: no JS errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('CRASH', e); process.exit(2); });
