/* board.js — לוח העסק, שלב 1 (04.11.2026). קורא מהענן את מה שכבר יש: לידים מוואטסאפ (app2.wa_leads),
   משימות (app2.tasks), ביקורים (app2.jobs.visit_at). כותב רק שני דברים: סטטוס של ליד (כמו מסך הלידים באפליקציה)
   ו-done_at של משימה / משימה חדשה. וי על שורה שאין מאחוריה נתון (ביקור, מעקב אחרי הצעה) נשמר במכשיר, ליום הזה. */
const SB_URL = 'https://wxnmujdcrqsgokzlptkh.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4bm11amRjcnFzZ29remxwdGtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMDE3ODMsImV4cCI6MjA5NjU3Nzc4M30.R84NdsvQi5tMSJC51k4SxeVK364JQL1eZau0r9_V_ew';
const FX = window.BOARD_FIXTURE || null;   // בדיקות בלבד: נתונים קבועים במקום הענן, בלי כתיבה
const sb = FX ? null : supabase.createClient(SB_URL, SB_ANON, { db: { schema: 'app2' }, auth: { persistSession: true, autoRefreshToken: true, storageKey: 'ob2_auth' } });

const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
const canHover = matchMedia('(hover:hover)').matches, calm = matchMedia('(prefers-reduced-motion:reduce)').matches;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NAMES = { 'or.perias@gmail.com': 'אור', 'zohariadar@gmail.com': 'זוהרי' };
const D = { leads: [], tasks: [], jobs: [], customers: [], me: '' };
let calDay = 'today', taskDay = 'today';

/* ---------- תאריכים ---------- */
const dayKey = (t) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const TODAY = () => dayKey(Date.now()), TOM = () => dayKey(Date.now() + 864e5);
const hm = (t) => new Date(t).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
const ts = (l) => l.last_activity ? new Date(l.last_activity).getTime() : 0;
function ago(t) {
  if (!t) return ''; const m = Math.floor((Date.now() - t) / 60000);
  if (m < 60) return 'לפני ' + Math.max(1, m) + ' דק׳'; const h = Math.floor(m / 60); if (h < 24) return h === 1 ? 'לפני שעה' : h === 2 ? 'לפני שעתיים' : 'לפני ' + h + ' שעות';
  const d = Math.floor(h / 24); return d === 1 ? 'אתמול' : d === 2 ? 'שלשום' : 'לפני ' + d + ' ימים';
}

/* ---------- לידים ---------- */
// אותם סטטוסים כמו במסך הלידים באפליקציה ובדשבורד במחשב (app2.wa_leads.status) — מה שמזיזים כאן מופיע שם.
const STAGES = [
  { id: 'new', name: 'חדשים', hint: 'עוד לא חזרנו אליהם', c: '#25915e' },
  { id: 'replied', name: 'חזרנו אליהם', hint: 'מחכים לתשובה מהם', c: '#6f9f3a' },
  { id: 'visit', name: 'קבענו ביקור', hint: 'לבוא ולמדוד', c: '#2b7f86' },
  { id: 'quote_sent', name: 'נשלחה הצעה', hint: 'מחכים שיחליטו', c: '#8a6440' },
  { id: 'approved', name: 'אישרו', hint: 'לבצע ולגבות', c: '#c96a1c' },
];
const RECENT_DAYS = 14;
const isOpen = (l) => !['done', 'skip'].includes(l.status);
const isJob = (l) => !!(l.data && l.data.band);   // כמו "לידים" באפליקציה: הזדמנות לעבודה (לא שיחה על עבודה שכבר רצה)
// על הלוח: מה שזז ב-14 הימים האחרונים, או שמישהו כבר סימן לו שלב. השאר — בשורה אחת למטה, עם מעבר לאפליקציה.
const onBoard = (l) => isOpen(l) && isJob(l) && (l.status !== 'new' || Date.now() - ts(l) < RECENT_DAYS * 864e5);
const fmtPhone = (p) => { const d = String(p || '').replace(/\D/g, '').replace(/^972/, '0'); return d.length === 10 ? d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6) : String(p || ''); };
const leadName = (l) => (l.name && !/^[+\d\s()\-\u2010-\u2015\u200e\u200f\u202a-\u202e]+$/.test(l.name) ? l.name : fmtPhone(l.name || l.phone)) || 'ללא שם';   // הסריקה שמה טלפון בשם כשאין שם באנשי הקשר
function waHref(phone) { let p = String(phone || '').replace(/\D/g, ''); if (p.startsWith('0')) p = '972' + p.slice(1); return p ? 'https://wa.me/' + p : ''; }
const awaitingLong = (l) => l.data && l.data.awaiting && l.status === 'new' && Date.now() - ts(l) > 864e5;

