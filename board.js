/* board.js — לוח העסק (07.11.2026, גרסה 2: סגנון "בית נעים" + פניות/לקוחות/שיחות/אשף/סידור בוקר).
   קורא מהענן: wa_leads, calls (שיחות-טלפון מסוכמות מהמק), tasks, jobs, customers, payments.
   כותב באותן טבלאות ובאותה צורה כמו האפליקציה: לקוח חדש, עבודה, מועד ביקור, תשלום, משימה, סטטוס ליד, "טופל" בשיחה.
   כל כתיבה נרשמת גם ב-app2.events (כמו באפליקציה). שום מחיקה. */
const SB_URL = 'https://wxnmujdcrqsgokzlptkh.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4bm11amRjcnFzZ29remxwdGtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMDE3ODMsImV4cCI6MjA5NjU3Nzc4M30.R84NdsvQi5tMSJC51k4SxeVK364JQL1eZau0r9_V_ew';
const FX = window.BOARD_FIXTURE || null;   // בדיקות בלבד: נתונים קבועים במקום הענן, בלי כתיבה
const sb = FX ? null : supabase.createClient(SB_URL, SB_ANON, { db: { schema: 'app2' }, auth: { persistSession: true, autoRefreshToken: true, storageKey: 'ob2_auth' } });

const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
const canHover = matchMedia('(hover:hover)').matches, calm = matchMedia('(prefers-reduced-motion:reduce)').matches;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// מי מסתכל. owner = רואה כסף וחשבוניות. כל אחד אחר (רון, עובדים) — בלי כסף. (07.11, הוראת אור)
const PEOPLE = { 'or.perias@gmail.com': { name: 'אור', role: 'owner', w: 'var(--or)' }, 'zohariadar@gmail.com': { name: 'זהרי', role: 'owner', w: 'var(--zo)' } };
const D = { leads: [], tasks: [], jobs: [], customers: [], payments: [], calls: [], me: '', role: 'crew', email: '', callsOk: true };
const isOwner = () => D.role === 'owner';
let calDay = 'today', taskDay = 'today';

/* ---------- תאריכים ---------- */
const dayKey = (t) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
// ימים לפי לוח-שנה (לא +24 שעות): בלילה של מעבר שעון "מחר" יצא "היום" (סבב-ביקורת לוח 2)
const dayOff = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return dayKey(d); };
const TODAY = () => dayKey(Date.now()), TOM = () => dayOff(1);
const hm = (t) => new Date(t).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
const dm = (k) => { const p = String(k || '').split('-'); return p.length === 3 ? +p[2] + '.' + +p[1] : ''; };
const dayHe = (k) => k === TODAY() ? 'היום' : k === TOM() ? 'מחר' : k === dayOff(-1) ? 'אתמול' : new Date(k + 'T12:00').toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' });
const ts = (l) => l.last_activity ? new Date(l.last_activity).getTime() : 0;
const T = (iso) => iso ? new Date(iso).getTime() : 0;
function ago(t) {
  if (!t) return ''; const m = Math.floor((Date.now() - t) / 60000);
  if (m < 60) return 'לפני ' + Math.max(1, m) + ' דק׳'; const h = Math.floor(m / 60); if (h < 24) return h === 1 ? 'לפני שעה' : h === 2 ? 'לפני שעתיים' : 'לפני ' + h + ' שעות';
  const d = Math.floor(h / 24); return d === 1 ? 'אתמול' : d === 2 ? 'שלשום' : 'לפני ' + d + ' ימים';
}
const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const short = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
const shek = (n) => Math.round(+n || 0).toLocaleString('he-IL') + ' ₪';

/* ---------- טלפונים ושמות ---------- */
const normPhone = (p) => { let d = String(p || '').replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2); if (d.startsWith('972')) d = '0' + d.slice(3); if (d.length === 9 && /^[5-9]/.test(d)) d = '0' + d; return d.length >= 9 && d.length <= 10 ? d : ''; };
const fmtPhone = (p) => { const d = normPhone(p) || String(p || '').replace(/\D/g, ''); return d.length === 10 ? d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6) : String(p || ''); };
const looksPhone = (s) => /^[+\d\s()\-‐-―‎‏‪-‮⁦-⁩]+$/.test(String(s || ''));
const cleanName = (s) => String(s || '').replace(/[‎‏‪-‮⁦-⁩]/g, '').trim();
const leadPhone = (l) => l.phone || (/@s\.whatsapp\.net$/.test(l.jid || '') ? normPhone(l.jid.split('@')[0]) : '');   // הסריקה לא תמיד ממלאת phone; ב-jid של שיחה פרטית יש את המספר
const leadName = (l) => (l.name && !looksPhone(l.name) ? cleanName(l.name) : fmtPhone(l.name || l.phone)) || 'ללא שם';
function waHref(phone, text) { let p = normPhone(phone); if (p.startsWith('0')) p = '972' + p.slice(1); return p ? 'https://wa.me/' + p + (text ? '?text=' + encodeURIComponent(text) : '') : ''; }
// כתובת מדויקת (רחוב + מספר) → govmap, שם אפשר לראות את הגג מלמעלה ולמדוד (08.11, רעיון של אור)
const gisHref = (a) => { a = String(a || '').trim(); return /\d/.test(a) && /[א-ת]{2}/.test(a) ? 'https://www.govmap.gov.il/?q=' + encodeURIComponent(a) + '&z=10&b=1' : ''; };
const telHref = (p) => normPhone(p) ? 'tel:' + normPhone(p) : '';
// אינדקסים + זיכרון-ביניים לכל גרסת-נתונים (סבב-ביקורת לוח 2: 10,000 לקוחות → הקשה תקעה שניות)
let IDX = null, MEMO = {};
function idx() {
  if (IDX) return IDX;
  const cust = new Map(D.customers.map((c) => [c.id, c])), paid = new Map();
  D.payments.forEach((p) => { if (!p.deleted_at) paid.set(p.job_id, (paid.get(p.job_id) || 0) + (+p.amount || 0)); });
  return (IDX = { cust, paid });
}
function dirty() { IDX = null; MEMO = {}; }
const memo = (k, f) => (k in MEMO ? MEMO[k] : (MEMO[k] = f()));
const custOf = (id) => idx().cust.get(id);
const custByPhone = (p) => { const n = normPhone(p); return n ? D.customers.find((c) => normPhone(c.phone) === n) : null; };
const jobName = (j) => { const c = j && custOf(j.customer_id); return (c && c.name) || (j && j.title) || 'לקוח'; };
const callWho = (c) => cleanName((c.data && c.data.person) || c.contact || '') || fmtPhone(c.phone) || 'מספר לא ידוע';

/* ---------- פניות (inbox): וואטסאפ + שיחות טלפון שעוד לא הפכו ללקוח ---------- */
const isJob = (l) => !!(l.data && l.data.band);   // כמו "לידים" באפליקציה: הזדמנות לעבודה
const leadOpen = (l) => !['done', 'skip'].includes(l.status);
const recent = (t, days) => t && Date.now() - t < days * 864e5;
const awaitingLong = (l) => l.data && l.data.awaiting && l.status === 'new' && Date.now() - ts(l) > 864e5;
const callTime = (c) => T(c.started_at);
const callIsLead = (c) => ['lead', 'unclear'].includes(c.kind);
const callOpen = (c) => !c.handled_at && !c.customer_id && !c.deleted_at;

function inboxItems() { return memo('inbox', inboxItems0); }
function inboxItems0() {
  const out = [], byJid = {};
  D.leads.filter((l) => isJob(l) && leadOpen(l) && !l.customer_id && ['new', 'replied'].includes(l.status)).forEach((l) => {
    const it = liveMark({ id: 'W' + l.jid, src: 'wa', jid: l.jid, lead: l, calls: [], tab: l.status === 'new' ? 'check' : 'replied', name: leadName(l), phone: leadPhone(l),
      place: l.data && (l.data.address || l.data.area) || '', what: l.summary || '', at: ts(l), waiting: !!(l.data && l.data.awaiting && l.status === 'new'),
      // "דחוף" רק כשבאמת: ליד חם שמחכה לנו יותר מיממה (ביקורת 07.11: "דחוף על כל ליד = לא אומר כלום")
      urgent: ['hot', 'to_close'].includes(l.data && l.data.band) && !!(l.data && l.data.awaiting) && l.status === 'new' && Date.now() - ts(l) > 864e5 }, l, Math.max(ts(l), T(l.status_at)));
    if (!it.live) return;   // שבוע בלי תזוזה → ארכיון
    byJid[l.jid] = it; out.push(it);
  });
  // שיחה של מי שיש לו פנייה בוואטסאפ מצטרפת אליה (כל סוג שיחה של לקוח/ליד); שיחת-ליד בלי וואטסאפ — פנייה משלה
  D.calls.filter((c) => ['lead', 'unclear', 'customer'].includes(c.kind) && callOpen(c) && recent(callTime(c), LIVE_DAYS)).forEach((c) => {
    const host = c.wa_jid && byJid[c.wa_jid];
    if (!host && !callIsLead(c)) return;
    if (host) { host.calls.push(c); host.at = Math.max(host.at, callTime(c)); if (c.data && c.data.urgent) host.urgent = true; return; }
    const a = c.data || {};
    out.push({ id: 'C' + c.id, src: 'call', call: c, calls: [c], tab: 'check', name: callWho(c), phone: c.phone, place: a.place || '', what: a.topic || a.summary || '', at: callTime(c), waiting: true, urgent: !!a.urgent });
  });
  return out.sort((a, b) => (b.urgent - a.urgent) || b.at - a.at);
}
const ITABS = [{ id: 'check', name: 'לבדוק', hint: 'פניות חדשות', c: '#2a9a63' }, { id: 'replied', name: 'מחכים ללקוח', hint: 'חזרנו אליהם, מחכים לתשובה מהם', c: '#6f9f3a' }];

/* ---------- לקוחות בתהליך: עבודות באפליקציה + לידים מוואטסאפ שכבר התקדמו ---------- */
/* ---------- חיים של שבוע + ארכיון (אור אישר את המוקאפ 08.11): במסך הראשי רק מה שזז השבוע ---------- */
const LIVE_DAYS = 7, QUOTE_DAYS = 14;   // מחכים להחלטה על הצעה — 14
const liveDays = (tab) => (tab === 'sent' ? QUOTE_DAYS : LIVE_DAYS);
// הועבר ידנית לארכיון — עד שיש תזוזה חדשה אחרי ההעברה (לקוח כתב שוב → חוזר לבד)
const manualArch = (rec, at) => !!(rec && rec.archived_at) && at <= T(rec.archived_at);
// עד מתי במסך הראשי: תזוזה אחרונה + 7 (הצעה: 14), או "להמשיך עוד שבוע" — המאוחר מביניהם
const liveUntil = (rec, at, tab) => Math.max(at + liveDays(tab) * 864e5, T(rec && rec.keep_until));
// touch = התזוזה האחרונה (הודעה, או פעולה של אור — "חזרתי אליו" נחשב); at נשאר לתצוגה ולמיון
function liveMark(it, rec, touch) {
  it.rec = rec; it.touch = touch == null ? it.at : touch; it.until = liveUntil(rec, it.touch, it.tab);
  it.live = !manualArch(rec, it.touch) && it.until > Date.now();
  it.cool = it.live && it.until - Date.now() < 864e5;   // יום לפני שיורד — "מתקררים"
  return it;
}
const CSTAGES = [
  { id: 'sched', name: 'לתאם ביקור', hint: 'כרטיס נפתח, עוד אין מועד', c: '#2f8f98', jobs: ['lead'], wa: [] },
  { id: 'visit', name: 'ביקור נקבע', hint: 'לבוא ולמדוד', c: '#d39a1c', jobs: ['visit'], wa: ['visit'] },
  // 08.11 (אור): "להכין הצעה" ו"הצעה נשלחה" — שתי לשוניות. ביקור שכבר היה = להכין הצעה.
  { id: 'quote', name: 'להכין הצעה', hint: 'הביקור היה, צריך לשלוח הצעה', c: '#8a6440', jobs: ['quote'], wa: [] },
  { id: 'sent', name: 'הצעה נשלחה', hint: 'מחכים שיחליטו', c: '#6f9f3a', jobs: ['sent'], wa: ['quote_sent'] },
  { id: 'doing', name: 'לביצוע', hint: 'אישרו, לבצע ולגבות', c: '#e07a3a', jobs: ['approved', 'doing'], wa: ['approved'] },
];
// לא updated_at/created_at: הייבוא מהישנה (04.11) נגע בכולן, ואז 63 לידים ישנים נראו "פעילים". שינוי-שלב וביקור — כן.
const jobTouch = (j) => Math.max(T(j.stage_changed_at), T(j.visit_at)) || T(j.created_at);
function custItems() { return memo('cust', custItems0); }
function custItems0() {
  const out = [];
  D.jobs.filter((j) => !['paid', 'lost'].includes(j.stage)).forEach((j) => {
    let st = CSTAGES.find((s) => s.jobs.includes(j.stage)); if (!st) return; const c = custOf(j.customer_id);
    if (j.stage === 'visit' && j.visit_at && T(j.visit_at) < Date.now() - 2 * 3600e3) st = CSTAGES.find((s) => s.id === 'quote');   // הביקור כבר היה
    out.push(liveMark({ id: 'J' + j.id, src: 'job', job: j, cust: c, tab: st.id, name: jobName(j), phone: c && c.phone, place: c && c.address || '', what: j.problem || j.title || '', at: jobTouch(j) }, j));
  });
  const jobCust = new Set(D.jobs.map((j) => j.customer_id));
  D.leads.filter((l) => leadOpen(l) && isJob(l) && !(l.customer_id && jobCust.has(l.customer_id))).forEach((l) => {
    const st = CSTAGES.find((s) => s.wa.includes(l.status)); if (!st) return;
    out.push(liveMark({ id: 'W' + l.jid, src: 'wa', jid: l.jid, lead: l, tab: st.id, name: leadName(l), phone: leadPhone(l), place: l.data && (l.data.address || l.data.area) || '', what: l.summary || '', at: Math.max(ts(l), T(l.status_at)) }, l));
  });
  return out.sort((a, b) => b.at - a.at);
}

/* ---------- כסף (רק לבעלים) ---------- */
const paidOf = (jid) => idx().paid.get(jid) || 0;
function moneyItems() { return memo('money', moneyItems0); }
function moneyItems0() {
  if (!isOwner()) return [];
  const out = [];
  D.payments.filter((p) => !p.deleted_at && !p.invoice_issued).forEach((p) => {
    const j = D.jobs.find((x) => x.id === p.job_id);
    out.push({ id: 'P' + p.id, src: 'pay', pay: p, job: j, tab: 'inv', name: jobName(j), what: (p.note || 'תשלום') + ' · ' + (p.method || ''), amount: +p.amount || 0, at: T(p.paid_at) });
  });
  D.jobs.filter((j) => ['approved', 'doing'].includes(j.stage) && +j.price_agreed > 0).forEach((j) => {
    const left = +j.price_agreed - paidOf(j.id); if (left <= 0) return;
    out.push({ id: 'G' + j.id, src: 'collect', job: j, tab: 'collect', name: jobName(j), what: 'סוכם ' + shek(j.price_agreed) + ', שולם ' + shek(paidOf(j.id)), amount: left, at: jobTouch(j) });
  });
  return out.sort((a, b) => b.at - a.at);
}
const MTABS = [{ id: 'inv', name: 'להוציא חשבונית', hint: 'שולם, אין חשבונית', c: '#e07a3a' }, { id: 'collect', name: 'לגבות', hint: 'נשאר לשלם', c: '#b0587d' }];

/* ---------- רשימת היום ---------- */
const URG = [{ id: 'now', name: 'דחוף', u: '#e07a3a' }, { id: 'today', name: 'היום', u: '#4a78d0' }, { id: 'later', name: 'כשיש זמן', u: '#b5aec8' }];
const SEC = { 'p-inbox': 'פניות', 'p-cust': 'לקוחות', 'p-calls': 'שיחות', 'p-tasks': 'משימות', 'p-cal': 'יומן', 'p-money': 'כסף' };
const PC = { 'p-today': '#7b68d9', 'p-inbox': '#2a9a63', 'p-cust': '#2f8f98', 'p-calls': '#b0587d', 'p-tasks': '#4a78d0', 'p-cal': '#d39a1c', 'p-money': '#e07a3a', 'p-arch': '#5f86b8' };
const AG_MAX = 15, LATER_MAX = 5;
const DONE_KEY = () => 'ob2_board_done_' + TODAY() + '_' + (D.email || 'x');   // לכל אדם בנפרד (מכשיר משותף)
function doneStore() { try { return JSON.parse(localStorage.getItem(DONE_KEY()) || '{}'); } catch (e) { return {}; } }
function doneSave(s) { try { localStorage.setItem(DONE_KEY(), JSON.stringify(s)); } catch (e) {} }

