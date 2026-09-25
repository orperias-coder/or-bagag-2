# אור בגג 2 — תוכנית ביצוע מא' עד ת'

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** אפליקציה חדשה לאור בגג, 4 מסכים (לקוחות · עבודה בשלבים · הצעת מחיר + PDF · כסף), עם כל הנתונים הישנים, עמידה ב-8 תרחישי-הקבלה של המסמך המאושר, באוויר בכתובת חדשה — בלי שאלה אחת לאור עד הסוף.

**Architecture:** דף-אינטרנט (PWA) בקבצים סטטיים בלי build: `index.html` + `style.css` + `app.js` (ניווט ומסכים) + `data.js` (גישה לענן, תור-כתיבה לבלי-רשת, יומן-אירועים) + `quote.js` (עורך הצעות, תצוגת-הדפסה). הענן = Supabase, סכימת `app2` (קיימת, 8 טבלאות עם RLS ו-`deleted_at`). הישנה (`public.sync_records`) לא נגעת. אחסון תמונות: bucket `app2-media`.

**Tech Stack:** HTML/CSS/JS ללא ספריות מלבד `@supabase/supabase-js@2` (CDN jsdelivr). בדיקות: Playwright על Chrome מקומי (`tests/e2e.js`, `tests/scenarios.js`). SQL דרך `supabase db query --linked -f`. פריסה: GitHub Pages, ריפו חדש `orperias-coder/or-bagag-2`.

**Spec:** https://claude.ai/artifact/Qox8f5ataUPDJNzvVXjbv9 (אושר 25.09: "הכל בסדר אתה יכול להתקדם").

---

## הכרעות שנקבעו מראש (כדי שלא תהיה שאלה באמצע)

| # | נושא | הכרעה | למה |
|---|---|---|---|
| ה1 | פריסה | ריפו חדש `orperias-coder/or-bagag-2`, GitHub Pages, כתובת `https://orperias-coder.github.io/or-bagag-2/`. הישנה נשארת כמו שהיא. | אישור התוכנית = אישור הפריסה לכתובת החדשה בלבד. |
| ה2 | מספור הצעות | ממשיך את הישנה: המספר הבא `2026-029` (028 קיימת בטלפון). `settings.next_quote_number=29`. | לא לכפול מספרים. |
| ה3 | PDF | תצוגת-הדפסה HTML זהה לפורמט ההצעה הקיימת (2026-028) + `window.print()` → "שמור כ-PDF" בטלפון/מחשב, ושיתוף בוואטסאפ. בלי ספריות. | כך עובד היום, ואור רגיל. |
| ה4 | תמונות | צילום/בחירה → הקטנה ל-1600px + thumb 240px; העלאה ל-Storage; בלי רשת — נשמר בתור ומועלה כשיש. | תרחיש 1. |
| ה5 | בלי רשת | קריאה: העותק האחרון בדפדפן. כתיבה: תור ב-IndexedDB, מנוסה כל 20 שנ' וב-online. התנגשות: מי שנשמר אחרון בענן מנצח, והגרסה שנדחתה נכתבת ליומן-האירועים (לא נעלמת). | פשוט וניתן לבדיקה. |
| ה6 | תזכורות | "נשלחה" → סופר ימים. 3 ימים בלי תשובה → מופיע בראש "עבודות" תחת "מחכות לתשובה"; 7 ימים → מסומן "תזכורת אחרונה". בלי התראות-דחיפה (דורש שרת). | מה שאור ביקש 8.8/9.8. |
| ה7 | גיבוי לילי | (א) pg_cron בענן: כל לילה שומר ספירות; ירידה → שורת-התראה שהאפליקציה מציגה בפתיחה. (ב) על המק: launchd ב-03:00 מריץ `supabase db dump` לתיקיית הדרייב "Or BaGag - גיבויים/app2/". (ג) כפתור "גיבוי לקובץ" באפליקציה. | תרחיש 6 + סעיף 6 במסמך. |
| ה8 | מחיקה | לעולם `deleted_at`. מסך "סל" ב"עוד" עם "שחזר". | חוק-הברזל. |
| ה9 | קטלוג | 14 פריטים שיובאו + 40 מהקטלוג הישן (`or-bagag-catalog.js`), מחירים לפני מע"מ, עריכה ב"עוד → קטלוג". | תרחיש 7. |
| ה10 | לקוחות-ניסיון ישנים | לא נוגעים. אור מוחק לסל בעצמו אם ירצה. | לא מוחקים נתונים. |
| ה11 | הצעדים היחידים של אור | (1) בסיום: לפתוח את הישנה בטלפון פעם אחת, "גיבוי" → ייבוא חוזר (הצעות 025-028). (2) להיכנס לחדשה עם האימייל והסיסמה. הכל אחר לא דורש אותו. | אין דרך אחרת להגיע לנתוני הטלפון. |
| ה12 | סגירת הישנה | לא בתוכנית. הישנה נשארת פתוחה עד שאור יגיד. | הכרעת אור. |

## מבנה קבצים

- `index.html` — מעטפת, מסכים ריקים, טפסים כתבניות `<template>`.
- `style.css` — עיצוב (קיים, מתרחב).
- `data.js` — **חדש.** `DB`: טעינה, `save(table,row)` (insert/update עם יומן-אירועים ותור), `trash/restore`, `queue`, `sync()`, `uploadPhoto`.
- `app.js` — ניווט, המסכים (לקוחות/עבודה/כסף/עוד), טפסים.
- `quote.js` — **חדש.** עורך הצעה, חישובים, גרסאות, תצוגת-הדפסה.
- `sql/003_counts.sql` — טבלת ספירות + pg_cron + התראות.
- `sql/004_seq.sql` — מונה-הצעות = 29.
- `import/import_media.py` — תמונות מלאות מהגיבויים ל-Storage.
- `import/import_catalog.py` — הקטלוג הישן ל-settings.catalog.
- `bin/backup-nightly.sh`, `bin/com.orbagag2.backup.plist` — גיבוי לילי במק.
- `tests/e2e.js` (קיים), `tests/scenarios.js` — **חדש**, 8 תרחישי-הקבלה.
- `tests/run.sh` — מריץ שרת מקומי + שתי חבילות-הבדיקה.

## איך מריצים בדיקות (לכל משימה)

```bash
cd ~/Documents/Claude/Projects/or-bagag-2
(python3 -m http.server 8746 --bind 127.0.0.1 >/dev/null 2>&1 &)
export OB2_PW_FILE=/private/tmp/claude-501/-Users-orperias/d7298096-2519-4dcf-b226-3ec99d3e50f4/scratchpad/app2test.pw
node tests/e2e.js && node tests/scenarios.js
```
משתמש-הבדיקה: `app2test@example.com` (uid `f234ee6d-c039-4976-a166-f8dd962e7a97`). כל בדיקה מנקה אחריה (מוחקת לסל את מה שיצרה, ואז `delete` אמיתי רק לשורות עם `legacy_id like 'e2e:%'` דרך SQL — זה החריג היחיד לחוק-המחיקה, ורק על נתוני-בדיקה של משתמש-הבדיקה).

---

### Task 1: שכבת-נתונים עם תור-כתיבה ויומן-אירועים (`data.js`)

**Files:**
- Create: `data.js`
- Modify: `index.html` (טעינת `data.js` לפני `app.js`), `app.js` (החלפת `loadAll` הישן ב-`DB.loadAll`)
- Test: `tests/scenarios.js` (בדיקה `data-queue`)

- [ ] **Step 1: בדיקה נכשלת — כתיבה בלי רשת נשמרת בתור ועולה כשיש רשת**