/* ---------- רשימת היום ---------- */
const URG = [{ id: 'now', name: 'דחוף', u: '#c96a1c' }, { id: 'today', name: 'היום', u: '#3b6db3' }, { id: 'later', name: 'כשיש זמן', u: '#b5a894' }];
const SEC = { 'p-leads': 'לידים', 'p-tasks': 'משימות', 'p-cal': 'יומן' };
const PC = { 'p-leads': '#25915e', 'p-tasks': '#3b6db3', 'p-cal': '#b07d0c' };
const AG_MAX = 15, LATER_MAX = 5;   // "כשיש זמן" לא יותר מ-5, שהרשימה לא תהפוך לעוד רשימה ארוכה
const DONE_KEY = () => 'ob2_board_done_' + TODAY();
function doneStore() { try { return JSON.parse(localStorage.getItem(DONE_KEY()) || '{}'); } catch (e) { return {}; } }
function doneSave(s) { try { localStorage.setItem(DONE_KEY(), JSON.stringify(s)); } catch (e) {} }
const short = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const custOf = (id) => D.customers.find((c) => c.id === id);
const jobName = (j) => { const c = j && custOf(j.customer_id); return (c && c.name) || (j && j.title) || 'לקוח'; };

function buildAgenda() {
  const out = [], today = TODAY();
  D.leads.filter(onBoard).forEach((l) => {
    const band = l.data.band;
    if (l.data.awaiting && l.status === 'new') out.push({ id: 'L' + l.jid, kind: 'lead', jid: l.jid, u: ['hot', 'to_close'].includes(band) ? 'now' : Date.now() - ts(l) < 3 * 864e5 ? 'today' : 'later',
      t: 'לחזור ל' + leadName(l), y: short(l.summary, 70) + (ts(l) ? ' · ' + ago(ts(l)) : ''), sec: 'p-leads', k: 'L' + l.jid, at: ts(l) });
    if (l.status === 'quote_sent' && l.status_at && Date.now() - new Date(l.status_at) > 3 * 864e5) out.push({ id: 'Q' + l.jid, kind: 'local', u: 'later',
      t: 'לבדוק עם ' + leadName(l) + ' על ההצעה', y: 'נשלחה ' + ago(new Date(l.status_at).getTime()), sec: 'p-leads', k: 'L' + l.jid, at: new Date(l.status_at).getTime() });
  });
  D.tasks.filter((t) => !t.job_id && !t.done_at && t.due && t.due <= today).forEach((t) => out.push({ id: 'T' + t.id, kind: 'task', tid: t.id, u: t.due < today ? 'now' : 'today',
    t: t.title, y: t.due < today ? 'היה צריך עד ' + t.due.split('-').reverse().slice(0, 2).join('.') : 'משימה להיום', sec: 'p-tasks', k: 'T' + t.id, at: 0 }));
  D.jobs.filter((j) => j.visit_at && dayKey(j.visit_at) === today && !['paid', 'lost'].includes(j.stage)).forEach((j) => out.push({ id: 'V' + j.id, kind: 'local', u: 'today',
    t: 'ביקור אצל ' + jobName(j), y: 'בשעה ' + hm(j.visit_at), sec: 'p-cal', k: 'V' + j.id, at: new Date(j.visit_at).getTime() }));
  const order = { now: 0, today: 1, later: 2 };
  out.sort((a, b) => order[a.u] - order[b.u] || b.at - a.at);
  // מה שסומן היום נשאר ברשימה עם קו, גם אם הנתון מאחוריו כבר השתנה (ליד שעבר ל"חזרנו", משימה שבוצעה)
  const st = doneStore(), ids = new Set(out.map((a) => a.id));
  Object.values(st).forEach((a) => { if (!ids.has(a.id)) out.push(a); });
  out.forEach((a) => { a.done = !!st[a.id]; });
  return out;
}
let AG = [];
const CHK = '<svg viewBox="0 0 12 12"><path d="M2 6.5l2.6 2.5L10 3.5"/></svg>';
function renderAgenda() {
  AG = buildAgenda();
  const open = AG.filter((a) => !a.done && (a.u !== 'later' || AG.filter((x) => x.u === 'later' && !x.done).indexOf(a) < LATER_MAX)), shown = new Set([...open.slice(0, AG_MAX), ...AG.filter((a) => a.done)].map((a) => a.id)), hiddenN = AG.filter((a) => !a.done).length - Math.min(open.length, AG_MAX);
  $('#agenda').innerHTML = URG.map((g) => {
    const its = AG.filter((a) => a.u === g.id && shown.has(a.id)); if (!its.length) return '';
    return `<div class="agroup"><h3><i style="--u:${g.u}"></i>${g.name}</h3>${its.map((a, i) => `<div class="ai lift ${a.done ? 'done' : ''}" data-ag="${esc(a.id)}" style="--pc:${PC[a.sec]};--i:${i}" role="button" tabindex="0" aria-label="${esc(a.t)}, לעבור ל${SEC[a.sec]}">
      <button class="chk" type="button" data-agchk="${esc(a.id)}" aria-pressed="${a.done}" aria-label="סימון וי">${CHK}</button>
      <div class="tt"><span class="tx">${esc(a.t)}</span><small>${esc(a.y)}</small></div><span class="chip">${SEC[a.sec]}</span>
      <svg class="arr" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 6l-6 6 6 6"/></svg></div>`).join('')}</div>`;
  }).join('') + (hiddenN ? `<div class="allset" style="color:var(--muted);font-weight:500">ועוד ${hiddenN} בחלונות למטה</div>` : '')
    + (!AG.length ? '<div class="allset">אין כרגע שום דבר שמחכה לך.</div>' : AG.every((a) => a.done) ? '<div class="allset">הכל מסומן. כל הכבוד.</div>' : '');
}
async function tickAgenda(a) {
  const st = doneStore();
  if (a.done) {   // ביטול הווי: מחזירים גם את מה שהווי שינה
    const prev = st[a.id]; delete st[a.id]; doneSave(st);
    if (prev && prev.kind === 'lead' && prev.prevStatus) await setLeadStatus(prev.jid, prev.prevStatus, true);
    if (prev && prev.kind === 'task') await setTaskDone(prev.tid, false, true);
  } else {
    const rec = { id: a.id, kind: a.kind, jid: a.jid, tid: a.tid, u: a.u, t: a.t, y: a.y, sec: a.sec, k: a.k, at: a.at };
    if (a.kind === 'lead') { const l = D.leads.find((x) => x.jid === a.jid); rec.prevStatus = l && l.status; if (!(await setLeadStatus(a.jid, 'replied', true))) return; }
    if (a.kind === 'task' && !(await setTaskDone(a.tid, true, true))) return;
    st[a.id] = rec; doneSave(st);
  }
  renderAll(true);
}
$('#agenda').addEventListener('click', (e) => {
  const ck = e.target.closest('[data-agchk]');
  if (ck) {
    e.stopPropagation(); const a = AG.find((x) => x.id === ck.dataset.agchk); if (!a) return;
    const row = ck.closest('.ai'); row.classList.toggle('done', !a.done); ck.setAttribute('aria-pressed', String(!a.done));
    const was = a.done;
    tickAgenda(a).then(() => { if (!was) toast('סומן וי: ' + a.t + (a.kind === 'lead' ? ' (עבר ל"חזרנו אליהם")' : ''), () => { const b = AG.find((x) => x.id === a.id); if (b) tickAgenda(b); }); });
    return;
  }
  const row = e.target.closest('[data-ag]'); if (row) jump(AG.find((x) => x.id === row.dataset.ag));
});
$('#agenda').addEventListener('keydown', (e) => { const row = e.target.closest && e.target.closest('[data-ag]'); if (row && e.target === row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); row.click(); } });