function buildAgenda() {
  const out = [], today = TODAY();
  inboxItems().filter((it) => it.tab === 'check').forEach((it) => {
    // לא כפול: ליד רגיל נשאר בחלון "פניות"; לרשימת היום עולים רק דחופים ומה שהגיע בשיחת טלפון
    if (!it.urgent && !it.calls.length) return;
    const u = it.urgent ? 'now' : Date.now() - it.at < 3 * 864e5 ? 'today' : 'later';
    out.push({ id: 'A' + it.id, kind: it.src === 'wa' ? 'lead' : 'call', ref: it.id, jid: it.jid, cid: it.call && it.call.id, u, sec: 'p-inbox',
      t: (it.src === 'call' ? 'פנייה בטלפון: ' : 'לחזור ל' + (/^[\d+]/.test(it.name) ? '-' : '')) + it.name, y: short(it.what, 70) + (it.at ? ' · ' + ago(it.at) : ''), at: it.at });
  });
  D.calls.filter((c) => !callIsLead(c) && callOpen(c) && c.data && c.data.next && (!isDay(c.data.due) || c.data.due <= today) && recent(callTime(c), 14)).forEach((c) => {
    out.push({ id: 'AC' + c.id, kind: 'call', ref: 'K' + c.id, cid: c.id, u: c.data.urgent || (c.data.due && c.data.due < today) ? 'now' : 'today', sec: 'p-calls',
      t: short(c.data.next, 60), y: 'משיחה עם ' + callWho(c) + ' · ' + ago(callTime(c)), at: callTime(c) });
  });
  D.tasks.filter((t) => !t.job_id && !t.done_at && t.due && t.due <= today).forEach((t) => out.push({ id: 'T' + t.id, kind: 'task', tid: t.id, ref: 'T' + t.id, u: t.due < today ? 'now' : 'today', sec: 'p-tasks',
    t: t.title, y: t.due < today ? 'היה צריך עד ' + dm(t.due) : 'משימה להיום', at: 0 }));
  D.jobs.filter((j) => j.visit_at && dayKey(j.visit_at) === today && !['paid', 'lost'].includes(j.stage)).forEach((j) => out.push({ id: 'V' + j.id, kind: 'local', ref: 'J' + j.id, u: 'today', sec: 'p-cal',
    t: 'ביקור אצל ' + jobName(j), y: 'בשעה ' + hm(j.visit_at), at: T(j.visit_at) }));
  D.leads.filter((l) => l.status === 'quote_sent' && l.status_at && Date.now() - T(l.status_at) > 3 * 864e5 && Date.now() - T(l.status_at) < 30 * 864e5).forEach((l) => out.push({ id: 'Q' + l.jid, kind: 'local', ref: 'W' + l.jid, u: 'later', sec: 'p-cust',
    t: 'לבדוק עם ' + leadName(l) + ' על ההצעה', y: 'נשלחה ' + ago(T(l.status_at)), at: T(l.status_at) }));
  if (isOwner()) moneyItems().filter((m) => m.tab === 'inv' && Date.now() - m.at > 2 * 864e5).slice(0, 3).forEach((m) => out.push({ id: 'M' + m.id, kind: 'local', ref: m.id, u: 'later', sec: 'p-money',
    t: 'חשבונית ל' + m.name, y: shek(m.amount) + ' · שולם ' + ago(m.at), at: m.at }));
  const order = { now: 0, today: 1, later: 2 };
  out.sort((a, b) => order[a.u] - order[b.u] || b.at - a.at);
  const st = doneStore(), ids = new Set(out.map((a) => a.id));
  Object.values(st).forEach((a) => { if (!ids.has(a.id) && a.sec) out.push(a); });
  out.forEach((a) => {
    const r = st[a.id]; a.done = !!r;
    // ליד שנפתח מחדש אחרי הווי (לקוח כתב שוב / מכשיר אחר) — חוזר לרשימה, לא נשאר מוסתר עד חצות
    if (r && a.kind === 'lead') { const l = D.leads.find((x) => x.jid === a.jid); if (l && l.status === 'new' && T(l.status_at) > (r.t0 || 0)) { a.done = false; } }
  });
  return out;
}
let AG = [], SHOWN = [], agFilter = null, agAll = false;
const CHK = '<svg viewBox="0 0 12 12"><path d="M2 6.5l2.6 2.5L10 3.5"/></svg>';
const ARR = '<svg class="arr" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 6l-6 6 6 6"/></svg>';
function renderAgenda() {
  AG = buildAgenda();
  const laters = AG.filter((x) => x.u === 'later' && !x.done);
  const open = AG.filter((a) => !a.done && (agAll || a.u !== 'later' || laters.indexOf(a) < LATER_MAX));   // "להראות עוד" מראה באמת הכל
  const max = agAll ? 999 : innerWidth <= 900 ? 6 : AG_MAX;   // בטלפון 6 (אור 04.11: "הלוח ארוך מדי בטלפון")
  // משימות וביקורים של היום לעולם לא נחבאים מאחורי "עוד" — התקרה רק על פניות/שיחות/תזכורות
  const keep = AG.filter((a) => !a.done && (a.kind === 'task' || a.sec === 'p-cal'));
  const shown = new Set([...open.slice(0, max), ...keep, ...AG.filter((a) => a.done)].map((a) => a.id)), hiddenN = AG.filter((a) => !a.done && !shown.has(a.id)).length;
  if (agFilter) AG.filter((a) => a.sec === agFilter).forEach((a) => shown.add(a.id));
  const pass = (a) => !agFilter || a.sec === agFilter;
  SHOWN = URG.flatMap((g) => AG.filter((a) => a.u === g.id && shown.has(a.id) && pass(a)));
  renderChips();
  $('#agenda').innerHTML = URG.map((g) => {
    const its = AG.filter((a) => a.u === g.id && shown.has(a.id) && pass(a)); if (!its.length) return '';
    return `<div class="agroup"><h3><i style="--u:${g.u}"></i>${g.name}</h3>${its.map((a, i) => `<div class="ai lift ${a.done ? 'done' : ''} ${CUR && CUR.id === a.id ? 'sel' : ''}" data-ag="${esc(a.id)}" style="--pc:${PC[a.sec]};--i:${i}" role="button" tabindex="0" aria-label="${esc(a.t)}, לפתוח פרטים">
      <button class="chk" type="button" data-agchk="${esc(a.id)}" aria-pressed="${a.done}" aria-label="סימון וי">${CHK}</button>
      <div class="tt"><span class="tx">${esc(a.t)}</span><small>${esc(a.y)}</small></div><span class="chip">${SEC[a.sec]}</span>${ARR}</div>`).join('')}</div>`;
  }).join('') + (hiddenN > 0 && !agFilter ? `<button type="button" class="lmore allset" data-agall style="border-radius:14px">להראות עוד ${hiddenN}</button>` : '')
    + (!AG.length ? '<div class="allset">אין כרגע שום דבר שמחכה.</div>' : AG.every((a) => a.done) ? '<div class="allset">הכל מסומן. כל הכבוד.</div>' : '');
}
const TICKING = new Set();   // לחיצה כפולה על וי בזמן שמירה הרסה את ה"ביטול" (ביקורת 07.11)
async function tickAgenda(a) {
  if (TICKING.has(a.id)) return false; TICKING.add(a.id);
  try { return await tickAgenda2(a); } finally { TICKING.delete(a.id); }
}
async function tickAgenda2(a) {
  const st = doneStore();
  if (a.done) {
    const prev = st[a.id]; delete st[a.id]; doneSave(st);
    if (prev && prev.kind === 'lead' && prev.prevStatus) await setLeadStatus(prev.jid, prev.prevStatus, 'replied');   // רק אם עדיין "חזרנו" — לא דורסים התקדמות שקרתה בינתיים
    if (prev && prev.kind === 'task') await setTaskDone(prev.tid, false);
    if (prev && prev.kind === 'call') await setCallHandled(prev.cid, false);
  } else {
    const rec = { id: a.id, kind: a.kind, jid: a.jid, tid: a.tid, cid: a.cid, ref: a.ref, u: a.u, t: a.t, y: a.y, sec: a.sec, at: a.at };
    if (a.kind === 'lead') { const l = D.leads.find((x) => x.jid === a.jid); rec.prevStatus = l && l.status; if (!(await setLeadStatus(a.jid, 'replied', l && l.status))) { renderAll(); return false; } }
    if (a.kind === 'task' && !(await setTaskDone(a.tid, true))) { renderAll(); return false; }
    if (a.kind === 'call' && !(await setCallHandled(a.cid, true))) { renderAll(); return false; }
    rec.t0 = Date.now(); st[a.id] = rec; doneSave(st);
  }
  renderAll(true);
  return true;
}
function tickWithToast(a) {
  const was = a.done;
  return tickAgenda(a).then((ok) => { if (ok && !was) toast('סומן וי: ' + a.t + (a.kind === 'lead' ? ' (עבר ל"חזרנו אליהם")' : ''), () => { const b = AG.find((x) => x.id === a.id); if (b) tickAgenda(b); }); });
}
$('#agenda').addEventListener('click', (e) => {
  const ck = e.target.closest('[data-agchk]');
  if (ck) { e.stopPropagation(); const a = AG.find((x) => x.id === ck.dataset.agchk); if (!a) return; ck.closest('.ai').classList.toggle('done', !a.done); tickWithToast(a); return; }
  if (e.target.closest('[data-agall]')) { agAll = true; unboot(); renderAgenda(); return; }
  const row = e.target.closest('[data-ag]'); if (row) openAgenda(AG.find((x) => x.id === row.dataset.ag));
});
function renderChips() {
  const open = AG.filter((a) => !a.done), secs = Object.keys(SEC).filter((s) => open.some((a) => a.sec === s) || agFilter === s);
  $('#fchips').innerHTML = secs.map((sec) => `<button type="button" class="fchip" data-f="${sec}" style="--c:${PC[sec]}" aria-pressed="${agFilter === sec}"><i></i>${SEC[sec]} <b>${open.filter((a) => a.sec === sec).length}</b></button>`).join('');
}
$('#fchips').addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (!b) return; agFilter = agFilter === b.dataset.f ? null : b.dataset.f; unboot(); renderAgenda(); });