```js
// tests/scenarios.js — שלד + בדיקה ראשונה
const { chromium } = require('playwright'); const fs = require('fs');
const PW = process.env.OB2_TEST_PW || fs.readFileSync(process.env.OB2_PW_FILE, 'utf8').trim();
const URL = process.env.OB2_URL || 'http://localhost:8746/';
let fails = 0; const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + x : '')); if (!c) fails++; };
async function login(ctx) { const p = await ctx.newPage(); await p.goto(URL); await p.waitForSelector('#login:not([hidden])');
  await p.fill('#li-email', 'app2test@example.com'); await p.fill('#li-pass', PW); await p.click('#li-go'); await p.waitForSelector('#cust-list'); return p; }
(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL' }); const p = await login(ctx);
  // data-queue: יצירת לקוח בלי רשת → בתור → עולה כשיש רשת
  await ctx.setOffline(true);
  const id = await p.evaluate(async () => (await DB.save('customers', { name: 'e2e תור', legacy_id: 'e2e:queue' })).id);
  ok('queue: local id returned offline', !!id);
  ok('queue: pending count 1', (await p.evaluate(() => DB.pendingCount())) === 1);
  await ctx.setOffline(false); await p.evaluate(() => DB.sync()); await p.waitForFunction(() => DB.pendingCount() === 0, null, { timeout: 20000 });
  const row = await p.evaluate(async (id) => (await sb.from('customers').select('id,name').eq('id', id).single()).data, id);
  ok('queue: row reached cloud', row && row.name === 'e2e תור');
  await p.evaluate(() => DB.trash('customers', document.body.dataset.tmp || ''));
  await ctx.close(); await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('CRASH', e); process.exit(2); });
```

- [ ] **Step 2: להריץ ולראות כישלון** — `node tests/scenarios.js` → `CRASH ... DB is not defined`.

- [ ] **Step 3: מימוש `data.js`**

```js
/* data.js — הענן הוא האמת. כל כתיבה: (1) עדכון מיידי בזיכרון+עותק מקומי, (2) שורה בתור IndexedDB, (3) ניסיון מיידי לשלוח; כשל → נשאר בתור. */
const DB = (() => {
  const TABLES = ['customers', 'jobs', 'quotes', 'quote_versions', 'payments', 'media', 'settings', 'events', 'alerts'];
  const DEVICE = (() => { try { let d = localStorage.getItem('ob2_device'); if (!d) { d = crypto.randomUUID().slice(0, 8); localStorage.setItem('ob2_device', d); } return d; } catch (e) { return 'x'; } })();
  const uuid = () => crypto.randomUUID();
  let idb;
  function openIDB() { return idb || (idb = new Promise((res, rej) => { const r = indexedDB.open('ob2', 1); r.onupgradeneeded = () => r.result.createObjectStore('queue', { keyPath: 'qid' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); })); }
  async function qAll() { const db = await openIDB(); return new Promise((res) => { const rq = db.transaction('queue').objectStore('queue').getAll(); rq.onsuccess = () => res(rq.result || []); }); }
  async function qPut(item) { const db = await openIDB(); return new Promise((res) => { const t = db.transaction('queue', 'readwrite'); t.objectStore('queue').put(item); t.oncomplete = res; }); }
  async function qDel(qid) { const db = await openIDB(); return new Promise((res) => { const t = db.transaction('queue', 'readwrite'); t.objectStore('queue').delete(qid); t.oncomplete = res; }); }
  let pending = 0; const listeners = new Set();
  function notify() { listeners.forEach((f) => f()); }
  async function refreshPending() { pending = (await qAll()).length; notify(); }

  function local(table, row) {            // עדכון בזיכרון (D) + עותק מקומי
    const arr = D[table]; if (!Array.isArray(arr)) return;
    const i = arr.findIndex((x) => x.id === row.id);
    if (i >= 0) arr[i] = { ...arr[i], ...row }; else arr.unshift(row);
    cacheSave();
  }
  async function send(item) {             // שליחה אחת לענן; זורק בכשל
    const { table, row, op } = item;
    if (op === 'upsert') { const { error } = await sb.from(table).upsert(row, { onConflict: 'id' }); if (error) throw error; }
    if (op === 'event') { const { error } = await sb.from('events').insert(row); if (error) throw error; }
  }
  async function enqueue(item) { item.qid = item.qid || uuid(); item.at = item.at || Date.now(); await qPut(item); await refreshPending(); trySync(); }
  let syncing = false;
  async function sync() {
    if (syncing || !navigator.onLine) return; syncing = true;
    try { for (const item of (await qAll()).sort((a, b) => a.at - b.at)) { try { await send(item); await qDel(item.qid); } catch (e) { console.warn('[queue]', e.message); break; } } }
    finally { syncing = false; await refreshPending(); }
  }
  const trySync = () => setTimeout(sync, 50);
  setInterval(sync, 20000); window.addEventListener('online', sync);

  async function save(table, patch) {     // יצירה/עדכון. מחזיר את השורה המלאה.
    const isNew = !patch.id; const now = new Date().toISOString();
    const row = { ...(isNew ? { id: uuid(), created_at: now } : (D[table] || []).find((x) => x.id === patch.id) || {}), ...patch, updated_at: now };
    delete row.user_id;                    // הענן ממלא auth.uid()
    local(table, row);
    await enqueue({ table, row, op: 'upsert' });
    await enqueue({ op: 'event', row: { entity: table, entity_id: row.id, action: isNew ? 'create' : 'update', device: DEVICE, diff: patch } });
    return row;
  }
  async function trash(table, id) { return save(table, { id, deleted_at: new Date().toISOString() }); }
  async function restore(table, id) { return save(table, { id, deleted_at: null }); }
  async function stage(jobId, stage) {     // מעבר שלב = עדכון + חותמת + אירוע 'stage'
    const now = new Date().toISOString(); const patch = { id: jobId, stage, stage_changed_at: now };
    if (stage === 'sent') patch.quote_sent_at = now; if (stage === 'approved') patch.approved_at = now; if (stage === 'doing') patch.started_at = now; if (stage === 'paid') patch.paid_at = now;
    const row = await save('jobs', patch); await enqueue({ op: 'event', row: { entity: 'jobs', entity_id: jobId, action: 'stage', device: DEVICE, diff: { stage } } }); return row;
  }
  async function loadAll() {
    const sel = { customers: '*', jobs: '*', quotes: '*', payments: '*', media: 'id,job_id,customer_id,kind,storage_path,thumb_data,taken_at,caption,created_at,updated_at,deleted_at', alerts: '*' };
    const res = await Promise.all(Object.entries(sel).map(([t, s]) => sb.from(t).select(s).order('updated_at', { ascending: false }).limit(t === 'media' ? 600 : 2000).then((r) => [t, r])));
    for (const [t, r] of res) { if (r.error) throw r.error; D[t] = r.data; }
    const st = await sb.from('settings').select('*').maybeSingle(); if (!st.error && st.data) D.settings = st.data;
    D.loadedAt = Date.now(); cacheSave();
    // מיזוג: שורות שעדיין בתור גוברות על מה שהגיע מהענן (עוד לא עלו)
    for (const it of await qAll()) if (it.op === 'upsert') local(it.table, it.row);
  }
  async function uploadPhoto(file, jobId, customerId) {   // הקטנה + thumb + שורה + העלאה (בתור אם אין רשת)
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
    const draw = (max) => { const s = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c; };
    const thumb = draw(240).toDataURL('image/jpeg', 0.7);
    const full = await new Promise((res) => draw(1600).toBlob(res, 'image/jpeg', 0.85));
    const row = await save('media', { job_id: jobId, customer_id: customerId, kind: 'photo', thumb_data: thumb, taken_at: new Date().toISOString() });
    const path = `${(await sb.auth.getUser()).data.user.id}/${row.id}.jpg`;
    await enqueue({ op: 'upload', row: { id: row.id, path }, blob: full });
    return row;
  }
  // תור-העלאות: אותו מנגנון, op='upload'
  const _send = send;
  send = async (item) => { if (item.op !== 'upload') return _send(item); const { error } = await sb.storage.from('app2-media').upload(item.row.path, item.blob, { contentType: 'image/jpeg', upsert: true }); if (error) throw error; await _send({ table: 'media', op: 'upsert', row: { id: item.row.id, storage_path: item.row.path, updated_at: new Date().toISOString() } }); local('media', { id: item.row.id, storage_path: item.row.path }); };
  async function photoUrl(path) { const { data } = await sb.storage.from('app2-media').createSignedUrl(path, 3600); return data && data.signedUrl; }
  refreshPending();
  return { save, trash, restore, stage, loadAll, sync, uploadPhoto, photoUrl, pendingCount: () => pending, onChange: (f) => listeners.add(f), DEVICE, uuid };
})();
```