/* קפיצה לחלון: גלילה, ניעור קטן, החלונות האחרים מתעמעמים לרגע, והפריט עצמו מודגש */
let spotT;
function jump(a) {
  if (!a) return; const p = $('#' + a.sec); if (!p || p.hidden) return;
  $('#app').classList.remove('boot');
  p.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
  let fired = false; const go = () => {
    if (fired) return; fired = true;
    const pr = p.getBoundingClientRect(); if (Math.abs(pr.top - 14) > 40) scrollTo({ top: scrollY + pr.top - 14 });
    const grid = $('#grid'); clearTimeout(spotT);
    p.classList.remove('hit'); void p.offsetWidth; p.classList.add('hit'); grid.classList.add('spot');
    spotT = setTimeout(() => { grid.classList.remove('spot'); p.classList.remove('hit'); }, 1700);
    if (a.sec === 'p-tasks') { const t = D.tasks.find((x) => 'T' + x.id === a.k); const d = t && t.due === TOM() ? 'tom' : 'today'; if (d !== taskDay) $('#taskDay [data-d="' + d + '"]').click(); }
    if (a.sec === 'p-cal' && calDay !== 'today') $('#calDay [data-d="today"]').click();
    const el = a.k && [...p.querySelectorAll('[data-k]')].find((x) => x.dataset.k === a.k);
    if (el) {
      el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
      el.classList.remove('target'); void el.offsetWidth; el.classList.add('target'); setTimeout(() => el.classList.remove('target'), 2000);
      if (el.dataset.lead && !el.classList.contains('open')) setTimeout(() => toggleOpen(el), 500);
      el.focus({ preventScroll: true });
    }
  };
  if ('onscrollend' in window) { addEventListener('scrollend', go, { once: true }); setTimeout(go, 900); } else setTimeout(go, 550);
}

