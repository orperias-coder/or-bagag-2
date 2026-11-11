/* offer.js — הצעת מחיר מתוך לוח העסק (09.11.2026, לפי המוקאפ שאור אישר: 85KhVXzRip8VWcvWnkK2VP).
   offer.html?job=<מזהה עבודה>  [&q=<מזהה הצעה>] [&new=1]
   אותן טבלאות של האפליקציה (app2.quotes / quote_versions), כך שהצעה שנבנתה כאן נפתחת גם באפליקציה ולהפך.
   מחירון: app2.price_list (מסונכרן ממאגר העבודות). כללי אור: רק אור שולח; שום שלב לא משתנה לבד —
   רק לחיצה של אדם על "✓ נשלחה" / "הלקוח אישר". שום מחיקה. */
const SB_URL = 'https://wxnmujdcrqsgokzlptkh.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4bm11amRjcnFzZ29remxwdGtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMDE3ODMsImV4cCI6MjA5NjU3Nzc4M30.R84NdsvQi5tMSJC51k4SxeVK364JQL1eZau0r9_V_ew';
const FX = window.OFFER_FIXTURE || null;   // בדיקות בלבד: "שרת" בזיכרון
const sb = FX ? null : supabase.createClient(SB_URL, SB_ANON, { db: { schema: 'app2' }, auth: { persistSession: true, autoRefreshToken: true, storageKey: 'ob2_auth' } });
const OR_EMAIL = 'or.perias@gmail.com';
const PEOPLE = { 'or.perias@gmail.com': 'owner', 'zohariadar@gmail.com': 'owner' };
const BIZ_DEFAULT = { businessName: 'אור בגג', ownerName: 'אור פריאס', phone: '054-5725681', email: 'or.perias@gmail.com', taxId: '307951517' };
const UNFORESEEN = 'במידה ויתגלו במהלך העבודה כשלים, נזקים או צרכים שלא נצפו ואינם כלולים בהצעה זו — יינתן עבורם תמחור נפרד בתיאום מראש עם הלקוח.';
const TERMS_DEFAULT = '30% מקדמה במועד החתימה, 70% בסיום העבודה';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const m = (n) => '₪' + Math.round(+n || 0).toLocaleString('he-IL');
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
const normPhone = (p) => { let d = String(p || '').replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2); if (d.startsWith('972')) d = '0' + d.slice(3); if (d.length === 9 && /^[5-9]/.test(d)) d = '0' + d; return d.length >= 9 && d.length <= 10 ? d : ''; };
const fmtPhone = (p) => { const d = normPhone(p); return d.length === 10 ? d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6) : String(p || ''); };
const waHref = (p, text) => { p = normPhone(p); if (p.startsWith('0')) p = '972' + p.slice(1); return p ? 'https://wa.me/' + p + (text ? '?text=' + encodeURIComponent(text) : '') : ''; };
const dateHe = (d) => new Date(d).toLocaleDateString('he-IL');
const num = (v) => { const n = Number(String(v).replace(/[^\d.]/g, '')); return Number.isFinite(n) ? n : 0; };

/* ---------- גישה לנתונים (ענן או "שרת" הבדיקה) ---------- */
const api = {
  async session() { if (FX) return { email: FX.email || OR_EMAIL, id: 'fx' }; const { data: { session } } = await sb.auth.getSession(); return session && { email: (session.user.email || '').toLowerCase(), id: session.user.id }; },
  async role(s) {
    if (PEOPLE[s.email]) return PEOPLE[s.email];
    if (FX) return FX.role || 'crew';
    try { const r = await sb.from('team').select('role').eq('member_id', s.id).maybeSingle(); return (r.data && r.data.role) || 'crew'; } catch (e) { return 'crew'; }
  },
  async rows(t, col, val) {
    if (FX) return (FX.server[t] || []).filter((r) => !r.deleted_at && (col == null || r[col] === val)).map((r) => JSON.parse(JSON.stringify(r)));
    let q = sb.from(t).select('*').is('deleted_at', null); if (col != null) q = q.eq(col, val);
    const { data, error } = await q; if (error) throw error; return data || [];
  },
  async settings() { if (FX) return (FX.server.settings || [])[0] || null; const { data } = await sb.from('settings').select('business,quote_template').limit(1); return (data && data[0]) || null; },
  async insert(t, row) {
    if (FX) { FX.writes.push(['insert', t, row]); if (FX.failNext) { FX.failNext = false; return false; } (FX.server[t] = FX.server[t] || []).push(JSON.parse(JSON.stringify(row))); return true; }
    const { error } = await sb.from(t).insert(row); if (error && error.code !== '23505') { console.warn(t, error); return false; }
    log(t, row.id, 'create', null); return true;
  },
  async update(t, id, patch, expect) {
    patch = { ...patch, updated_at: new Date().toISOString() };
    if (FX) {
      FX.writes.push(['update', t, id, patch]); if (FX.failNext) { FX.failNext = false; return false; }
      const r = (FX.server[t] || []).find((x) => x.id === id); if (!r) return false;
      if (expect && Object.entries(expect).some(([k, v]) => (r[k] == null ? null : r[k]) !== v)) return 'changed';
      Object.assign(r, JSON.parse(JSON.stringify(patch))); api.at = r.updated_at; return true;
    }
    let q = sb.from(t).update(patch).eq('id', id); if (expect) Object.entries(expect).forEach(([k, v]) => { q = v == null ? q.is(k, null) : q.eq(k, v); });
    const { data, error } = await q.select('id,updated_at');
    if (error) { console.warn(t, error); return false; } if (!data || !data.length) return expect ? 'changed' : false;
    api.at = data[0].updated_at; log(t, id, 'update', patch); return true;
  },
  async stamp(t, id) {   // חותמת-העדכון של שורה בענן, כמו שהיא עכשיו (null = לא הצלחתי לבדוק)
    if (FX) { const r = (FX.server[t] || []).find((x) => x.id === id); return r ? r.updated_at || '' : null; }
    try { const { data, error } = await sb.from(t).select('updated_at').eq('id', id).maybeSingle(); return error || !data ? null : data.updated_at || ''; } catch (e) { return null; }
  },
  async nextNumber() {   // הפונקציה בענן (sql/001) סופרת לפי המשתמש המחובר: אצל זהרי הייתה פותחת מונה משלה (001…) → מספרים כפולים. לכן רק אור מושך מספר; הצעה של זהרי מקבלת מספר כשאור שולח
    if (!S.canSend) return null;
    if (FX) return FX.nextNumber || null;
    try { const { data } = await sb.rpc('next_quote_number'); return data || null; } catch (e) { return null; }
  },
};
async function log(entity, id, action, diff) { if (FX) return; try { await sb.from('events').insert({ entity, entity_id: id, action, device: 'board-offer', diff }); } catch (e) { /* לוג בלבד */ } }