הערה: `D`, `cacheSave`, `sb` מוגדרים ב-`app.js` (משתנים גלובליים) — ב-`index.html` הסדר: `app.js` מגדיר את `sb`/`D`/`cacheSave` **לפני** `data.js`? לא — `data.js` נטען **אחרי** `app.js` אבל `app.js` קורא ל-`DB.loadAll()` רק ב-`boot()`. לכן: להעביר את `boot()` לסוף `data.js`? הפתרון הפשוט: `index.html` טוען `app.js`, ואז `data.js`, ואז `<script>boot()</script>`; ב-`app.js` להסיר את הקריאה `boot();` בסוף.

- [ ] **Step 4: לחבר ב-`app.js`** — להחליף את `loadAll()` הישן ב-`DB.loadAll()` (3 מקומות: `boot`, `#refresh`), להסיר את `boot();` מסוף הקובץ, ולהוסיף בסוף `index.html`: `<script src="data.js"></script><script>boot();</script>`. נקודת-הסנכרון בכותרת: `DB.onChange(() => { $('#netdot').classList.toggle('pending', DB.pendingCount() > 0); $('#netdot').title = DB.pendingCount() ? DB.pendingCount() + ' עדיין לא עלו' : 'מסונכרן'; })` + CSS `#netdot.pending{background:var(--acc)}`.

- [ ] **Step 5: להריץ** — `node tests/e2e.js && node tests/scenarios.js` → `ALL PASSED` פעמיים.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "data.js: תור-כתיבה לבלי-רשת, יומן-אירועים, העלאת תמונות"`

---

### Task 2: לקוח — הוספה, עריכה, סל ושחזור (תרחיש 4)

**Files:** Modify `index.html` (תבנית טופס לקוח), `app.js` (`openCustomerForm`, כפתורי עריכה/סל בכרטיס, מסך "סל" ב"עוד"), `style.css` (טופס-גיליון תחתון `.sheet`). Test: `tests/scenarios.js` (תרחיש 4).

- [ ] **Step 1: בדיקה נכשלת (תרחיש 4)**

```js
  // S4: יוצר לקוח → מוחק → בסל → משחזר עם כל מה שהיה לו
  await p.click('#plus'); await p.click('[data-new="customer"]');
  await p.fill('#f-name', 'e2e לקוח סל'); await p.fill('#f-phone', '0501111111'); await p.fill('#f-address', 'רחוב הבדיקה 4'); await p.click('#f-save');
  await p.waitForSelector('#v-customer:not([hidden])'); ok('S4: customer created', (await p.locator('#v-customer h2').textContent()).includes('e2e לקוח סל'));
  await p.click('[data-act="trash-customer"]'); await p.click('#confirm-yes'); await p.waitForSelector('#v-customers:not([hidden])');
  ok('S4: not in list after trash', !(await p.locator('#cust-list').textContent()).includes('e2e לקוח סל'));
  await p.click('#tabs [data-tab="more"]'); await p.click('[data-open="trash"]'); await p.waitForSelector('#v-trash:not([hidden])');
  ok('S4: in trash', (await p.locator('#v-trash').textContent()).includes('e2e לקוח סל'));
  await p.click('#v-trash [data-restore]'); await p.click('#tabs [data-tab="customers"]'); await p.fill('#search', 'e2e לקוח סל');
  ok('S4: restored with phone+address', (await p.locator('#cust-list').textContent()).includes('0501111111'));
```

- [ ] **Step 2: להריץ → FAIL** (אין `[data-new]`).

- [ ] **Step 3: מימוש** — ב-`index.html` תבנית:

```html
<template id="t-customer-form"><div class="sheet"><div class="sheet-h"><b id="f-title">לקוח חדש</b><button class="btn sm ghost" data-close>סגור</button></div>
<label>שם<input id="f-name" required></label><label>טלפון<input id="f-phone" inputmode="tel" dir="ltr"></label><label>כתובת<input id="f-address"></label><label>הערות<textarea id="f-notes" rows="2"></textarea></label>
<button class="btn pri" id="f-save">שמור</button></div></template>
<template id="t-plus"><div class="sheet"><div class="sheet-h"><b>מה להוסיף?</b><button class="btn sm ghost" data-close>סגור</button></div><button class="btn" data-new="customer">לקוח חדש</button><button class="btn" data-new="job">עבודה ללקוח קיים</button></div></template>
<template id="t-confirm"><div class="sheet"><b id="confirm-title"></b><div class="dim" id="confirm-msg"></div><div class="row2"><button class="btn" data-close>בטל</button><button class="btn danger" id="confirm-yes">כן</button></div></div></template>
```

ב-`app.js`:

```js
function sheet(tplId) { closeSheet(); const n = document.getElementById(tplId).content.cloneNode(true); const w = document.createElement('div'); w.id = 'sheet-wrap'; w.appendChild(n); document.body.appendChild(w); w.addEventListener('click', (e) => { if (e.target === w || e.target.closest('[data-close]')) closeSheet(); }); return w; }
function closeSheet() { const w = $('#sheet-wrap'); if (w) w.remove(); }
function confirmAsk(title, msg, cb) { const w = sheet('t-confirm'); $('#confirm-title', w).textContent = title; $('#confirm-msg', w).textContent = msg; $('#confirm-yes', w).onclick = () => { closeSheet(); cb(); }; }
function openCustomerForm(c) {
  const w = sheet('t-customer-form'); if (c) { $('#f-title', w).textContent = 'עריכת לקוח'; $('#f-name', w).value = c.name || ''; $('#f-phone', w).value = c.phone || ''; $('#f-address', w).value = c.address || ''; $('#f-notes', w).value = c.notes || ''; }
  $('#f-save', w).onclick = async () => { const name = $('#f-name', w).value.trim(); if (!name) return toast('צריך שם'); const row = await DB.save('customers', { ...(c ? { id: c.id } : {}), name, phone: $('#f-phone', w).value.trim() || null, address: $('#f-address', w).value.trim() || null, notes: $('#f-notes', w).value.trim() || null, source: c ? c.source : 'ידני' }); closeSheet(); show('customer', { id: row.id }); toast('נשמר'); };
}
```

בכרטיס הלקוח (`renderCustomer`): שורת כפתורים `<div class="row2"><button class="btn sm" data-act="edit-customer">ערוך</button><button class="btn sm" data-act="new-job">עבודה חדשה</button><button class="btn sm danger" data-act="trash-customer">לסל</button></div>`.
מסך סל: `<section id="v-trash" class="view" hidden>` + `renderTrash()` שמציג `customers/jobs/quotes` עם `deleted_at`, כפתור `data-restore` שקורא `DB.restore(table,id)`. ב"עוד": כרטיס "סל המיחזור" עם `data-open="trash"`.
מאזין-קליקים: `data-new="customer"` → `openCustomerForm()`; `data-act="edit-customer"` → `openCustomerForm(c)`; `data-act="trash-customer"` → `confirmAsk('להעביר לסל?', 'הלקוח והעבודות שלו יועברו לסל. אפשר לשחזר.', async () => { await DB.trash('customers', c.id); for (const j of jobsOf(c.id)) await DB.trash('jobs', j.id); S.stack = []; show('customers'); })`.
`renderCustomers` ממשיך לסנן `live()`.

- [ ] **Step 4: להריץ → PASS.** לצלם `phone` ו-`desktop` של הטופס ולבדוק בעיניים שהטופס נגיש לאגודל (כפתורים ≥44px).
- [ ] **Step 5: Commit** `feat: לקוח — הוספה/עריכה/סל/שחזור`

---

### Task 3: עבודה — יצירה, מעבר שלבים, "נשלחה" וספירת ימים (תרחיש 3)

**Files:** Modify `index.html` (תבנית `t-job-form`), `app.js` (`openJobForm`, כפתורי-שלב במסך העבודה, מקטע "מחכות לתשובה" ב"עבודות"). Test: תרחיש 3 (עם דילוג-זמן: הבדיקה מגדירה `quote_sent_at` 4 ימים אחורה דרך `DB.save`).

- [ ] **Step 1: בדיקה נכשלת**

```js
  // S3: "נשלחה" → ימים; 3+ ימים → "מחכות לתשובה"; 7+ → "תזכורת אחרונה"
  await p.fill('#search', 'e2e לקוח סל'); await p.click('#cust-list .row'); await p.click('[data-act="new-job"]');
  await p.fill('#j-title', 'e2e גג'); await p.fill('#j-problem', 'נזילה'); await p.click('#j-save'); await p.waitForSelector('#v-job:not([hidden])');
  await p.click('[data-stage="sent"]'); ok('S3: chip shows 0 days', (await p.locator('#v-job .chip.days').textContent()).includes('0'));
  const jid = await p.evaluate(() => S.params.id);
  await p.evaluate(async (jid) => { await DB.save('jobs', { id: jid, quote_sent_at: new Date(Date.now() - 4 * 864e5).toISOString() }); render(); }, jid);
  ok('S3: 4 days', (await p.locator('#v-job .chip.days').textContent()).includes('4'));
  await p.click('#tabs [data-tab="work"]'); ok('S3: waiting section', (await p.locator('#cust-list').textContent()).includes('מחכות לתשובה'));
  await p.evaluate(async (jid) => { await DB.save('jobs', { id: jid, quote_sent_at: new Date(Date.now() - 8 * 864e5).toISOString() }); render(); }, jid);
  ok('S3: last reminder at 8 days', (await p.locator('#cust-list').textContent()).includes('תזכורת אחרונה'));