/* ---------- עזרים: הודעה, אדווה, קפיצת מספר, FLIP ---------- */
let undoFn = null, toastT;
function toast(msg, fn) { $('#tmsg').textContent = msg; undoFn = fn; $('#undo').hidden = !fn; $('#toast').classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => $('#toast').classList.remove('show'), 5000); }
$('#undo').onclick = () => { const f = undoFn; undoFn = null; $('#toast').classList.remove('show'); if (f) f(); };
document.addEventListener('pointerdown', (e) => {
  const b = e.target.closest('.btn,.seg button'); if (!b || calm) return;
  const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2, s = document.createElement('span');
  s.className = 'rp'; s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
  b.style.overflow = 'hidden'; b.appendChild(s); setTimeout(() => s.remove(), 650);
});
function bump(id) { const n = document.getElementById(id); if (n) { n.classList.add('bump'); setTimeout(() => n.classList.remove('bump'), 380); } }
function flip(scope, mutate) {
  const before = {}; scope.querySelectorAll('[data-k]').forEach((c) => before[c.dataset.k] = c.getBoundingClientRect());
  $('#app').classList.remove('boot'); mutate();
  if (calm) return;
  scope.querySelectorAll('[data-k]').forEach((c) => {
    const b = before[c.dataset.k]; if (!b) return; const a = c.getBoundingClientRect();
    const dx = b.left - a.left, dy = b.top - a.top; if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    c.animate([{ transform: `translate(${dx}px,${dy}px) scale(1.04) rotate(${dx > 0 ? 1.5 : dx < 0 ? -1.5 : 0}deg)`, boxShadow: '0 26px 44px -16px rgba(60,40,20,.4)' }, { transform: 'none' }], { duration: 700, easing: 'cubic-bezier(.34,1.3,.5,1)' });
  });
}
function pill(group) { const on = group.querySelector('[aria-pressed=true]'), p = group.querySelector('.pill'); if (!on || !p) return; const g = group.getBoundingClientRect(), r = on.getBoundingClientRect(); p.style.right = (g.right - r.right) + 'px'; p.style.width = r.width + 'px'; }
if (canHover && !calm) {
  document.addEventListener('pointermove', (e) => {
    const c = e.target.closest('.lift'); if (!c || c.classList.contains('open')) return;
    const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5, k = Math.min(1, 260 / r.width);
    c.style.setProperty('--ry', (x * 6 * k).toFixed(2) + 'deg'); c.style.setProperty('--rx', (-y * 5 * k).toFixed(2) + 'deg');
  });
  document.addEventListener('pointerout', (e) => { const c = e.target.closest('.lift'); if (c && !c.contains(e.relatedTarget)) { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); } });
}
function toggleOpen(c) {
  const was = c.classList.contains('open');
  c.parentElement.closest('.panel').querySelectorAll('.open').forEach((x) => { x.classList.remove('open'); x.setAttribute('aria-expanded', 'false'); });
  if (!was) { c.classList.add('open'); c.setAttribute('aria-expanded', 'true'); }
}