/* ---------- מצב ---------- */
const S = { me: '', canSend: false, job: null, cust: null, quotes: [], prices: [], findings: [], biz: BIZ_DEFAULT, Q: null, saved: false, base: null, versioned: false, saving: null, dirtyT: null, opened: '' };
const calc = (q) => {
  const items = (q.items || []).filter((i) => i.visible !== false), sum = items.reduce((a, i) => a + Number(i.total || 0), 0), d = q.discount;
  const disc = Math.min(sum, !d ? 0 : d.type === 'percent' ? sum * Math.min(100, Number(d.value || 0)) / 100 : Number(d.value || 0));
  const before = Math.max(0, sum - disc), vat = before * Number(q.vat_rate ?? 18) / 100;
  return { sum, disc, before, vat, total: before + vat, adv: (before + vat) * 0.3 };
};
const validUntil = (q) => { const d = new Date(q.sent_at || q.created_at || Date.now()); d.setDate(d.getDate() + Number(q.validity_days || 30)); return d; };
const firstName = () => String((S.cust && S.cust.name) || '').trim().split(/\s+/)[0] || '';

function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => e.classList.remove('on'), 3200); }
function gate(t, p) { $('#gate').hidden = false; $('#app').hidden = true; $('#bar').hidden = true; $('#gate-t').textContent = t; $('#gate-p').textContent = p || ''; }

async function init() {
  const s = await api.session();
  if (!s) return gate('צריך להתחבר', 'נכנסים קודם ללוח העסק, ואז חוזרים לכאן.');
  if ((await api.role(s)) !== 'owner') return gate('הצעות מחיר — רק לאור ולזהרי', '');
  S.me = s.email; S.canSend = s.email === OR_EMAIL;
  const P = new URLSearchParams(location.search), jobId = P.get('job');
  if (!jobId) return gate('לא נבחרה עבודה', 'פותחים הצעה מתוך כרטיס הלקוח בלוח.');
  try {
    const [jobs, quotes, prices, findings, st] = await Promise.all([api.rows('jobs', 'id', jobId), api.rows('quotes', 'job_id', jobId), api.rows('price_list').catch(() => []), api.rows('findings', 'job_id', jobId).catch(() => []), api.settings().catch(() => null)]);
    S.job = jobs[0]; if (!S.job) return gate('העבודה לא נמצאה', 'אולי הועברה לארכיון.');
    S.cust = (await api.rows('customers', 'id', S.job.customer_id))[0] || { id: null, name: '' };
    S.quotes = quotes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    S.prices = prices.sort((a, b) => String(a.domain || '').localeCompare(String(b.domain || ''), 'he') || String(a.label || '').localeCompare(String(b.label || ''), 'he'));
    S.findings = findings; S.tpl = (st && st.quote_template) || {}; S.biz = { ...BIZ_DEFAULT, ...((st && st.business) || {}) };
  } catch (e) { console.warn(e); return gate('לא הצלחתי לטעון מהענן', 'בדוק רשת ורענן.'); }
  const want = P.get('q');
  const q = P.get('new') ? null : (want && S.quotes.find((x) => x.id === want)) || S.quotes.find((x) => x.status === 'draft') || S.quotes[0];
  if (q) use(q, true); else use(blank(), false);
  $('#gate').hidden = true; $('#app').hidden = false; $('#bar').hidden = false;
  draw();
}
function blank() {
  const t = S.tpl || {};
  return { id: uuid(), job_id: S.job.id, number: null, status: 'draft', version: 1, items: [], addon: false, discount: null, vat_rate: Number(t.vatRate ?? 18), validity_days: Number(t.validityDays || 30),
    payment_terms: t.paymentTerms || TERMS_DEFAULT, notes: t.standardNotes || '', options: { unforeseen: true, signatures: true }, total_before_vat: 0, total: 0, created_at: new Date().toISOString() };
}
function use(q, saved) { S.Q = JSON.parse(JSON.stringify(q)); S.Q.items = S.Q.items || []; S.saved = saved; S.base = saved ? JSON.parse(JSON.stringify(q)) : null; S.versioned = false; S.opened = ''; }