```

- [ ] **Step 2: להריץ → FAIL.**
- [ ] **Step 3: מימוש**

```html
<template id="t-job-form"><div class="sheet"><div class="sheet-h"><b>עבודה חדשה</b><button class="btn sm ghost" data-close>סגור</button></div>
<label>שם העבודה (למשל: נזילה ברוכבים)<input id="j-title"></label><label>מה הלקוח תיאר<textarea id="j-problem" rows="2"></textarea></label><label>מועד ביקור<input id="j-visit" type="datetime-local"></label>
<button class="btn pri" id="j-save">שמור</button></div></template>
```

```js
function openJobForm(customerId) { const w = sheet('t-job-form'); $('#j-save', w).onclick = async () => { const row = await DB.save('jobs', { customer_id: customerId, title: $('#j-title', w).value.trim() || null, problem: $('#j-problem', w).value.trim() || null, visit_at: $('#j-visit', w).value ? new Date($('#j-visit', w).value).toISOString() : null, stage: $('#j-visit', w).value ? 'visit' : 'lead' }); closeSheet(); show('job', { id: row.id }); }; }
const NEXT = { lead: ['visit', 'quote'], visit: ['quote'], quote: ['sent'], sent: ['approved', 'lost'], approved: ['doing'], doing: ['paid'], paid: [], lost: ['lead'] };
const NEXT_HE = { visit: 'נקבע ביקור', quote: 'בונים הצעה', sent: 'נשלחה ללקוח', approved: 'הלקוח אישר', doing: 'התחלנו', paid: 'שולם וסגור', lost: 'לא יצא', lead: 'לפתוח מחדש' };
// במסך העבודה, מתחת לפס-השלבים:
// `<div class="row2">${NEXT[j.stage].map((s) => `<button class="btn sm ${s === 'lost' ? 'danger' : 'pri'}" data-stage="${s}">${NEXT_HE[s]}</button>`).join('')}<button class="btn sm ghost" data-act="trash-job">לסל</button></div>`
// מאזין: data-stage → if (s==='sent' && !quotesOf(j.id).length) toast('קודם בונים הצעה'); else await DB.stage(j.id, s); render();
```

ב-`renderWork`: לפני הקבוצות — `const waiting = open.filter((j) => j.stage === 'sent' && daysSince(j.quote_sent_at) >= 3)`; אם יש: `<div class="section">מחכות לתשובה · ${waiting.length}</div>` + שורות עם צ'יפ `${d} ימים` ו-`${d >= 7 ? ' · תזכורת אחרונה' : ''}` (מסומן `.chip.days.last{background:var(--red-l);color:var(--red)}`), ולחיצה על "וואטסאפ" בשורה פותחת `wa.me` עם טקסט "היי, רק לוודא שקיבלת את הצעת המחיר, אשמח לשמוע אם יש שאלות". הקבוצות הרגילות מציגות את השאר.

- [ ] **Step 4: להריץ → PASS.** צילום מסך "עבודות" עם "מחכות לתשובה".
- [ ] **Step 5: Commit** `feat: עבודה — יצירה, שלבים, נשלחה+ימים, מחכות לתשובה`

---

### Task 4: ביקור — הערות, מטראז'ים ותמונות, גם בלי רשת (תרחיש 1)

**Files:** Modify `index.html` (input file מוסתר `#photo-in` עם `capture="environment"`), `app.js` (מקטע "מהביקור" ניתן לעריכה, כפתור "צלם/הוסף תמונות", תצוגת תמונה מלאה), `style.css`. Test: תרחיש 1 (בלי רשת → 3 תמונות → רשת → קיימות בענן; נבדק במסך "מחשב" בהקשר חדש).

- [ ] **Step 1: בדיקה נכשלת**

```js
  // S1: בלי רשת: לקוח חדש + 3 תמונות → רשת → בהקשר-דפדפן חדש (=מחשב) הלקוח עם 3 תמונות
  await ctx.setOffline(true); await p.click('#tabs [data-tab="customers"]'); await p.click('#plus'); await p.click('[data-new="customer"]');
  await p.fill('#f-name', 'e2e ביקור בלי רשת'); await p.click('#f-save'); await p.waitForSelector('#v-customer:not([hidden])');
  await p.click('[data-act="new-job"]'); await p.fill('#j-title', 'e2e ביקור'); await p.click('#j-save'); await p.waitForSelector('#v-job:not([hidden])');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4AWP4z8DwHwyBNBAAAP4dA/0Xm0J3AAAAAElFTkSuQmCC', 'base64');
  await p.setInputFiles('#photo-in', [1, 2, 3].map((i) => ({ name: `p${i}.png`, mimeType: 'image/png', buffer: png })));
  await p.waitForFunction(() => document.querySelectorAll('#v-job .thumbs img').length === 3);
  ok('S1: 3 thumbs offline', true); ok('S1: pending > 0', (await p.evaluate(() => DB.pendingCount())) > 0);
  await p.fill('#j-notes', 'רוכבים 20 מטר'); await p.click('#j-notes-save');
  await ctx.setOffline(false); await p.waitForFunction(() => DB.pendingCount() === 0, null, { timeout: 60000 });
  const ctx2 = await b.newContext({ viewport: { width: 1280, height: 800 }, locale: 'he-IL' }); const p2 = await login(ctx2);
  await p2.fill('#search', 'e2e ביקור בלי רשת'); await p2.click('#cust-list .row'); await p2.click('#v-customer .row[data-job]'); await p2.waitForSelector('#v-job:not([hidden])');
  ok('S1: desktop sees 3 photos', (await p2.locator('#v-job .thumbs img').count()) === 3);
  ok('S1: desktop sees notes', (await p2.locator('#v-job').textContent()).includes('רוכבים 20 מטר'));
  ok('S1: full photo opens (signed url)', !!(await p2.evaluate(async () => { const m = D.media.find((m) => m.storage_path); return m && (await DB.photoUrl(m.storage_path)); })));
  await ctx2.close();
```

- [ ] **Step 2: להריץ → FAIL.**
- [ ] **Step 3: מימוש** — במסך העבודה: `<textarea id="j-notes" rows="3" placeholder="מטראז'ים והערות מהביקור">${esc(j.visit_notes||'')}</textarea><button class="btn sm" id="j-notes-save">שמור הערות</button>` (שמירה: `DB.save('jobs',{id, visit_notes})`; גם שמירה אוטומטית ב-`blur`). כפתור `<button class="btn" data-act="add-photos">צלם / הוסף תמונות</button>` → `$('#photo-in').click()`; `#photo-in` ב-`index.html`: `<input id="photo-in" type="file" accept="image/*" multiple capture="environment" hidden>`; מאזין `change` → לכל קובץ `await DB.uploadPhoto(file, j.id, j.customer_id)`; `render()`. תמונות בגלריה: thumb מ-`thumb_data`; לחיצה → אם `storage_path` → `DB.photoUrl` ופתיחה בשכבת-תצוגה `<div id="lightbox">` עם `<img>`; אם עוד לא עלה → toast "עדיין לא עלה — ייפתח כשיהיה רשת". סימון `.pending` על thumb בלי `storage_path` (מסגרת כתומה + טקסט "לא עלה").