/* ---------- כתיבה לענן ---------- */
async function setLeadStatus(jid, st, quiet) {
  const l = D.leads.find((x) => x.jid === jid); if (!l) return false;
  const prev = [l.status, l.status_at], now = new Date().toISOString(); l.status = st; l.status_at = now;
  if (FX) return true;
  const { error } = await sb.from('wa_leads').update({ status: st, status_by: 'phone', status_at: now, updated_at: now }).eq('jid', jid);
  if (error) { [l.status, l.status_at] = prev; renderAll(); toast('לא נשמר. בדוק רשת ונסה שוב', null); return false; }
  return true;
}
async function setTaskDone(id, done, quiet) {
  const t = D.tasks.find((x) => x.id === id); if (!t) return false;
  const prev = t.done_at, now = new Date().toISOString(); t.done_at = done ? now : null;
  if (FX) return true;
  const { error } = await sb.from('tasks').update({ done_at: t.done_at, updated_at: now }).eq('id', id);
  if (error) { t.done_at = prev; renderAll(); toast('לא נשמר. בדוק רשת ונסה שוב', null); return false; }
  return true;
}

/* ---------- חלון לידים ---------- */
function renderLeads() {
  const list = D.leads.filter(onBoard);
  $('#bar').innerHTML = STAGES.map((s) => `<i style="--c:${s.c};flex-grow:${list.filter((l) => l.status === s.id).length || .2}"></i>`).join('');
  $('#board').innerHTML = STAGES.map((s, si) => {
    const items = list.filter((l) => l.status === s.id).sort((a, b) => ts(b) - ts(a));
    return `<div class="tray" style="--c:${s.c}"><div class="tray-h"><span class="dot ${s.id === 'new' && items.length ? 'pulse' : ''}"></span><h3>${s.name}</h3><span class="n" id="ln-${s.id}">${items.length}</span></div><p class="hint">${s.hint}</p>
    <div class="list">${items.map((l, i) => {
      const msgs = ((l.data && l.data.messages) || []).slice(-3), href = waHref(l.phone), area = l.data && (l.data.address || l.data.area);
      return `<article class="card lift" tabindex="0" data-k="L${esc(l.jid)}" data-lead="${esc(l.jid)}" style="--i:${Math.min(si * 2 + i, 12)}" aria-expanded="false">
      <div class="top"><span class="name">${esc(leadName(l))}${area ? ', ' + esc(area) : ''}</span></div>
      <div class="need">${esc(l.summary || '')}</div><div class="meta"><span class="${awaitingLong(l) ? 'late' : ''}">${l.data && l.data.awaiting && l.status === 'new' ? 'מחכה לנו · ' : ''}${ago(ts(l))}</span>${l.data && l.data.band_he ? `<span>${esc(l.data.band_he)}</span>` : ''}</div>
      <div class="more"><div>${msgs.length ? `<div class="chat">${msgs.map((m) => `<div class="b ${m.me ? 'me' : ''}">${esc(short(m.text, 220))}</div>`).join('')}</div>` : ''}
      <div class="acts"><button class="btn go" type="button" data-go="${esc(l.jid)}">${si < 4 ? 'להעביר ל' + STAGES[si + 1].name : 'לסמן שטופל'}</button>${href ? `<a class="btn link" target="_blank" rel="noopener" href="${href}">לפתוח בוואטסאפ</a>` : ''}<button class="btn ghost" type="button" data-skip="${esc(l.jid)}">לא רלוונטי</button></div></div></div></article>`;
    }).join('') || '<div class="empty">אין כאן אף אחד</div>'}</div></div>`;
  }).join('');
  const nw = list.filter((l) => l.status === 'new').length, wt = list.filter((l) => l.status === 'new' && l.data.awaiting).length;
  $('#leadSum').innerHTML = `<b>${nw} חדשים</b>${wt ? `, מתוכם <b>${wt} מחכים לתשובה</b>` : ''}. מוצגים ${RECENT_DAYS} הימים האחרונים.`;
  const older = D.leads.filter((l) => isOpen(l) && isJob(l) && !onBoard(l)).length;
  $('#older').innerHTML = older ? `ועוד ${older} לידים ישנים יותר שאף אחד לא סימן. <a href="./">לכל הלידים באפליקציה</a>` : '';
  const sc = D.leads.reduce((m, l) => (l.scanned_at > m ? l.scanned_at : m), '');
  $('#status').textContent = sc ? 'סריקת וואטסאפ אחרונה: ' + new Date(sc).toLocaleString('he-IL', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '';
}
$('#board').addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]'), sk = e.target.closest('[data-skip]');
  if (go || sk) {
    e.stopPropagation(); const jid = (go || sk).dataset[go ? 'go' : 'skip'], l = D.leads.find((x) => x.jid === jid); if (!l) return;
    const from = l.status, i = STAGES.findIndex((x) => x.id === from), to = sk ? 'skip' : i < 4 ? STAGES[i + 1].id : 'done';
    flip($('#board'), () => { setLeadStatus(jid, to).then((ok) => { if (!ok) flip($('#board'), renderAll); }); renderAll(); });
    if (STAGES[i + 1] && !sk) bump('ln-' + to);
    const label = sk ? ' סומן "לא רלוונטי"' : to === 'done' ? ' סומן שטופל' : ' עבר ל' + STAGES[i + 1].name;
    toast(leadName(l) + label, () => flip($('#board'), () => { setLeadStatus(jid, from); renderAll(); }));
    return;
  }
  if (e.target.closest('a')) return;
  const c = e.target.closest('.card'); if (c && !e.target.closest('button')) toggleOpen(c);
});
document.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('card') && e.target.dataset.lead) { e.preventDefault(); toggleOpen(e.target); } });