/* ---------- שורות: פניות / לקוחות / שיחות / כסף ---------- */
const SRC = {
  wa: { c: '#2a9a63', svg: '<path d="M20 11.5a8 8 0 0 1-11.6 7.1L4 20l1.4-4.2A8 8 0 1 1 20 11.5z"/>', he: 'וואטסאפ' },
  call: { c: '#b0587d', svg: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>', he: 'שיחת טלפון' },
  job: { c: '#2f8f98', svg: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>', he: 'באפליקציה' },
  pay: { c: '#e07a3a', svg: '<path d="M7 3h7l4 4v14H7z"/><path d="M10 12h5M10 16h5"/>', he: 'תשלום' },
  collect: { c: '#b0587d', svg: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9 11h6"/>', he: 'לגבות' },
};
const srcIc = (s) => `<span class="src" style="--sc:${SRC[s].c}" title="${SRC[s].he}"><svg viewBox="0 0 24 24">${SRC[s].svg}</svg></span>`;
const ROWMAX = 8;
const VIEW = { inbox: { tab: null, more: false }, cust: { tab: null, more: false }, calls: { tab: 'cust', more: false }, money: { tab: null, more: false }, arch: { r: 'all', q: '', more: false } };
let LISTS = { inbox: [], cust: [], calls: [], money: [] };
function rowHtml(it, extraRight) {
  const icons = it.src === 'wa' && it.calls && it.calls.length ? srcIc('wa') + srcIc('call') : srcIc(it.src);
  return `<div class="lr ${CUR && CUR.id === it.id ? 'sel' : ''}" data-row="${esc(it.id)}" role="button" tabindex="0" aria-label="${esc(it.name)}, לפתוח פרטים">
    <span style="display:flex;gap:3px">${icons}</span>
    <div class="tt"><span class="nm">${esc(it.name)}${it.place ? ', ' + esc(it.place) : ''}${it.urgent ? '<span class="urg">דחוף</span>' : ''}</span><span class="sm">${esc(it.what || '')}</span></div>
    <span class="ag ${it.late ? 'late' : ''}">${extraRight != null ? extraRight : ago(it.at)}</span>${waHref(it.phone) ? `<a class="rwa" href="${waHref(it.phone)}" target="_blank" rel="noopener" aria-label="וואטסאפ ל${esc(it.name)}" title="לפתוח וואטסאפ"><svg viewBox="0 0 24 24">${SRC.wa.svg}</svg></a>` : '<span></span>'}${ARR}</div>`;
}
function tabsHtml(tabs, cur, counts) {
  return tabs.map((s) => `<button type="button" class="ltab" role="tab" data-tab="${s.id}" style="--c:${s.c}" aria-selected="${s.id === cur}"><i></i>${s.name} <b>${counts[s.id] || 0}</b></button>`).join('');
}
function renderInbox() {
  const all = inboxItems(), v = VIEW.inbox, cnt = {}; all.forEach((x) => { cnt[x.tab] = (cnt[x.tab] || 0) + 1; });
  if (!v.tab) v.tab = cnt.check ? 'check' : cnt.replied ? 'replied' : 'check';
  $('#itabs').style.setProperty('--nt', ITABS.length); $('#itabs').innerHTML = tabsHtml(ITABS, v.tab, cnt);
  $('#inboxCool').innerHTML = coolHtml(all);
  const items = all.filter((x) => x.tab === v.tab && !(x.cool && x.src !== 'call')); items.forEach((x) => { x.late = x.src === 'wa' && awaitingLong(x.lead); });
  LISTS.inbox = items; const cut = v.more ? items : items.slice(0, ROWMAX), st = ITABS.find((s) => s.id === v.tab);
  $('#inbox').style.setProperty('--c', st.c);
  $('#inbox').innerHTML = cut.map((it) => rowHtml(it)).join('') + (items.length > cut.length ? `<button type="button" class="lmore" data-more="inbox">עוד ${items.length - cut.length}</button>` : '') + (!items.length ? `<div class="empty">אין כאן כלום. ${st.hint}.</div>` : '');
  const waiting = all.filter((x) => x.tab === 'check' && x.waiting).length, phone = all.filter((x) => x.calls && x.calls.length).length;
  $('#inboxSum').innerHTML = `<b>${cnt.check || 0} לבדוק</b>${waiting ? `, ${waiting} מחכים לתשובה` : ''}${phone ? ` · ${phone} עם שיחת טלפון` : ''}. לוחצים על פנייה כדי לטפל בה.`;
  const older = archItems().filter((x) => x.src === 'wa' && x.why === 'cold' && !x.lead.customer_id && ['new', 'replied'].includes(x.lead.status)).length;
  $('#inboxOlder').innerHTML = older ? `ועוד ${older} פניות שלא זזו שבוע — בארכיון. <button type="button" class="linkb" data-goarch>לארכיון</button>` : '';
}
function renderCust() {
  const all = custItems(), fresh = all.filter((x) => x.live), v = VIEW.cust, cnt = {};
  $('#custCool').innerHTML = coolHtml(fresh);
  fresh.filter((x) => !x.cool).forEach((x) => { cnt[x.tab] = (cnt[x.tab] || 0) + 1; });
  if (!v.tab) v.tab = (CSTAGES.find((s) => cnt[s.id]) || CSTAGES[0]).id;
  $('#cbar').innerHTML = CSTAGES.map((s) => `<i style="--c:${s.c};flex-grow:${cnt[s.id] || .2}"></i>`).join('');
  $('#ctabs').style.setProperty('--nt', CSTAGES.length); $('#ctabs').innerHTML = tabsHtml(CSTAGES, v.tab, cnt);
  const items = fresh.filter((x) => x.tab === v.tab && !x.cool); LISTS.cust = items;
  const cut = v.more ? items : items.slice(0, ROWMAX), st = CSTAGES.find((s) => s.id === v.tab);
  $('#cust').style.setProperty('--c', st.c);
  $('#cust').innerHTML = cut.map((it) => rowHtml(it, it.src === 'job' && it.job.visit_at && it.tab === 'visit' ? `<b>${dm(dayKey(it.job.visit_at))}</b>${hm(it.job.visit_at)}` : null)).join('')
    + (items.length > cut.length ? `<button type="button" class="lmore" data-more="cust">עוד ${items.length - cut.length}</button>` : '') + (!items.length ? `<div class="empty">אין כאן אף אחד. ${st.hint}.</div>` : '');
  $('#custSum').innerHTML = `<b>${fresh.length} לקוחות פעילים</b> — רק מי שזז בשבוע האחרון (מחכים להחלטה על הצעה: שבועיים).`;
  const old = archItems().length;
  $('#custOlder').innerHTML = old ? `ועוד ${old} בארכיון. <button type="button" class="linkb" data-goarch>לארכיון</button>` : '';
}

/* ---------- "מתקררים" (יום לפני שיורדים) + ארכיון ---------- */
const stageHe = (it) => ({ check: 'פנייה חדשה', replied: 'מחכים ללקוח' })[it.tab] || (CSTAGES.find((s) => s.id === it.tab) || {}).name || '';
const daysIdle = (t) => Math.max(1, Math.floor((Date.now() - t) / 864e5));
let COOL = new Map();
function coolHtml(items) {
  const c = items.filter((x) => x.cool && x.src !== 'call');   // שיחה בלי וואטסאפ — אין איפה לשמור "להמשיך"; פשוט יורדת אחרי שבוע
  c.forEach((x) => COOL.set(x.id, x));
  if (!c.length || D.archOk === false) return '';
  return `<div class="cool"><div class="ct">מתקררים — מחר יורדים לארכיון</div>${c.map((it) => `<div class="crow"><div class="tt"><span class="nm">${esc(it.name)}${it.place ? ', ' + esc(it.place) : ''}</span><span class="sm">${esc(stageHe(it))} · בלי תזוזה ${daysIdle(it.touch)} ימים</span></div>`
    + `<div class="cb"><button class="btn main" type="button" data-keep="${esc(it.id)}">להמשיך עוד שבוע</button><button class="btn" type="button" data-arch="${esc(it.id)}">לארכיון</button></div></div>`).join('')}</div>`;
}
async function setLife(it, patch, msg) {
  const rec = it && it.rec; if (!rec || BUSY) return;
  const job = it.src === 'job', key = job ? 'id' : 'jid', prev = {};
  Object.keys(patch).forEach((k) => { prev[k] = rec[k] == null ? null : rec[k]; });
  Object.assign(rec, patch); renderAll();
  if (await dbUpdate(job ? 'jobs' : 'wa_leads', rec[key], patch, key)) { toast(msg); return; }
  Object.assign(rec, prev); renderAll();
}
const AREASON = [{ id: 'all', name: 'הכל', c: '#7b68d9' }, { id: 'closed', name: 'נסגר', c: '#2a9a63' }, { id: 'cold', name: 'התקרר', c: '#5f86b8' }, { id: 'nope', name: 'לא רלוונטי', c: '#857d98' }];
function archItems() { return memo('arch', archItems0); }
function archItems0() {
  const live = new Set(inboxItems().map((x) => x.id).concat(custItems().filter((x) => x.live).map((x) => x.id)));
  const jobCust = new Set(D.jobs.map((j) => j.customer_id)), out = [];
  D.jobs.forEach((j) => {
    const id = 'J' + j.id; if (live.has(id)) return; const c = custOf(j.customer_id);
    out.push({ id, src: 'job', job: j, rec: j, name: jobName(j), phone: c && c.phone, place: c && c.address || '', what: j.problem || j.title || '', at: jobTouch(j),
      why: j.stage === 'paid' ? 'closed' : j.stage === 'lost' || j.archive_reason === 'nope' ? 'nope' : 'cold' });
  });
  // ליד של לקוח שיש לו עבודה — העבודה מייצגת אותו (לא פעמיים)
  D.leads.filter((l) => isJob(l) && !(l.customer_id && jobCust.has(l.customer_id))).forEach((l) => {
    const id = 'W' + l.jid; if (live.has(id)) return;
    out.push({ id, src: 'wa', jid: l.jid, lead: l, rec: l, name: leadName(l), phone: leadPhone(l), place: l.data && (l.data.address || l.data.area) || '', what: l.summary || '', at: Math.max(ts(l), T(l.status_at)),
      why: l.status === 'done' ? 'closed' : l.status === 'skip' || l.archive_reason === 'nope' ? 'nope' : 'cold' });
  });
  return out.sort((a, b) => b.at - a.at);
}
function renderArch() {
  const all = archItems(), v = VIEW.arch, q = String(v.q || '').trim(), cnt = { all: all.length };
  all.forEach((x) => { cnt[x.why] = (cnt[x.why] || 0) + 1; });
  $('#atabs').style.setProperty('--nt', AREASON.length); $('#atabs').innerHTML = tabsHtml(AREASON, v.r, cnt);
  let items = all.filter((x) => v.r === 'all' || x.why === v.r);
  if (q) {
    const ql = q.toLowerCase(), qd = q.replace(/\D/g, '');
    items = items.filter((x) => (x.name + ' ' + x.place + ' ' + x.what).toLowerCase().includes(ql) || (qd.length >= 3 && normPhone(x.phone).includes(qd)));
  }
  const cut = v.more ? items : items.slice(0, 30), WHY = { closed: 'נסגר', cold: 'התקרר', nope: 'לא רלוונטי' };
  let last = '', html = '';
  cut.forEach((it) => {
    const m = it.at ? new Date(it.at).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' }) : 'בלי תאריך';
    if (m !== last) { html += `<div class="daysep">${m}</div>`; last = m; }
    html += `<div class="ar"><span style="display:flex">${srcIc(it.src)}</span><div class="tt"><span class="nm">${esc(it.name)}${it.place ? ', ' + esc(it.place) : ''}</span><span class="sm">${esc(short(it.what, 90))}${it.at ? ' · ' + ago(it.at) : ''}</span></div>`
      + `<span class="why w-${it.why}">${WHY[it.why]}</span>${it.why === 'cold' && D.archOk !== false ? `<button class="btn" type="button" data-back="${esc(it.id)}">להחזיר</button>` : ''}</div>`;
  });
  $('#arch').innerHTML = html + (items.length > cut.length ? `<button type="button" class="lmore" data-more="arch">עוד ${items.length - cut.length}</button>` : '')
    + (!items.length ? `<div class="empty">${q ? 'לא נמצא בארכיון.' : 'הארכיון ריק.'}</div>` : '');
  $('#archSum').innerHTML = `<b>${all.length} בארכיון</b>. שום דבר לא נמחק. לקוח שכותב שוב בוואטסאפ חוזר לבד ללוח.`;
}
function archClick(e) {
  const g = e.target.closest('[data-goarch]'); if (g) { curSec = 'p-arch'; renderNav(); jump('p-arch'); return; }
  const k = e.target.closest('[data-keep]'); if (k) return setLife(COOL.get(k.dataset.keep), { keep_until: new Date(Date.now() + LIVE_DAYS * 864e5).toISOString() }, 'נשאר בלוח עוד שבוע');
  const a = e.target.closest('[data-arch]'); if (a) return setLife(COOL.get(a.dataset.arch), { archived_at: new Date().toISOString(), archive_reason: 'cold' }, 'הועבר לארכיון');
}
$('#p-inbox').addEventListener('click', archClick); $('#p-cust').addEventListener('click', archClick);
$('#atabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (!b) return; VIEW.arch.r = b.dataset.tab; VIEW.arch.more = false; renderArch(); });
$('#archQ').addEventListener('input', (e) => { VIEW.arch.q = e.target.value; VIEW.arch.more = false; renderArch(); });
$('#arch').addEventListener('click', (e) => {
  if (e.target.closest('[data-more]')) { VIEW.arch.more = true; renderArch(); return; }
  const b = e.target.closest('[data-back]'); if (!b) return;
  const it = archItems().find((x) => x.id === b.dataset.back);
  if (it) setLife(it, { archived_at: null, keep_until: new Date(Date.now() + LIVE_DAYS * 864e5).toISOString() }, 'חזר ללוח לשבוע');
});
const KTABS = [{ id: 'cust', name: 'לקוחות ופניות', c: '#b0587d', kinds: ['customer', 'lead', 'unclear'] }, { id: 'team', name: 'ספקים וצוות', c: '#8a6440', kinds: ['supplier', 'team'] }, { id: 'open', name: 'עם צעד פתוח', c: '#e07a3a', kinds: null }];
const KIND_HE = { customer: 'לקוח', lead: 'פנייה חדשה', supplier: 'ספק', team: 'צוות', unclear: 'לא ברור' };
function renderCalls() {
  $('#p-calls').hidden = !isOwner(); if (!isOwner()) { LISTS.calls = []; return; }   // סיכומי שיחות רק לבעלים (יכולים לכלול סכומים)
  const v = VIEW.calls, all = D.calls.filter((c) => !c.deleted_at).sort((a, b) => callTime(b) - callTime(a));
  const inTab = (c, t) => t.kinds ? t.kinds.includes(c.kind) : callOpen(c) && c.data && c.data.next;
  const cnt = {}; KTABS.forEach((t) => { cnt[t.id] = all.filter((c) => inTab(c, t)).length; });
  $('#ktabs').style.setProperty('--nt', KTABS.length); $('#ktabs').innerHTML = tabsHtml(KTABS, v.tab, cnt);
  const t = KTABS.find((x) => x.id === v.tab), items = all.filter((c) => inTab(c, t)).map((c) => ({ id: 'K' + c.id, src: 'call', call: c, name: callWho(c), place: (c.data && c.data.place) || '',
    what: (c.data && (c.data.topic || c.data.summary)) || '', at: callTime(c), urgent: !!(c.data && c.data.urgent) && callOpen(c), handled: !callOpen(c) }));
  LISTS.calls = items; const cut = v.more ? items : items.slice(0, ROWMAX * 2);
  $('#calls').style.setProperty('--c', t.c);
  let last = '', html = '';
  cut.forEach((it) => { const k = dayKey(it.at); if (k !== last) { html += `<div class="daysep">${dayHe(k)}</div>`; last = k; } html += rowHtml(it, hm(it.at)).replace('class="lr ', `class="lr ${it.handled ? 'dim ' : ''}`); });
  $('#calls').innerHTML = html + (items.length > cut.length ? `<button type="button" class="lmore" data-more="calls">עוד ${items.length - cut.length}</button>` : '')
    + (!items.length ? `<div class="empty">${D.callsOk ? 'אין שיחות כאן עדיין. השיחות המוקלטות מהטלפון מסוכמות במחשב ומגיעות לכאן.' : 'השיחות עוד לא מחוברות לענן.'}</div>` : '');
  const today = all.filter((c) => dayKey(callTime(c)) === TODAY()).length, openN = cnt.open;
  $('#callsSum').innerHTML = `<b>${today} היום</b>${openN ? ` · ${openN} עם צעד שעוד לא טופל` : ''}. רק שיחות עבודה; שיחות פרטיות לא נכנסות לכאן.`;
}
function renderMoney() {
  $('#p-money').hidden = !isOwner(); if (!isOwner()) { LISTS.money = []; return; }
  const all = moneyItems(), v = VIEW.money, cnt = {}; all.forEach((x) => { cnt[x.tab] = (cnt[x.tab] || 0) + 1; });
  if (!v.tab) v.tab = cnt.inv ? 'inv' : 'collect';
  $('#mtabs').style.setProperty('--nt', MTABS.length); $('#mtabs').innerHTML = tabsHtml(MTABS, v.tab, cnt);
  const items = all.filter((x) => x.tab === v.tab); LISTS.money = items; const cut = v.more ? items : items.slice(0, ROWMAX), st = MTABS.find((s) => s.id === v.tab);
  $('#money').style.setProperty('--c', st.c);
  $('#money').innerHTML = cut.map((it) => rowHtml(it, `<b>${shek(it.amount)}</b>${it.at ? ago(it.at) : ''}`)).join('') + (items.length > cut.length ? `<button type="button" class="lmore" data-more="money">עוד ${items.length - cut.length}</button>` : '') + (!items.length ? `<div class="empty">${D.payOk === false ? 'התשלומים לא נטענו מהענן. רענן את הדף.' : 'אין כאן כלום.'}</div>` : '');
  const sumInv = all.filter((x) => x.tab === 'inv').reduce((s, x) => s + x.amount, 0), sumCol = all.filter((x) => x.tab === 'collect').reduce((s, x) => s + x.amount, 0);
  $('#moneySum').innerHTML = `<b>${cnt.inv || 0} תשלומים בלי חשבונית</b> (${shek(sumInv)})${cnt.collect ? ` · לגבות ${shek(sumCol)}` : ''}`;
}
const LIST_OF = { inbox: '#inbox', cust: '#cust', calls: '#calls', money: '#money' }, TABS_OF = { inbox: '#itabs', cust: '#ctabs', calls: '#ktabs', money: '#mtabs' };
Object.keys(LIST_OF).forEach((k) => {
  $(TABS_OF[k]).addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (!b || b.dataset.tab === VIEW[k].tab) return; VIEW[k].tab = b.dataset.tab; VIEW[k].more = false; unboot(); renderAll(); });
  $(LIST_OF[k]).addEventListener('click', (e) => {
    if (e.target.closest('[data-more]')) { VIEW[k].more = true; renderAll(); return; }
    if (e.target.closest('a.rwa')) return;   // כפתור הוואטסאפ בשורה — פותח וואטסאפ, לא את החלונית
    const r = e.target.closest('[data-row]'); if (r) openItem(LISTS[k].find((x) => x.id === r.dataset.row), LISTS[k]);
  });
  $(LIST_OF[k]).addEventListener('keydown', (e) => { const r = e.target.closest && e.target.closest('[data-row]'); if (r && e.target === r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); r.click(); } });
});

/* ---------- חלונית פרטים ---------- */
let CUR = null, SL = [], WZ = null, BUSY = false;
const KINDNAME = { wa: 'פנייה מוואטסאפ', call: 'שיחת טלפון', job: 'לקוח באפליקציה', pay: 'תשלום', collect: 'לגבות' };
function findItem(ref) {
  return inboxItems().find((x) => x.id === ref) || custItems().find((x) => x.id === ref) || moneyItems().find((x) => x.id === ref)
    || (ref && ref[0] === 'K' && (() => { const c = D.calls.find((x) => 'K' + x.id === ref); return c && { id: ref, src: 'call', call: c, name: callWho(c), place: (c.data && c.data.place) || '', what: (c.data && c.data.topic) || '', at: callTime(c) }; })())
    || (ref && ref[0] === 'T' && (() => { const t = D.tasks.find((x) => 'T' + x.id === ref); return t && { id: ref, src: 'task', task: t, name: t.title, at: 0 }; })());
}
function openAgenda(a) {
  if (!a) return; const it = findItem(a.ref);
  if (it) { it.agId = a.id; openItem(it, SHOWN.map((x) => { const f = findItem(x.ref); return f && Object.assign(f, { agId: x.id }); }).filter(Boolean)); }
  else jump(a.sec);
}
function callBlock(c) {
  const a = c.data || {}, out = [];
  out.push(`<p class="meta">${esc(dayHe(dayKey(callTime(c))))} ב-${hm(callTime(c))}${c.duration ? ' · ' + Math.max(1, Math.round(c.duration / 60)) + ' דק׳' : ''} · ${esc(KIND_HE[c.kind] || '')}</p>`);
  if (a.summary) out.push(`<p class="body">${esc(a.summary)}</p>`);
  if (Array.isArray(a.agreed) && a.agreed.length) out.push(`<div><b style="font-size:.86rem">מה נקבע</b><ul>${a.agreed.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`);
  if (a.next) out.push(`<p class="body"><b>הצעד הבא:</b> ${esc(a.next)}${a.due ? ' (עד ' + dm(a.due) + ')' : ''}</p>`);
  if (a.weak) out.push('<p class="note-weak">התמלול לא ברור בחלק מהשיחה. כדאי לשמוע את ההקלטה בדרייב.</p>');
  return out.join('');
}
function itemBody(it) {
  const rows = [], extra = [], acts = [];
  if (it.src === 'wa' || (it.src === 'call' && it.calls)) {   // פנייה (מחלון הפניות). שיחה מחלון השיחות — בענף נפרד למטה
    const l = it.lead;
    if (it.phone) rows.push(['טלפון', fmtPhone(it.phone)]); if (it.place) rows.push(['איפה', it.place]);
    if (l) { const s = { new: 'חדש', replied: 'חזרנו אליו', visit: 'קבענו ביקור', quote_sent: 'נשלחה הצעה', approved: 'אישר' }[l.status]; if (s) rows.push(['שלב', s]); if (ts(l)) rows.push(['וואטסאפ אחרון', ago(ts(l))]); }
    if (l && l.summary) extra.push(`<p class="body">${esc(l.summary)}</p>`);
    if (l && Array.isArray(l.media) && l.media.length) extra.push(`<div class="phs" data-media="${esc(l.jid)}">${l.media.slice(0, 8).map(() => '<span class="ph0"></span>').join('')}</div>`);
    const msgs = ((l && l.data && l.data.messages) || []).filter((m) => m && m.text && !/^\s*\[[^\]]*\]\s*$/.test(m.text)).slice(-4);   // בלי "[תמונה]"/"[ללא טקסט]" — התמונות מוצגות למעלה
    if (msgs.length) extra.push(`<div class="chat">${msgs.map((m) => `<div class="b ${m.me ? 'me' : ''}">${esc(short(m.text, 260))}</div>`).join('')}</div>`);
    (it.calls || []).forEach((c) => extra.push(`<div style="border-top:1px solid var(--line);padding-top:10px"><span class="kind" style="--pc:#b0587d">שיחת טלפון</span>${callBlock(c)}</div>`));
    const inCust = it.tab && CSTAGES.some((s) => s.id === it.tab);
    if (!inCust) {
      acts.push('<button class="btn main" type="button" data-s="wizard">לטפל בפנייה: לפתוח כרטיס ולתאם</button>');
      acts.push('<div class="row">' + (it.src === 'wa' && it.lead.status === 'new' ? '<button class="btn" type="button" data-s="replied">חזרתי אליו</button>' : it.src === 'call' ? '<button class="btn" type="button" data-s="handled">טופל</button>' : '')
        + '<button class="btn ghost" type="button" data-s="skip">לא רלוונטי</button></div>');
    } else acts.push('<button class="btn main" type="button" data-s="wizard">להמשיך: תיאום, דמי ביקור וחשבונית</button>');
  } else if (it.src === 'job') {
    const j = it.job, c = it.cust;
    if (c && c.phone) rows.push(['טלפון', fmtPhone(c.phone)]); if (c && c.address) rows.push(['כתובת', c.address]);
    rows.push(['שלב', CSTAGES.find((s) => s.id === it.tab).name]); if (j.visit_at) rows.push(['ביקור', dayHe(dayKey(j.visit_at)) + ' ' + hm(j.visit_at)]);
    if (isOwner() && +j.price_agreed) rows.push(['סוכם', shek(j.price_agreed) + ' · שולם ' + shek(paidOf(j.id))]);
    if (j.problem) extra.push(`<p class="body">${esc(short(j.problem, 400))}</p>`);
    D.calls.filter((x) => x.customer_id && x.customer_id === j.customer_id).slice(0, 3).forEach((x) => extra.push(`<div style="border-top:1px solid var(--line);padding-top:10px"><span class="kind" style="--pc:#b0587d">שיחת טלפון</span>${callBlock(x)}</div>`));
    if (['lead', 'visit'].includes(j.stage)) acts.push('<button class="btn main" type="button" data-s="wizard">' + (j.stage === 'lead' ? 'לתאם ביקור' : j.visit_at && T(j.visit_at) < Date.now() ? 'הביקור היה: דמי ביקור וחשבונית' : 'פרטי הביקור') + '</button>');
    if (isOwner()) acts.push(`<a class="btn${['quote', 'sent'].includes(it.tab) ? ' main' : ''}" href="offer.html?job=${encodeURIComponent(j.id)}">${it.tab === 'quote' ? 'להכין הצעת מחיר' : it.tab === 'sent' ? 'לפתוח את ההצעה' : 'הצעות מחיר'}</a>`);   // offer.html — כלי ההצעות של הלוח (09.11)
    if (c && c.id) acts.push('<button class="btn" type="button" data-s="custedit">לערוך פרטי לקוח</button>');
    acts.push('<a class="btn ghost" href="./">לפתוח באפליקציה (תמונות)</a>');
  } else if (it.src === 'call') { /* מטופל למעלה */ } else if (it.src === 'pay') {
    rows.push(['סכום', shek(it.amount)]); rows.push(['שולם', it.pay.paid_at ? dm(it.pay.paid_at) : '']); if (it.pay.method) rows.push(['אמצעי', it.pay.method]); if (it.pay.note) rows.push(['הערה', it.pay.note]);
    acts.push('<a class="btn" target="_blank" rel="noopener" href="https://app.greeninvoice.co.il/">לפתוח את מורנינג</a>');
    acts.push('<button class="btn main" type="button" data-s="invoiced">הוצאתי חשבונית ✓</button>');
  } else if (it.src === 'collect') {
    rows.push(['נשאר', shek(it.amount)]); rows.push(['סוכם', shek(it.job.price_agreed)]);
    acts.push('<a class="btn main" href="./">לרשום תשלום באפליקציה</a>');
  } else if (it.src === 'task') {
    const t = it.task; rows.push(['עד', t.due ? dm(t.due) : 'בלי תאריך']);
    acts.push(`<button class="btn main" type="button" data-s="taskdone">${t.done_at ? 'לבטל את הווי' : 'בוצע ✓'}</button>`);
  }
  if (it.src === 'call' && !it.calls) {   // שיחה מחלון השיחות (לא פנייה)
    extra.push(callBlock(it.call));
    const c = it.call;
    if (callIsLead(c) && callOpen(c)) acts.push('<button class="btn main" type="button" data-s="wizard">לטפל בפנייה: לפתוח כרטיס ולתאם</button>');
    if (c.data && c.data.next && callOpen(c)) acts.push('<button class="btn" type="button" data-s="mktask">להפוך את הצעד הבא למשימה</button>');
    acts.push(`<button class="btn" type="button" data-s="handled">${callOpen(c) ? 'טופל ✓' : 'להחזיר ללא-טופל'}</button>`);
    if (c.wa_jid) acts.push('<button class="btn ghost" type="button" data-s="towa">לפנייה בוואטסאפ של אותו אדם</button>');
  }
  const ph = it.phone || (it.call && it.call.phone) || (it.cust && it.cust.phone);
  const adr = (it.cust && it.cust.address) || it.place || '', gis = gisHref(adr);
  if (ph || gis) extra.unshift(`<div class="row">${telHref(ph) ? `<a class="btn" href="${telHref(ph)}">להתקשר</a>` : ''}${waHref(ph) ? `<a class="btn" target="_blank" rel="noopener" href="${waHref(ph)}">וואטסאפ</a>` : ''}${gis ? `<a class="btn" target="_blank" rel="noopener" href="${gis}">מפה ומדידה</a>` : ''}</div>`);
  return { rows, extra, acts };
}
function openItem(it, list) {
  if (!it) return; CUR = it; WZ = null; SL = list || [it];
  const sh = $('#sheet'), { rows, extra, acts } = itemBody(it), ix = SL.findIndex((x) => x.id === it.id);
  sh.style.setProperty('--pc', SRC[it.src] ? SRC[it.src].c : PC['p-tasks']);
  sh.innerHTML = `<div class="grab"></div><button class="x" type="button" data-s="close" aria-label="סגירה">×</button>
    <span class="kind">${KINDNAME[it.src] || 'משימה'}${it.calls && it.calls.length && it.src === 'wa' ? ' + שיחת טלפון' : ''}</span><h2 id="shT">${esc(it.name)}</h2>${it.what && !['call', 'wa'].includes(it.src) && !(it.job && it.job.problem) ? `<p class="meta">${esc(short(it.what, 140))}</p>` : ''}
    ${rows.length ? `<dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : ''}${extra.join('')}
    <div class="sacts">${acts.join('')}</div>
    ${SL.length > 1 ? `<div class="snav"><button type="button" data-s="prev" ${ix <= 0 ? 'disabled' : ''}>→ הקודם</button><span class="meta">${ix + 1} מתוך ${SL.length}</span><button type="button" data-s="next" ${ix < 0 || ix >= SL.length - 1 ? 'disabled' : ''}>הבא ←</button></div>` : ''}`;
  showSheet(); loadPhotos();
}
// תמונות הליד מהענן (אותו דלי של האפליקציה): קישורים חתומים לשעה, רק כשהחלונית נפתחת
const PHURL = {};
async function loadPhotos() {
  const box = $('#sheet [data-media]'); if (!box || FX) return; const l = D.leads.find((x) => x.jid === box.dataset.media); if (!l) return;
  const items = l.media.slice(0, 8), need = items.map((m) => m.path).filter((p) => p && !PHURL[p]);
  if (need.length) { try { const { data } = await sb.storage.from('app2-media').createSignedUrls(need, 3600); (data || []).forEach((d) => { if (d.signedUrl) PHURL[d.path] = d.signedUrl; }); } catch (e) { console.warn(e); } }
  if (!box.isConnected) return;
  box.innerHTML = items.map((m) => PHURL[m.path] ? (m.type === 'video' ? `<a href="${esc(PHURL[m.path])}" target="_blank" rel="noopener" class="ph1 vid">▶</a>` : `<a href="${esc(PHURL[m.path])}" target="_blank" rel="noopener"><img class="ph1" src="${esc(PHURL[m.path])}" alt="" loading="lazy"></a>`) : '').join('');
}
function showSheet() {
  const sh = $('#sheet'); sh.hidden = false; requestAnimationFrame(() => { sh.classList.add('on'); $('#scrim').classList.add('on'); $('#scrim').classList.toggle('wide', !!WZ); });
  $$('.lr.sel,.ai.sel').forEach((r) => r.classList.remove('sel'));
  if (CUR) { const r = document.querySelector(`[data-row="${CSS.escape(CUR.id)}"]`); if (r) r.classList.add('sel'); }
  const f = sh.querySelector('.main,input,[data-s]'); if (f && innerWidth > 900) f.focus({ preventScroll: true });
}
function closeSheet() {
  const sh = $('#sheet'); sh.classList.remove('on'); $('#scrim').classList.remove('on'); CUR = null; WZ = null;
  $$('.lr.sel,.ai.sel').forEach((r) => r.classList.remove('sel'));
  setTimeout(() => { if (!sh.classList.contains('on')) sh.hidden = true; }, 450);
}
function nextAfter(it) { const ix = SL.findIndex((x) => x.id === it.id); return SL[ix + 1] || null; }
async function afterAction(it) {   // אחרי פעולה שמוציאה פריט מהרשימה — ממשיכים לבא
  const nx = nextAfter(it); renderAll(true);
  const fresh = nx && findItem(nx.id); if (fresh) openItem(fresh, SL.filter((x) => x.id !== it.id)); else closeSheet();
}
$('#scrim').onclick = () => { if (!WZ || confirm('לצאת מהאשף? מה שכבר נשמר נשאר שמור.')) closeSheet(); };
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && CUR && !WZ) closeSheet(); if (e.key === 'Escape' && $('#mw').classList.contains('on')) closeMorning(); });
$('#sheet').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-s]'); if (!b || !CUR || BUSY) return; const it = CUR, s = b.dataset.s, ix = SL.findIndex((x) => x.id === it.id);
  if (s === 'close') return WZ && !confirm('לצאת מהאשף? מה שכבר נשמר נשאר שמור.') ? null : closeSheet();
  if (s === 'prev' && SL[ix - 1]) return openItem(findItem(SL[ix - 1].id) || SL[ix - 1], SL);
  if (s === 'next' && SL[ix + 1]) return openItem(findItem(SL[ix + 1].id) || SL[ix + 1], SL);
  if (s.startsWith('wz')) return wizardClick(b);
  BUSY = true; b.disabled = true;
  try {
    if (s === 'wizard') { startWizard(it); return; }
    if (s === 'replied') { const prev = (D.leads.find((x) => x.jid === it.jid) || it.lead).status; if (await setLeadStatus(it.jid, 'replied')) { toast(it.name + ' עבר ל"חזרנו אליהם"', () => setLeadStatus(it.jid, prev).then(() => renderAll())); await afterAction(it); } return; }
    if (s === 'skip') {
      if (it.src === 'wa') { const prev = (D.leads.find((x) => x.jid === it.jid) || it.lead).status; if (await setLeadStatus(it.jid, 'skip')) { const cs = it.calls || []; for (const c of cs) await setCallHandled(c.id, true); toast(it.name + ' סומן "לא רלוונטי"', async () => { await setLeadStatus(it.jid, prev, 'skip'); for (const c of cs) await setCallHandled(c.id, false); renderAll(); }); await afterAction(it); } }
      else if (it.src === 'call') { if (await setCallHandled(it.call.id, true, 'לא רלוונטי')) { toast('השיחה סומנה "לא רלוונטי"', () => setCallHandled(it.call.id, false).then(() => renderAll())); await afterAction(it); } }
      return;
    }
    if (s === 'handled') { const c = it.call || (it.calls && it.calls[0]); const was = callOpen(c); if (await setCallHandled(c.id, was)) { toast(was ? 'השיחה סומנה שטופלה' : 'השיחה חזרה ללא-טופל', () => setCallHandled(c.id, !was).then(() => renderAll())); was && it.calls ? await afterAction(it) : (renderAll(), openItem(findItem(it.id) || it, SL)); } return; }
    if (s === 'mktask') { const c = it.call; c.__task = c.__task || uuid(); const ok = await addTask(c.data.next + ' · ' + callWho(c), isDay(c.data.due) && c.data.due >= TODAY() ? c.data.due : TODAY(), c.__task); if (ok && (await setCallHandled(c.id, true))) { toast('נוספה משימה' + (c.data.due ? ' ל-' + dm(c.data.due) : ' להיום')); renderAll(); openItem(findItem(it.id) || it, SL); } return; }
    if (s === 'towa') { const t = inboxItems().find((x) => x.jid === it.call.wa_jid) || custItems().find((x) => x.jid === it.call.wa_jid); if (t) openItem(t, [t]); else toast('הפנייה בוואטסאפ כבר טופלה או סגורה'); return; }
    if (s === 'invoiced') { if (await dbUpdate('payments', it.pay.id, { invoice_issued: true })) { it.pay.invoice_issued = true; toast('סומן: חשבונית הוצאה', () => dbUpdate('payments', it.pay.id, { invoice_issued: false }).then(() => { it.pay.invoice_issued = false; renderAll(); })); await afterAction(it); } return; }
    if (s === 'custedit') {   // פרטי לקוח מתוך הלוח (09.11, תחילת ניהול לקוחות)
      const c = it.cust, box = $('#sheet .sacts');
      box.innerHTML = `<div class="cedit"><label>שם<input id="ce-name" value="${esc(c.name || '')}"></label><label>טלפון<input id="ce-phone" inputmode="tel" value="${esc(c.phone || '')}"></label><label>מייל<input id="ce-mail" inputmode="email" dir="ltr" value="${esc(c.email || '')}"></label><label>כתובת<input id="ce-addr" value="${esc(c.address || '')}"></label><label>הערות<textarea id="ce-note" rows="2">${esc(c.notes || '')}</textarea></label><button class="btn main" type="button" data-s="custsave">לשמור</button></div>`;
      $('#ce-name').focus(); return;
    }
    if (s === 'custsave') {
      const c = it.cust, patch = { name: $('#ce-name').value.trim(), phone: $('#ce-phone').value.trim() || null, email: $('#ce-mail').value.trim() || null, address: $('#ce-addr').value.trim() || null, notes: $('#ce-note').value.trim() || null };
      if (!patch.name) return toast('צריך שם');
      if (patch.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.email)) return toast('המייל לא נראה תקין');
      if (await dbUpdate('customers', c.id, patch)) { const cc = D.customers.find((x) => x.id === c.id); if (cc) Object.assign(cc, patch); dirty(); renderAll(); toast('פרטי הלקוח נשמרו'); openItem(findItem(it.id) || it, SL); }
      return;
    }
    if (s === 'taskdone') { const t = it.task; if (await setTaskDone(t.id, !t.done_at)) { renderAll(); closeSheet(); } return; }
  } finally { BUSY = false; if (b.isConnected) b.disabled = false; }
});
(() => {   // בטלפון: גרירה למטה סוגרת (לא באשף)
  let y0 = null; const sh = $('#sheet');
  sh.addEventListener('touchstart', (e) => { if (!WZ && sh.scrollTop <= 0 && innerWidth <= 900) y0 = e.touches[0].clientY; }, { passive: true });
  sh.addEventListener('touchmove', (e) => { if (y0 == null) return; const dy = e.touches[0].clientY - y0; if (dy > 0) sh.style.transform = `translateY(${dy}px)`; }, { passive: true });
  sh.addEventListener('touchend', (e) => { if (y0 == null) return; const dy = e.changedTouches[0].clientY - y0; sh.style.transform = ''; y0 = null; if (dy > 90) closeSheet(); });
})();
$('#agenda').addEventListener('keydown', (e) => { const row = e.target.closest && e.target.closest('[data-ag]'); if (row && e.target === row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); row.click(); } });

/* ---------- האשף: פנייה → כרטיס → ביקור ביומן → דמי ביקור → חשבונית ---------- */
const WSTEPS = ['בודקים', 'מתאמים ביקור', 'דמי ביקור', 'חשבונית'];
// איש-קשר ששמור אצל אור כ"לקוח דימה זכרון": השם = דימה, המקום = זכרון (08.11, אור: "שהכרטיס יהיה מלא")
function splitContactName(s) {
  s = cleanName(s); const m = s.match(/^(?:לקוח(?:ה)?|לק'|לק׳)\s+(\S+)\s+(.+)$/);
  return m ? { name: m[1], place: m[2].trim() } : { name: s, place: '' };
}
function startWizard(it) {
  const c = it.call || (it.calls && it.calls[0]), a = (c && c.data) || {}, l = it.lead;
  const nm = splitContactName(it.name && !looksPhone(it.name) ? it.name : (a.person || ''));
  const ld = (l && l.data) || {};
  WZ = { it, step: 0, name: nm.name, phone: normPhone(it.phone || (c && c.phone)) || '', place: it.place || a.place || nm.place || '',
    problem: [ld.problem, l && l.summary].filter(Boolean).join('\n') || a.summary || it.what || '', visit: a.visit || null, jobId: null, customerId: null, payId: null, fee: null };
  if (it.src === 'job') { const j = it.job; WZ.jobId = j.id; WZ.customerId = j.customer_id; WZ.step = j.stage === 'lead' ? 1 : 2; WZ.problem = j.problem || ''; if (j.visit_at) WZ.visitAt = j.visit_at; WZ.showFee = !!(j.visit_at && T(j.visit_at) < Date.now()); }
  if (it.src === 'wa' && l && l.customer_id) { WZ.useCust = l.customer_id; const j = D.jobs.find((x) => x.customer_id === l.customer_id && ['lead', 'visit'].includes(x.stage)); if (j) { WZ.jobId = j.id; WZ.customerId = j.customer_id; WZ.step = j.stage === 'lead' ? 1 : 2; if (j.visit_at) WZ.visitAt = j.visit_at; } }
  renderWizard();
}
function stepsBar() { const n = isOwner() ? 4 : 2; return `<div class="steps" aria-label="שלב ${WZ.step + 1} מתוך ${n}">${WSTEPS.slice(0, n).map((x, i) => `<i class="${i < WZ.step ? 'on' : i === WZ.step ? 'cur' : ''}" title="${x}"></i>`).join('')}</div>`; }
function renderWizard() {
  const w = WZ, sh = $('#sheet'); let body = '';
  const n = isOwner() ? 4 : 2;
  if (w.step === 0) body = `<div class="wz">
      <p class="hint2">בודקים שהפנייה רלוונטית ומשלימים פרטים. "לפתוח כרטיס" יוצר לקוח באפליקציה (אותו טלפון = אותו לקוח) ועבודה חדשה.</p>
      <label>שם<input id="wzName" value="${esc(w.name)}" autocomplete="off"></label>
      <div class="two"><label>טלפון<input id="wzPhone" inputmode="tel" value="${esc(w.phone)}" autocomplete="off"></label><label>עיר / כתובת<input id="wzPlace" value="${esc(w.place)}" autocomplete="off"></label></div>
      <label>מה הבעיה<textarea id="wzProb">${esc(w.problem)}</textarea></label>
      ${w.askCust && custOf(w.askCust) ? `<div class="done-badge" style="background:var(--accent-soft);color:#8a4a1c">הטלפון הזה כבר שייך ללקוח באפליקציה: ${esc(custOf(w.askCust).name)}${custOf(w.askCust).address ? ', ' + esc(custOf(w.askCust).address) : ''}. זה אותו אדם?</div>
      <div class="sacts"><button class="btn main" type="button" data-s="wz-use">כן, לפתוח עבודה חדשה אצלו</button><button class="btn" type="button" data-s="wz-new">לא, לקוח חדש</button></div></div>`
      : '<div class="sacts"><button class="btn main" type="button" data-s="wz-open">רלוונטי: לפתוח כרטיס</button><button class="btn ghost" type="button" data-s="wz-skip">לא רלוונטי</button></div></div>'}`;
  if (w.step === 1) {
    const d = w.visit ? w.visit.date : '', tm = w.visit && w.visit.time ? w.visit.time : '';
    body = `<div class="wz">
      <div class="done-badge">✓ הכרטיס נפתח${w.name ? ': ' + esc(w.name) : ''}</div>
      ${w.visit ? `<p class="hint2">בשיחה נקבע ביקור ב-${esc(dm(w.visit.date))}${tm ? ' בשעה ' + esc(tm) : ''}. אפשר לשנות.</p>` : '<p class="hint2">מתי באים לבדוק? המועד נכנס לעבודה באפליקציה וליומן בלוח.</p>'}
      <div class="two"><label>תאריך<input type="date" id="wzDate" value="${esc(d)}" min="${dayKey(Date.now() - 864e5)}"></label><label>שעה<input type="time" id="wzTime" value="${esc(tm)}" step="900"></label></div>
      <div class="sacts"><button class="btn main" type="button" data-s="wz-visit">לקבוע את הביקור</button><button class="btn" type="button" data-s="wz-visited">כבר הייתי בביקור</button><button class="btn ghost" type="button" data-s="wz-later">עוד לא, אתאם אחר כך</button></div></div>`;
  }
  if (w.step === 2) {
    const v = w.visitAt ? new Date(w.visitAt) : null;
    body = `<div class="wz">
      ${v ? `<div class="done-badge">✓ ביקור נקבע: ${esc(dayHe(dayKey(v)))} ב-${hm(v)}</div>
      <div class="row"><a class="btn" target="_blank" rel="noopener" href="${gcalHref()}">להוסיף ליומן גוגל</a>${waHref(w.phone) ? `<a class="btn" target="_blank" rel="noopener" href="${waHref(w.phone, confirmText())}">לשלוח אישור בוואטסאפ</a>` : ''}</div>` : ''}
      ${isOwner() && feeExists(w) ? `<div class="done-badge" style="background:var(--accent-soft);color:#8a4a1c">כבר נרשמו דמי ביקור לעבודה הזו. לא צריך שוב.</div><div class="sacts"><button class="btn main" type="button" data-s="wz-end">סיימנו</button></div>` : ''}
      ${isOwner() && !feeExists(w) && !w.showFee ? `<div class="sacts"><button class="btn main" type="button" data-s="wz-end">סיימנו</button><button class="btn" type="button" data-s="wz-showfee">${v && v.getTime() < Date.now() ? 'הביקור היה: לרשום דמי ביקור' : 'לרשום דמי ביקור עכשיו (שולם מראש)'}</button></div><p class="hint2">דמי ביקור וחשבונית אפשר לרשום גם אחרי הביקור, מהכרטיס בחלון "לקוחות".</p>` : ''}
      ${isOwner() && !feeExists(w) && w.showFee ? `<p class="hint2">דמי ביקור: כמה ומתי משלמים?</p>
      <div class="opts">
        <label class="opt"><input type="radio" name="fee" value="none" checked>בלי דמי ביקור</label>
        <label class="opt"><input type="radio" name="fee" value="later">ייגבה בביקור (נוספת משימה ליום הביקור)</label>
        <label class="opt"><input type="radio" name="fee" value="now">שולם כבר</label>
      </div>
      <div class="two"><label>סכום (₪)<input id="wzAmt" inputmode="numeric" placeholder="למשל 350"></label><label>אמצעי<select id="wzMeth"><option>ביט</option><option>מזומן</option><option value="העברה">העברה בנקאית</option><option>אשראי</option><option>צ'ק</option></select></label></div>
      <div class="sacts"><button class="btn main" type="button" data-s="wz-fee">להמשיך</button></div>` : ''}${!isOwner() ? `<div class="sacts"><button class="btn main" type="button" data-s="wz-end">סיימנו</button></div>` : ''}</div>`;
  }
  if (w.step === 3) body = `<div class="wz">
      ${w.fee === 'now' ? `<div class="done-badge">✓ נרשם תשלום של ${shek(w.amount)}</div><p class="hint2">צריך להוציא חשבונית במורנינג. כשהוצאת, מסמנים כאן. אם לא עכשיו, זה מחכה בחלון "גבייה וחשבוניות".</p>
        <div class="sacts"><a class="btn" target="_blank" rel="noopener" href="https://app.greeninvoice.co.il/">לפתוח את מורנינג</a><button class="btn main" type="button" data-s="wz-inv">הוצאתי חשבונית ✓</button><button class="btn ghost" type="button" data-s="wz-end">אחר כך</button></div>`
      : w.fee === 'later' ? `<div class="done-badge">✓ נוספה משימה: לגבות ${w.amount ? shek(w.amount) : 'דמי ביקור'} ביום הביקור</div><p class="hint2">אחרי שגובים, רושמים תשלום באפליקציה ומשם יוצאת חשבונית.</p><div class="sacts"><button class="btn main" type="button" data-s="wz-end">סיימנו</button></div>`
      : `<div class="done-badge">✓ הכל מסודר</div><div class="sacts"><button class="btn main" type="button" data-s="wz-end">סיימנו</button></div>`}</div>`;
  sh.style.setProperty('--pc', '#7b68d9');
  sh.innerHTML = `<div class="grab"></div><button class="x" type="button" data-s="close" aria-label="סגירה">×</button>
    <span class="kind">טיפול בפנייה · שלב ${Math.min(w.step + 1, n)} מתוך ${n}: ${WSTEPS[w.step]}</span>${stepsBar()}<h2 id="shT">${esc(w.name || w.it.name)}</h2>${body}`;
  showSheet();
  $$('#sheet [name=fee]').forEach((r) => r.addEventListener('change', () => { const on = r.value !== 'none'; $('#wzAmt').disabled = !on; $('#wzMeth').disabled = r.value !== 'now'; }));
  if ($('#wzAmt')) { $('#wzAmt').disabled = true; $('#wzMeth').disabled = true; }
  const ta = $('#wzProb'); if (ta) { const grow = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 2 + 'px'; }; ta.addEventListener('input', grow); requestAnimationFrame(grow); }   // בלי גלילה: החלון גדל לפי הטקסט
  // אחרי "זה אותו אדם?" — תיקון הטלפון מבטל את השאלה ומחזיר את "לפתוח כרטיס" (בודקים מחדש)
  if (w.askCust && $('#wzPhone')) $('#wzPhone').addEventListener('input', () => { if (!WZ || !WZ.askCust) return; Object.assign(WZ, { name: $('#wzName').value, phone: $('#wzPhone').value, place: $('#wzPlace').value, problem: $('#wzProb').value, askCust: null }); const pos = $('#wzPhone').selectionStart; renderWizard(); const f = $('#wzPhone'); f.focus(); try { f.setSelectionRange(pos, pos); } catch (e) {} }, { once: true });
}
const feeExists = (w) => D.payments.some((p) => p.job_id === w.jobId && /דמי ביקור/.test(p.note || '')) || D.tasks.some((t) => !t.done_at && t.title && t.title.startsWith('לגבות דמי ביקור') && w.jobId && t.title.includes('#' + w.jobId.slice(0, 4)));
const pad = (n) => String(n).padStart(2, '0');
function gcalHref() {
  const w = WZ, s = new Date(w.visitAt), e = new Date(s.getTime() + 3600e3), f = (d) => d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + '00Z';
  const p = new URLSearchParams({ action: 'TEMPLATE', text: 'ביקור · ' + (w.name || 'לקוח'), dates: f(s) + '/' + f(e), details: [isOwner() ? w.problem : noMoney(w.problem), w.phone && 'טלפון: ' + fmtPhone(w.phone)].filter(Boolean).join('\n'), location: w.place || '', ctz: 'Asia/Jerusalem' });
  return 'https://calendar.google.com/calendar/render?' + p.toString();
}
function confirmText() { const v = new Date(WZ.visitAt); return `שלום${WZ.name ? ' ' + WZ.name.split(' ')[0] : ''}, כאן אור בגג. מאשר ביקור ב${dayHe(dayKey(v)) === 'היום' || dayHe(dayKey(v)) === 'מחר' ? dayHe(dayKey(v)) : '-' + dm(dayKey(v))} בשעה ${hm(v)}.`; }
// קריאת שדות האשף (גם בשלב "אותו אדם?" — אחרת עריכה שם הלכה לאיבוד, ביקורת לוח 5)
function readWzForm(w) {
  if (!$('#wzName')) return;
  w.name = $('#wzName').value.trim(); w.phone = normPhone($('#wzPhone').value) || $('#wzPhone').value.trim();
  w.place = $('#wzPlace').value.trim(); w.problem = $('#wzProb').value.trim();
  const raw = w.it.lead && w.it.lead.__raw;   // צוות: התיבה מוסתרת-סכומים; אם לא נערכה — לענן נשמר המקור
  w.problemRaw = raw && w.problem === (w.it.lead.summary || '').trim() ? raw.trim() : null;
}
async function wizardClick(b) {
  const w = WZ, s = b.dataset.s; if (!w || BUSY) return; BUSY = true; b.disabled = true;
  try {
    if (s === 'wz-skip') { const it = w.it; let ok = true; if (it.src === 'wa') ok = await setLeadStatus(it.jid, 'skip'); for (const c of it.calls || (it.call ? [it.call] : [])) ok = (await setCallHandled(c.id, true, 'לא רלוונטי')) && ok; if (!ok) return; WZ = null; toast('סומן "לא רלוונטי"'); await afterAction(it); return; }
    if (s === 'wz-open') {
      readWzForm(w); w.useCust = null; w.forceNew = false;
      if (!w.name && !w.phone) { toast('צריך לפחות שם או טלפון'); return; }
      const r = await openCard(w); if (r === 'ask') { renderWizard(); return; } if (!r) return;
      w.step = 1; renderAll(); renderWizard(); return;
    }
    if (s === 'wz-use' || s === 'wz-new') { readWzForm(w); if (s === 'wz-use') w.useCust = w.askCust; else w.forceNew = true; w.askCust = null; const r = await openCard(w); if (r === 'ask') { renderWizard(); return; } if (!r) return; w.step = 1; renderAll(); renderWizard(); return; }
    if (s === 'wz-showfee') { w.showFee = true; renderWizard(); return; }
    if (s === 'wz-later') { w.step = isOwner() ? 2 : 2; if (!isOwner()) { closeSheet(); renderAll(); toast('הכרטיס נפתח. התיאום מחכה בחלון "לקוחות"'); return; } renderWizard(); return; }
    if (s === 'wz-visit' || s === 'wz-visited') {
      let at;   // "כבר הייתי בביקור": הביקור = עכשיו, ישר לשלב שאחרי הביקור (אור תיאם לבד, 08.11)
      if (s === 'wz-visited') at = new Date();
      else { const d = $('#wzDate').value, tm = $('#wzTime').value || '09:00'; if (!d) { toast('צריך לבחור תאריך'); return; } at = new Date(d + 'T' + tm); if (isNaN(at)) { toast('התאריך לא תקין'); return; } }
      const j = D.jobs.find((x) => x.id === w.jobId); const patch = { visit_at: at.toISOString() }; if (j && j.stage === 'lead') Object.assign(patch, { stage: 'visit', stage_changed_at: new Date().toISOString() });
      // מותנה: אם מכשיר אחר כבר קידם את העבודה או קבע ביקור אחר — לא דורסים (סבב-ביקורת לוח 2)
      if (!(await dbUpdate('jobs', w.jobId, patch, null, j ? { stage: j.stage, visit_at: j.visit_at || null } : null))) return; if (j) Object.assign(j, patch);
      const ljid = w.it.jid || (w.it.lead && w.it.lead.jid), l = ljid && D.leads.find((x) => x.jid === ljid); if (l && ['new', 'replied'].includes(l.status)) await setLeadStatus(l.jid, 'visit');
      w.visitAt = patch.visit_at; if (s === 'wz-visited') w.showFee = true; w.step = 2; renderAll(); renderWizard(); return;
    }
    if (s === 'wz-fee') {
      const kind = (document.querySelector('#sheet [name=fee]:checked') || {}).value || 'none', amt = +String($('#wzAmt').value).replace(/[^\d.]/g, '');
      if (kind !== 'none' && kind === 'now' && !(amt > 0)) { toast('צריך סכום'); return; }
      w.fee = kind; w.amount = amt || 0;
      if (kind === 'now') { const id = w.payId0 = w.payId0 || uuid(); const row = { id, job_id: w.jobId, amount: amt, paid_at: TODAY(), method: $('#wzMeth').value, note: 'דמי ביקור', invoice_issued: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; if (!(await dbInsert('payments', row))) return; if (!D.payments.some((x) => x.id === row.id)) D.payments.push(row); dirty(); w.payId = id; }
      if (kind === 'later') { const due = w.visitAt ? dayKey(w.visitAt) : TODAY(); w.task0 = w.task0 || uuid(); if (!(await addTask('לגבות דמי ביקור · ' + (w.name || 'לקוח') + ' #' + w.jobId.slice(0, 4), due, w.task0))) return; }   // בלי סכום בכותרת: משימות רואים כולם (גם צוות)
      w.step = 3; renderAll(); renderWizard(); return;
    }
    if (s === 'wz-inv') { if (await dbUpdate('payments', w.payId, { invoice_issued: true })) { const p = D.payments.find((x) => x.id === w.payId); if (p) p.invoice_issued = true; toast('מעולה. הכל מסודר.'); closeSheet(); renderAll(); } return; }
    if (s === 'wz-end') { closeSheet(); renderAll(); toast('נשמר. ' + (w.name || 'הלקוח') + ' בחלון "לקוחות"'); return; }
  } finally { BUSY = false; if (b.isConnected) b.disabled = false; }
}
// לקוח (קיים לפי טלפון או חדש) + עבודה. מקשר את הפנייה והשיחות.
// ביקורת 07.11: (1) מזהים קבועים לכל אשף — ניסיון חוזר לא יוצר כפילות; (2) לקוח קיים לפי טלפון → אור מאשר באשף (useCust);
// (3) עבודה קיימת נלקחת רק אם היא "ליד" בלי מועד ביקור — לעולם לא דורסים ביקור קיים; (4) ליד שכבר מקושר — ללקוח שלו.
async function serverCustByPhone(ph) {
  if (FX || !ph) return null; const tail = normPhone(ph).slice(-7); if (!tail) return null;
  const { data } = await sb.from('customers').select('id,name,address,phone').is('deleted_at', null).ilike('phone', '%' + tail.slice(0, 3) + '%' + tail.slice(3) + '%').limit(20);
  return (data || []).find((c) => normPhone(c.phone) === normPhone(ph)) || null;
}
async function openCard(w) {
  const now = new Date().toISOString(), it = w.it;
  w.ids = w.ids || { cust: uuid(), job: uuid() };
  // תמיד מהנתונים הטריים (08.11, בודק אקראי: אחרי רענון-רקע האשף עדכן עותק ישן — הענן השתנה, המסך לא)
  const jid = it.jid || (it.lead && it.lead.jid), l = jid ? D.leads.find((x) => x.jid === jid) : null;
  let c = (w.useCust && custOf(w.useCust)) || (l && l.customer_id && custOf(l.customer_id)) || null;
  if (!c && !w.forceNew) {
    const found = custByPhone(w.phone) || await serverCustByPhone(w.phone);
    if (found && found.id === w.ids.cust) c = found;   // הלקוח שהאשף הזה עצמו יצר (ניסיון חוזר אחרי כשל) — לא שואלים
    else if (found) { if (!D.customers.some((x) => x.id === found.id)) { D.customers.push(found); dirty(); } w.askCust = found.id; return 'ask'; }
  }
  if (!c) {
    c = { id: w.ids.cust, name: w.name || fmtPhone(w.phone), phone: w.phone || null, address: w.place || null, source: it.src === 'call' ? 'טלפון' : 'וואטסאפ', created_at: now, updated_at: now };
    if (!(await dbInsert('customers', c))) return false; if (!D.customers.some((x) => x.id === c.id)) D.customers.push(c); dirty();
  } else if (!c.address && w.place) { if (await dbUpdate('customers', c.id, { address: w.place })) c.address = w.place; }
  let j = D.jobs.find((x) => x.id === w.ids.job) || D.jobs.find((x) => x.customer_id === c.id && x.stage === 'lead' && !x.visit_at && !x.deleted_at && (!x.problem || !w.problem || x.problem === (isOwner() ? w.problem : noMoney(w.problem))));
  if (!j) {
    const prob = w.problemRaw || w.problem;   // צוות: לענן המקור, אם לא נערך
    j = { id: w.ids.job, customer_id: c.id, title: short(prob, 60) || null, stage: 'lead', stage_changed_at: now, problem: prob || null, created_at: now, updated_at: now };
    if (!(await dbInsert('jobs', j))) return false;
    if (!isOwner()) j = { ...j, problem: noMoney(j.problem), title: noMoney(j.title) };   // צוות: בענן נשמר המקור, במסך — בלי סכומים (ביקורת לוח 3)
    if (!D.jobs.find((x) => x.id === j.id)) D.jobs.push(j); dirty();
  }
  w.customerId = c.id; w.jobId = j.id; if (!w.name) w.name = c.name;
  let linked = true;
  if (l && l.customer_id !== c.id) { const patch = { customer_id: c.id }; if (l.status === 'new') Object.assign(patch, { status: 'replied', status_by: 'phone', status_at: now }); if (await dbUpdate('wa_leads', l.jid, patch, 'jid', { status: l.status })) Object.assign(l, patch); else linked = false; }
  for (const cl0 of it.calls || (it.call ? [it.call] : [])) { const cl = D.calls.find((x) => x.id === cl0.id) || cl0; if (cl.customer_id === c.id) continue; const p = { customer_id: c.id, handled_at: now, handled_by: D.me || 'לוח' }; if (await dbUpdate('calls', cl.id, p)) Object.assign(cl, p); else linked = false; }
  return linked;
}

/* ---------- כתיבה לענן ---------- */
// בדיקות בלבד (window.BOARD_FIXTURE): "שרת" מדומה בזיכרון עם אותה התנהגות כמו Supabase — מזהה כפול = 23505,
// עדכון מותנה שנכשל כשמכשיר אחר שינה, כשל-רשת לפי FX.fail. בלי FX — לא קיים ולא רץ.
const FXT = { wa_leads: 'jid' };
function fxTable(t) { FX.server = FX.server || {}; return (FX.server[t] = FX.server[t] || []); }
function fxFail(op, table) { const f = FX.fail && FX.fail[op + ':' + table]; if (f > 0) { FX.fail[op + ':' + table] = f - 1; return true; } return false; }
async function fxInsert(table, row) {
  FX.writes.push(['insert', table, row]);
  if (fxFail('insert', table)) { toast('לא נשמר. בדוק רשת ונסה שוב'); return false; }
  const T0 = fxTable(table); if (T0.some((r) => r.id === row.id)) return true;
  T0.push(JSON.parse(JSON.stringify(row))); FX.events.push([table, row.id, 'create']); return true;
}
async function fxUpdate(table, id, patch, key, expect) {
  FX.writes.push(['update', table, id, patch]);
  if (fxFail('update', table)) { toast('לא נשמר. בדוק רשת ונסה שוב'); return false; }
  const r = fxTable(table).find((x) => x[key || 'id'] === id);
  if (r && expect && Object.entries(expect).some(([k, v]) => (r[k] == null ? null : r[k]) !== v)) { toast('זה השתנה בינתיים במכשיר אחר. מרענן…'); reloadSoon(); return false; }
  if (!r) { toast('לא נשמר. בדוק רשת ונסה שוב'); return false; }
  Object.assign(r, patch); FX.events.push([table, id, 'update']); return true;
}
let reloadT;
function reloadSoon() { clearTimeout(reloadT); reloadT = setTimeout(async () => { if (BUSY || TICKING.size) { reloadSoon(); return; } try { if (await load()) { renderAll(); refreshOpenSheet(); } } catch (e) { console.warn(e); } }, FX ? 50 : 600); }
// אחרי רענון: חלונית פתוחה (לא אשף) נבנית מחדש מהנתונים הטריים, כדי שהפעולה הבאה לא תיגע בעותק ישן
function refreshOpenSheet() { if (CUR && !WZ && CUR.id !== 'menu') { const f = findItem(CUR.id); if (f) openItem(f, SL.map((x) => findItem(x.id) || x)); else closeSheet(); } }
async function logEvent(entity, id, action, diff) {
  if (FX || !/^[0-9a-f-]{36}$/i.test(String(id))) return;   // events.entity_id הוא uuid; jid/שם-קובץ לא נרשמים
  try { await sb.from('events').insert({ entity, entity_id: id, action, device: 'board', diff }); } catch (e) { /* לוג בלבד */ }
}
async function dbInsert(table, row) {
  if (FX) return fxInsert(table, row);
  const { error } = await sb.from(table).insert(row);
  if (error && error.code === '23505') return true;   // כבר נשמר (ניסיון חוזר עם אותו מזהה) — לא כפילות
  if (error) { console.warn(table, error); toast('לא נשמר. בדוק רשת ונסה שוב'); return false; }
  logEvent(table, row.id, 'create', row); return true;
}
// expect: {עמודה: ערך} — מעדכנים רק אם בענן עדיין כך (מכשיר אחר לא שינה בינתיים). אחרת: לא נשמר + רענון.
async function dbUpdate(table, id, patch, key, expect) {
  if (FX) return fxUpdate(table, id, patch, key, expect);
  const p = { ...patch, updated_at: new Date().toISOString() };
  let q = sb.from(table).update(p).eq(key || 'id', id); if (expect) Object.entries(expect).forEach(([k, v]) => { q = v == null ? q.is(k, null) : q.eq(k, v); });
  const { error, data } = await q.select(key || 'id');
  if (!error && expect && data && !data.length) { toast('זה השתנה בינתיים במכשיר אחר. מרענן…'); reloadSoon(); return false; }
  if (error || !data || !data.length) { console.warn(table, error); toast('לא נשמר. בדוק רשת ונסה שוב'); return false; }
  logEvent(table, id, 'update', patch); return true;
}
async function setLeadStatus(jid, st, expected) {
  const l = D.leads.find((x) => x.jid === jid); if (!l) return false;
  const exp = expected === undefined ? l.status : expected;
  if (exp != null && l.status !== exp && expected !== undefined) { toast('זה השתנה בינתיים. לא שיניתי'); return false; }
  const prev = [l.status, l.status_at], now = new Date().toISOString(); l.status = st; l.status_at = now;
  if (await dbUpdate('wa_leads', jid, { status: st, status_by: 'phone', status_at: now }, 'jid', exp ? { status: exp } : null)) return true;
  [l.status, l.status_at] = prev; renderAll(); return false;
}
async function setTaskDone(id, done) {
  const t = D.tasks.find((x) => x.id === id); if (!t) return false;
  const prev = t.done_at; t.done_at = done ? new Date().toISOString() : null;
  if (await dbUpdate('tasks', id, { done_at: t.done_at })) return true;
  t.done_at = prev; renderAll(); return false;
}
async function setCallHandled(id, on, why) {
  const c = D.calls.find((x) => x.id === id); if (!c) return false;
  const prev = [c.handled_at, c.handled_by], patch = { handled_at: on ? new Date().toISOString() : null, handled_by: on ? (why ? why + ' · ' : '') + (D.me || 'לוח') : null };
  Object.assign(c, patch);
  if (await dbUpdate('calls', id, patch)) return true;
  [c.handled_at, c.handled_by] = prev; renderAll(); return false;
}
async function addTask(title, due, id) {
  const row = { id: id || uuid(), title: String(title).slice(0, 300), due, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  if (!(await dbInsert('tasks', row))) return false; if (!D.tasks.some((x) => x.id === row.id)) D.tasks.unshift(row); dirty(); return true;
}

/* ---------- משימות ---------- */
function renderTasks() {
  const day = taskDay === 'today' ? TODAY() : TOM(), today = TODAY();
  const free = D.tasks.filter((t) => !t.job_id && (taskDay === 'today' ? (!t.due || t.due <= today) : t.due === day) && (!t.done_at || dayKey(t.done_at) === today))
    .sort((a, b) => (a.done_at ? 1 : 0) - (b.done_at ? 1 : 0) || String(a.due || '9').localeCompare(String(b.due || '9')));
  const byJob = {}; D.tasks.filter((t) => t.job_id && !t.done_at).forEach((t) => { (byJob[t.job_id] = byJob[t.job_id] || []).push(t); });
  const groups = taskDay === 'today' ? Object.entries(byJob) : [];
  $('#tasks').innerHTML = free.map((t, i) => `<div class="task lift ${t.done_at ? 'done' : ''}" data-k="T${esc(t.id)}" style="--i:${i}">
    <button class="chk" type="button" data-chk="${esc(t.id)}" aria-label="סימון שבוצע" aria-pressed="${!!t.done_at}">${CHK}</button>
    <div class="tt"><span class="tx">${esc(t.title)}</span><small>${!t.due ? 'בלי תאריך' : t.due < today ? 'באיחור · היה עד ' + dm(t.due) : t.due === today ? 'היום' : 'מחר'}</small></div></div>`).join('')
    + groups.map(([jid, ts2], i) => { const j = D.jobs.find((x) => x.id === jid); return `<a class="task group lift" href="./" data-k="J${esc(jid)}" style="--i:${free.length + i};--pc:#4a78d0"><span class="cnt">${ts2.length}</span><div class="tt">סעיפי ביצוע פתוחים · ${esc(jobName(j))}<small>מסמנים בתוך העבודה באפליקציה</small></div></a>`; }).join('')
    || '<div class="empty">אין משימות ל' + (taskDay === 'today' ? 'היום' : 'מחר') + '</div>';
  const open = D.tasks.filter((t) => !t.job_id && !t.done_at && (!t.due || t.due <= today)).length;
  $('#taskSum').innerHTML = `<b>${open} פתוחות</b>${groups.length ? ` · ${groups.length} עבודות בביצוע` : ''}`;
}
$('#tasks').addEventListener('click', (e) => {
  const ck = e.target.closest('[data-chk]'); if (!ck) return;
  const t = D.tasks.find((x) => x.id === ck.dataset.chk); if (!t) return; const done = !t.done_at;
  ck.closest('.task').classList.toggle('done', done); ck.setAttribute('aria-pressed', String(done));
  setTaskDone(t.id, done).then((ok) => {
    if (!ok) return; const st = doneStore(); if (!done) { delete st['T' + t.id]; doneSave(st); }
    setTimeout(() => flip($('#tasks'), () => renderAll()), 450);
    if (done) toast('סומן שבוצע', () => setTaskDone(t.id, false).then(() => flip($('#tasks'), () => renderAll())));
  });
});
$('#addTask').addEventListener('submit', async (e) => {
  e.preventDefault(); const v = $('#taskIn').value.trim(); if (!v) return;
  $('#taskIn').value = '';
  if (!(await addTask(v, taskDay === 'today' ? TODAY() : TOM()))) { $('#taskIn').value = v; return; }
  flip($('#tasks'), () => renderAll());
});

/* ---------- יומן: ביקורים מהעבודות + ביקורים שנקבעו בשיחות ---------- */
function calEvents(from, to) {
  const ev = [];
  D.jobs.filter((j) => j.visit_at && !['paid', 'lost'].includes(j.stage)).forEach((j) => { const k = dayKey(j.visit_at); if (k >= from && k <= to) ev.push({ k, t: T(j.visit_at), what: 'ביקור · ' + jobName(j), sub: [custOf(j.customer_id) && custOf(j.customer_id).address, short(j.problem, 60)].filter(Boolean).join(' · '), ref: 'J' + j.id, w: 'var(--or)' }); });
  const linked = new Set(D.jobs.filter((j) => j.visit_at).map((j) => j.customer_id));
  D.calls.filter((c) => c.data && c.data.visit && c.data.visit.date && !(c.customer_id && linked.has(c.customer_id))).forEach((c) => {
    const k = c.data.visit.date; if (k < from || k > to) return; const t = c.data.visit.time ? new Date(k + 'T' + c.data.visit.time).getTime() : new Date(k + 'T23:59').getTime();
    ev.push({ k, t, what: 'נקבע בטלפון · ' + callWho(c), sub: (c.data.place ? c.data.place + ' · ' : '') + 'עוד לא בכרטיס', ref: 'K' + c.id, w: 'var(--zo)', noTime: !c.data.visit.time });
  });
  return ev.sort((a, b) => a.t - b.t);
}
function renderCal() {
  const from = calDay === 'tom' ? TOM() : TODAY(), to = calDay === 'today' ? TODAY() : calDay === 'tom' ? TOM() : dayKey(Date.now() + 6 * 864e5);
  const vs = calEvents(from, to), now = Date.now(); let nowShown = calDay !== 'today', html = '', last = '';
  vs.forEach((e, i) => {
    if (calDay === 'week' && e.k !== last) { html += `<div class="daysep" style="background:none">${dayHe(e.k)}</div>`; last = e.k; }
    if (!nowShown && e.t > now) { html += '<div class="now"><i class="pulse"></i>עכשיו</div>'; nowShown = true; }
    html += `<div class="ev lift ${e.t < now && calDay === 'today' ? 'past' : ''}" data-ref="${esc(e.ref)}" style="--w:${e.w};--i:${i}" role="button" tabindex="0"><span class="t">${e.noTime ? '—' : hm(e.t)}</span><span class="stripe"></span><div class="what">${esc(e.what)}<small>${esc(e.sub)}</small></div></div>`;
  });
  $('#cal').innerHTML = html || `<div class="empty">אין ביקורים ${calDay === 'today' ? 'היום' : calDay === 'tom' ? 'מחר' : 'השבוע'}. ביקור שקובעים באשף או באפליקציה יופיע כאן.</div>`;
}
$('#cal').addEventListener('keydown', (e) => { const r = e.target.closest && e.target.closest('[data-ref]'); if (r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); r.click(); } });
$('#cal').addEventListener('click', (e) => { const r = e.target.closest('[data-ref]'); if (!r) return; const it = findItem(r.dataset.ref); if (it) openItem(it, [it]); });

/* ---------- פס-ברכה, כרטיסי מספר, תפריט ---------- */
const SEEN_KEY = () => 'ob2_board_seen_' + (D.email || 'x');
let SINCE = 0;
function sinceTime() {
  let s = 0; try { s = +localStorage.getItem(SEEN_KEY()) || 0; } catch (e) {}
  const y = new Date(); y.setDate(y.getDate() - 1); y.setHours(18, 0, 0, 0);   // ברירת-מחדל: מאתמול ב-18:00
  return s && Date.now() - s < 4 * 864e5 ? Math.min(s, Date.now() - 3600e3) : y.getTime();
}
function briefData() {
  const S = SINCE, ib = inboxItems(), calls = D.calls.filter((c) => callTime(c) > S);
  return {
    newWa: D.leads.filter((l) => isJob(l) && T(l.data && l.data.first_seen ? l.data.first_seen : l.last_activity) > S && l.status === 'new').length,
    callsBiz: calls.filter((c) => ['customer', 'lead'].includes(c.kind)).length,
    callsLead: calls.filter((c) => c.kind === 'lead').length,
    check: ib.filter((x) => x.tab === 'check').length, waiting: ib.filter((x) => x.tab === 'check' && x.waiting).length,
    visits: calEvents(TODAY(), TODAY()).length, tasks: D.tasks.filter((t) => !t.job_id && !t.done_at && t.due && t.due <= TODAY()).length,
    callNext: D.calls.filter((c) => callOpen(c) && c.data && c.data.next && !callIsLead(c)).length,
    inv: moneyItems().filter((m) => m.tab === 'inv').length,
  };
}
function renderHero(bumpIt) {
  const h = new Date().getHours(), greet = h < 5 ? 'לילה טוב' : h < 12 ? 'בוקר טוב' : h < 17 ? 'צהריים טובים' : 'ערב טוב';
  $('#greet').textContent = greet + (D.me ? ', ' + D.me : '');
  const b = briefData(), left = AG.filter((a) => !a.done).length, sinceTxt = new Date(SINCE).toLocaleString('he-IL', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
  const parts = [];
  if (b.callsBiz) parts.push(`<b>${b.callsBiz} שיחות עבודה</b>`);
  const inboxTxt = b.check ? ` ${b.check === 1 ? 'פנייה אחת מחכה' : b.check + ' פניות מחכות'} לבדיקה.` : ''; if (b.newWa) parts.push(`<b>${b.newWa} פניות חדשות בוואטסאפ</b>`);
  const now = (b.visits ? `${b.visits === 1 ? 'ביקור אחד' : b.visits + ' ביקורים'} היום` : '') + (b.visits && left ? ', ו-' : '') + (left ? `<b class="n" id="hiN">${left === 1 ? 'דבר אחד' : left + ' דברים'}</b> ברשימה` : '');
  $('#brief').innerHTML = (parts.length ? `מאז ${esc(sinceTxt)}: ${parts.join(' ו-')}. ` : '') + (now ? now + '.' : 'הרשימה של היום נקייה.') + inboxTxt;
  if (bumpIt) bump('hiN');
}
function spark(pts) {
  if (!pts.some((v) => v > 0)) return '<span></span>';   // קו שטוח של אפסים לא אומר כלום
  const W = 120, H = 38, mx = Math.max(...pts), mn = Math.min(...pts), r = (mx - mn) || 1;
  const xy = pts.map((v, i) => [i * W / (pts.length - 1), H - 4 - (v - mn) / r * (H - 10)]);
  const d = xy.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' '), last = xy[xy.length - 1];
  return `<svg class="sp" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path class="a" d="${d} L${W} ${H} L0 ${H}Z"/><path class="l" d="${d}"/><circle cx="${last[0]}" cy="${last[1]}" r="3.5"/></svg>`;
}
const week = (arr, f) => { const out = []; for (let i = 6; i >= 0; i--) { const k = dayOff(-i); out.push(arr.filter((x) => f(x) === k).length); } return out; };
const TI = {
  inbox: '<path d="M4 13l2.5-7h11L20 13v6H4z"/><path d="M4 13h5l1 2h4l1-2h5"/>', clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>', doc: '<path d="M7 3h7l4 4v14H7z"/><path d="M10 13l2 2 4-4"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>', check: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.5 12.5l2.3 2.2 4.7-5"/>' };
function renderTiles() {
  const b = briefData(), leadDay = (l) => dayKey(l.last_activity || 0), callDay = (c) => dayKey(callTime(c));
  const nextV = calEvents(TODAY(), dayKey(Date.now() + 6 * 864e5)).find((e) => e.t > Date.now());
  const callsToday = D.calls.filter((c) => callDay(c) === TODAY()).length;
  const tiles = [
    { c: '#2a9a63', i: 'inbox', l: 'פניות לבדוק', v: b.check, d: b.waiting ? `<b class="warn">${b.waiting} מחכים לתשובה</b>` : 'אף אחד לא מחכה', s: week(D.leads.filter(isJob), leadDay), sec: 'p-inbox' },
    isOwner() && { c: '#b0587d', i: 'phone', l: 'שיחות היום', v: callsToday, d: b.callNext ? `<b class="warn">${b.callNext} עם צעד פתוח</b>` : 'הכל טופל', s: week(D.calls, callDay), sec: 'p-calls' },
    { c: '#d39a1c', i: 'cal', l: 'ביקורים היום', v: b.visits, d: nextV ? 'הבא: ' + esc(short(nextV.what.replace(/^.*· /, ''), 18)) + ' ' + (dayKey(nextV.t) === TODAY() ? hm(nextV.t) : dm(dayKey(nextV.t))) : 'אין ביקור קרוב', s: week(D.jobs.filter((j) => j.visit_at), (j) => dayKey(j.visit_at)), sec: 'p-cal' },
    isOwner() ? { c: '#e07a3a', i: 'doc', l: 'להוציא חשבונית', v: b.inv, d: b.inv ? shek(moneyItems().filter((m) => m.tab === 'inv').reduce((s, m) => s + m.amount, 0)) + ' בלי חשבונית' : 'הכל מסודר', s: week(D.payments, (p) => p.paid_at), sec: 'p-money' }
      : { c: '#4a78d0', i: 'check', l: 'משימות היום', v: b.tasks, d: 'פתוחות להיום', s: week(D.tasks, (t) => t.due), sec: 'p-tasks' },
  ];
  $('#tiles').innerHTML = tiles.filter(Boolean).map((t, i) => `<button class="tile lift" type="button" data-sec="${t.sec}" style="--tc:${t.c};--i:${i + 1}">
    <span class="ti"><svg viewBox="0 0 24 24">${TI[t.i]}</svg></span>${spark(t.s)}
    <span class="lb">${t.l}</span><span class="v">${t.v}</span><span class="dl">${t.d}</span></button>`).join('');
}
$('#tiles').addEventListener('click', (e) => { const b = e.target.closest('[data-sec]'); if (b) { curSec = b.dataset.sec; jump(b.dataset.sec); renderNav(); } });
const NAV_ICON = { 'p-today': '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>', 'p-inbox': TI.inbox, 'p-cust': '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
  'p-calls': TI.phone, 'p-tasks': TI.check, 'p-cal': TI.cal, 'p-money': '<path d="M7 3h7l4 4v14H7z"/><path d="M10 12h5M10 16h5"/>', 'p-arch': '<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v10h14V9M10 13h4"/>' };
const NAVN = { 'p-today': 'היום', 'p-inbox': 'פניות', 'p-cust': 'לקוחות', 'p-calls': 'שיחות', 'p-tasks': 'משימות', 'p-cal': 'יומן', 'p-money': 'כסף', 'p-arch': 'ארכיון' };
let curSec = 'p-today';
function badge(id) {
  if (id === 'p-today') return AG.filter((a) => !a.done).length;
  if (id === 'p-inbox') return inboxItems().filter((x) => x.tab === 'check').length;
  if (id === 'p-calls') return D.calls.filter((c) => callOpen(c) && c.data && c.data.next && !callIsLead(c)).length;
  if (id === 'p-money') return moneyItems().filter((m) => m.tab === 'inv').length;
  return 0;
}
function renderNav() {
  const ids = Object.keys(NAVN).filter((id) => !$('#' + id).hidden), bd = (id) => { const n = badge(id); return n ? `<i>${n}</i>` : ''; };
  $('#nav').innerHTML = ids.map((id) => `<button type="button" data-sec="${id}" aria-current="${id === curSec}"><svg viewBox="0 0 24 24">${NAV_ICON[id]}</svg><span>${NAVN[id]}</span>${bd(id)}</button>`).join('');
  const dockIds = ['p-today', 'p-inbox', 'p-cust', 'p-cal'], more = !dockIds.includes(curSec), moreN = ['p-calls', 'p-money'].reduce((n, id) => n + badge(id), 0);
  $('#dock').innerHTML = dockIds.map((id) => `<button type="button" data-sec="${id}" aria-current="${id === curSec}"><svg viewBox="0 0 24 24">${NAV_ICON[id]}</svg>${NAVN[id]}${bd(id)}</button>`).join('')
    + `<button type="button" data-more-menu aria-current="${more}"><svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/></svg>עוד${moreN ? `<i>${moreN}</i>` : ''}</button>`;
  if (isPhone()) showPhoneSec(curSec);
}
function navGo(e) {
  if (e.target.closest('[data-more-menu]')) return openMoreMenu();
  const b = e.target.closest('[data-sec]'); if (!b) return; curSec = b.dataset.sec; renderNav(); if (curSec === 'p-today' && !isPhone()) { scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' }); return; } jump(curSec);
}
function openMoreMenu() {
  CUR = { id: 'menu' }; WZ = null; SL = [];
  const ids = ['p-calls', 'p-tasks', 'p-money', 'p-arch'].filter((id) => !$('#' + id).hidden);
  $('#sheet').style.setProperty('--pc', 'var(--lav)');
  $('#sheet').innerHTML = `<div class="grab"></div><button class="x" type="button" data-s="close" aria-label="סגירה">×</button><h2 id="shT">עוד</h2><div class="sacts">${ids.map((id) => `<button class="btn" type="button" data-go="${id}">${NAVN[id]}${badge(id) ? ' · ' + badge(id) : ''}</button>`).join('')}${isOwner() ? '<a class="btn" href="home.html">לוח הבית</a>' : ''}<button class="btn" type="button" data-go="morning">סידור הבוקר</button><a class="btn ghost" href="./">לאפליקציה</a></div>`;
  showSheet();
}
$('#sheet').addEventListener('click', (e) => { const g = e.target.closest('[data-go]'); if (!g) return; closeSheet(); if (g.dataset.go === 'morning') return openMorning(); curSec = g.dataset.go; renderNav(); jump(curSec); });
const isPhone = () => innerWidth <= 900;
$('#nav').addEventListener('click', navGo); $('#dock').addEventListener('click', navGo);
$('#cta').addEventListener('click', () => { const a = AG.find((x) => !x.done && x.u === 'now') || AG.find((x) => !x.done); if (a) openAgenda(a); else jump('p-today'); });

/* קפיצה לחלון: גלילה וטבעת צבע קטנה */
// טלפון: מסך אחד בכל פעם (החלטה 04.11: "רשימת היום כמסך הבית, לשוניות בתחתית"). מחשב: הכל, עם גלילה.
function showPhoneSec(sec) {
  document.body.classList.add('tabbed'); document.body.classList.toggle('at-today', sec === 'p-today');
  $$('.grid>.panel').forEach((p) => p.classList.toggle('cur', p.id === sec));
}
addEventListener('resize', () => { if (!isPhone()) document.body.classList.remove('tabbed'); else showPhoneSec(curSec); });
function jump(sec) {
  if (isPhone()) { curSec = sec; renderNav(); showPhoneSec(sec); scrollTo({ top: 0 }); return; }
  const p = $('#' + sec); if (!p || p.hidden) return; unboot();
  p.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
  p.animate && !calm && p.animate([{ boxShadow: '0 0 0 0 transparent' }, { boxShadow: `0 0 0 6px ${PC[sec]}44` }, { boxShadow: '0 0 0 0 transparent' }], { duration: 1400, delay: 350 });
}

/* ---------- סידור הבוקר: פעם ביום, בפתיחה הראשונה. מה קרה, ואז עוברים על הפניות אחת-אחת ---------- */
const MORNING_KEY = () => 'ob2_morning_' + TODAY() + '_' + (D.email || 'x');
function morningLines() {
  const b = briefData(), L = [];
  if (b.callsBiz) L.push(['#b0587d', b.callsBiz, 'שיחות עבודה מאז אתמול' + (b.callsLead ? `, מתוכן ${b.callsLead} פניות חדשות` : '')]);
  if (b.newWa) L.push(['#2a9a63', b.newWa, 'פניות חדשות בוואטסאפ']);
  if (b.check) L.push(['#2a9a63', b.check, 'פניות מחכות לבדיקה (רלוונטי או לא)']);
  if (b.callNext) L.push(['#e07a3a', b.callNext, 'שיחות שנקבע בהן משהו ועוד לא טופל']);
  L.push(['#d39a1c', b.visits, b.visits === 1 ? 'ביקור היום' : 'ביקורים היום']);
  if (b.tasks) L.push(['#4a78d0', b.tasks, 'משימות להיום']);
  if (isOwner() && b.inv) L.push(['#e07a3a', b.inv, 'תשלומים בלי חשבונית']);
  return L;
}
function openMorning() {
  const L = morningLines(), b = briefData(), h = new Date().getHours();
  $('#mwc').innerHTML = `<span class="kind" style="--pc:var(--lav)">סידור הבוקר</span><h2 id="mwT">${h < 12 ? 'בוקר טוב' : 'שלום'}${D.me ? ', ' + esc(D.me) : ''}</h2>
    <p class="lead">זה מה שקרה ומה שמחכה. אפשר לעבור על הפניות אחת-אחת: רלוונטי, לא רלוונטי, או אחר כך.</p>
    <div class="lines">${L.map(([c, n, t]) => `<div class="line" style="--c:${c}"><b>${n}</b><span>${esc(t)}</span></div>`).join('')}</div>
    <div class="acts">${b.check ? '<button class="btn dark" type="button" data-m="inbox">לעבור על הפניות</button>' : ''}${b.callNext ? '<button class="btn" type="button" data-m="calls">לעבור על השיחות</button>' : ''}<button class="btn ghost" type="button" data-m="close">לסגור</button></div>`;
  const mw = $('#mw'); mw.hidden = false; requestAnimationFrame(() => mw.classList.add('on'));
  try { localStorage.setItem(MORNING_KEY(), '1'); } catch (e) {}
  const f = mw.querySelector('.btn'); if (f) f.focus({ preventScroll: true });
}
function closeMorning() { const mw = $('#mw'); mw.classList.remove('on'); setTimeout(() => { if (!mw.classList.contains('on')) mw.hidden = true; }, 350); }
$('#mw').addEventListener('click', (e) => {
  if (e.target === $('#mw')) return closeMorning();
  const b = e.target.closest('[data-m]'); if (!b) return; closeMorning();
  if (b.dataset.m === 'inbox') { VIEW.inbox.tab = 'check'; renderAll(); const L = LISTS.inbox; if (L.length) openItem(L[0], L); }
  if (b.dataset.m === 'calls') { VIEW.calls.tab = 'open'; renderAll(); const L = LISTS.calls; if (L.length) openItem(L[0], L); }
});
$$('[data-morning]').forEach((b) => b.addEventListener('click', openMorning));

/* ---------- עזרים ---------- */
let undoFn = null, toastT;
function toast(msg, fn) { $('#tmsg').textContent = msg; undoFn = fn || null; $('#undo').hidden = !fn; $('#toast').classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => $('#toast').classList.remove('show'), 5000); }
$('#undo').onclick = () => { const f = undoFn; undoFn = null; $('#toast').classList.remove('show'); if (f) f(); };
document.addEventListener('pointerdown', (e) => {
  const b = e.target.closest('.btn,.seg button,.cta'); if (!b || calm) return;
  const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2, s = document.createElement('span');
  s.className = 'rp'; s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
  b.appendChild(s); setTimeout(() => s.remove(), 650);
});
function bump(id) { const n = document.getElementById(id); if (n) { n.classList.add('bump'); setTimeout(() => n.classList.remove('bump'), 380); } }
const unboot = () => $('#app').classList.remove('boot');
function flip(scope, mutate) {
  const before = {}; scope.querySelectorAll('[data-k]').forEach((c) => before[c.dataset.k] = c.getBoundingClientRect());
  unboot(); mutate(); if (calm) return;
  scope.querySelectorAll('[data-k]').forEach((c) => {
    const b = before[c.dataset.k]; if (!b) return; const a = c.getBoundingClientRect(), dx = b.left - a.left, dy = b.top - a.top; if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    c.animate([{ transform: `translate(${dx}px,${dy}px) scale(1.04)` }, { transform: 'none' }], { duration: 600, easing: 'cubic-bezier(.34,1.3,.5,1)' });
  });
}
function pill(group) { const on = group.querySelector('[aria-pressed=true]'), p = group.querySelector('.pill'); if (!on || !p) return; const g = group.getBoundingClientRect(), r = on.getBoundingClientRect(); p.style.right = (g.right - r.right) + 'px'; p.style.width = r.width + 'px'; }
if (canHover && !calm) {
  document.addEventListener('pointermove', (e) => {
    const c = e.target.closest('.lift'); if (!c) return;
    const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5, k = Math.min(1, 260 / r.width);
    c.style.setProperty('--ry', (x * 6 * k).toFixed(2) + 'deg'); c.style.setProperty('--rx', (-y * 5 * k).toFixed(2) + 'deg');
  });
  document.addEventListener('pointerout', (e) => { const c = e.target.closest('.lift'); if (c && !c.contains(e.relatedTarget)) { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); } });
}
function segInit(id, cb) {
  const g = $(id); g.addEventListener('click', (e) => { const b = e.target.closest('button[data-d]'); if (!b) return; g.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); pill(g); cb(b.dataset.d); });
}
segInit('#taskDay', (d) => { taskDay = d; unboot(); renderTasks(); });
segInit('#calDay', (d) => { calDay = d; unboot(); renderCal(); });
addEventListener('resize', () => $$('.seg').forEach(pill));

function renderAll(bumpIt) {
  dirty();   // כל ציור מחדש מתחיל מהנתונים העדכניים (כתיבות משנות את D בין ציורים)
  renderAgenda(); renderInbox(); renderCust(); renderCalls(); renderTasks(); renderCal(); renderMoney(); renderArch(); renderTiles(); renderHero(bumpIt); renderNav();
  const sc = D.leads.reduce((m, l) => (l.scanned_at > m ? l.scanned_at : m), '');
  $('#status').textContent = sc ? 'וואטסאפ נסרק: ' + new Date(sc).toLocaleString('he-IL', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '';
}

// סכומים בטקסט חופשי → [סכום] (רק לתצוגת צוות). ביקורות לוח 4–5: מילת-מפתח עצמאית; סכום = 3+ ספרות (או אלפים עם פסיק);
// ביקורת לוח 6: בלי \s* רצופים (קפאון על רווחים ארוכים), אחרי ב/מ- לא שנה ולא שעה (1600), סכום לא מתחיל ב-0 (טלפון).
// לא מסתירים מידות (מ"ר/מטר/ס"מ/ליטר...) ולא שנים אחרי ב/מ-. זו הגנה משנית — ההגנה האמיתית היא הרשאות בענן.
const MONEY_KW = 'מחירים|מחיר|עלויות|עלות|סוכם|סגרנו|הצעת מחיר|הצעה|תשלומים|תשלום|לשלם|משלם|שילמתי|שילמנו|שילמו|שילם|תשלם|נשלם|משלמים|ישלמו|שולמו|שולם|שלמתי|ישלם|מקדמה|תקציב|יעלה|עולה|יצא|יצאה|סופי|עלתה|סכום|פיקדון|פקדון|תמחור|חוב|גבייה|לגבות|דורש|שווה|סך הכל|סה"כ|סה״כ|סהכ|סך|יתרה|הנחה|ביט|פייבוקס|צ\'ק|צ׳ק|חשבונית|קבלה|דמי ביקור|העברתי|העביר|קיבלתי|קיבלנו|קיבל|סגרתי|מזומן|בהעברה|העברה|ביקש|מבקש|הוריד|מע"מ|מע״מ';
const M_UNIT = '(?![\\d,.]|\\s*(?:מ["״]ר|מ["״]מ|ס["״]מ|מטר|מטרים|ליטר|מ["״]ל|יריעות|גלונים|דליים|פחים|גלילים|רולים|קילו|ק["״]ג|יחידות|ברגים|קומות|שכבות|אחוז|%|שנים|שנה|ימים|יום|שעות|דקות))';
const M_NUM = '(?:\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d{3,}(?:\\.\\d+)?)';                  // 4,500 / 4500 / 12000.5
const M_YEAR = '(?:19|20)\\d\\d(?![\\d,.])';
const M_CUR = '(?:₪|ש["״׳\']{0,2}ח|ש\\.ח|שקלים|שקל|NIS|nis|ILS|דולר|\\$|€)';
const M_RANGE = '(?:\\s*(?:-|–|עד|או|מתוך|/|ל-?)\\s*\\d[\\d,.]*)?';                              // 4500-5000 / בין 4500 ל-5000
const M_TAIL = '(?:\\s*(?:אלף|אלפים|K|k))?(?:\\s*' + M_CUR + ')?' + M_RANGE;
const MONEY_RE = new RegExp([
  '(?:₪|\\$|€|ILS\\s?)\\s*\\d[\\d,.]*' + M_RANGE,                                         // ₪3,500 / $900 / ILS 4500
  '(?<![\\d,.])\\d[\\d,.]*\\s*(?:(?:אלף|אלפים|K|k)\\s*)?' + M_CUR,                                       // 350 שקל / 15K ₪ / 4500 ש.ח
  '(?<![\\d,.])\\d[\\d,.]*\\s*(?:אלף|אלפים)(?![א-ת])',                                               // כ-12 אלף
  '(?<!\\d)\\d+(?:\\.\\d+)?\\s*[Kk](?![A-Za-z])',                                                 // 15K
  // מילת-מפתח (+אות-שימוש) · עד 3 מילים · פיסוק · (כ-/של) · סכום שאינו מידה; אחרי ב/מ- — לא שנה
  '(?<![א-ת])[והבשלכ]{0,3}(?:' + MONEY_KW + ')(?:\\s+[^\\d\\s:?=\\-]{2,14}){0,3}\\s*(?:[:?=\\-]\\s*)?(?:כ-?\\s*|של\\s+|[במל]-?(?!\\s*(?:' + M_YEAR + '|(?:[01]\\d|2[0-3])[0-5]\\d(?![\\d,.])))\\s*)?(?!0)' + M_NUM + M_UNIT + M_TAIL,
  '(?<!\\d)' + M_NUM + '\\s*(?:\\+|כולל|לפני|אחרי|ללא|בלי)\\s*מע["״]?מ',                              // 8000 כולל מעמ / 1200 + מע"מ
  '(?<![\\d,.])\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?' + M_UNIT,                                                        // 4,500 לבד (לא 1,200 מ"ר)
  '(?<![\\d,.])\\d[\\d,.]*\\s*ל(?:מ"ר|מ״ר|מטר)',                                                       // 120 למ"ר (מחיר למטר)
  '(?<![א-ת])(?:[א-ת]+\\s+ו?)?(?:[א-ת]+\\s+)?(?:אלפיים|מאתיים|מאות|אלף|אלפים)(?:\\s*' + M_CUR + ')(?![א-ת])', // חמש מאות שקל / אלף שקל
  '(?<![א-ת])(?:אלפיים|מאתיים|[א-ת]+ת?\\s+(?:אלף|אלפים))(?![א-ת])',                       // אלפיים / שלושת אלפים
  '(?<![\\d,.])' + M_NUM + '\\s*(?:ב?מזומן|בביט|בהעברה|בצ[\'׳]ק)(?![א-ת])',
].join('|'), 'g');
const noMoney = (t) => (typeof t === 'string' ? t.replace(MONEY_RE, '[סכום]') : t);
function scrubMoney() {
  D.leads.forEach((l) => { l.__raw = l.summary; l.summary = noMoney(l.summary); if (l.data && Array.isArray(l.data.messages)) l.data.messages = l.data.messages.map((m) => (m ? { ...m, text: noMoney(m.text) } : m)); });
  D.jobs.forEach((j) => { j.problem = noMoney(j.problem); j.title = noMoney(j.title); delete j.price_agreed; });
  D.tasks.forEach((t) => { t.title = noMoney(t.title); });
  D.payments = [];
}
async function resolveRole(session) {
  let who = PEOPLE[D.email] || { name: '', role: 'crew', w: 'var(--ron)' };
  if (!FX && !PEOPLE[D.email] && session) {   // חבר-צוות (sql/016, אחרי אישור): התפקיד והשם מטבלת team. בלי הטבלה — "צוות" (בלי כסף)
    try { const r = await sb.from('team').select('role,name').eq('member_id', session.user.id).maybeSingle(); if (r.data) who = { name: r.data.name || '', role: r.data.role, w: r.data.role === 'owner' ? 'var(--zo)' : 'var(--ron)' }; } catch (e) { /* בלי טבלת צוות */ }
  }
  D.me = who.name; D.role = who.role; D.who = who;
}
async function load() {
  if (FX) {
    FX.writes = FX.writes || []; FX.events = FX.events || [];
    if (!FX.server) FX.server = { wa_leads: FX.wa_leads || [], tasks: FX.tasks || [], jobs: FX.jobs || [], customers: FX.customers || [], payments: FX.payments || [], calls: FX.calls || [] };
    const cp = (t) => JSON.parse(JSON.stringify(FX.server[t] || [])).filter((r) => !r.deleted_at);
    Object.assign(D, { leads: cp('wa_leads'), tasks: cp('tasks'), jobs: cp('jobs'), customers: cp('customers'), payments: cp('payments'), calls: cp('calls'), email: FX.email || 'or.perias@gmail.com' });
  } else {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return false;
    D.email = (session.user.email || '').toLowerCase();
    await resolveRole(session);
    const owner = isOwner();
    // Supabase מחזיר עד 1000 שורות לבקשה (ברירת-מחדל) — דפדוף, כדי ששום רשומה לא תיחתך בשקט (סבב-ביקורת לוח 2)
    const all = async (mk, cap) => { let out = [], from = 0; for (;;) { const r = await mk().range(from, from + 999); if (r.error) return r; out = out.concat(r.data || []); if (!r.data || r.data.length < 1000) return { data: out }; if (out.length >= cap) { console.warn('הגענו לתקרת טעינה', cap); return { data: out }; } from += 1000; } };
    // עמודות הארכיון (sql/017). אם עוד לא הורץ בענן — טוענים בלעדיהן, והכפתורים "להמשיך/לארכיון/להחזיר" מוסתרים
    const AR = ',keep_until,archived_at,archive_reason';
    const arch = async (mk, cap) => { const r = await all(() => mk(AR), cap); if (!r.error || !/keep_until|archived_at|archive_reason|42703/.test((r.error.code || '') + (r.error.message || ''))) return r; D.archOk = false; return all(() => mk(''), cap); };
    const [l, t, j, c, p, k] = await Promise.all([
      arch((x) => sb.from('wa_leads').select('jid,name,phone,summary,data,media,status,status_at,last_activity,scanned_at,customer_id' + x).is('deleted_at', null).order('last_activity', { ascending: false, nullsFirst: false }).order('jid'), 3000),
      all(() => sb.from('tasks').select('id,title,due,job_id,done_at,created_at').is('deleted_at', null).order('created_at', { ascending: false }).order('id'), 6000),
      arch((x) => sb.from('jobs').select('id,customer_id,title,stage,stage_changed_at,visit_at,quote_sent_at,problem,created_at,updated_at' + (owner ? ',price_agreed' : '') + x).is('deleted_at', null).order('created_at', { ascending: false }).order('id'), 10000),
      all(() => sb.from('customers').select('id,name,address,phone,email,notes').is('deleted_at', null).order('created_at', { ascending: false }).order('id'), 20000),
      owner ? all(() => sb.from('payments').select('id,job_id,amount,paid_at,method,note,invoice_issued').is('deleted_at', null).order('paid_at', { ascending: false }).order('id'), 10000) : Promise.resolve({ data: [] }),
      !owner ? Promise.resolve({ data: [] }) : sb.from('calls').select('id,started_at,duration,contact,phone,wa_jid,kind,data,handled_at,handled_by,customer_id').is('deleted_at', null).order('started_at', { ascending: false }).limit(1000)]);
    for (const r of [l, t, j, c]) if (r.error) throw r.error;
    D.callsOk = !k.error;   // טבלת השיחות חדשה (sql/014) — אם עוד לא קיימת, הלוח עובד בלעדיה
    D.payOk = !p.error; if (p.error) console.warn('payments', p.error);
    Object.assign(D, { leads: l.data, tasks: t.data, jobs: j.data, customers: c.data, payments: p.error ? [] : p.data, calls: k.error ? [] : k.data });
  }
  if (FX) await resolveRole(null);
  if (!isOwner()) { scrubMoney(); D.calls = []; }
  dirty();   // צוות: גם בתוך טקסטים חופשיים (סיכומי לידים, הודעות, משימות) לא מוצגים סכומים
  $$('[data-owner]').forEach((x) => { x.hidden = !isOwner(); });
  $('#meName').textContent = D.me ? 'שלום, ' + D.me : 'שלום'; $('#meName2').textContent = D.me;
  $('#avatar').textContent = (D.me || '?')[0]; $('#avatar').style.setProperty('--w', D.who.w);
  return true;
}
async function boot() {
  $('#date').textContent = new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
  let ok;
  try { ok = await load(); } catch (e) { console.warn(e); $('#hero').hidden = false; $('#brief').textContent = 'לא הצלחתי לטעון מהענן. בדוק רשת ורענן.'; return; }
  if (!ok) { $('#gate').hidden = false; $('#app').classList.remove('boot'); return; }
  SINCE = sinceTime();
  $('#hero').hidden = false; $('#grid').hidden = false; renderAll();
  requestAnimationFrame(() => $$('.seg').forEach(pill)); document.fonts && document.fonts.ready.then(() => $$('.seg').forEach(pill));
  setTimeout(unboot, 1800);
  try { localStorage.setItem(SEEN_KEY(), String(Date.now())); } catch (e) {}
  let seenToday = false; try { seenToday = !!localStorage.getItem(MORNING_KEY()); } catch (e) {}
  const h = new Date().getHours();
  if (!seenToday && h >= 5 && h < 13 && !FX) setTimeout(openMorning, 900);
  if (FX && FX.morning) setTimeout(openMorning, 300);
}
// חוזרים ללשונית אחרי יותר מדקה → מרעננים מהענן (מה שסומן בטלפון או במחשב בינתיים)
let lastLoad = Date.now();
document.addEventListener('visibilitychange', async () => {
  if (document.hidden || FX || Date.now() - lastLoad < 60000 || WZ || BUSY) return;
  lastLoad = Date.now(); try { if (await load()) { renderAll(); refreshOpenSheet(); } } catch (e) { console.warn(e); }
});
boot();