- [ ] **Step 4: להריץ → PASS.** לבדוק בעיניים צילום של מסך העבודה עם 3 תמונות.
- [ ] **Step 5: Commit** `feat: ביקור — הערות, תמונות עם תור-העלאה, תצוגה מלאה`

---

### Task 5: עורך הצעת מחיר — סעיפים, קטלוג, הנחה, טיוטה נשמרת (תרחיש 2), גרסאות (תרחיש 5)

**Files:** Create `quote.js`. Modify `index.html` (`<section id="v-quote">`, תבנית `t-item-form`, טעינת `quote.js`), `app.js` (ניווט `show('quote',{id})`, כפתור "הצעה חדשה" במסך העבודה), `style.css`. Test: תרחישים 2, 5.

- [ ] **Step 1: בדיקות נכשלות**

```js
  // S2: בונה הצעה במחשב, סוגר באמצע → בטלפון הטיוטה שם עם אותם מספרים
  const pd = await (await b.newContext({ viewport: { width: 1280, height: 800 }, locale: 'he-IL' })).newPage(); // (login כמו למעלה)
  // ... login(pd) ; חיפוש 'e2e ביקור בלי רשת' → עבודה → [data-act="new-quote"]
  await pd.click('[data-act="new-quote"]'); await pd.waitForSelector('#v-quote:not([hidden])');
  await pd.click('[data-act="add-item"]'); await pd.fill('#i-title', 'חידוש רוכבים'); await pd.fill('#i-qty', '20'); await pd.fill('#i-unit', 'מטר'); await pd.fill('#i-ppu', '300'); await pd.click('#i-save');
  await pd.click('[data-act="add-item"]'); await pd.fill('#i-title', 'קופינג'); await pd.fill('#i-qty', '10'); await pd.fill('#i-ppu', '250'); await pd.click('#i-save');
  ok('S2: totals 8,500 / 10,030', (await pd.locator('#q-totals').textContent()).includes('8,500') && (await pd.locator('#q-totals').textContent()).includes('10,030'));
  const qnum = await pd.locator('#q-number').textContent(); ok('S2: number assigned YYYY-NNN', /^\d{4}-\d{3}$/.test(qnum.trim()), qnum);
  await pd.waitForFunction(() => DB.pendingCount() === 0); await pd.context().close();   // "סוגר את הדפדפן"
  await p.click('#tabs [data-tab="customers"]'); await p.evaluate(() => DB.loadAll().then(render)); await p.fill('#search', 'e2e ביקור בלי רשת'); await p.click('#cust-list .row'); await p.click('#v-customer .row[data-job]'); await p.click('#v-job [data-quote]');
  ok('S2: phone shows same draft', (await p.locator('#q-totals').textContent()).includes('10,030') && (await p.locator('#v-quote').textContent()).includes('חידוש רוכבים'));
  // S5: עריכה אחרי "נשלחה" → גרסה 1 נשמרת, מוצגת גרסה 2
  await p.click('[data-act="mark-sent"]'); await p.click('[data-act="edit-item"]:first-child'); await p.fill('#i-ppu', '320'); await p.click('#i-save');
  ok('S5: version 2', (await p.locator('#q-version').textContent()).includes('2'));
  await p.click('[data-act="versions"]'); ok('S5: version 1 kept with old price', (await p.locator('#v-versions').textContent()).includes('300'));
```

- [ ] **Step 2: להריץ → FAIL.**
- [ ] **Step 3: מימוש `quote.js`**