/* ---------- שמירה: טיוטה נשמרת תוך כדי; אחרי "נשלחה" — הגרסה הקודמת נשמרת פעם אחת לפני השינוי הראשון ---------- */
function changed() { if (S.stale) return setSaved(STALE_S, true); setSaved('שומר…'); clearTimeout(S.dirtyT); S.dirtyT = setTimeout(save, 700); }
// 10.11: שמירה שלא דורסת. (1) לענן נשלחים רק שדות ששונו בחלון הזה; (2) מצב ההצעה (טיוטה/נשלחה/אושרה) נכתב רק מהכפתורים שלו;
// (3) לפני שמירה בודקים שההצעה לא שונתה במכשיר אחר מאז שנטענה כאן (updated_at) — אם שונתה: לא דורסים, מודיעים.
const STALE = 'ההצעה הזאת שונתה במכשיר אחר. כדי לא לדרוס אותה, כאן לא נשמר יותר. מרעננים את הדף וממשיכים מהגרסה העדכנית.', STALE_S = 'שונתה במכשיר אחר · צריך לרענן את הדף';
const NOT_CONTENT = ['id', 'created_at', 'updated_at', 'status', 'sent_at'];
const same = (a, b) => JSON.stringify(a == null ? null : a) === JSON.stringify(b == null ? null : b);
const diffOf = (q, b) => { const p = {}; Object.keys(q).forEach((k) => { if (!NOT_CONTENT.includes(k) && !same(q[k], b[k])) p[k] = q[k]; }); return p; };
function goStale() { S.stale = true; clearTimeout(S.dirtyT); S.dirtyT = null; setSaved(STALE_S, true); toast(STALE); return false; }
// עדכון של ההצעה רק אם בענן היא עדיין כמו שנטענה כאן. true / false (רשת) / 'changed'
async function putQuote(patch, extra) {
  patch = JSON.parse(JSON.stringify(patch));   // צילום של מה שנשלח: הקלדה בזמן השמירה לא נחשבת "נשמרה"
  const at = S.base.updated_at || null, exp = { ...(extra || {}), ...(at ? { updated_at: at } : {}) };
  let r = await api.update('quotes', S.Q.id, patch, Object.keys(exp).length ? exp : null);
  if (r === 'changed' && at) {   // מוודאים בקריאה: "שונתה במכשיר אחר" רק אם החותמת בענן באמת אחרת (או שהמצב שם כבר אחר)
    const now = await api.stamp('quotes', S.Q.id); if (now == null) return false;
    if (now === at) r = await api.update('quotes', S.Q.id, patch, extra || null);
  }
  if (r === true) { S.Q.updated_at = api.at || S.Q.updated_at; Object.assign(S.base, patch, { updated_at: S.Q.updated_at }); }
  return r;
}
function setSaved(t, bad) { const e = $('#saved'); e.textContent = t; e.classList.toggle('bad', !!bad); }
async function save() {
  clearTimeout(S.dirtyT); S.dirtyT = null;
  if (S.stale) { setSaved(STALE_S, true); toast(STALE); return false; }
  if (S.saving) { await S.saving; if (!S.dirtyT) return save0(); return true; }
  return save0();
}
async function save0() {
  const run = (async () => {
    const q = S.Q, k = calc(q);
    q.total_before_vat = Math.round(k.before * 100) / 100; q.total = Math.round(k.total * 100) / 100;
    let ok;
    if (!S.saved) {
      if (!q.number) q.number = await api.nextNumber();
      const row = JSON.parse(JSON.stringify(q)); delete row.created_at;
      ok = await api.insert('quotes', row);
      if (ok) { S.saved = true; S.quotes.unshift(q); try { history.replaceState(null, '', '?job=' + encodeURIComponent(q.job_id) + '&q=' + encodeURIComponent(q.id)); } catch (e) { /* רענון של "?new=1" לא יפתח עוד הצעה ריקה */ } S.base = { ...row, created_at: q.created_at }; if (Object.keys(diffOf(q, S.base)).length) changed(); else setSaved(label() + ' · נשמר'); head(); return true; }
    } else {
      if (!Object.keys(diffOf(q, S.base)).length) { setSaved(label() + ' · נשמר'); return true; }   // לא שונה כלום — לא כותבים
      if (q.status !== 'draft' && !S.versioned) {
        const v = await api.insert('quote_versions', { id: uuid(), quote_id: q.id, version: S.base.version || 1, snapshot: S.base });
        if (!v) { setSaved('לא נשמר. בדוק רשת', true); return false; }
        S.versioned = true; q.version = (S.base.version || 1) + 1;
      }
      ok = await putQuote(diffOf(q, S.base));
      if (ok === 'changed') return goStale();
      if (ok === true) { setSaved(label() + ' · נשמר'); head(); return true; }
    }
    setSaved('לא נשמר. בדוק רשת', true); return false;
  })();
  S.saving = run; try { return await run; } finally { S.saving = null; }
}
const label = () => { const q = S.Q; return (q.status === 'draft' ? 'טיוטה' : 'הצעה') + (q.number ? ' ' + q.number : '') + (q.version > 1 ? ' · גרסה ' + q.version : ''); };