/* ---------- חלון משימות ---------- */
// משימות חופשיות לפי יום. סעיפי-ביצוע מהצעה שאושרה — שורה אחת לכל עבודה (מסומנים בתוך העבודה באפליקציה).
function renderTasks() {
  const day = taskDay === 'today' ? TODAY() : TOM(), today = TODAY();
  const free = D.tasks.filter((t) => !t.job_id && (taskDay === 'today' ? (!t.due || t.due <= today) : t.due === day) && (!t.done_at || dayKey(t.done_at) === today))
    .sort((a, b) => (a.done_at ? 1 : 0) - (b.done_at ? 1 : 0) || String(a.due || '9').localeCompare(String(b.due || '9')));
  const byJob = {}; D.tasks.filter((t) => t.job_id && !t.done_at).forEach((t) => { (byJob[t.job_id] = byJob[t.job_id] || []).push(t); });
  const groups = taskDay === 'today' ? Object.entries(byJob) : [];
  $('#tasks').innerHTML = free.map((t, i) => `<div class="task lift ${t.done_at ? 'done' : ''}" data-k="T${esc(t.id)}" style="--i:${i}">
    <button class="chk" type="button" data-chk="${esc(t.id)}" aria-label="סימון שבוצע" aria-pressed="${!!t.done_at}">${CHK}</button>
    <div class="tt"><span class="tx">${esc(t.title)}</span><small>${!t.due ? 'בלי תאריך' : t.due < today ? 'באיחור · היה עד ' + t.due.split('-').reverse().slice(0, 2).join('.') : t.due === today ? 'היום' : 'מחר'}</small></div></div>`).join('')
    + groups.map(([jid, ts2], i) => { const j = D.jobs.find((x) => x.id === jid); return `<a class="task group lift" href="./" data-k="J${esc(jid)}" style="--i:${free.length + i}"><span class="cnt">${ts2.length}</span><div class="tt">סעיפי ביצוע פתוחים · ${esc(jobName(j))}<small>מסמנים בתוך העבודה באפליקציה</small></div></a>`; }).join('')
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
  const row = { id: crypto.randomUUID(), title: v.slice(0, 300), due: taskDay === 'today' ? TODAY() : TOM(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  $('#taskIn').value = '';
  flip($('#tasks'), () => { D.tasks.unshift(row); renderAll(); });
  if (FX) return;
  const { error } = await sb.from('tasks').insert(row);
  if (error) { D.tasks = D.tasks.filter((x) => x !== row); $('#taskIn').value = v; renderAll(); toast('לא נשמר. בדוק רשת ונסה שוב', null); }
});

/* ---------- חלון יומן ---------- */
// בינתיים: ביקורים מהעבודות באפליקציה. יומני הגוגל של כל אחד — בשלב 3.
function renderCal() {
  const day = calDay === 'today' ? TODAY() : TOM();
  const vs = D.jobs.filter((j) => j.visit_at && dayKey(j.visit_at) === day && !['paid', 'lost'].includes(j.stage)).sort((a, b) => new Date(a.visit_at) - new Date(b.visit_at));
  const now = Date.now(); let nowShown = calDay !== 'today';
  let html = '';
  vs.forEach((j, i) => {
    const t = new Date(j.visit_at).getTime(), c = custOf(j.customer_id);
    if (!nowShown && t > now) { html += '<div class="now"><i class="pulse"></i>עכשיו</div>'; nowShown = true; }
    html += `<div class="ev lift ${t < now ? 'past' : ''}" data-k="V${esc(j.id)}" style="--w:var(--or);--i:${i}"><span class="t">${hm(t)}</span><span class="stripe"></span><div class="what">ביקור · ${esc(jobName(j))}<small>${esc([c && c.address, short(j.problem, 60)].filter(Boolean).join(' · '))}</small></div></div>`;
  });
  $('#cal').innerHTML = html || `<div class="empty">אין ביקורים ${calDay === 'today' ? 'היום' : 'מחר'}. ביקור שקובעים בעבודה באפליקציה יופיע כאן.</div>`;
}

/* ---------- כללי ---------- */
function hello(bumpIt) {
  const left = AG.filter((a) => !a.done).length, name = D.me;
  $('#hi').innerHTML = left ? `<b class="n" id="hiN">${left === 1 ? 'דבר אחד' : left + ' דברים'}</b> ${left === 1 ? 'מחכה' : 'מחכים'} לך היום${name ? ', ' + esc(name) : ''}` : `הכל מסומן להיום${name ? ', ' + esc(name) : ''}`;
  if (bumpIt) bump('hiN');
}
function renderAll(bumpIt) { renderAgenda(); renderLeads(); renderTasks(); renderCal(); hello(bumpIt); }
function segInit(id, cb) {
  const g = $(id); g.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-d]'); if (!b) return;
    g.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); pill(g); cb(b.dataset.d);
  });
}
segInit('#taskDay', (d) => { taskDay = d; $('#app').classList.remove('boot'); renderTasks(); });
segInit('#calDay', (d) => { calDay = d; $('#app').classList.remove('boot'); renderCal(); });
addEventListener('resize', () => $$('.seg').forEach(pill));