```js
/* quote.js — הצעת מחיר: סעיפים, קטלוג, הנחה, מע"מ, טיוטה נשמרת אוטומטית, גרסאות אחרי "נשלחה". */
const Q = {
  calc(q) { const items = (q.items || []).filter((i) => i.visible !== false); const sum = items.reduce((a, i) => a + Number(i.total || 0), 0);
    const d = q.discount || null; const disc = !d ? 0 : d.type === 'percent' ? sum * Number(d.value || 0) / 100 : Number(d.value || 0);
    const before = Math.max(0, sum - disc); const vat = before * Number(q.vat_rate ?? 18) / 100; return { sum, disc, before, vat, total: before + vat, advance: before + vat > 0 ? (before + vat) * 0.3 : 0 }; },
  async create(job) { const st = D.settings || {}; const { data: number } = await sb.rpc('next_quote_number');   // אטומי בענן; בלי רשת: "טיוטה" ומספר ניתן בשמירה הבאה
    return DB.save('quotes', { job_id: job.id, number: number || null, status: 'draft', version: 1, items: [], vat_rate: (st.quote_template && st.quote_template.vatRate) || 18, validity_days: (st.quote_template && st.quote_template.validityDays) || 30, payment_terms: (st.quote_template && st.quote_template.paymentTerms) || '30% מקדמה במועד החתימה, 70% בסיום העבודה', notes: (st.quote_template && st.quote_template.standardNotes) || '', options: { unforeseen: true, signatures: true }, total_before_vat: 0, total: 0 }); },
  async save(q, patch) {   // כל שינוי אחרי "נשלחה" = גרסה חדשה; הישנה ל-quote_versions
    const cur = live(D.quotes).find((x) => x.id === q.id) || q; let version = cur.version || 1;
    if (cur.status !== 'draft' && !patch._noVersion) { await DB.save('quote_versions', { quote_id: cur.id, version, snapshot: { ...cur } }); version += 1; }
    const next = { ...cur, ...patch, version }; const c = Q.calc(next); return DB.save('quotes', { ...patch, id: cur.id, version, total_before_vat: Math.round(c.before * 100) / 100, total: Math.round(c.total * 100) / 100 }); },
  async markSent(q) { const row = await Q.save(q, { status: 'sent', sent_at: new Date().toISOString(), _noVersion: true }); await DB.stage(q.job_id, 'sent'); return row; },
  itemFromCatalog(cat) { return { id: DB.uuid(), title: cat.name, description: cat.description || '', qty: 1, unit: cat.unit || '', price_per_unit: Number(cat.price || 0), total: Number(cat.price || 0), urgency: '', visible: true }; },
};
function renderQuote() {
  const v = $('#v-quote'); v.hidden = false; const q = live(D.quotes).find((x) => x.id === S.params.id); if (!q) return v.innerHTML = '<div class="empty">הצעה לא נמצאה</div>';
  const j = D.jobs.find((x) => x.id === q.job_id) || {}, c = custOf(j.customer_id) || {}, k = Q.calc(q);
  v.innerHTML = `<button class="back" data-back>‹ ${esc(c.name || 'חזרה')}</button>
  <div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><div><b>הצעה <span id="q-number">${esc(q.number || 'טיוטה')}</span></b> · גרסה <span id="q-version">${q.version}</span></div><span class="chip ${q.status === 'draft' ? 'quote' : 'sent'}">${{ draft: 'טיוטה', sent: 'נשלחה', accepted: 'אושרה', rejected: 'נדחתה' }[q.status]}</span></div><div class="dim">${esc(c.name)} · ${esc(c.address || '')}</div></div>
  <div class="section">סעיפים</div><div class="card" id="q-items">${(q.items || []).map((i, n) => `<div class="qitem" data-idx="${n}"><div style="flex:1"><div class="t">${esc(i.title)}</div>${i.description ? `<div class="d">${esc(i.description)}</div>` : ''}<div class="dim">${i.qty} ${esc(i.unit || '')} × ${money(i.price_per_unit)}</div></div><div style="text-align:left"><b>${money(i.total)}</b><div><button class="btn sm ghost" data-act="edit-item" data-idx="${n}">ערוך</button><button class="btn sm ghost" data-act="del-item" data-idx="${n}">הסר</button></div></div></div>`).join('') || '<div class="empty">אין סעיפים עדיין</div>'}
  <div class="row2"><button class="btn" data-act="add-item">סעיף חופשי</button><button class="btn" data-act="add-catalog">מהקטלוג</button></div></div>
  <div class="card" id="q-totals"><div class="qitem"><span>סה"כ סעיפים</span><b>${money(k.sum)}</b></div><div class="qitem"><span>הנחה <button class="btn sm ghost" data-act="discount">${q.discount ? (q.discount.type === 'percent' ? q.discount.value + '%' : money(q.discount.value)) : 'הוסף'}</button></span><b>${k.disc ? '−' + money(k.disc) : ''}</b></div><div class="qitem"><span>לפני מע"מ</span><b>${money(k.before)}</b></div><div class="qitem"><span>מע"מ ${q.vat_rate}%</span><b>${money(k.vat)}</b></div><div class="total"><span>סה"כ לתשלום</span><span>${money(k.total)}</span></div><div class="qitem dim"><span>מקדמה 30%</span><b>${money(k.advance)}</b></div></div>
  <div class="card"><label>הערות להצעה<textarea id="q-notes" rows="3">${esc(q.notes || '')}</textarea></label><label>תנאי תשלום<input id="q-terms" value="${esc(q.payment_terms || '')}"></label></div>
  <div class="row2 sticky-actions"><button class="btn pri" data-act="pdf">PDF / הדפסה</button>${q.status === 'draft' ? '<button class="btn" data-act="mark-sent">נשלחה ללקוח</button>' : `<button class="btn ghost" data-act="versions">גרסאות (${q.version})</button>`}<button class="btn ghost" data-act="share">טקסט לוואטסאפ</button></div>
  <div id="v-versions" hidden></div>`;
  $('#q-notes', v).onblur = () => Q.save(q, { notes: $('#q-notes', v).value, _noVersion: q.status === 'draft' }); $('#q-terms', v).onblur = () => Q.save(q, { payment_terms: $('#q-terms', v).value, _noVersion: q.status === 'draft' });
}
function openItemForm(q, idx) {
  const it = idx != null ? q.items[idx] : { id: DB.uuid(), title: '', description: '', qty: 1, unit: '', price_per_unit: 0, total: 0, visible: true };
  const w = sheet('t-item-form'); $('#i-title', w).value = it.title; $('#i-desc', w).value = it.description || ''; $('#i-qty', w).value = it.qty; $('#i-unit', w).value = it.unit || ''; $('#i-ppu', w).value = it.price_per_unit || '';
  $('#i-save', w).onclick = async () => { const n = { ...it, title: $('#i-title', w).value.trim(), description: $('#i-desc', w).value.trim(), qty: Number($('#i-qty', w).value) || 1, unit: $('#i-unit', w).value.trim(), price_per_unit: Number($('#i-ppu', w).value) || 0 }; n.total = Math.round(n.qty * n.price_per_unit); if (!n.title) return toast('צריך שם לסעיף');
    const items = [...q.items]; if (idx != null) items[idx] = n; else items.push(n); await Q.save(q, { items }); closeSheet(); render(); };
}
function openCatalog(q) { const cat = (D.settings && D.settings.catalog) || []; const w = sheet('t-catalog'); const list = $('#cat-list', w);
  const draw = (f) => { list.innerHTML = cat.filter((c) => !f || (c.name || '').includes(f)).map((c, i) => `<div class="row" data-cat="${i}"><div class="main"><div class="name">${esc(c.name)}</div><div class="sub">${esc(c.category || '')} · ${money(c.price)} / ${esc(c.unit || '')}</div></div></div>`).join('') || '<div class="empty">לא נמצא</div>'; };
  draw(''); $('#cat-search', w).oninput = (e) => draw(e.target.value.trim());
  list.onclick = async (e) => { const r = e.target.closest('[data-cat]'); if (!r) return; await Q.save(q, { items: [...q.items, Q.itemFromCatalog(cat[+r.dataset.cat])] }); closeSheet(); render(); }; }
```

תבניות ב-`index.html`: `t-item-form` (שדות `#i-title #i-desc #i-qty #i-unit #i-ppu`, כפתור `#i-save`), `t-catalog` (`#cat-search`, `#cat-list`), `t-discount` (`#d-type` select percent/amount, `#d-value`, `#d-save`). מאזין-קליקים ב-`app.js`: `data-act="new-quote"` → `Q.create(j)` → `show('quote',{id})`; `data-quote` (שורת הצעה במסך העבודה) → `show('quote',{id})`; `add-item/edit-item/del-item/add-catalog/discount/mark-sent/versions`. `versions` מציג ב-`#v-versions` את `quote_versions` של ההצעה (מיון לפי version) כ-`quoteBlock(snapshot)` עם כותרת "גרסה N · תאריך". `del-item` → `confirmAsk`. הסרת סעיף בטיוטה = `visible:false`? לא — בטיוטה מסירים באמת; אחרי "נשלחה" — הגרסה הקודמת כבר שמורה.

- [ ] **Step 4: להריץ → PASS.** צילומי מסך של העורך בטלפון ובמחשב.
- [ ] **Step 5: Commit** `feat: עורך הצעות — סעיפים, קטלוג, הנחה, מע"מ, טיוטה, גרסאות`

---

### Task 6: תצוגת-הדפסה ו-PDF בפורמט של אור (תרחיש 7) + טקסט לוואטסאפ

**Files:** Create `print.css` (מדיה print). Modify `quote.js` (`renderPrint`), `index.html` (`<section id="v-print">`). Test: תרחיש 7 — בדיקה שהעמוד המודפס מכיל את כל חלקי הדוגמה 2026-028 + השוואת-עין ל-PDF `~/Downloads/הצעת מחיר 2026-028 - ערבה מערכות אלומיניום.pdf`.

- [ ] **Step 1: בדיקה נכשלת**

```js
  // S7: תצוגת-הדפסה מכילה את כל חלקי הפורמט הקיים
  await p.click('[data-act="pdf"]'); await p.waitForSelector('#v-print:not([hidden])');
  const pr = await p.locator('#v-print').textContent();
  for (const s of ['אור בגג', 'אור פריאס', '054-5725681', 'ח.פ. 307951517', 'הצעת מחיר #', 'בתוקף עד', 'לכבוד', 'תיאור הסעיף', 'סה"כ לפני מע"מ', 'מע"מ 18%', 'סה"כ לתשלום', 'מקדמה 30%', 'תנאי תשלום', 'עבודות בלתי-צפויות', 'תנאים כלליים', 'חתימת הלקוח', 'חתימת הקבלן', 'הופק מאפליקציית']) ok('S7: print has "' + s + '"', pr.includes(s));
  await p.pdf({ path: '/tmp/claude-501/ob2-shots/quote.pdf', format: 'A4', printBackground: true });   // ל-בדיקת-עין מול הדוגמה
```

- [ ] **Step 2: להריץ → FAIL.**
- [ ] **Step 3: מימוש `renderPrint(q)`** — HTML לפי הדוגמה: כותרת עליונה (שם העסק מ-`D.settings.business`: `businessName`, `ownerName`, `phone`, `email`, `taxId`), תיבת "הצעת מחיר #מספר / תאריך / בתוקף עד (created + validity_days)", "לכבוד + שם לקוח", טבלה (#, תיאור הסעיף + description, כמות, מחיר ליח', דחיפות אם יש, סה"כ), תיבת-סיכום (לפני מע"מ, מע"מ, סה"כ לתשלום מודגש, מקדמה 30%), "תנאי תשלום", "הבהרה — עבודות בלתי-צפויות" (הטקסט מ-`settings.quote_template.unforeseenClause`, ברירת-מחדל הטקסט מהדוגמה), "תנאים כלליים" (3 השורות מהדוגמה), שתי שורות-חתימה, שורת-תחתית "הופק מאפליקציית "אור בגג" · תאריך שעה". צבעים כמו בדוגמה: כותרת חומה-כתומה `#b4552b`, כותרת-טבלה חומה כהה `#3a2a1e` עם טקסט לבן, תיבת-סיכום עם מסגרת זהב. `print.css`: `@media print { body > *:not(#v-print){display:none} #tabs,#top{display:none} @page{size:A4;margin:12mm} }`. כפתורים בראש התצוגה (לא מודפסים): "הדפס / שמור PDF" (`window.print()`), "חזרה". שם-הקובץ: `document.title = 'הצעת מחיר ' + number + ' - ' + customer` לפני `print()`.
"טקסט לוואטסאפ": `navigator.share ? navigator.share({text}) : copy` עם: "היי {שם}, מצורפת הצעת מחיר {מספר} על סך {סה"כ} ₪ כולל מע"מ. בתוקף עד {תאריך}. אשמח לענות על כל שאלה. אור — אור בגג".