/* ---------- ציור ---------- */
const STAGE_TRAIL = [['lead', 'פנייה'], ['visit', 'ביקור'], ['quote', 'להכין הצעה'], ['sent', 'הצעה נשלחה'], ['approved', 'לביצוע']];
function head() {
  const c = S.cust || {}, j = S.job, q = S.Q;
  $('#ctx-name').textContent = [c.name || 'לקוח', j.title].filter(Boolean).join(' · ');
  $('#cust-line').textContent = [c.address, c.phone && fmtPhone(c.phone), c.email].filter(Boolean).join(' · ') || 'אין כתובת, טלפון או מייל. אפשר להוסיף בפרטי הלקוח.';
  $('#ctx-from').textContent = j.visit_at ? 'ביקור: ' + dateHe(j.visit_at) : '';
  const stage = ['doing', 'paid'].includes(j.stage) ? 'approved' : j.stage, ix = STAGE_TRAIL.findIndex(([s]) => s === stage);
  $('#trail').innerHTML = STAGE_TRAIL.map(([s, n], i) => `<span class="${i < ix ? 'done' : i === ix ? 'on' : ''}">${n}</span>`).join('<i>›</i>') + (j.stage === 'lost' ? '<i>›</i><span class="on">לא יצא</span>' : '');
  $('#qpick').innerHTML = S.quotes.length > 1 || (S.saved && q.status !== 'draft')
    ? S.quotes.map((x) => `<a class="tag ${x.id === q.id ? 'v' : x.status === 'draft' ? 'draft' : 'sent'}" href="?job=${encodeURIComponent(j.id)}&q=${encodeURIComponent(x.id)}">${x.status === 'draft' ? 'טיוטה' : 'הצעה'} ${esc(x.number || '')}</a>`).join('') + `<a class="tag draft" href="?job=${encodeURIComponent(j.id)}&new=1">+ הצעה חדשה</a>` : '';
  if (!$('#saved').textContent || /נשמר$/.test($('#saved').textContent)) setSaved(S.saved ? label() + ' · נשמר' : 'טיוטה חדשה · נשמרת כשמוסיפים סעיף');
  bar();
}
function bar() {
  const q = S.Q, k = calc(q), hasItems = (q.items || []).length > 0;
  $('#bar-total').textContent = m(k.total) + ' כולל מע"מ';
  $('#bar-sub').textContent = q.status === 'draft' ? (S.opened ? 'נפתח ' + S.opened + ' · השלב לא השתנה עד שתלחץ "✓ נשלחה"' : 'טיוטה · עוד לא נשלחה')
    : q.status === 'sent' ? 'נשלחה ' + (q.sent_at ? dateHe(q.sent_at) : '') + ' · מחכים לתשובה' : q.status === 'accepted' ? 'הלקוח אישר' : 'נדחתה';
  $('#b-send').hidden = !S.canSend || !hasItems || q.status === 'accepted';
  $('#b-send').textContent = q.status === 'draft' ? 'לשלוח ללקוח' : 'לשלוח שוב';
  $('#b-did').hidden = q.status !== 'draft' || !hasItems;
  $('#b-ok').hidden = q.status !== 'sent';
}
function draw(newIdx) {
  const q = S.Q;
  $('#items').innerHTML = q.items.map((i, n) => `<div class="it${n === newIdx ? ' new' : ''}" data-row="${n}"><span class="n">${n + 1}</span><div style="min-width:0">
    <div class="t"><input data-n="${n}" data-k="title" value="${esc(i.title)}" aria-label="שם הסעיף" placeholder="שם הסעיף"></div>
    <div class="d"><input data-n="${n}" data-k="description" value="${esc(i.description || '')}" aria-label="פירוט" placeholder="פירוט (לא חובה)"></div>
    <div class="q"><input data-n="${n}" data-k="qty" inputmode="decimal" value="${esc(i.qty)}" aria-label="כמות"> <input data-n="${n}" data-k="unit" value="${esc(i.unit || '')}" aria-label="יחידה" style="width:64px"> × <input data-n="${n}" data-k="price_per_unit" inputmode="decimal" value="${esc(i.price_per_unit)}" aria-label="מחיר ליחידה"> ₪</div></div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px"><span class="tot num">${m(i.total)}</span><button class="x" type="button" data-del="${n}">להסיר</button></div></div>`).join('')
    || '<p class="muted" style="margin:4px 0">עוד אין סעיפים. מוסיפים מהמחירון או סעיף חופשי.</p>';
  $('#cnt').textContent = q.items.length ? q.items.length + ' סעיפים' : '';
  const left = S.findings.filter((f) => !q.items.some((i) => i.finding_id === f.id));
  $('#b-find').hidden = !left.length; $('#b-find').textContent = '+ מהביקור (' + left.length + (left.length === 1 ? ' ממצא)' : ' ממצאים)');
  $('#terms').value = q.payment_terms || ''; $('#notes').value = q.notes || '';
  totals(); head();
}
function totals() {
  const q = S.Q, k = calc(q), d = q.discount;
  $('#t-sum').textContent = m(k.sum); $('#t-disc').textContent = k.disc ? '−' + m(k.disc) : ''; $('#t-before').textContent = m(k.before);
  $('#t-vat-l').textContent = 'מע"מ ' + (q.vat_rate ?? 18) + '%'; $('#t-vat').textContent = m(k.vat); $('#t-total').textContent = m(k.total); $('#t-adv').textContent = m(k.adv);
  $('#b-disc').textContent = d ? (d.type === 'percent' ? d.value + '%' : m(d.value)) + ' · לשנות' : 'הוסף';
  paper(k); bar();
}
function paper(k) {
  const q = S.Q, c = S.cust || {}, b = S.biz, items = q.items.filter((i) => i.visible !== false), d = q.discount;
  $('#paper').innerHTML = `<div class="ph"><div class="logo"><img src="logo.png" alt="${esc(b.businessName)}"><small>${esc(b.ownerName)}</small></div><div style="text-align:left;font-size:.72rem;color:#6d655a">${esc(b.phone)}<br><span dir="ltr">${esc(b.email)}</span><br>ח.פ. ${esc(b.taxId)}</div></div>
  <div class="ttl"><b>הצעת מחיר${q.number ? ' #' + esc(q.number) : ''}</b><span>${dateHe(q.sent_at || q.created_at || Date.now())} · בתוקף עד ${dateHe(validUntil(q))}</span></div>
  <div>לכבוד <b>${esc(c.name || '')}</b>${c.address ? ' · ' + esc(c.address) : ''}</div>
  <div class="tbl-wrap"><table><thead><tr><th>#</th><th>תיאור</th><th>כמות</th><th>מחיר ליח'</th><th>סה"כ</th></tr></thead><tbody>
  ${items.map((i, n) => `<tr><td>${n + 1}</td><td><b>${esc(i.title)}</b>${i.description ? `<div style="color:#6d655a">${esc(i.description)}</div>` : ''}</td><td class="num">${esc(i.qty)} ${esc(i.unit || '')}</td><td class="num">${m(i.price_per_unit)}</td><td class="s num">${m(i.total)}</td></tr>`).join('')}
  </tbody></table></div>
  <div class="pt num">${k.disc ? `<div><span>סה"כ סעיפים</span><span>${m(k.sum)}</span></div><div><span>הנחה${d && d.type === 'percent' ? ' ' + d.value + '%' : ''}</span><span>−${m(k.disc)}</span></div>` : ''}<div><span>לפני מע"מ</span><span>${m(k.before)}</span></div><div><span>מע"מ ${q.vat_rate ?? 18}%</span><span>${m(k.vat)}</span></div><div class="g"><span>לתשלום</span><span>${m(k.total)}</span></div><div><span>מקדמה 30%</span><span>${m(k.adv)}</span></div></div>
  ${q.payment_terms ? `<div class="box"><b>תנאי תשלום</b><div>${esc(q.payment_terms)}</div></div>` : ''}
  ${q.notes && q.notes.trim() ? `<div class="box"><b>הערות</b><div style="white-space:pre-wrap">${esc(q.notes)}</div></div>` : ''}
  <div class="box dash"><b>עבודות בלתי-צפויות</b><div>${esc((S.tpl && S.tpl.unforeseenClause) || UNFORESEEN)}</div></div>
  <div class="sig"><div>חתימת הלקוח · תאריך</div><div>חתימת הקבלן · תאריך</div></div>`;
}

/* ---------- עריכה ---------- */
const itemOf = (o) => ({ id: uuid(), title: o.title || '', description: o.description || '', qty: Number(o.qty) || 1, unit: o.unit || '', price_per_unit: Number(o.price_per_unit) || 0, total: Math.round((Number(o.qty) || 1) * (Number(o.price_per_unit) || 0)), urgency: '', visible: true, ...(o.extra || {}) });
function add(it) { S.Q.items.push(it); draw(S.Q.items.length - 1); changed(); }
$('#items').addEventListener('input', (e) => {
  const t = e.target, n = t.dataset.n; if (n == null) return; const it = S.Q.items[+n]; if (!it) return;
  if (t.dataset.k === 'qty' || t.dataset.k === 'price_per_unit') { const v = num(t.value); if (!(v >= 0) || v > 1e9) return; it[t.dataset.k] = v; it.total = Math.round(it.qty * it.price_per_unit); t.closest('.it').querySelector('.tot').textContent = m(it.total); totals(); }
  else { it[t.dataset.k] = t.value; paper(calc(S.Q)); }
  changed();
});
$('#items').addEventListener('click', (e) => {
  const d = e.target.closest('[data-del]'); if (!d) return; const [x] = S.Q.items.splice(+d.dataset.del, 1); draw(); changed(); toast('"' + (x.title || 'סעיף') + '" הוסר');
});
$('#b-free').onclick = () => { add(itemOf({ title: '', unit: "יח'", qty: 1, price_per_unit: 0 })); const r = document.querySelector(`[data-row="${S.Q.items.length - 1}"] [data-k="title"]`); if (r) r.focus(); };
$('#b-find').onclick = () => { const left = S.findings.filter((f) => !S.Q.items.some((i) => i.finding_id === f.id)); left.forEach((f) => S.Q.items.push(itemOf({ title: f.title, description: f.description, qty: f.qty, unit: f.unit, price_per_unit: f.price_per_unit, extra: { finding_id: f.id } }))); draw(S.Q.items.length - 1); changed(); toast(left.length + ' ממצאים מהביקור נוספו'); };
$('#b-disc').onclick = () => {
  const d = S.Q.discount, cur = d ? (d.type === 'percent' ? d.value + '%' : String(d.value)) : '';
  const v = prompt('הנחה: באחוזים (למשל 5%) או בשקלים (למשל 500). ריק = בלי הנחה', cur); if (v == null) return;
  const s = v.trim(); if (!s) S.Q.discount = null; else { const n = num(s); if (!(n > 0)) return toast('לא הבנתי את ההנחה'); S.Q.discount = /%/.test(s) ? { type: 'percent', value: Math.min(100, n) } : { type: 'amount', value: n }; }
  totals(); changed();
};
$('#terms').addEventListener('input', (e) => { S.Q.payment_terms = e.target.value; paper(calc(S.Q)); changed(); });
$('#notes').addEventListener('input', (e) => { S.Q.notes = e.target.value; paper(calc(S.Q)); changed(); });
$('#b-pv').onclick = () => { document.body.classList.toggle('show-pv'); $('#b-pv').textContent = document.body.classList.contains('show-pv') ? 'חזרה לעריכה' : 'איך זה ייראה ללקוח'; scrollTo({ top: 0, behavior: 'smooth' }); };
const printPdf = () => { const c = S.cust || {}; const t = document.title; document.title = `הצעת מחיר ${S.Q.number || ''} - ${c.name || ''}`.replace(/\s+/g, ' ').trim(); window.print(); setTimeout(() => { document.title = t; }, 1500); };
$('#b-pdf').onclick = printPdf; $('#b-pdf2').onclick = printPdf;

/* ---------- מחירון ---------- */
const defPrice = (p) => (p.source === 'הצעות מחיר' && p.price_min != null && p.price_max != null ? Math.round((+p.price_min + +p.price_max) / 2) : +(p.price_min ?? p.price_max ?? 0));
function cat(f) {
  const l = S.prices.filter((p) => !f || [p.label, p.work_name, p.domain].some((x) => String(x || '').includes(f))).slice(0, 80); let g = null;
  $('#cat-list').innerHTML = !S.prices.length ? '<p class="muted">המחירון עוד לא זמין כאן. אפשר "סעיף חופשי".</p>' : l.map((p) => {
    const h = p.domain !== g ? `<div class="cat-g">${esc((g = p.domain) || 'כללי')}</div>` : '';
    const range = p.price_min != null && p.price_max != null && +p.price_min !== +p.price_max ? `בעבר ${m(p.price_min)}–${m(p.price_max)}` : esc(p.source || '');
    return h + `<button class="cat" type="button" data-p="${esc(p.id)}"><span><b>${esc(p.label || p.work_name)}</b>${p.label && p.label !== p.work_name ? `<br><span class="muted" style="font-size:.8rem">${esc(p.work_name)}</span>` : ''}</span><span class="num" style="white-space:nowrap;text-align:left">${m(defPrice(p))}${p.unit ? ' / ' + esc(p.unit) : ''}<br><span class="muted" style="font-size:.75rem">${range}</span></span></button>`;
  }).join('') || '<p class="muted">לא נמצא. אפשר "סעיף חופשי".</p>';
}
$('#b-cat').onclick = () => { $('#cat-q').value = ''; cat(''); openSh('#sh-cat'); setTimeout(() => $('#cat-q').focus(), 300); };
$('#cat-q').oninput = (e) => cat(e.target.value.trim());
$('#cat-list').onclick = (e) => { const b = e.target.closest('[data-p]'); if (!b) return; const p = S.prices.find((x) => x.id === b.dataset.p); if (!p) return; close(); add(itemOf({ title: p.label || p.work_name, unit: p.unit, qty: 1, price_per_unit: defPrice(p), extra: { catalog_id: p.id } })); toast('נוסף. משנים כמות ומחיר בשורה'); };

/* ---------- חלוניות ---------- */
function openSh(id) { $('#veil').classList.add('on'); $(id).classList.add('on'); }
function close() { document.querySelectorAll('.sheet.on').forEach((s) => s.classList.remove('on')); $('#veil').classList.remove('on'); }
$('#veil').onclick = close; document.querySelectorAll('[data-close]').forEach((b) => { b.onclick = close; });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

/* ---------- שליחה (אור בלבד). פותחים וואטסאפ/מייל אצלו; השלב לא משתנה ---------- */
function shareText() { const k = calc(S.Q); return `היי ${firstName()}, מצורפת הצעת מחיר${S.Q.number ? ' ' + S.Q.number : ''} על סך ${m(k.total)} כולל מע"מ.\nבתוקף עד ${dateHe(validUntil(S.Q))}. אשמח לענות על כל שאלה.\nאור - אור בגג`; }
$('#b-send').onclick = async () => {
  if (!S.canSend) return; if (!S.Q.items.length) return toast('אין סעיפים בהצעה');
  if (!S.Q.number) { const n = await api.nextNumber(); if (n) { S.Q.number = n; await save(); } } else await save();
  $('#send-t').textContent = 'לשלוח ל' + (firstName() || 'לקוח'); $('#msg').value = shareText();
  $('#att-name').textContent = `הצעת מחיר ${S.Q.number || ''} - ${(S.cust && S.cust.name) || ''}.pdf`.replace(/\s+/g, ' ');
  $('#b-mail').textContent = S.cust && S.cust.email ? 'פתח מייל' : 'פתח מייל (אין כתובת)';
  openSh('#sh-send'); pdfFile().catch(() => {});   // מכינים מראש, כך שהלחיצה על "שתף" משתפת מיד
};

/* ---------- PDF לשיתוף (09.11, אור: "כפתור שתף עם PDF, תעשה את זה") ----------
   הטלפון משתף קובץ רק מתוך לחיצה, ולכן ה-PDF מוכן כבר כשהחלונית נפתחת. במחשב (אין שיתוף קבצים) — הקובץ יורד. */
const H2P = 'vendor/html2pdf.bundle.min.js';   // html2pdf.js 0.10.1, עותק באתר (בלי תלות ב-CDN)
let h2pLoad = null, pdfMemo = null;
const loadH2p = () => h2pLoad || (h2pLoad = new Promise((ok, no) => {
  const s = document.createElement('script'); s.src = H2P; s.onload = () => ok(window.html2pdf); s.onerror = () => { h2pLoad = null; s.remove(); no(new Error('lib')); }; document.head.appendChild(s);
}));
const pdfName = () => `הצעת מחיר ${S.Q.number || ''} - ${(S.cust && S.cust.name) || ''}.pdf`.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
async function makePdf() {
  const h2p = await loadH2p();
  const box = document.createElement('div'); box.style.cssText = 'position:fixed;left:-10000px;top:0;width:740px;background:#fff';
  const p = $('#paper').cloneNode(true); p.removeAttribute('id'); p.style.cssText = 'transform:none;box-shadow:none;border-radius:0;padding:0;font-size:11pt;background:#fff';
  box.appendChild(p); document.body.appendChild(box);
  // בלי זה הספרייה מאבדת רווחים בין מילים בעברית; כך כל אות מצוירת בדיוק במקום שהדפדפן שם אותה
  [p, ...p.querySelectorAll('*')].forEach((el) => { el.style.letterSpacing = '0.01px'; });
  try {
    const blob = await h2p().set({ margin: 12, image: { type: 'jpeg', quality: 0.92 }, html2canvas: { scale: 2, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4' }, pagebreak: { mode: ['css', 'avoid-all'] } }).from(p).outputPdf('blob');
    return new File([blob], pdfName(), { type: 'application/pdf' });
  } finally { box.remove(); }
}
// אותו PDF כל עוד ההצעה לא השתנתה
function pdfFile() {
  const key = JSON.stringify([S.Q, S.cust]);
  if (!pdfMemo || pdfMemo.key !== key) { pdfMemo = { key, p: makePdf() }; pdfMemo.p.catch(() => { if (pdfMemo && pdfMemo.key === key) pdfMemo = null; }); }
  return pdfMemo.p;
}
function download(f) { const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
$('#b-share').onclick = async (e) => {
  const b = e.currentTarget; if (b.disabled) return;
  const text = $('#msg').value; try { navigator.clipboard && navigator.clipboard.writeText(text).catch(() => {}); } catch (_) { /* בלי העתקה */ }
  b.disabled = true; const t0 = b.textContent; b.textContent = 'מכין PDF…';
  try {
    const f = await pdfFile();
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [f] })) {
      try { await navigator.share({ files: [f], title: f.name, text }); opened('בשיתוף'); }
      catch (er) { if (er && er.name === 'NotAllowedError') toast('ה-PDF מוכן. לוחצים שוב "שתף עם PDF"'); else if (!er || er.name !== 'AbortError') throw er; }
    } else { download(f); toast('ה-PDF ירד, וההודעה הועתקה. מצרפים אותו בוואטסאפ או במייל'); }
  } catch (er) { console.warn('pdf', er); toast('לא הצלחתי להכין PDF. אפשר "לשמור PDF"'); }
  finally { b.disabled = false; b.textContent = t0; }
};
function opened(how) { S.opened = how; close(); bar(); toast('אחרי שההודעה יצאה, לוחצים "✓ נשלחה"'); }
$('#b-go').onclick = () => { const h = waHref(S.cust && S.cust.phone, $('#msg').value); if (!h) return toast('אין טלפון ללקוח. מוסיפים בפרטי הלקוח'); window.open(h, '_blank', 'noopener'); opened('בוואטסאפ'); };
$('#b-mail').onclick = () => {
  const to = String((S.cust && S.cust.email) || '').trim(); if (!to) return toast('אין מייל ללקוח. מוסיפים בפרטי הלקוח');
  const subj = `הצעת מחיר${S.Q.number ? ' ' + S.Q.number : ''} - אור בגג`;
  location.href = 'mailto:' + encodeURIComponent(to) + '?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent($('#msg').value); opened('במייל');
};

/* ---------- שינויי שלב — רק בלחיצה של אדם ---------- */
async function setJob(patch, okFrom) {
  const j = S.job; if (okFrom && !okFrom.includes(j.stage)) return true;   // לא מחזירים אחורה עבודה שכבר התקדמה
  const r = await api.update('jobs', j.id, patch, { stage: j.stage });
  if (r === 'changed') { toast('העבודה השתנתה בינתיים במכשיר אחר. מרענן…'); setTimeout(() => location.reload(), 1200); return false; }
  if (!r) { toast('לא נשמר. בדוק רשת ונסה שוב'); return false; }
  Object.assign(S.job, patch); return true;
}
// מצב ההצעה: נכתב רק מכאן, ורק אם בענן המצב עדיין "from". קודם העבודה ואז ההצעה (10.11): אם השלב השני נכשל,
// ההצעה נשארת במצב הקודם, הכפתור נשאר על המסך, ולחיצה נוספת משלימה — בלי מצב-ביניים שאי-אפשר לצאת ממנו.
async function setStatus(patch, from) {
  const r = await putQuote(patch, { status: from });
  if (r === 'changed') return goStale();
  if (!r) { toast('לא נשמר. בדוק רשת ונסה שוב'); return false; }
  Object.assign(S.Q, patch); const o = S.quotes.find((x) => x.id === S.Q.id); if (o && o !== S.Q) Object.assign(o, patch);
  return true;
}
$('#b-did').onclick = async (e) => {
  const b = e.currentTarget; if (b.disabled || S.Q.status !== 'draft') return;
  if (S.stale) return toast(STALE);
  if (!confirm('לסמן שההצעה נשלחה ללקוח?\nהכרטיס בלוח יעבור ל"הצעה נשלחה" ומתחילים לספור ימים.')) return;
  b.disabled = true;
  try {
    if (!S.Q.number) S.Q.number = await api.nextNumber();
    if (!(await save())) return;   // התוכן (והמספר) נשמר לפני שינוי המצב
    const now = new Date().toISOString();
    if (!(await setJob({ stage: 'sent', stage_changed_at: now, quote_sent_at: now }, ['lead', 'visit', 'quote', 'sent']))) return;
    if (!(await setStatus({ status: 'sent', sent_at: now }, 'draft'))) return;
    log('jobs', S.job.id, 'stage', { stage: 'sent', by: S.me }); toast('סומן: נשלחה. הכרטיס עבר ל"הצעה נשלחה"'); draw();
  } finally { b.disabled = false; }
};
$('#b-ok').onclick = async (e) => {
  const b = e.currentTarget; if (b.disabled || S.Q.status !== 'sent') return;
  if (S.stale) return toast(STALE);
  const k = calc(S.Q); if (!confirm(`הלקוח אישר את ההצעה על ${m(k.total)}?\nהכרטיס יעבור ל"לביצוע".`)) return;
  b.disabled = true;
  try {
    const v0 = S.versioned; S.versioned = true;   // הסימון עצמו אינו "שינוי" שדורש גרסה
    const saved = await save(); S.versioned = v0; if (!saved) return;
    const now = new Date().toISOString();
    if (!(await setJob({ stage: 'approved', stage_changed_at: now, approved_at: now, price_agreed: Math.round(k.total * 100) / 100 }, ['lead', 'visit', 'quote', 'sent']))) return;
    if (!(await setStatus({ status: 'accepted' }, 'sent'))) return;
    toast('מעולה. הכרטיס עבר ל"לביצוע"'); draw();
  } finally { b.disabled = false; }
};

/* ---------- פרטי לקוח (תחילת ניהול לקוחות) ---------- */
const EF = { name: '#e-name', phone: '#e-phone', email: '#e-mail', address: '#e-addr', notes: '#e-note' }; let E0 = null;   // E0 = מה שהוצג כשהטופס נפתח
$('#b-edit').onclick = () => { const c = S.cust || {}; E0 = {}; Object.keys(EF).forEach((k) => { E0[k] = String(c[k] || '').trim() || (k === 'name' ? '' : null); }); $('#e-name').value = c.name || ''; $('#e-phone').value = c.phone || ''; $('#e-mail').value = c.email || ''; $('#e-addr').value = c.address || ''; $('#e-note').value = c.notes || ''; openSh('#sh-edit'); };
$('#e-save').onclick = async (e) => {
  const b = e.currentTarget; if (b.disabled) return; const c = S.cust; if (!c || !c.id) return toast('אין כרטיס לקוח לעבודה הזו');
  const all = { name: $('#e-name').value.trim(), phone: $('#e-phone').value.trim() || null, email: $('#e-mail').value.trim() || null, address: $('#e-addr').value.trim() || null, notes: $('#e-note').value.trim() || null };
  if (!all.name) return toast('צריך שם');
  if (all.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(all.email)) return toast('המייל לא נראה תקין');
  const patch = {}; Object.keys(all).forEach((k) => { if (!E0 || all[k] !== E0[k]) patch[k] = all[k]; });   // 10.11: רק מה ששונה בטופס — לא דורסים שדה שמישהו אחר עדכן
  if (!Object.keys(patch).length) { close(); return toast('לא שונה כלום'); }
  b.disabled = true;
  try { if ((await api.update('customers', c.id, patch)) === true) { Object.assign(c, patch); close(); head(); paper(calc(S.Q)); toast('פרטי הלקוח נשמרו'); } else toast('לא נשמר. בדוק רשת ונסה שוב'); } finally { b.disabled = false; }
};

// 10.11: חיווי "אין חיבור"
const netState = () => { $('#offline').hidden = navigator.onLine !== false; };
addEventListener('offline', netState); addEventListener('online', netState); netState();
window.addEventListener('beforeunload', (e) => { if (S.dirtyT || S.saving) { save(); e.preventDefault(); e.returnValue = ''; } });
init();