async function load() {
  if (FX) { Object.assign(D, { leads: FX.wa_leads || [], tasks: FX.tasks || [], jobs: FX.jobs || [], customers: FX.customers || [], me: FX.me || 'אור' }); return true; }
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return false;
  D.me = NAMES[(session.user.email || '').toLowerCase()] || '';
  const [l, t, j, c] = await Promise.all([
    sb.from('wa_leads').select('jid,name,phone,summary,data,status,status_at,last_activity,scanned_at').is('deleted_at', null).order('last_activity', { ascending: false, nullsFirst: false }).limit(1500),
    sb.from('tasks').select('id,title,due,job_id,done_at,created_at').is('deleted_at', null).limit(3000),
    sb.from('jobs').select('id,customer_id,title,stage,visit_at,quote_sent_at,problem').is('deleted_at', null).limit(3000),
    sb.from('customers').select('id,name,address,phone').is('deleted_at', null).limit(3000)]);
  for (const r of [l, t, j, c]) if (r.error) throw r.error;
  Object.assign(D, { leads: l.data, tasks: t.data, jobs: j.data, customers: c.data });
  return true;
}
async function boot() {
  $('#date').textContent = new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
  let ok;
  try { ok = await load(); } catch (e) { console.warn(e); $('#hi').textContent = 'לא הצלחתי לטעון מהענן. בדוק רשת ורענן.'; $('#grid').hidden = false; return; }
  if (!ok) { $('#gate').hidden = false; return; }
  $('#grid').hidden = false; renderAll();
  requestAnimationFrame(() => $$('.seg').forEach(pill)); document.fonts && document.fonts.ready.then(() => $$('.seg').forEach(pill));
  setTimeout(() => $('#app').classList.remove('boot'), 1800);
}
// חוזרים ללשונית אחרי יותר מדקה → מרעננים מהענן (מה שסומן בטלפון או במחשב בינתיים)
let lastLoad = Date.now();
document.addEventListener('visibilitychange', async () => {
  if (document.hidden || FX || Date.now() - lastLoad < 60000 || document.querySelector('.card.open')) return;
  lastLoad = Date.now(); try { if (await load()) renderAll(); } catch (e) { console.warn(e); }
});
boot();