- [ ] **Step 4: להריץ → PASS.** לפתוח את `quote.pdf` ואת הדוגמה זו לצד זו (Read) ולוודא: אותם חלקים, אותו סדר, עברית מיושרת לימין, מספרים עם פסיפים.
- [ ] **Step 5: Commit** `feat: תצוגת-הדפסה/PDF בפורמט הקיים + טקסט לוואטסאפ`

---

### Task 7: כסף — תשלום, חשבונית, סגירה

**Files:** Modify `app.js` (טופס תשלום `t-payment-form`, סימון "הוצאה חשבונית", כפתור "סגור — שולם" כשהסכום מלא), `index.html`. Test: בדיקה `money`.

- [ ] **Step 1: בדיקה נכשלת** — ב-e2e: עבודה עם `price_agreed=10030` (מאישור ההצעה: `data-stage="approved"` קובע `price_agreed = quote.total` של ההצעה האחרונה שנשלחה) → "רשום תשלום" 5,000 → מסך כסף מראה "נשאר 5,030" ו"בלי חשבונית 1" → סימון "הוצאה חשבונית" → 0 → תשלום 5,030 → כפתור "שולם וסגור" → שלב `paid`.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: מימוש** — `openPaymentForm(job)`: סכום (ברירת-מחדל = הנשאר), תאריך (היום), אמצעי (העברה/ביט/צ'ק/אשראי), "הוצאתי חשבונית בחשבונית ירוקה" (checkbox). שמירה: `DB.save('payments',…)`; אם סך התשלומים ≥ `price_agreed` → `DB.stage(job.id,'paid')`. במסך "כסף": שורת תשלום בלי חשבונית עם כפתור "הוצאתי חשבונית" → `DB.save('payments',{id,invoice_issued:true})`. מעבר ל-`approved`: `price_agreed = (הצעה אחרונה בסטטוס sent/accepted).total`, וההצעה → `status:'accepted'` (`_noVersion`).
- [ ] **Step 4: PASS.** **Step 5: Commit** `feat: כסף — תשלומים, חשבונית, סגירה`

---

### Task 8: "עוד" — סל, הגדרות העסק, קטלוג, גיבוי לקובץ, התראות

**Files:** Modify `app.js`, `index.html`. Test: e2e — `data-open="settings"` שומר `businessName`; `data-open="catalog"` מוסיף פריט; "גיבוי לקובץ" מוריד JSON עם 5 המפתחות.

- [ ] **Step 1: FAIL** (אין המסכים). **Step 2: מימוש** — הגדרות: טופס `business` (שם עסק, בעלים, טלפון, אימייל, ח.פ) + תבנית (מע"מ, תוקף, תנאי תשלום, הערות קבועות, נוסח הבהרה) → `DB.save('settings',{user_id: uid, business, quote_template})` (upsert לפי `user_id` — ב-`data.js` `send`: אם `table==='settings'` → `onConflict:'user_id'`). קטלוג: רשימה + חיפוש + "הוסף פריט" (שם, קטגוריה, יחידה, מחיר) + עריכה + "הסתר" (לא מוחק). גיבוי לקובץ: `Blob` JSON של `{exportedAt, customers, jobs, quotes, quote_versions, payments, media(בלי thumb), settings}` → `a.download='or-bagag-2-backup-YYYY-MM-DD.json'`. התראות: אם ב-`D.alerts` יש שורה עם `seen_at null` → באנר אדום בראש כל מסך "ירידה במספר הרשומות אתמול — לבדוק בסל" + כפתור "ראיתי" (`DB.save('alerts',{id,seen_at})`).
- [ ] **Step 3: PASS. Commit** `feat: עוד — הגדרות, קטלוג, סל, גיבוי לקובץ, התראות`

---

### Task 9: ייבוא תמונות מלאות + הקטלוג הישן + מונה 29

**Files:** Create `import/import_media.py`, `import/import_catalog.py`, `sql/004_seq.sql`. Test: SQL counts.

- [ ] **Step 1: `sql/004_seq.sql`**

```sql
update app2.settings set next_quote_number = greatest(next_quote_number, 29), quote_year = 2026 where user_id = '2f8efb6f-3f81-4f1a-b7f9-c654bb4c0667';
```

- [ ] **Step 2: `import/import_catalog.py`** — קורא `~/Documents/Claude/Projects/or-bagag-app/or-bagag-catalog.js`, מחלץ את ה-JSON מ-`window.V210_DEFAULT_CATALOG_JSON = "..."` (`json.loads(json.loads(...))`), ממפה כל פריט ל-`{name, category, unit, price, price_min, price_max, description, legacy_id}` (מחירים לפני מע"מ), ממזג עם `settings.catalog` הקיים לפי `name` (קיים גובר), וכותב `update app2.settings set catalog = <json> where user_id=...` דרך `supabase db query --linked -f`. אימות: `select jsonb_array_length(catalog) from app2.settings` ≥ 50.
- [ ] **Step 3: `import/import_media.py`** — עובר על **כל** 60 הגיבויים (החדש ראשון), אוסף `media[id] = {data|dataFull}` (base64 של התמונה המלאה) לכל `legacy_id` שקיים ב-`app2.media` של אור; לכל תמונה שאין לה `storage_path`: מפענח, מקטין ל-1600px (Pillow), מעלה ל-`app2-media/2f8efb6f-…/<media.id>.jpg` דרך `supabase storage cp` (CLI מקושר; אם הפקודה לא זמינה — דרך REST של Storage עם JWT של משתמש-הבדיקה **לא** — כי הקבצים שייכים לאור; אז דרך SQL: `insert into storage.objects` אסור. פתרון: `supabase storage cp <file> ss:///app2-media/<path> --linked`). אחרי העלאה: `update app2.media set storage_path=… where id=…`. אימות: `select count(*) from app2.media where storage_path is not null` = מספר התמונות שנמצאו (צפוי ≥ 50), ו-`DB.photoUrl` פותח אחת מהן בבדיקה.
- [ ] **Step 4: Commit** `data: קטלוג ישן, תמונות מלאות ב-Storage, מונה-הצעות 29`

---

### Task 10: שמירה על הנתונים — ספירה לילית בענן, גיבוי לילי במק (תרחיש 6 — "שום דבר לא נעלם")

**Files:** Create `sql/003_counts.sql`, `bin/backup-nightly.sh`, `bin/com.orbagag2.backup.plist`.

- [ ] **Step 1: `sql/003_counts.sql`**

```sql
create table if not exists app2.daily_counts (day date, user_id uuid, customers int, jobs int, quotes int, payments int, media int, primary key (day, user_id));
create table if not exists app2.alerts (id uuid primary key default gen_random_uuid(), user_id uuid not null, at timestamptz default now(), kind text, message text, seen_at timestamptz);
alter table app2.alerts enable row level security; drop policy if exists own_alerts on app2.alerts; create policy own_alerts on app2.alerts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant all on app2.daily_counts, app2.alerts to authenticated;
create or replace function app2.snapshot_counts() returns void language plpgsql security definer as $$
declare u record; c record; prev record; begin
  for u in select distinct user_id from app2.customers loop
    select (select count(*) from app2.customers where user_id=u.user_id and deleted_at is null) customers,(select count(*) from app2.jobs where user_id=u.user_id and deleted_at is null) jobs,(select count(*) from app2.quotes where user_id=u.user_id and deleted_at is null) quotes,(select count(*) from app2.payments where user_id=u.user_id and deleted_at is null) payments,(select count(*) from app2.media where user_id=u.user_id and deleted_at is null) media into c;
    select * into prev from app2.daily_counts where user_id=u.user_id order by day desc limit 1;
    insert into app2.daily_counts values (current_date, u.user_id, c.customers, c.jobs, c.quotes, c.payments, c.media) on conflict (day,user_id) do update set customers=excluded.customers, jobs=excluded.jobs, quotes=excluded.quotes, payments=excluded.payments, media=excluded.media;
    if prev is not null and (c.customers < prev.customers or c.jobs < prev.jobs or c.quotes < prev.quotes) then
      insert into app2.alerts (user_id, kind, message) values (u.user_id, 'drop', format('ירידה במספרים מול אתמול: לקוחות %s→%s, עבודות %s→%s, הצעות %s→%s', prev.customers, c.customers, prev.jobs, c.jobs, prev.quotes, c.quotes));
    end if;
  end loop; end $$;
create extension if not exists pg_cron;
select cron.schedule('app2-nightly-counts', '30 0 * * *', $$select app2.snapshot_counts()$$);
```
אימות: `select app2.snapshot_counts(); select * from app2.daily_counts;` → שורה להיום עם הספירות. בדיקת ההתראה: להוריד ידנית `deleted_at` על שורת-בדיקה של משתמש-הבדיקה, להריץ שוב, לראות שורת alert למשתמש-הבדיקה, ולהחזיר.

- [ ] **Step 2: `bin/backup-nightly.sh`**

```bash
#!/bin/zsh
# גיבוי לילי של סכימת app2 לדרייב (רץ מ-launchd ב-03:00 כשהמק דלוק)
cd ~/Documents/Claude/Projects/or-bagag-2 || exit 1
OUT="$HOME/Library/CloudStorage/GoogleDrive-or.perias@gmail.com/האחסון שלי/Or BaGag - גיבויים/app2"; mkdir -p "$OUT"
F="$OUT/app2-$(date +%Y-%m-%d).sql"
/opt/homebrew/bin/supabase db dump --linked --schema app2 --data-only -f "$F" >> /tmp/or-bagag-2-backup.log 2>&1 && echo "$(date) ok $F $(wc -c < "$F")" >> /tmp/or-bagag-2-backup.log
```
`bin/com.orbagag2.backup.plist` (Label `com.orbagag2.backup`, ProgramArguments הסקריפט, StartCalendarInterval Hour 3 Minute 0), התקנה: `cp bin/com.orbagag2.backup.plist ~/Library/LaunchAgents/ && launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.orbagag2.backup.plist`. אימות: הרצה ידנית של הסקריפט → קובץ בדרייב עם `insert`-ים ל-`customers`.

- [ ] **Step 3: Commit** `ops: ספירה לילית + התראה, גיבוי לילי לדרייב`

---

### Task 11: פריסה לכתובת החדשה (ה1) ובדיקה חיה

**Files:** ריפו GitHub חדש. Test: `OB2_URL=https://orperias-coder.github.io/or-bagag-2/ node tests/e2e.js && node tests/scenarios.js`.

- [ ] **Step 1:** `gh repo create orperias-coder/or-bagag-2 --public --source=. --push` (ב-`.gitignore`: `node_modules/ tests/package-lock.json supabase/.temp/`; `supabase/` config נשאר — בלי סודות).
- [ ] **Step 2:** `gh api -X POST repos/orperias-coder/or-bagag-2/pages -f build_type=legacy -f 'source[branch]=main' -f 'source[path]=/'` → לחכות ל-200 על הכתובת (עד 5 דקות; `curl -sI`).
- [ ] **Step 3:** להריץ את שתי חבילות-הבדיקה מול הכתובת החיה → `ALL PASSED` ×2. לצלם מסך טלפון מהאתר החי.
- [ ] **Step 4:** לבדוק PWA: `manifest.json` נטען (200), `sw.js` נרשם (בבדיקה: `navigator.serviceWorker.getRegistration()`).
- [ ] **Step 5: Commit** (אם שונה משהו) + לרשום ב-CONTEXT.md את הכתובת.

---

### Task 12: ביקורת-שבירה (עין שנייה) ותיקונים

- [ ] **Step 1:** סוכן נפרד (Sonnet, קריאה + הרצה בלבד) מקבל: הכתובת החיה, משתמש-הבדיקה, `tests/scenarios.js`, ורשימת ה-8 תרחישים. משימתו: לנסות לשבור — קלט ריק, שם עם גרש, טלפון עם רווחים, 0 סעיפים בהצעה, הנחה 100%, שני טאבים במקביל, רענון באמצע טופס, מחיקה כפולה, בלי רשת באמצע העלאה. מחזיר רשימת-ממצאים עם צעדי-שחזור.
- [ ] **Step 2:** כל ממצא משוחזר בעצמי (בדיקה חדשה ב-`scenarios.js` שנכשלת) → תיקון → ירוק. ממצא שלא משוחזר — נרשם "לא שוחזר" ב-CONTEXT.md.
- [ ] **Step 3:** `node tests/e2e.js && node tests/scenarios.js` מול הכתובת החיה → ירוק. Commit + push.

---

### Task 13: סיום — ניקוי, מסמך-מסירה, מדריך לאור

- [ ] **Step 1:** ניקוי נתוני-בדיקה: `delete from app2.<table> where user_id='f234ee6d-…' and legacy_id like 'e2e:%'` (החריג המותר — משתמש-הבדיקה בלבד). משתמש-הבדיקה **נשאר** (לבדיקות עתידיות), נרשם ב-CLAUDE.md.
- [ ] **Step 2:** CONTEXT.md: מצב / מה אומת (עם פלט הבדיקות) / מה הלאה / הצעדים של אור (ה11).
- [ ] **Step 3:** דף-מסירה לנייד (Artifact, לפי סקיל דוח-נייד, בלי שמות לקוחות): הכתובת, "איך נכנסים", 8 התרחישים ואיך אור מריץ כל אחד בעצמו ב-5 דקות, שני הצעדים שלו, ומה לא נבנה בכוונה. זה המסר היחיד שנשלח לאור בסיום.
- [ ] **Step 4:** עדכון זיכרון (`project_or_bagag.md`) + הודעת-סיום קצרה בעברית: השורה הראשונה = מה עובד ומה לא.

---

## סדר וזמן (אומדן)

| משימה | שעות |
|---|---|
| 1 שכבת-נתונים ותור | 3 |
| 2 לקוח | 2 |
| 3 עבודה ושלבים | 2.5 |
| 4 ביקור ותמונות | 3 |
| 5 עורך הצעות | 5 |
| 6 PDF | 3 |
| 7 כסף | 2 |
| 8 עוד/הגדרות/קטלוג/גיבוי | 2.5 |
| 9 ייבוא תמונות וקטלוג | 2 |
| 10 ספירה וגיבוי לילי | 1.5 |
| 11 פריסה | 1 |
| 12 ביקורת-שבירה ותיקונים | 3 |
| 13 סיום | 1 |
| **סה"כ** | **~31** |

## חוקים במהלך הביצוע

1. אין שאלה לאור. ספק → ההכרעה מהטבלה למעלה; אין הכרעה → הבחירה הפשוטה יותר, נרשמת ב-CONTEXT.md תחת "הנחות".
2. כל משימה: בדיקה נכשלת → מימוש → ירוק → צילום-מסך נבדק בעיניים → commit. שתי חבילות-הבדיקה ירוקות לפני כל commit.
3. באג שנמצא: נרשם מיד ב-CONTEXT.md (גם אם תוקן). חדשות רעות בראש הדיווח.
4. הישנה (`or-bagag-app/`, `public.sync_records`, הריפו `Or-BaGag`) — קריאה בלבד. לעולם.
5. חוק שני הכישלונות: אותו תיקון נכשל פעמיים → עוצרים, כותבים היפותזה, בודקים אותה.
6. דופק: אחרי כל משימה שורה אחת לאור (מה נגמר, מה הבא). לא יותר.
