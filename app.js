/* אור בגג 2 — שלב א': התחברות, לקוחות, כרטיס לקוח, עבודה והצעה (צפייה).
   הענן (Supabase, סכימת app2) הוא האמת. עותק לקריאה נשמר בדפדפן כדי שהמסך ייפתח מיד גם בלי רשת. */
const APP_VERSION = '2.0.1';
const SB_URL = 'https://wxnmujdcrqsgokzlptkh.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4bm11amRjcnFzZ29remxwdGtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMDE3ODMsImV4cCI6MjA5NjU3Nzc4M30.R84NdsvQi5tMSJC51k4SxeVK364JQL1eZau0r9_V_ew';
const sb = supabase.createClient(SB_URL, SB_ANON, { db: { schema: 'app2' }, auth: { persistSession: true, autoRefreshToken: true, storageKey: 'ob2_auth' } });

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const STAGES = ['lead', 'visit', 'quote', 'sent', 'approved', 'doing', 'paid'];
const STAGE_HE = { lead: 'פנייה', visit: 'ביקור', quote: 'הצעה', sent: 'נשלחה', approved: 'אושרה', doing: 'בביצוע', paid: 'שולם', lost: 'לא יצא' };
const money = (n) => (n == null || isNaN(n)) ? '' : Number(n).toLocaleString('he-IL', { maximumFractionDigits: 0 }) + ' ₪';
const dateHe = (t) => { if (!t) return ''; const d = new Date(t); return isNaN(d) ? '' : d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit' }); };
const daysSince = (t) => t ? Math.floor((Date.now() - new Date(t).getTime()) / 86400000) : null;
function toast(m, ms) { const e = $('#toast'); e.textContent = m; e.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => e.hidden = true, ms || 2500); }

// ---------- נתונים: זיכרון + עותק בדפדפן ----------
const D = { customers: [], jobs: [], quotes: [], quote_versions: [], payments: [], media: [], alerts: [], tasks: [], findings: [], expenses: [], settings: null, uid: null, loadedAt: 0 };
const CACHE_KEY = 'ob2_cache_v1';
function cacheSave() { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ...D, media: D.media.map((m) => ({ ...m, thumb_data: null })) })); } catch (e) {} }
function cacheLoad() { try { const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); if (c && c.customers) Object.assign(D, c); } catch (e) {} }
const live = (arr) => arr.filter((x) => !x.deleted_at);
const jobsOf = (cid) => live(D.jobs).filter((j) => j.customer_id === cid).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
const quotesOf = (jid) => live(D.quotes).filter((q) => q.job_id === jid).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
const paymentsOf = (jid) => live(D.payments).filter((p) => p.job_id === jid);
const mediaOf = (jid) => live(D.media).filter((m) => m.job_id === jid);
const custOf = (id) => D.customers.find((c) => c.id === id);
const expensesOf = (jid) => live(D.expenses).filter((e) => e.job_id === jid);
const tasksOf = (jid) => live(D.tasks).filter((t) => t.job_id === jid).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
const EXP_HE = { material: 'חומרים', sub: 'קבלן משנה', worker: 'עובד', other: 'אחר' };
const workers = () => ((D.settings && D.settings.workers) || []);
const findingsOf = (jid) => live(D.findings).filter((f) => f.job_id === jid).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

// ---------- ניווט ----------
const S = { view: 'today', stack: [], tab: 'today', q: '' };
function show(view, params, fromPop) {
  if (view !== S.view || JSON.stringify(params) !== JSON.stringify(S.params)) S.stack.push({ view: S.view, params: S.params });
  S.view = view; S.params = params || {};
  if (!fromPop) { try { history.pushState({ ob2: S.stack.length }, ''); } catch (e) {} }   // כפתור-אחורה של הטלפון חוזר מסך אחד, לא יוצא מהאפליקציה
  render();
  window.scrollTo(0, 0);
}
function back(fromPop) {
  if ($('#sheet-wrap')) { closeSheet(); return; }
  if (!fromPop && history.state && history.state.ob2 > 0) { history.back(); return; }   // popstate מבצע את החזרה (פעם אחת)
  const p = S.stack.pop(); if (!p) { S.view = 'today'; S.params = {}; render(); return; }
  S.view = p.view; S.params = p.params || {}; render();
}
window.addEventListener('popstate', () => { if (S.stack.length || $('#sheet-wrap')) back(true); });
try { history.replaceState({ ob2: 0 }, ''); } catch (e) {}
function render() {
  document.querySelectorAll('.view').forEach((v) => v.hidden = true);
  const map = { today: renderToday, calendar: renderCalendar, customers: renderCustomers, work: renderWork, customer: renderCustomer, job: renderJob, money: renderMoney, more: renderMore, trash: renderTrash, quote: renderQuote, print: renderPrint, settings: renderSettings, catalog: renderCatalog };
  (map[S.view] || renderToday)(); renderAlerts();
  document.querySelectorAll('#tabs [data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === ({ customers: 'today', calendar: 'today', customer: 'today', job: 'today', quote: 'today', print: 'today', trash: 'more', settings: 'more', catalog: 'more' }[S.view] || S.view)));
}

// ---------- מסכים ----------
function custRow(c) {
  const js = jobsOf(c.id), top = js[0];
  const sub = [c.phone, c.address].filter(Boolean).join(' · ');
  const chip = top ? `<span class="chip ${top.stage}">${STAGE_HE[top.stage]}</span>` : '';
  return `<div class="row" data-cust="${c.id}"><div class="avatar">${esc((c.name || '?').trim()[0] || '?')}</div><div class="main"><div class="name">${esc(c.name)}</div><div class="sub">${esc(sub) || '&nbsp;'}</div></div>${chip}</div>`;
}
const dayKey = (t) => { const d = new Date(t); return isNaN(d) ? '' : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const timeHe = (t) => new Date(t).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
const navLink = (addr) => addr ? `<a class="btn sm" style="text-decoration:none;display:inline-flex;align-items:center" target="_blank" href="https://waze.com/ul?q=${encodeURIComponent(addr)}&navigate=yes" onclick="event.stopPropagation()">נווט</a>` : '';
const gcalLink = (j, c) => { const s = new Date(j.visit_at), e = new Date(s.getTime() + 36e5), f = (d) => d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + 'T' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0') + '00';
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('ביקור: ' + (c.name || ''))}&dates=${f(s)}/${f(e)}&location=${encodeURIComponent(c.address || '')}&details=${encodeURIComponent(j.title || '')}`; };
const visitRow = (j, gcal) => { const c = custOf(j.customer_id) || {}; return `<div class="row" data-job="${j.id}"><div class="avatar">${timeHe(j.visit_at)}</div><div class="main"><div class="name">${esc(c.name)}</div><div class="sub">${esc(c.address || j.title || '')}</div></div>${navLink(c.address)}${gcal ? `<a class="btn sm ghost" style="text-decoration:none;display:inline-flex;align-items:center" target="_blank" href="${gcalLink(j, c)}" onclick="event.stopPropagation()">ליומן גוגל</a>` : ''}</div>`; };
const openTasks = () => live(D.tasks).filter((t) => !t.done_at).sort((a, b) => (a.due || '9') < (b.due || '9') ? -1 : 1);
const taskRow = (t, today) => `<div class="row" data-task="${t.id}"><button class="btn sm ghost" data-task-done="${t.id}" aria-label="בוצע" style="flex:none;width:34px;height:34px;border-radius:50%;padding:0">✓</button><div class="main"><div class="name">${esc(t.title)}</div><div class="sub">${t.due ? (t.due < today ? `<b style="color:var(--red)">באיחור · ${dateHe(t.due)}</b>` : t.due === today ? 'היום' : dateHe(t.due)) : ''}${t.job_id ? ' · ' + esc(custOf((D.jobs.find((j) => j.id === t.job_id) || {}).customer_id)?.name || '') : ''}</div></div></div>`;
function renderToday() {   // הלשונית הראשונה: מה יש היום. חיפוש בראש המסך פותח את רשימת הלקוחות.
  const v = $('#v-customers'); v.hidden = false; const today = dayKey(Date.now());
  const open = live(D.jobs).filter((j) => !['paid', 'lost'].includes(j.stage));
  const visits = open.filter((j) => j.visit_at && dayKey(j.visit_at) === today).sort((a, b) => new Date(a.visit_at) - new Date(b.visit_at));
  const soon = open.filter((j) => j.visit_at && dayKey(j.visit_at) > today && (new Date(j.visit_at) - Date.now()) < 7 * 864e5).sort((a, b) => new Date(a.visit_at) - new Date(b.visit_at));
  const doing = open.filter((j) => j.stage === 'doing');
  const waiting = open.filter((j) => j.stage === 'sent' && daysSince(j.quote_sent_at) >= 3);
  const needQuote = open.filter((j) => j.stage === 'visit' && j.visit_at && (Date.now() - new Date(j.visit_at)) > 864e5 && !quotesOf(j.id).length);
  const tasks = openTasks(), due = tasks.filter((t) => !t.due || t.due <= today), later = tasks.filter((t) => t.due && t.due > today);
  const sentToday = live(D.quotes).filter((q) => q.sent_at && dayKey(q.sent_at) === today).length, paidToday = live(D.payments).filter((p) => p.paid_at && dayKey(p.paid_at) === today).reduce((a, p) => a + Number(p.amount || 0), 0);
  const jobRow = (j) => { const c = custOf(j.customer_id) || {}; return `<div class="row" data-job="${j.id}"><div class="avatar">${esc((c.name || '?')[0])}</div><div class="main"><div class="name">${esc(c.name)}</div><div class="sub">${esc(j.title || c.address || '')}</div></div><span class="chip ${j.stage}">${STAGE_HE[j.stage]}</span></div>`; };
  $('#cust-list').innerHTML = `<div class="card"><b>${new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}</b><div class="dim">${visits.length} ביקורים · ${sentToday} הצעות נשלחו · ${money(paidToday) || '0 ₪'} נכנסו</div>
  <div class="actions"><button class="btn sm" data-open="calendar">יומן</button><button class="btn sm" data-new="task">משימה</button><button class="btn sm ghost" data-act="all-customers">כל הלקוחות · ${live(D.customers).length}</button></div></div>
  ${visits.length ? `<div class="section">ביקורים היום · ${visits.length}</div>` + visits.map((j) => visitRow(j)).join('') : ''}
  ${due.length ? `<div class="section">משימות · ${due.length}</div>` + due.map((t) => taskRow(t, today)).join('') : ''}
  ${doing.length ? `<div class="section">בביצוע · ${doing.length}</div>` + doing.map(jobRow).join('') : ''}
  ${waiting.length ? `<div class="section">מחכות לתשובה · ${waiting.length}</div>` + waiting.slice(0, 5).map(jobRow).join('') : ''}
  ${needQuote.length ? `<div class="section">ממתינות להצעה · ${needQuote.length}</div>` + needQuote.slice(0, 5).map(jobRow).join('') : ''}
  ${soon.length ? `<div class="section">ביקורים קרובים</div>` + soon.slice(0, 7).map((j) => `<div class="row" data-job="${j.id}"><div class="avatar" style="font-size:12px">${dateHe(j.visit_at).slice(0, 5)}</div><div class="main"><div class="name">${esc(custOf(j.customer_id)?.name)}</div><div class="sub">${timeHe(j.visit_at)} · ${esc(custOf(j.customer_id)?.address || '')}</div></div></div>`).join('') : ''}
  ${later.length ? `<div class="section">משימות בהמשך · ${later.length}</div>` + later.slice(0, 5).map((t) => taskRow(t, today)).join('') : ''}
  ${!visits.length && !due.length && !doing.length && !waiting.length && !needQuote.length ? '<div class="empty">יום שקט. הקלד למעלה כדי למצוא לקוח, או + להוסיף.</div>' : ''}`;
}
function renderCalendar() {   // שבוע: ביקורים ומשימות לפי יום, עם "ליומן גוגל"
  const v = $('#v-calendar'); v.hidden = false; const off = Number(S.params.week || 0); const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - start.getDay() + off * 7);
  const today = dayKey(Date.now()); const open = live(D.jobs).filter((j) => !['paid', 'lost'].includes(j.stage)); const tasks = openTasks();
  const days = [...Array(7)].map((_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  v.innerHTML = `<div class="bar"><button class="btn sm" data-back>חזרה</button><b>${dateHe(days[0])} – ${dateHe(days[6])}</b><span><button class="btn sm ghost" data-act="cal-prev">‹ שבוע</button> <button class="btn sm ghost" data-act="cal-next">שבוע ›</button></span></div>` + days.map((d) => { const k = dayKey(d);
    const vs = open.filter((j) => j.visit_at && dayKey(j.visit_at) === k).sort((a, b) => new Date(a.visit_at) - new Date(b.visit_at)), ts = tasks.filter((t) => t.due === k);
    return `<div class="section" ${k === today ? 'style="color:var(--acc)"' : ''}>${d.toLocaleDateString('he-IL', { weekday: 'long' })} ${dateHe(d)}${k === today ? ' · היום' : ''}</div>${vs.map((j) => visitRow(j, true)).join('')}${ts.map((t) => taskRow(t, today)).join('')}${!vs.length && !ts.length ? '<div class="dim" style="padding:2px 12px 6px">—</div>' : ''}`; }).join('');
}
function openTaskForm(t, jobId) {
  const w = sheet('t-task-form'); if (t) { $('#tk-title', w).value = t.title; $('#tk-due', w).value = t.due || ''; $('#tk-del', w).hidden = false; }
  $('#tk-save', w).onclick = async () => { const title = $('#tk-title', w).value.trim(); if (!title) return toast('מה המשימה?'); await DB.save('tasks', { ...(t ? { id: t.id } : { job_id: jobId || null }), title, due: $('#tk-due', w).value || null }); closeSheet(); render(); toast('נשמר'); };
  $('#tk-del', w).onclick = async () => { await DB.trash('tasks', t.id); closeSheet(); render(); toast('הועבר לסל'); };
  setTimeout(() => $('#tk-title', w).focus(), 50);
}
function renderCustomers() {
  const v = $('#v-customers'); v.hidden = false;
  const q = S.q.trim().toLowerCase();
  let list = live(D.customers);
  if (q) list = list.filter((c) => [c.name, c.phone, c.address, c.notes].some((x) => (x || '').toLowerCase().includes(q)) || jobsOf(c.id).some((j) => [j.title, j.problem, j.visit_notes, j.work_notes].some((x) => (x || '').toLowerCase().includes(q))   // חיפוש בכל דבר: גם הערות, סעיפי הצעות, ממצאים ומשימות
    || quotesOf(j.id).some((qq) => String(qq.number || '').includes(q) || (qq.items || []).some((i) => ((i.title || '') + ' ' + (i.description || '')).toLowerCase().includes(q))) || findingsOf(j.id).some((f) => (f.title || '').toLowerCase().includes(q)) || tasksOf(j.id).some((t) => (t.title || '').toLowerCase().includes(q))));
  list.sort((a, b) => new Date(jobsOf(b.id)[0]?.updated_at || b.updated_at) - new Date(jobsOf(a.id)[0]?.updated_at || a.updated_at));
  $('#cust-list').innerHTML = list.length ? list.map(custRow).join('') : `<div class="empty">${q ? 'לא נמצא' : 'אין לקוחות עדיין'}</div>`;
}
function renderWork() {
  const v = $('#v-customers'); v.hidden = false;
  const q = S.q.trim().toLowerCase();
  const open = live(D.jobs).filter((j) => !['paid', 'lost'].includes(j.stage));
  const waiting = open.filter((j) => j.stage === 'sent' && daysSince(j.quote_sent_at) >= 3).sort((a, b) => new Date(a.quote_sent_at) - new Date(b.quote_sent_at));
  const wHtml = waiting.length ? `<div class="section">מחכות לתשובה · ${waiting.length}</div>` + waiting.map((j) => { const c = custOf(j.customer_id) || {}; const d = daysSince(j.quote_sent_at);
    return `<div class="row" data-job="${j.id}"><div class="avatar">${esc((c.name || '?')[0])}</div><div class="main"><div class="name">${esc(c.name)}</div><div class="sub">${esc(j.title || '')}${d >= 7 ? ' · <b style="color:var(--red)">תזכורת אחרונה</b>' : ''}</div></div><span class="chip days ${d >= 7 ? 'last' : ''}">${d} ימים</span>${c.phone ? `<a class="btn sm" style="text-decoration:none;display:inline-flex;align-items:center" target="_blank" href="${waLink(c.phone, WA_FOLLOWUP)}" onclick="event.stopPropagation()">וואטסאפ</a>` : ''}</div>`; }).join('') : '';
  const needQuote = open.filter((j) => j.stage === 'visit' && j.visit_at && (Date.now() - new Date(j.visit_at)) > 864e5 && !quotesOf(j.id).length);
  const nqHtml = needQuote.length ? `<div class="section">ממתינות להצעה · ${needQuote.length}</div>` + needQuote.map((j) => { const c = custOf(j.customer_id) || {}; return `<div class="row" data-job="${j.id}"><div class="avatar">${esc((c.name || '?')[0])}</div><div class="main"><div class="name">${esc(c.name)}</div><div class="sub">ביקור ${dateHe(j.visit_at)} · ${findingsOf(j.id).length} ממצאים</div></div><span class="chip days">${daysSince(j.visit_at)} ימים</span></div>`; }).join('') : '';
  const yearAgo = live(D.jobs).filter((j) => j.stage === 'paid' && (j.finished_at || j.paid_at) && daysSince(j.finished_at || j.paid_at) >= 300 && daysSince(j.finished_at || j.paid_at) <= 450 && !j.maint_reminded_at);
  const mHtml = yearAgo.length ? `<div class="section">תחזוקה לפני החורף · ${yearAgo.length}</div>` + yearAgo.map((j) => { const c = custOf(j.customer_id) || {}; const wEnd = j.warranty_months && j.finished_at ? new Date(new Date(j.finished_at).setMonth(new Date(j.finished_at).getMonth() + j.warranty_months)) : null;
    return `<div class="row" data-job="${j.id}"><div class="avatar">${esc((c.name || '?')[0])}</div><div class="main"><div class="name">${esc(c.name)}</div><div class="sub">${esc(j.title || '')} · הסתיים ${dateHe(j.finished_at || j.paid_at)}${wEnd ? ' · אחריות עד ' + dateHe(wEnd) : ''}</div></div>${c.phone ? `<a class="btn sm" style="text-decoration:none;display:inline-flex;align-items:center" target="_blank" href="${waLink(c.phone, WA_MAINT)}" onclick="event.stopPropagation()">וואטסאפ</a>` : ''}</div>`; }).join('') : '';
  const rest = open.filter((j) => !waiting.includes(j) && !needQuote.includes(j));
  const groups = STAGES.filter((s) => s !== 'paid').map((s) => [s, rest.filter((j) => j.stage === s)]).filter(([, a]) => a.length);
  $('#cust-list').innerHTML = wHtml + nqHtml + mHtml + groups.map(([s, arr]) => `<div class="section">${STAGE_HE[s]} · ${arr.length}</div>` + arr.map((j) => {
    const c = custOf(j.customer_id) || {}; if (q && !(c.name || '').toLowerCase().includes(q)) return '';
    const days = j.stage === 'sent' ? daysSince(j.quote_sent_at) : null;
    return `<div class="row" data-job="${j.id}"><div class="avatar">${esc((c.name || '?')[0])}</div><div class="main"><div class="name">${esc(c.name)}</div><div class="sub">${esc(j.title || c.address || '')}</div></div>${days != null ? `<span class="chip days">${days} ימים</span>` : ''}</div>`;
  }).join('')).join('') || (wHtml || nqHtml || mHtml ? '' : '<div class="empty">אין עבודות פתוחות</div>');
}
const normPhone = (p) => String(p || '').replace(/\D/g, '').replace(/^972/, '0');
const dupOf = (c) => normPhone(c.phone).length >= 9 ? live(D.customers).find((x) => x.id !== c.id && normPhone(x.phone) === normPhone(c.phone)) : null;
const roofLine = (c) => c && c.roof ? [c.roof.tiles, c.roof.access, c.roof.slope, c.roof.floors ? c.roof.floors + ' קומות' : ''].filter(Boolean).map(esc).join(' · ') : '';
function renderCustomer() {
  const v = $('#v-customer'); v.hidden = false;
  const c = custOf(S.params.id); if (!c) return v.innerHTML = '<div class="empty">לקוח לא נמצא</div>';
  const js = jobsOf(c.id);
  v.innerHTML = `<button class="back" data-back>‹ חזרה</button>
  <div class="card"><h2>${esc(c.name)}</h2><div class="kv">${c.phone ? `<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a><a href="https://wa.me/972${esc(String(c.phone).replace(/\D/g, '').replace(/^0/, ''))}" target="_blank">וואטסאפ</a>` : ''}${c.address ? `<span>${esc(c.address)}</span>` : ''}</div>${c.notes ? `<div class="dim" style="margin-top:6px;white-space:pre-line">${esc(c.notes)}</div>` : ''}${roofLine(c) ? `<div class="dim" style="margin-top:6px">גג: ${roofLine(c)}</div>` : ''}${dupOf(c) ? `<div class="alert" style="margin-top:8px"><span>יש לקוח נוסף עם אותו טלפון: <b>${esc(dupOf(c).name)}</b></span><button class="btn sm" data-merge="${dupOf(c).id}">מזג לכאן</button></div>` : ''}<div class="actions"><button class="btn sm ghost" data-act="report">דוח ייעוץ</button><button class="btn sm pri" data-act="new-job">עבודה חדשה</button><button class="btn sm" data-act="edit-customer">ערוך</button><button class="btn sm danger" data-act="trash-customer">לסל</button></div></div>
  <div class="section">עבודות · ${js.length}</div>
  <div class="list">${js.map((j) => { const qs = quotesOf(j.id); const days = j.stage === 'sent' ? daysSince(j.quote_sent_at) : null;
    return `<div class="row" data-job="${j.id}"><div class="main"><div class="name">${esc(j.title || (qs[0] && qs[0].items && qs[0].items[0] && qs[0].items[0].title) || 'עבודה')}</div><div class="sub">${dateHe(j.created_at)}${qs.length ? ' · ' + qs.length + ' הצעות' : ''}${j.price_agreed ? ' · ' + money(j.price_agreed) : ''}</div></div>${days != null ? `<span class="chip days">${days} ימים</span>` : ''}<span class="chip ${j.stage}">${STAGE_HE[j.stage]}</span></div>`; }).join('') || '<div class="empty">אין עבודות</div>'}</div>`;
}
function quoteBlock(q) {
  const items = (q.items || []).filter((i) => i.visible !== false);
  return `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><b>הצעה ${esc(q.number || '')}</b><span class="chip ${q.status === 'sent' ? 'sent' : q.status === 'accepted' ? 'approved' : q.status === 'rejected' ? 'lost' : 'quote'}">${{ draft: 'טיוטה', sent: 'נשלחה ' + dateHe(q.sent_at), accepted: 'אושרה', rejected: 'נדחתה' }[q.status] || q.status}</span></div>
  ${items.map((i) => `<div class="qitem"><div><div class="t">${esc(i.title)}</div>${i.description ? `<div class="d">${esc(i.description)}</div>` : ''}<div class="dim">${i.qty} ${esc(i.unit || '')} × ${money(i.price_per_unit)}</div></div><div><b>${money(i.total)}</b></div></div>`).join('')}
  <div class="total"><span>סה"כ כולל מע"מ</span><span>${money(q.total)}</span></div></div>`;
}
function renderJob() {
  const v = $('#v-job'); v.hidden = false;
  const j = live(D.jobs).find((x) => x.id === S.params.id); if (!j) return v.innerHTML = '<div class="empty">עבודה לא נמצאה</div>';
  const c = custOf(j.customer_id) || {}, qs = quotesOf(j.id), ps = paymentsOf(j.id), ms = mediaOf(j.id);
  const idx = STAGES.indexOf(j.stage), paid = ps.reduce((a, p) => a + Number(p.amount || 0), 0);
  const days = j.stage === 'sent' ? daysSince(j.quote_sent_at) : null;
  v.innerHTML = `<button class="back" data-back>‹ ${esc(c.name || 'חזרה')}</button>
  <div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h2 style="margin:0">${esc(j.title || 'עבודה')}</h2><span class="chip ${j.stage}">${STAGE_HE[j.stage]}</span></div>
  <div class="stages">${STAGES.map((s, i) => `<span class="${i <= idx ? 'done' : ''}" title="${STAGE_HE[s]}"></span>`).join('')}</div>
  <div class="kv"><span>${esc(c.name)}</span>${c.address ? `<span>${esc(c.address)}</span>` : ''}${roofLine(c) ? `<span>גג: ${roofLine(c)}</span>` : ''}${j.visit_at ? `<span>ביקור ${dateHe(j.visit_at)}</span>` : ''}${days != null ? `<span class="chip days">נשלחה לפני ${days} ימים</span>` : ''}</div>
  ${j.problem ? `<div style="margin-top:8px"><b>הבעיה:</b> ${esc(j.problem)}</div>` : ''}<div style="margin-top:10px"><div style="display:flex;justify-content:space-between;align-items:center"><label class="dim" for="j-notes">מהביקור: מטראז'ים והערות</label><button class="btn sm" data-act="voice" id="voice-btn">הקלטה</button></div><textarea id="j-notes" class="txt" rows="3" placeholder="למשל: רוכבים 20 מטר, קופינג 10 מטר">${esc(j.visit_notes || '')}</textarea></div><div class="actions">${(NEXT[j.stage] || []).map((s) => `<button class="btn sm ${s === 'lost' ? 'danger' : s === 'lead' ? '' : 'pri'}" data-stage="${s}">${NEXT_HE[s]}</button>`).join('')}${j.stage === 'sent' && c.phone ? `<a class="btn sm" style="display:inline-flex;align-items:center;text-decoration:none" target="_blank" href="${waLink(c.phone, WA_FOLLOWUP)}">תזכורת בוואטסאפ</a>` : ''}<button class="btn sm ghost" data-act="trash-job">לסל</button></div></div>
  <div class="two"><div>
  <div class="section">ממצאים מהגג · ${findingsOf(j.id).length}</div><div class="card">${findingsOf(j.id).map((f) => { const m = f.media_id && D.media.find((x) => x.id === f.media_id); return `<div class="qitem" data-finding="${f.id}" style="cursor:pointer"><div style="display:flex;gap:10px;align-items:center;min-width:0">${m && m.thumb_data ? `<img src="${m.thumb_data}" alt="" style="width:52px;height:52px;object-fit:cover;border-radius:8px;flex:none">` : ''}<div><div class="t">${esc(f.title)}</div><div class="dim">${f.qty} ${esc(f.unit || '')}${f.price_per_unit ? ' × ' + money(f.price_per_unit) : ''}</div></div></div><b>${f.price_per_unit ? money(f.qty * f.price_per_unit) : ''}</b></div>`; }).join('') || '<div class="dim">על הגג: כל ממצא עם תמונה וכמות, וההצעה בערב כבר מלאה.</div>'}<div class="actions"><button class="btn sm pri" data-act="new-finding">ממצא חדש</button>${findingsOf(j.id).length ? '<button class="btn sm ghost" data-act="clear-findings">נקה ממצאים</button>' : ''}</div></div>
  <div class="section">הצעות מחיר · ${qs.length}</div>${qs.map((q) => `<div data-quote="${q.id}" style="cursor:pointer">${quoteBlock(q)}</div>`).join('')}<div class="actions"><button class="btn sm pri" data-act="new-quote">${qs.length ? 'הצעה נוספת' : 'בנה הצעת מחיר'}</button></div>
  ${(j.price_agreed || ps.length || ['approved', 'doing', 'paid'].includes(j.stage)) ? `<div class="section">כסף</div><div class="card"><div class="total"><span>סוכם</span><span>${money(j.price_agreed)}</span></div><div class="total" style="color:var(--ok)"><span>שולם</span><span>${money(paid)}</span></div>${j.price_agreed ? `<div class="total" style="color:var(--acc)"><span>נשאר</span><span>${money(Math.max(0, j.price_agreed - paid))}</span></div>` : ''}${ps.map((p) => `<div class="qitem"><span>${dateHe(p.paid_at)} ${esc(p.method || '')}${p.invoice_issued ? ' · חשבונית הוצאה' : ` · <b style="color:var(--warn)">בלי חשבונית</b> <button class="btn sm ghost" data-inv="${p.id}">הוצאתי חשבונית</button>`}</span><b>${money(p.amount)}</b></div>`).join('')}<div class="actions"><button class="btn sm pri" data-act="add-payment">רשום תשלום</button></div></div>` : ''}
  ${['approved', 'doing', 'paid'].includes(j.stage) ? execHtml(j) : ''}
  </div><div>
  <div class="section">תמונות · ${ms.length}</div><div class="card">${[['roof', 'גג'], ['outside', 'חוץ'], ['interior', 'רטיבות בפנים'], ['', 'אחר']].map(([k, he]) => { const g = ms.filter((m) => (m.tag || '') === k); return g.length ? `<div class="dim" style="margin:6px 0 4px">${he} · ${g.length}</div><div class="thumbs">${g.map((m) => `<div class="th ${m.storage_path ? '' : 'pending'}" data-media="${m.id}">${m.thumb_data ? `<img src="${m.thumb_data}" alt="">` : `<div class="noimg">תמונה</div>`}${m.storage_path ? '' : '<span class="pend">לא עלה</span>'}</div>`).join('')}</div>` : ''; }).join('')}<div class="actions"><button class="btn sm pri" data-act="add-photos">צלם / הוסף תמונות</button></div></div>
  </div></div>`;
  bindJobNotes(j); bindJobFields(j);
}
function execHtml(j) {   // מקטע "ביצוע": משימות מהסעיפים, יומן-עבודה, הוצאות ורווח, תוספת, סיכום ללקוח
  const ts = tasksOf(j.id), done = ts.filter((t) => t.done_at), es = expensesOf(j.id), spent = es.reduce((a, e) => a + Number(e.amount || 0), 0);
  const d = (t) => t ? dayKey(t) : '';
  return `<div class="section">ביצוע · ${done.length}/${ts.length} בוצעו</div><div class="card">${ts.map((t) => `<div class="qitem" data-task="${t.id}" style="cursor:pointer;align-items:center"><span style="${t.done_at ? 'text-decoration:line-through;color:var(--dim)' : ''}">${esc(t.title)}</span>${t.done_at ? '<span class="dim">בוצע</span>' : `<button class="btn sm" data-task-done="${t.id}">בוצע</button>`}</div>`).join('') || '<div class="dim">כשהלקוח מאשר הצעה, כל סעיף הופך למשימה כאן.</div>'}
  <div class="actions"><button class="btn sm" data-new="task">משימה</button><button class="btn sm" data-act="addon">תוספת</button><button class="btn sm ghost" data-act="summary">סיכום ללקוח</button></div>
  <div class="row2" style="margin-top:10px"><label style="flex:1">התחלה<input type="date" dir="ltr" data-field="started_at" value="${d(j.started_at)}"></label><label style="flex:1">סיום<input type="date" dir="ltr" data-field="finished_at" value="${d(j.finished_at)}"></label></div>
  <div class="row2"><label style="flex:1">ימי עבודה<input type="number" inputmode="numeric" dir="ltr" data-field="work_days" value="${j.work_days ?? ''}"></label><label style="flex:1">אחריות (חודשים)<input type="number" inputmode="numeric" dir="ltr" data-field="warranty_months" value="${j.warranty_months ?? ''}"></label></div>
  <label>יומן עבודה<textarea class="txt" rows="2" data-field="work_notes" placeholder="מה נעשה בכל יום, מה נשאר">${esc(j.work_notes || '')}</textarea></label></div>
  <div class="section">הוצאות · ${money(spent) || '0 ₪'}</div><div class="card">${es.map((e) => `<div class="qitem" data-exp="${e.id}" style="cursor:pointer;align-items:center"><div><div class="t">${esc(e.title || EXP_HE[e.kind] || '')}</div><div class="dim">${EXP_HE[e.kind] || ''}${e.worker ? ' · ' + esc(e.worker) : ''}${e.days ? ' · ' + e.days + ' ימים' : ''}${['sub', 'worker'].includes(e.kind) ? (e.receipt ? ' · חשבונית התקבלה' : ` · <b style="color:var(--warn)">בלי חשבונית</b> <button class="btn sm ghost" data-exp-receipt="${e.id}">התקבלה</button>`) : ''}</div></div><b>${money(e.amount)}</b></div>`).join('')}
  ${j.price_agreed ? `<div class="total"><span>רווח משוער</span><span style="color:${j.price_agreed - spent >= 0 ? 'var(--ok)' : 'var(--red)'}">${money(j.price_agreed - spent)}</span></div>` : ''}<div class="actions"><button class="btn sm" data-act="add-expense">הוצאה</button></div></div>`;
}
function bindJobFields(j) {   // שדות-ביצוע: שמירה אוטומטית בשינוי
  document.querySelectorAll('#v-job [data-field]').forEach((el) => { el.onchange = async () => { const f = el.dataset.field; let val = el.value; if (['started_at', 'finished_at'].includes(f)) val = val ? new Date(val + 'T08:00').toISOString() : null; else if (['work_days', 'warranty_months'].includes(f)) val = val === '' ? null : Number(val); else val = val.trim() || null; await DB.save('jobs', { id: j.id, [f]: val }); toast('נשמר'); }; });
}
function openExpenseForm(job, id) {
  const e = id ? { ...(D.expenses.find((x) => x.id === id) || {}) } : { kind: 'material', title: '', amount: '', worker: '', days: '', receipt: false };
  const w = sheet('t-expense-form'); const ws = workers();
  $('#ex-worker', w).innerHTML = '<option value="">—</option>' + ws.map((x) => `<option value="${esc(x.name)}" data-rate="${x.rate || 0}">${esc(x.name)}${x.rate ? ' · ' + money(x.rate) + ' ליום' : ''}</option>`).join('');
  $('#ex-kind', w).value = e.kind; $('#ex-title', w).value = e.title || ''; $('#ex-amount', w).value = e.amount || ''; $('#ex-worker', w).value = e.worker || ''; $('#ex-days', w).value = e.days || ''; $('#ex-receipt', w).checked = !!e.receipt; if (id) $('#ex-del', w).hidden = false;
  const sync = () => { const k = $('#ex-kind', w).value; $('#ex-wrow', w).hidden = k !== 'worker' && k !== 'sub'; $('#ex-rrow', w).hidden = k !== 'worker' && k !== 'sub'; };
  $('#ex-kind', w).onchange = sync; sync();
  const calc = () => { const o = $('#ex-worker', w).selectedOptions[0]; const rate = Number(o && o.dataset.rate) || 0, days = Number($('#ex-days', w).value) || 0; if (rate && days) $('#ex-amount', w).value = rate * days; };
  $('#ex-worker', w).onchange = calc; $('#ex-days', w).oninput = calc;
  $('#ex-save', w).onclick = async () => { const amount = Number($('#ex-amount', w).value); if (!(amount >= 0)) return toast('סכום לא תקין'); const kind = $('#ex-kind', w).value;
    await DB.save('expenses', { ...(id ? { id } : { job_id: job.id }), kind, title: $('#ex-title', w).value.trim() || null, amount, worker: ['worker', 'sub'].includes(kind) ? ($('#ex-worker', w).value || null) : null, days: Number($('#ex-days', w).value) || null, receipt: $('#ex-receipt', w).checked, spent_at: dayKey(Date.now()) }); closeSheet(); render(); toast('נשמר'); };
  $('#ex-del', w).onclick = async () => { await DB.trash('expenses', id); closeSheet(); render(); toast('הועבר לסל'); };
  setTimeout(() => $('#ex-title', w).focus(), 50);
}
function openWorkerForm(idx) {
  const ws = [...workers()]; const x = idx != null ? { ...ws[idx] } : { name: '', phone: '', rate: '', type: 'מורשה' };
  const w = sheet('t-worker-form'); $('#wk-name', w).value = x.name; $('#wk-phone', w).value = x.phone || ''; $('#wk-rate', w).value = x.rate || ''; $('#wk-type', w).value = x.type || 'מורשה'; if (idx != null) $('#wk-del', w).hidden = false;
  $('#wk-save', w).onclick = async () => { const name = $('#wk-name', w).value.trim(); if (!name) return toast('שם?'); const n = { name, phone: $('#wk-phone', w).value.trim(), rate: Number($('#wk-rate', w).value) || 0, type: $('#wk-type', w).value }; if (idx != null) ws[idx] = n; else ws.push(n); await DB.save('settings', { workers: ws }); closeSheet(); render(); toast('נשמר'); };
  $('#wk-del', w).onclick = async () => { ws.splice(idx, 1); await DB.save('settings', { workers: ws }); closeSheet(); render(); };
  setTimeout(() => $('#wk-name', w).focus(), 50);
}
async function tasksFromQuote(job, q) {   // הלקוח אישר → כל סעיף הופך למשימת-ביצוע (פעם אחת לכל סעיף)
  const have = new Set(tasksOf(job.id).map((t) => t.item_id).filter(Boolean));
  for (const i of (q.items || []).filter((i) => i.visible !== false && !have.has(i.id))) await DB.save('tasks', { job_id: job.id, item_id: i.id, title: i.title });
}
function bindJobNotes(j) {
  const ta = $('#j-notes'); if (!ta) return;
  const saveNotes = async () => { const v = ta.value.trim() || null; const cur = live(D.jobs).find((x) => x.id === j.id) || j; if (v !== (cur.visit_notes || null)) { await DB.save('jobs', { id: j.id, visit_notes: v }); toast('הערות נשמרו'); } };
  let h; ta.oninput = () => { clearTimeout(h); h = setTimeout(saveNotes, 900); }; ta.onblur = () => { clearTimeout(h); saveNotes(); };
}
async function openMedia(id) {
  const m = D.media.find((x) => x.id === id); if (!m) return;
  if (!m.storage_path) return toast('התמונה עדיין לא עלתה לענן — תיפתח כשתהיה רשת');
  const url = await DB.photoUrl(m.storage_path); if (!url) return toast('לא הצלחתי לפתוח את התמונה');
  const lb = $('#lightbox'); lb.querySelector('img').src = url; lb.dataset.media = id; lb.querySelector('.lb-tags').innerHTML = [['roof', 'גג'], ['outside', 'חוץ'], ['interior', 'רטיבות בפנים'], ['', 'אחר']].map(([k, he]) => `<button class="btn sm ${(m.tag || '') === k ? 'pri' : ''}" data-tag="${k}">${he}</button>`).join(''); lb.hidden = false;
}
const BIZ_DEFAULT = { businessName: 'אור בגג', ownerName: 'אור פריאס', phone: '054-5725681', email: 'or.perias@gmail.com', taxId: '307951517' };
const UNFORESEEN_DEFAULT = 'במידה ויתגלו במהלך העבודה כשלים, נזקים או צרכים שלא נצפו ואינם כלולים בהצעה זו — יינתן עבורם תמחור נפרד בתיאום מראש עם הלקוח.';
const GENERAL_TERMS = ['המחירים כוללים אך ורק את הסעיפים המפורטים בהצעה זו. עבודה שאינה מופיעה כאן אינה כלולה במחיר.', 'לוח הזמנים כפוף לתנאי מזג האוויר ולזמינות חומרים, ויתואם מראש מול הלקוח.', 'ההצעה מחייבת את הצדדים רק לאחר אישור הלקוח, ובתוקף עד המועד הנקוב בראש המסמך.'];
function renderPrint() {
  const v = $('#v-print'); v.hidden = false;
  if (S.params.summary) return renderSummaryPrint(v);
  const q = Q.cur(S.params.id); if (!q) return v.innerHTML = '<div class="empty">הצעה לא נמצאה</div>';
  const j = D.jobs.find((x) => x.id === q.job_id) || {}, c = custOf(j.customer_id) || {}, k = Q.calc(q);
  const b = { ...BIZ_DEFAULT, ...((D.settings && D.settings.business) || {}) }, t = Q.tpl();
  const items = (q.items || []).filter((i) => i.visible !== false), hasUrg = items.some((i) => i.urgency);
  const fmt = (n) => '₪ ' + Number(n || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 });
  const dateFull = (d) => new Date(d).toLocaleDateString('he-IL');
  v.dataset.title = `הצעת מחיר ${q.number || ''} - ${c.name || ''}`.trim();
  v.innerHTML = `<div class="print-tools"><button class="btn" data-back>‹ חזרה</button><button class="btn pri" data-act="print">הדפס / שמור PDF</button><span class="dim">בטלפון: "שמור כ-PDF" ואז שיתוף בוואטסאפ</span></div>
  <div class="page">
    <div class="ph"><div><div class="biz">${esc(b.businessName)}</div><div class="owner">${esc(b.ownerName)}</div></div><div class="contact"><div>${esc(b.phone)}</div><div dir="ltr">${esc(b.email)}</div><div>ח.פ. ${esc(b.taxId)}</div></div></div>
    <div class="ptitle"><div class="pt">${q.addon ? 'תוספת לעבודה — הצעה משלימה' : 'הצעת מחיר'} #${esc(q.number || '')}</div><div class="pd"><div><b>תאריך:</b> ${dateFull(q.sent_at || q.created_at)}</div><div class="valid"><b>בתוקף עד:</b> ${dateFull(Q.validUntil(q))}</div></div></div>
    <div class="pto"><div class="dim">לכבוד</div><div class="cn">${esc(c.name || '')}</div>${c.address ? `<div class="dim">${esc(c.address)}</div>` : ''}</div>
    <table class="pitems"><thead><tr><th>#</th><th class="desc">תיאור הסעיף</th><th>כמות</th><th>מחיר ליח'</th>${hasUrg ? '<th>דחיפות</th>' : ''}<th>סה"כ</th></tr></thead><tbody>
    ${items.map((i, n) => `<tr><td>${n + 1}</td><td class="desc"><b>${esc(i.title)}</b>${i.description ? `<div class="idesc">${esc(i.description)}</div>` : ''}</td><td>${i.qty} ${esc(i.unit || '')}</td><td>${fmt(i.price_per_unit)}</td>${hasUrg ? `<td>${esc(i.urgency || '')}</td>` : ''}<td class="sum">${fmt(i.total)}</td></tr>`).join('')}</tbody></table>
    <div class="ptot"><div class="box">${k.disc ? `<div class="r"><span>סה"כ סעיפים</span><span>${fmt(k.sum)}</span></div><div class="r"><span>הנחה</span><span>− ${fmt(k.disc)}</span></div>` : ''}<div class="r"><span>סה"כ לפני מע"מ</span><span>${fmt(k.before)}</span></div><div class="r"><span>מע"מ ${q.vat_rate}%</span><span>${fmt(k.vat)}</span></div><div class="r big"><span>סה"כ לתשלום</span><span>${fmt(k.total)}</span></div><div class="r"><span>מקדמה 30%</span><span>${fmt(k.advance)}</span></div></div></div>
    ${q.payment_terms ? `<div class="pbox"><b>תנאי תשלום</b><div>${esc(q.payment_terms)}</div></div>` : ''}
    ${q.notes ? `<div class="pbox"><b>הערות</b><div class="pre">${esc(q.notes)}</div></div>` : ''}
    ${q.addon ? '<div class="pbox dashed">תוספת זו מתווספת להצעה המקורית שאושרה, ובאותם תנאים. הביצוע לאחר אישור הלקוח.</div>' : `<div class="pbox dashed"><b>הבהרה — עבודות בלתי-צפויות</b><div>${esc(t.unforeseenClause || UNFORESEEN_DEFAULT)}</div></div>
    <div class="pbox"><b>תנאים כלליים</b>${GENERAL_TERMS.map((x) => `<div>${esc(x)}</div>`).join('')}</div>`}
    <div class="psig"><div><div class="line"></div>חתימת הלקוח · תאריך</div><div><div class="line"></div>חתימת הקבלן · תאריך</div></div>
    <div class="pfoot">הופק מאפליקציית "אור בגג" · ${new Date().toLocaleDateString('he-IL')} ${new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</div>
  </div>`;
}
const MAINT_DEFAULT = 'ניקוי מרזבים פעמיים בשנה (לפני החורף ואחריו). בדיקה חזותית של הגג אחרי סערה. לא לדרוך על רעפים ופנלים בלי צורך. בכל רטיבות — לצלם ולהתקשר, לא לחכות.';
function renderSummaryPrint(v) {   // סיכום עבודה ללקוח: מה בוצע, לפני/אחרי, אחריות, תחזוקה (עמוד להדפסה כמו ההצעה)
  const j = D.jobs.find((x) => x.id === S.params.summary); if (!j) return v.innerHTML = '<div class="empty">עבודה לא נמצאה</div>';
  const c = custOf(j.customer_id) || {}, b = { ...BIZ_DEFAULT, ...((D.settings && D.settings.business) || {}) }, t = Q.tpl();
  const q = quotesOf(j.id).find((x) => x.status === 'accepted') || quotesOf(j.id)[0]; const did = tasksOf(j.id).length ? tasksOf(j.id).filter((x) => x.done_at).map((x) => x.title) : ((q && q.items) || []).filter((i) => i.visible !== false).map((i) => i.title);
  const ms = mediaOf(j.id).filter((m) => m.thumb_data), split = j.started_at ? new Date(j.started_at) : null; const before = split ? ms.filter((m) => new Date(m.taken_at || m.created_at) < split) : ms, after = split ? ms.filter((m) => new Date(m.taken_at || m.created_at) >= split) : [];
  const wEnd = j.warranty_months && j.finished_at ? new Date(new Date(j.finished_at).setMonth(new Date(j.finished_at).getMonth() + j.warranty_months)) : null;
  const pics = (arr) => arr.slice(0, 4).map((m) => `<img src="${m.thumb_data}" alt="" style="width:23%;aspect-ratio:1;object-fit:cover;border-radius:6px;margin:1%">`).join('');
  v.dataset.title = `סיכום עבודה - ${c.name || ''}`;
  v.innerHTML = `<div class="print-tools"><button class="btn" data-back>‹ חזרה</button><button class="btn pri" data-act="print">הדפס / שמור PDF</button></div>
  <div class="page">
    <div class="ph"><div><div class="biz">${esc(b.businessName)}</div><div class="owner">${esc(b.ownerName)}</div></div><div class="contact"><div>${esc(b.phone)}</div><div dir="ltr">${esc(b.email)}</div></div></div>
    <div class="ptitle"><div class="pt">סיכום עבודה</div><div class="pd"><div><b>תאריך:</b> ${new Date().toLocaleDateString('he-IL')}</div></div></div>
    <div class="pto"><div class="dim">לכבוד</div><div class="cn">${esc(c.name || '')}</div>${c.address ? `<div class="dim">${esc(c.address)}</div>` : ''}</div>
    <div class="pbox"><b>${esc(j.title || 'העבודה')}</b><div>${j.started_at ? 'התחלה ' + dateHe(j.started_at) : ''}${j.finished_at ? ' · סיום ' + dateHe(j.finished_at) : ''}${j.work_days ? ' · ' + j.work_days + ' ימי עבודה' : ''}</div></div>
    <div class="pbox"><b>מה בוצע</b>${did.map((x) => `<div>• ${esc(x)}</div>`).join('') || '<div class="dim">—</div>'}</div>
    ${before.length ? `<div class="pbox"><b>לפני</b><div>${pics(before)}</div></div>` : ''}${after.length ? `<div class="pbox"><b>אחרי</b><div>${pics(after)}</div></div>` : ''}
    <div class="pbox"><b>אחריות</b><div>${j.warranty_months ? `${j.warranty_months} חודשים על העבודה שבוצעה${wEnd ? ', עד ' + dateHe(wEnd) : ''}.` : 'לפי המוסכם בהצעת המחיר.'}</div></div>
    <div class="pbox"><b>המלצות לתחזוקה</b><div class="pre">${esc(t.maintenance || MAINT_DEFAULT)}</div></div>
    <div class="pfoot">תודה שבחרתם ב${esc(b.businessName)} · ${esc(b.phone)}</div>
  </div>`;
}
function openPaymentForm(job) {
  const w = sheet('t-payment-form'); const paid = paymentsOf(job.id).reduce((a, p) => a + Number(p.amount || 0), 0);
  $('#p-amount', w).value = job.price_agreed ? Math.max(0, Math.round(job.price_agreed - paid)) : ''; $('#p-date', w).value = new Date().toISOString().slice(0, 10);
  $('#p-save', w).onclick = async () => {
    const amount = Number($('#p-amount', w).value) || 0; if (amount <= 0) return toast('צריך סכום');
    await DB.save('payments', { job_id: job.id, amount, paid_at: $('#p-date', w).value || new Date().toISOString().slice(0, 10), method: $('#p-method', w).value, note: $('#p-note', w).value.trim() || null, invoice_issued: $('#p-inv', w).checked });
    closeSheet();
    const total = paymentsOf(job.id).reduce((a, p) => a + Number(p.amount || 0), 0);
    if (job.price_agreed && total >= job.price_agreed - 1 && job.stage !== 'paid') { await DB.stage(job.id, 'paid'); toast('שולם במלואו — העבודה נסגרה'); } else toast('התשלום נרשם');
    render();
  };
}
function openFindingForm(job, fid) {   // כל ממצא = שורה משלו בענן (תיקון: שני מכשירים לא דורסים זה את זה)
  const f = fid ? { ...(D.findings.find((x) => x.id === fid) || {}) } : { title: '', description: '', qty: 1, unit: '', price_per_unit: '', media_id: null, catalog_id: null };
  const w = sheet('t-finding-form'); $('#fi-title', w).value = f.title; $('#fi-desc', w).value = f.description || ''; $('#fi-qty', w).value = f.qty; $('#fi-unit', w).value = f.unit || ''; $('#fi-ppu', w).value = f.price_per_unit || '';
  const m = f.media_id && D.media.find((x) => x.id === f.media_id); if (m && m.thumb_data) { $('#fi-thumb', w).dataset.media = m.id; $('#fi-thumb', w).innerHTML = `<img src="${m.thumb_data}" alt="" style="width:72px;height:72px;object-fit:cover;border-radius:8px">`; }
  $('#fi-photo', w).onclick = () => { const inp = $('#photo-in'); inp.dataset.forJob = job.id; inp.dataset.forCust = job.customer_id; inp.dataset.forTag = 'roof'; inp.dataset.forFinding = '1'; inp.removeAttribute('multiple'); inp.click(); setTimeout(() => inp.setAttribute('multiple', ''), 500); };
  $('#fi-cat', w).onclick = () => { const cat = ((D.settings && D.settings.catalog) || []).filter((c) => !c.hidden); const cw = sheet('t-catalog'); const cl = $('#cat-list', cw);
    const draw = (q) => { cl.innerHTML = cat.filter((c) => !q || (c.name || '').includes(q)).slice(0, 60).map((c) => `<div class="row" data-cat="${cat.indexOf(c)}"><div class="main"><div class="name">${esc(c.name)}</div><div class="sub">${money(c.price)}${c.unit ? ' / ' + esc(c.unit) : ''}</div></div></div>`).join(''); };
    draw(''); $('#cat-search', cw).oninput = (e) => draw(e.target.value.trim());
    cl.onclick = (e) => { const r = e.target.closest('[data-cat]'); if (!r) return; const c = cat[+r.dataset.cat]; f.catalog_id = c.legacy_id || null; const w2 = openFindingForm.reopen(); $('#fi-title', w2).value = c.name; $('#fi-desc', w2).value = c.description || ''; $('#fi-unit', w2).value = c.unit || ''; $('#fi-ppu', w2).value = c.price || ''; if (m && m.thumb_data) { $('#fi-thumb', w2).dataset.media = m.id; $('#fi-thumb', w2).innerHTML = `<img src="${m.thumb_data}" alt="" style="width:72px;height:72px;object-fit:cover;border-radius:8px">`; } }; };
  openFindingForm.reopen = () => { const keep = { qty: $('#fi-qty') && $('#fi-qty').value }; const w2 = openFindingForm(job, fid); if (keep.qty) $('#fi-qty', w2).value = keep.qty; return w2; };
  $('#fi-save', w).onclick = async () => {
    const qty = Number($('#fi-qty', w).value), ppu = Number($('#fi-ppu', w).value) || 0; if (!$('#fi-title', w).value.trim()) return toast('מה מצאת?'); if (!(qty > 0)) return toast('כמות גדולה מ-0'); if (ppu < 0) return toast('מחיר לא יכול להיות שלילי');
    await DB.save('findings', { ...(fid ? { id: fid } : { job_id: job.id }), title: $('#fi-title', w).value.trim(), description: $('#fi-desc', w).value.trim(), qty, unit: $('#fi-unit', w).value.trim(), price_per_unit: ppu, media_id: $('#fi-thumb', w).dataset.media || f.media_id || null, catalog_id: f.catalog_id || null });
    if (job.stage === 'lead') await DB.stage(job.id, 'visit'); closeSheet(); render(); toast('ממצא נשמר');
  };
  setTimeout(() => $('#fi-title', w).focus(), 50); return w;
}
let _rec = null;
function startVoice(job) {   // הקלטה → טקסט לתוך הערות-הביקור (Web Speech API של כרום, עברית)
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; const btn = $('#voice-btn');
  if (!SR) return toast('הדפדפן הזה לא תומך בהקלטה לטקסט. בכרום באנדרואיד זה עובד.');
  if (_rec) { _rec.stop(); return; }
  const r = new SR(); r.lang = 'he-IL'; r.continuous = true; r.interimResults = false; _rec = r; btn.textContent = 'עצור הקלטה'; btn.classList.add('pri');
  r.onresult = (ev) => { let txt = ''; for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) txt += ev.results[i][0].transcript + ' '; if (!txt.trim()) return; const ta = $('#j-notes'); ta.value = (ta.value.trim() + '\n' + txt.trim()).trim(); ta.dispatchEvent(new Event('input')); };
  r.onerror = (ev) => { toast('ההקלטה נעצרה: ' + (ev.error === 'not-allowed' ? 'אין הרשאה למיקרופון' : ev.error)); };
  r.onend = () => { _rec = null; const b = $('#voice-btn'); if (b) { b.textContent = 'הקלטה'; b.classList.remove('pri'); } const ta = $('#j-notes'); if (ta) ta.dispatchEvent(new Event('blur')); };
  try { r.start(); toast('מקליט… דבר, ואז "עצור הקלטה"'); } catch (e) { _rec = null; toast('לא הצלחתי להתחיל הקלטה'); }
}
function renderMoney() {
  const v = $('#v-money'); v.hidden = false;
  const owe = live(D.jobs).filter((j) => ['approved', 'doing'].includes(j.stage) && j.price_agreed).map((j) => ({ j, left: j.price_agreed - paymentsOf(j.id).reduce((a, p) => a + Number(p.amount || 0), 0) })).filter((x) => x.left > 0);
  const noInv = live(D.payments).filter((p) => !p.invoice_issued);
  const noRec = live(D.expenses).filter((e) => ['worker', 'sub'].includes(e.kind) && !e.receipt);
  const profit = live(D.jobs).filter((j) => ['doing', 'paid'].includes(j.stage) && j.price_agreed && expensesOf(j.id).length).map((j) => ({ j, spent: expensesOf(j.id).reduce((a, e) => a + Number(e.amount || 0), 0) })).slice(0, 10);
  v.innerHTML = `<div class="section">חייבים לך</div><div class="list">${owe.map(({ j, left }) => `<div class="row" data-job="${j.id}"><div class="main"><div class="name">${esc(custOf(j.customer_id)?.name)}</div><div class="sub">${esc(j.title || '')}</div></div><b>${money(left)}</b></div>`).join('') || '<div class="empty">אין חובות פתוחים</div>'}</div>
  ${noRec.length ? `<div class="section">לקבל חשבונית/קבלה · ${noRec.length}</div><div class="list">${noRec.map((e) => { const j = D.jobs.find((x) => x.id === e.job_id) || {}; return `<div class="row" data-job="${j.id}"><div class="main"><div class="name">${esc(e.worker || e.title || EXP_HE[e.kind])}</div><div class="sub">${esc(custOf(j.customer_id)?.name || '')} · ${money(e.amount)}</div></div><button class="btn sm" data-exp-receipt="${e.id}">התקבלה</button></div>`; }).join('')}</div>` : ''}
  ${profit.length ? `<div class="section">רווח לעבודה</div><div class="list">${profit.map(({ j, spent }) => `<div class="row" data-job="${j.id}"><div class="main"><div class="name">${esc(custOf(j.customer_id)?.name)}</div><div class="sub">סוכם ${money(j.price_agreed)} · הוצאות ${money(spent)}</div></div><b style="color:${j.price_agreed - spent >= 0 ? 'var(--ok)' : 'var(--red)'}">${money(j.price_agreed - spent)}</b></div>`).join('')}</div>` : ''}
  <div class="section">תשלומים בלי חשבונית · ${noInv.length}</div><div class="dim" style="margin-bottom:6px">להוציא בחשבונית ירוקה, ואז לסמן כאן.</div><div class="list">${noInv.map((p) => { const j = D.jobs.find((x) => x.id === p.job_id) || {}; return `<div class="row" data-job="${j.id}"><div class="main"><div class="name">${esc(custOf(j.customer_id)?.name)}</div><div class="sub">${dateHe(p.paid_at)} · ${money(p.amount)}</div></div><button class="btn sm" data-inv="${p.id}">הוצאתי חשבונית</button></div>`; }).join('') || '<div class="empty">הכל עם חשבונית</div>'}</div>`;
}
function renderMore() {
  const v = $('#v-more'); v.hidden = false;
  const trashed = D.customers.filter((c) => c.deleted_at).length + D.jobs.filter((j) => j.deleted_at).length + D.quotes.filter((q) => q.deleted_at).length;
  const b = { ...BIZ_DEFAULT, ...((D.settings && D.settings.business) || {}) }, t = Q.tpl(), cat = ((D.settings && D.settings.catalog) || []);
  v.innerHTML = `<div class="card"><b>אור בגג</b> · גרסה ${APP_VERSION}<div class="dim">עודכן ${D.loadedAt ? new Date(D.loadedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '—'} · ${live(D.customers).length} לקוחות · ${live(D.jobs).length} עבודות · ${live(D.quotes).length} הצעות</div>
  <div class="actions"><button class="btn sm" id="refresh">רענן מהענן</button><button class="btn sm" data-act="backup-file">גיבוי לקובץ</button><button class="btn sm ghost" id="logout">התנתק</button></div></div>
  <div class="card" style="cursor:pointer" data-open="trash"><b>סל המיחזור</b> · ${trashed} פריטים<div class="dim">שום דבר לא נמחק באמת. לחץ לשחזור.</div></div>
  <div class="card" style="cursor:pointer" data-open="catalog"><b>הקטלוג והמחירון</b> · ${cat.filter((c) => !c.hidden).length} פריטים<div class="dim">סעיפים מוכנים להצעות מחיר, מחירים לפני מע"מ.</div></div>
  <div class="card" style="cursor:pointer" data-open="settings"><b>פרטי העסק ותבנית ההצעה</b><div class="dim">${esc(b.businessName)} · ${esc(b.ownerName)} · מע"מ ${t.vatRate ?? 18}% · תוקף ${t.validityDays || 30} יום</div></div>
  <div class="card" id="failed-card"><b>כתיבות שהענן דחה</b> · <span id="failed-n">…</span><div class="dim">שינויים שהענן לא קיבל נשמרים כאן עם השגיאה, לא נזרקים.</div></div>`;
  DB._failed().then((f) => { const n = $('#failed-n'); if (n) n.textContent = f.length; if (f.length && $('#failed-card')) $('#failed-card').innerHTML += f.slice(0, 10).map((x) => `<div class="qitem"><span>${esc(x.table || x.op)} · ${dateHe(x.failedAt)}</span><span class="dim" style="font-size:12px">${esc(String(x.error).slice(0, 90))}</span></div>`).join(''); });
}
const pinSet = () => { try { return !!localStorage.getItem(PIN_KEY); } catch (e) { return false; } };
function pinLock() {   // נעילה רכה: קוד במכשיר, לא בענן. אחרי 5 שגיאות מציע להתנתק ולהיכנס מחדש
  const pin = (() => { try { return localStorage.getItem(PIN_KEY); } catch (e) { return null; } })(); if (!pin) return;
  const l = $('#pinlock'); l.hidden = false; const inp = $('#pin-in'); inp.value = ''; let bad = 0; setTimeout(() => inp.focus(), 50);
  const tryPin = () => { if (inp.value === pin) { l.hidden = true; return; } bad++; inp.value = ''; $('#pin-msg').textContent = bad >= 5 ? 'שכחת? התנתק והתחבר מחדש עם הסיסמה.' : 'קוד שגוי'; $('#pin-forgot').hidden = bad < 5; };
  inp.oninput = () => { if (inp.value.length >= pin.length) tryPin(); }; $('#pin-go').onclick = tryPin; $('#pin-forgot').onclick = async () => { try { localStorage.removeItem(PIN_KEY); } catch (e) {} await sb.auth.signOut(); location.reload(); };
}
function renderSettings() {
  const v = $('#v-settings'); v.hidden = false; const b = { ...BIZ_DEFAULT, ...((D.settings && D.settings.business) || {}) }, t = Q.tpl();
  v.innerHTML = `<button class="back" data-back>‹ חזרה</button><div class="section">פרטי העסק (מופיעים בהצעה)</div><div class="card sheet" style="max-height:none">
  <label>שם העסק<input id="s-biz" value="${esc(b.businessName)}"></label><label>שם בעל העסק<input id="s-owner" value="${esc(b.ownerName)}"></label><label>טלפון<input id="s-phone" dir="ltr" value="${esc(b.phone)}"></label><label>אימייל<input id="s-email" dir="ltr" value="${esc(b.email)}"></label><label>ח.פ. / עוסק<input id="s-tax" dir="ltr" value="${esc(b.taxId)}"></label></div>
  <div class="section">תבנית הצעת מחיר</div><div class="card sheet" style="max-height:none">
  <div class="row2"><label style="flex:1">מע"מ %<input id="s-vat" type="number" dir="ltr" value="${t.vatRate ?? 18}"></label><label style="flex:1">תוקף (ימים)<input id="s-valid" type="number" dir="ltr" value="${t.validityDays || 30}"></label></div>
  <label>תנאי תשלום<input id="s-terms" value="${esc(t.paymentTerms || '30% מקדמה במועד החתימה, 70% בסיום העבודה')}"></label><label>הערות קבועות להצעה<textarea id="s-notes" rows="3">${esc(t.standardNotes || '')}</textarea></label><label>נוסח "עבודות בלתי-צפויות"<textarea id="s-unf" rows="3">${esc(t.unforeseenClause || UNFORESEEN_DEFAULT)}</textarea></label>
  <button class="btn pri" data-act="save-settings">שמור</button></div>
  <div class="section">נעילה בקוד (במכשיר הזה)</div><div class="card"><div class="dim">${pinSet() ? 'הנעילה פעילה: בכל פתיחה מבקשת קוד. להשאיר ריק וללחוץ כדי לבטל.' : 'קוד של 4-6 ספרות שיתבקש בכל פתיחה של האפליקציה במכשיר הזה.'}</div><div class="row2" style="margin-top:8px"><input id="s-pin" type="password" inputmode="numeric" dir="ltr" placeholder="קוד" style="flex:1"><button class="btn sm" data-act="set-pin">${pinSet() ? 'עדכן / בטל' : 'הפעל'}</button></div></div>
  <div class="section">עובדים וקבלני משנה</div><div class="card">${workers().map((x, i) => `<div class="qitem" data-worker-edit="${i}" style="cursor:pointer"><div><div class="t">${esc(x.name)}</div><div class="dim">${esc(x.phone || '')}${x.rate ? ' · ' + money(x.rate) + ' ליום' : ''} · ${esc(x.type || '')}</div></div></div>`).join('') || '<div class="dim">מי עובד איתך: שם, תעריף יומי, מורשה/פטור. בעבודה מסמנים מי עבד וכמה ימים.</div>'}<div class="actions"><button class="btn sm" data-act="worker-add">הוסף</button></div></div>`;
}
function renderCatalog() {
  const v = $('#v-catalog'); v.hidden = false; const cat = ((D.settings && D.settings.catalog) || []); const f = (S.params.q || '').trim();
  const rows = cat.map((c, i) => [c, i]).filter(([c]) => !f || (c.name || '').includes(f) || (c.category || '').includes(f));
  v.innerHTML = `<button class="back" data-back>‹ חזרה</button><div class="section">הקטלוג · ${cat.filter((c) => !c.hidden).length}</div><div class="row2"><input id="cat-q" class="txt" placeholder="חיפוש" value="${esc(f)}" style="flex:1"><button class="btn pri" data-act="cat-add">הוסף פריט</button></div>
  <div class="list" style="margin-top:8px">${rows.map(([c, i]) => `<div class="row ${c.hidden ? 'off' : ''}" data-cat-edit="${i}" style="${c.hidden ? 'opacity:.5' : ''}"><div class="main"><div class="name">${esc(c.name)}</div><div class="sub">${esc(c.category || '')}${c.price != null ? ' · ' + money(c.price) + (c.unit ? ' / ' + esc(c.unit) : '') : ''}${c.hidden ? ' · מוסתר' : ''}</div></div><span class="dim">ערוך</span></div>`).join('') || '<div class="empty">ריק</div>'}</div>`;
  $('#cat-q', v).oninput = (e) => { S.params.q = e.target.value; renderCatalog(); const i = $('#cat-q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); };
}
function openCatalogItem(idx) {
  const cat = [...((D.settings && D.settings.catalog) || [])]; const c = idx != null ? { ...cat[idx] } : { name: '', category: '', unit: '', price: '', description: '' };
  const w = sheet('t-catalog-item'); $('#c-name', w).value = c.name || ''; $('#c-cat', w).value = c.category || ''; $('#c-unit', w).value = c.unit || ''; $('#c-price', w).value = c.price ?? ''; $('#c-desc', w).value = c.description || ''; $('#c-hide', w).textContent = c.hidden ? 'הצג שוב' : 'הסתר'; if (idx == null) $('#c-hide', w).hidden = true;
  $('#c-save', w).onclick = async () => { const n = { ...c, name: $('#c-name', w).value.trim(), category: $('#c-cat', w).value.trim(), unit: $('#c-unit', w).value.trim(), price: Number($('#c-price', w).value) || 0, description: $('#c-desc', w).value.trim() }; if (!n.name) return toast('צריך שם'); if (idx != null) cat[idx] = n; else cat.push(n); await DB.save('settings', { catalog: cat }); closeSheet(); render(); toast('נשמר'); };
  $('#c-hide', w).onclick = async () => { cat[idx] = { ...c, hidden: !c.hidden }; await DB.save('settings', { catalog: cat }); closeSheet(); render(); };
}
function backupToFile() {
  const data = { app: 'or-bagag-2', exportedAt: new Date().toISOString(), customers: D.customers, jobs: D.jobs, quotes: D.quotes, quote_versions: D.quote_versions, payments: D.payments, media: D.media.map((m) => ({ ...m, thumb_data: undefined })), settings: D.settings };
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' })); a.download = 'or-bagag-2-backup-' + new Date().toISOString().slice(0, 10) + '.json'; a.click(); toast('הגיבוי ירד לקבצים');
}
function renderAlerts() {
  const open = (D.alerts || []).filter((x) => !x.seen_at); let bar = $('#alerts'); const noInv = live(D.payments).filter((p) => !p.invoice_issued).length;
  if (!open.length && !noInv) { if (bar) bar.remove(); return; }
  if (!bar) { bar = document.createElement('div'); bar.id = 'alerts'; $('#views').before(bar); }
  bar.innerHTML = open.map((x) => `<div class="alert"><span>${esc(x.message)}</span><button class="btn sm" data-seen="${x.id}">ראיתי</button></div>`).join('')
    + (noInv && S.view !== 'money' ? `<div class="alert warn" data-tab="money" style="cursor:pointer"><span>${noInv} תשלומים בלי חשבונית — להוציא בחשבונית ירוקה ולסמן</span><b>›</b></div>` : '');   // "חשבונית עקשנית": עד שמסמנים
}

// ---------- גיליונות וטפסים ----------
function sheet(tplId) { closeSheet(); const w = document.createElement('div'); w.id = 'sheet-wrap'; w.appendChild(document.getElementById(tplId).content.cloneNode(true)); document.body.appendChild(w); w.addEventListener('click', (e) => { if (e.target === w || e.target.closest('[data-close]')) closeSheet(); }); return w; }
function closeSheet() { const w = $('#sheet-wrap'); if (w) w.remove(); }
function confirmAsk(title, msg, cb) { const w = sheet('t-confirm'); $('#confirm-title', w).textContent = title; $('#confirm-msg', w).textContent = msg; $('#confirm-yes', w).onclick = () => { closeSheet(); cb(); }; }
function openCustomerForm(c) {
  const w = sheet('t-customer-form');
  if (c) { $('#f-title', w).textContent = 'עריכת לקוח'; $('#f-name', w).value = c.name || ''; $('#f-phone', w).value = c.phone || ''; $('#f-address', w).value = c.address || ''; $('#f-notes', w).value = c.notes || ''; const r = c.roof || {}; $('#f-tiles', w).value = r.tiles || ''; $('#f-access', w).value = r.access || ''; $('#f-slope', w).value = r.slope || ''; $('#f-floors', w).value = r.floors || ''; }
  $('#f-save', w).onclick = async () => {
    const name = $('#f-name', w).value.trim(); if (!name) return toast('צריך שם');
    const row = await DB.save('customers', { ...(c ? { id: c.id } : {}), name, phone: $('#f-phone', w).value.trim() || null, address: $('#f-address', w).value.trim() || null, notes: $('#f-notes', w).value.trim() || null, source: c ? c.source : 'ידני', roof: { tiles: $('#f-tiles', w).value, access: $('#f-access', w).value, slope: $('#f-slope', w).value, floors: $('#f-floors', w).value ? Number($('#f-floors', w).value) : null } });
    closeSheet(); S.stack = []; show('customer', { id: row.id }); toast('נשמר');
  };
  setTimeout(() => $('#f-name', w).focus(), 50);
}
function pickCustomer(cb) {
  const w = sheet('t-pick-customer'); const list = $('#pick-list', w);
  const draw = (f) => { list.innerHTML = live(D.customers).filter((c) => !f || (c.name || '').includes(f) || (c.phone || '').includes(f)).slice(0, 40).map((c) => `<div class="row" data-pick="${c.id}"><div class="main"><div class="name">${esc(c.name)}</div><div class="sub">${esc(c.phone || '')}</div></div></div>`).join('') || '<div class="empty">לא נמצא</div>'; };
  draw(''); $('#pick-search', w).oninput = (e) => draw(e.target.value.trim());
  list.onclick = (e) => { const r = e.target.closest('[data-pick]'); if (r) { closeSheet(); cb(r.dataset.pick); } };
}
function openJobForm(customerId) {
  const w = sheet('t-job-form');
  $('#j-save', w).onclick = async () => {
    const title = $('#j-title', w).value.trim(), visit = $('#j-visit', w).value;
    const row = await DB.save('jobs', { customer_id: customerId, title: title || null, problem: $('#j-problem', w).value.trim() || null, visit_at: visit ? new Date(visit).toISOString() : null, stage: visit ? 'visit' : 'lead', stage_changed_at: new Date().toISOString() });
    closeSheet(); show('job', { id: row.id }); toast('נשמר');
  };
  setTimeout(() => $('#j-title', w).focus(), 50);
}
const NEXT = { lead: ['visit', 'quote'], visit: ['quote'], quote: ['sent'], sent: ['approved', 'lost'], approved: ['doing'], doing: ['paid'], paid: [], lost: ['lead'] };
const NEXT_HE = { visit: 'נקבע ביקור', quote: 'בונים הצעה', sent: 'נשלחה ללקוח', approved: 'הלקוח אישר', doing: 'התחלנו', paid: 'שולם וסגור', lost: 'לא יצא', lead: 'לפתוח מחדש' };
const PIN_KEY = 'ob2_pin';
const WA_MAINT = 'שלום, זה אור מאור בגג. עברה שנה מהעבודה אצלכם. לפני החורף כדאי בדיקת תחזוקה קצרה לגג (מרזבים, איטום, רוכבים). אשמח לתאם.';
const WA_FOLLOWUP = 'היי, רק לוודא שקיבלת את הצעת המחיר. אשמח לשמוע אם יש שאלות. אור - אור בגג';
const waLink = (phone, text) => phone ? `https://wa.me/972${String(phone).replace(/\D/g, '').replace(/^0/, '')}${text ? '?text=' + encodeURIComponent(text) : ''}` : '';
function renderTrash() {
  const v = $('#v-trash'); v.hidden = false;
  const rows = [['customers', 'לקוח', D.customers.filter((c) => c.deleted_at).map((c) => [c, c.name])], ['jobs', 'עבודה', D.jobs.filter((j) => j.deleted_at).map((j) => [j, (j.title || 'עבודה') + ' · ' + (custOf(j.customer_id)?.name || '')])], ['quotes', 'הצעה', D.quotes.filter((q) => q.deleted_at).map((q) => [q, 'הצעה ' + (q.number || '') + ' · ' + (custOf((D.jobs.find((j) => j.id === q.job_id) || {}).customer_id)?.name || '')])],
    ['tasks', 'משימה', D.tasks.filter((t) => t.deleted_at).map((t) => [t, t.title])], ['findings', 'ממצא', D.findings.filter((f) => f.deleted_at).map((f) => [f, f.title])], ['expenses', 'הוצאה', D.expenses.filter((e) => e.deleted_at).map((e) => [e, (e.title || e.worker || EXP_HE[e.kind] || '') + ' · ' + money(e.amount)])]];
  v.innerHTML = `<button class="back" data-back>‹ חזרה</button><div class="section">סל המיחזור</div><div class="dim" style="margin-bottom:8px">שום דבר לא נמחק באמת. לחיצה על "שחזר" מחזירה.</div><div class="list">` +
    rows.flatMap(([t, he, arr]) => arr.map(([x, label]) => `<div class="row"><div class="main"><div class="name">${esc(label)}</div><div class="sub">${he} · הועבר לסל ${dateHe(x.deleted_at)}</div></div><button class="btn sm" data-restore="${t}:${x.id}">שחזר</button></div>`)).join('') + `</div>` || '';
  if (!rows.some(([, , a]) => a.length)) v.innerHTML += '<div class="empty">הסל ריק</div>';
}

// ---------- אירועים ----------
document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-cust],[data-job],[data-back],[data-tab],[data-new],[data-act],[data-open],[data-restore],[data-stage],[data-media],[data-close-lb],[data-quote],[data-inv],[data-seen],[data-cat-edit],[data-tag],[data-finding],[data-task-done],[data-task],[data-exp],[data-exp-receipt],[data-worker-edit],[data-merge],#plus,#refresh,#logout');
  if (!t || t.id === 'photo-in') return;
  try { DB.used(t.dataset.act || (t.dataset.tab && 'tab:' + t.dataset.tab) || (t.dataset.stage && 'stage:' + t.dataset.stage) || (t.dataset.new && 'new:' + t.dataset.new) || t.id || 'row'); } catch (e) {}
  const cur = S.params && (S.view === 'customer' ? custOf(S.params.id) : null);
  const job = S.view === 'job' ? live(D.jobs).find((x) => x.id === S.params.id) : null;
  if (t.dataset.cust) show('customer', { id: t.dataset.cust });
  else if (t.dataset.job) show('job', { id: t.dataset.job });
  else if (t.hasAttribute('data-back')) back();
  else if (t.dataset.tab) { S.stack = []; S.q = ''; $('#search').value = ''; S.view = t.dataset.tab; S.params = {}; try { history.replaceState({ ob2: 0 }, ''); } catch (e) {} render(); window.scrollTo(0, 0); }
  else if (t.id === 'plus') sheet('t-plus');
  else if (t.dataset.new === 'task') openTaskForm(null, job && job.id);
  else if (t.dataset.taskDone) { await DB.save('tasks', { id: t.dataset.taskDone, done_at: new Date().toISOString() }); render(); toast('בוצע'); }
  else if (t.dataset.task) { const tk = D.tasks.find((x) => x.id === t.dataset.task); if (tk) openTaskForm(tk); }
  else if (t.dataset.act === 'all-customers') { S.stack = []; S.view = 'customers'; render(); }
  else if (t.dataset.open === 'calendar') show('calendar', { week: 0 });
  else if (t.dataset.act === 'cal-prev' || t.dataset.act === 'cal-next') { S.params = { week: Number(S.params.week || 0) + (t.dataset.act === 'cal-next' ? 1 : -1) }; render(); }
  else if (t.dataset.new === 'customer') openCustomerForm();
  else if (t.dataset.new === 'job') pickCustomer((cid) => openJobForm(cid));
  else if (t.dataset.act === 'edit-customer' && cur) openCustomerForm(cur);
  else if (t.dataset.merge && cur) { const o = custOf(t.dataset.merge); if (!o) return; confirmAsk('למזג את "' + (o.name || '') + '" לתוך "' + (cur.name || '') + '"?', 'העבודות, ההצעות והתמונות שלו יעברו לכאן. הכרטיס הכפול עובר לסל (אפשר לשחזר).', async () => {
    for (const j of D.jobs.filter((j) => j.customer_id === o.id)) await DB.save('jobs', { id: j.id, customer_id: cur.id }); for (const m of D.media.filter((m) => m.customer_id === o.id)) await DB.save('media', { id: m.id, customer_id: cur.id });
    const patch = {}; for (const k of ['address', 'notes', 'roof']) if (!cur[k] && o[k]) patch[k] = o[k]; if (Object.keys(patch).length) await DB.save('customers', { id: cur.id, ...patch }); await DB.trash('customers', o.id); render(); toast('מוזג'); }); }
  else if (t.dataset.act === 'report' && cur) { const u = new URL('https://orperias-coder.github.io/or-bagag-report/'); u.searchParams.set('new', '1'); u.searchParams.set('client', cur.name || ''); u.searchParams.set('phone', cur.phone || ''); u.searchParams.set('address', cur.address || ''); window.open(u.toString(), '_blank'); }
  else if (t.dataset.act === 'set-pin') { const v = $('#s-pin').value.trim(); if (v && !/^\d{4,6}$/.test(v)) return toast('קוד של 4-6 ספרות'); try { if (v) localStorage.setItem(PIN_KEY, v); else localStorage.removeItem(PIN_KEY); } catch (e) {} toast(v ? 'הנעילה הופעלה במכשיר הזה' : 'הנעילה בוטלה'); render(); }
  else if (t.dataset.act === 'new-job' && cur) openJobForm(cur.id);
  else if (t.dataset.act === 'trash-customer' && cur) confirmAsk('להעביר לסל?', 'הלקוח והעבודות שלו יועברו לסל המיחזור. אפשר לשחזר מ"עוד".', async () => { for (const j of jobsOf(cur.id)) await DB.trash('jobs', j.id); await DB.trash('customers', cur.id); S.stack = []; show('customers'); toast('הועבר לסל'); });
  else if (t.dataset.stage && job) { const s = t.dataset.stage; if (s === 'sent' && !quotesOf(job.id).length) return toast('קודם בונים הצעה');
    if (s === 'approved') { const q = quotesOf(job.id).find((x) => x.status === 'sent') || quotesOf(job.id)[0]; if (q) { await Q.save(q, { status: 'accepted' }, { noVersion: true }); await DB.save('jobs', { id: job.id, price_agreed: q.total }); await tasksFromQuote(job, q); } }
    await DB.stage(job.id, s); render(); toast(NEXT_HE[s]); }
  else if (t.dataset.act === 'add-payment' && job) openPaymentForm(job);
  else if (t.dataset.inv) { await DB.save('payments', { id: t.dataset.inv, invoice_issued: true }); render(); toast('סומן: חשבונית הוצאה'); }
  else if (t.dataset.act === 'trash-job' && job) confirmAsk('להעביר את העבודה לסל?', 'אפשר לשחזר מ"עוד".', async () => { await DB.trash('jobs', job.id); back(); toast('הועבר לסל'); });
  else if (t.dataset.act === 'add-photos' && job) { const w = sheet('t-photo-kind'); w.addEventListener('click', (ev) => { const k = ev.target.closest('[data-kind]'); if (!k) return; closeSheet(); const inp = $('#photo-in'); inp.dataset.forJob = job.id; inp.dataset.forCust = job.customer_id; inp.dataset.forTag = k.dataset.kind; delete inp.dataset.forFinding; inp.click(); }); }
  else if (t.dataset.tag !== undefined && $('#lightbox').dataset.media) { await DB.save('media', { id: $('#lightbox').dataset.media, tag: t.dataset.tag || null }); toast('סווג'); render(); }
  else if (t.dataset.act === 'new-finding' && job) openFindingForm(job);
  else if (t.dataset.finding && job) openFindingForm(job, t.dataset.finding);
  else if (t.dataset.act === 'clear-findings' && job) confirmAsk('לנקות את הממצאים?', 'הממצאים יימחקו מהעבודה (התמונות נשארות).', async () => { for (const f of findingsOf(job.id)) await DB.trash('findings', f.id); render(); });
  else if (t.dataset.act === 'voice' && job) startVoice(job);
  else if (t.dataset.act === 'add-expense' && job) openExpenseForm(job);
  else if (t.dataset.exp && job) openExpenseForm(job, t.dataset.exp);
  else if (t.dataset.expReceipt) { await DB.save('expenses', { id: t.dataset.expReceipt, receipt: true }); render(); toast('סומן: חשבונית התקבלה'); }
  else if (t.dataset.act === 'addon' && job) { if (t.disabled) return; t.disabled = true; try { const q = await Q.create(job, { addon: true }); show('quote', { id: q.id }); } finally { t.disabled = false; } }
  else if (t.dataset.act === 'summary' && job) show('print', { summary: job.id });
  else if (t.dataset.act === 'worker-add') openWorkerForm();
  else if (t.dataset.workerEdit) openWorkerForm(+t.dataset.workerEdit);
  else if (t.dataset.media) openMedia(t.dataset.media);
  else if (t.dataset.quote) show('quote', { id: t.dataset.quote });
  else if (t.dataset.act === 'new-quote' && job) { if (t.disabled) return; t.disabled = true; try { const q = await Q.create(job); show('quote', { id: q.id }); } finally { t.disabled = false; } }   // לחיצה כפולה לא יוצרת שתי הצעות
  else if (S.view === 'quote' && t.dataset.act) quoteAction(t.dataset.act, t);
  else if (t.dataset.act === 'print') { document.title = $('#v-print').dataset.title || document.title; window.print(); }
  else if (t.hasAttribute('data-close-lb')) $('#lightbox').hidden = true;
  else if (t.dataset.open === 'trash') show('trash');
  else if (t.dataset.open === 'settings') show('settings');
  else if (t.dataset.open === 'catalog') show('catalog', { q: '' });
  else if (t.dataset.act === 'save-settings') { await DB.save('settings', { business: { ...((D.settings && D.settings.business) || {}), businessName: $('#s-biz').value.trim(), ownerName: $('#s-owner').value.trim(), phone: $('#s-phone').value.trim(), email: $('#s-email').value.trim(), taxId: $('#s-tax').value.trim() }, quote_template: { ...Q.tpl(), vatRate: Number($('#s-vat').value) || 18, validityDays: Number($('#s-valid').value) || 30, paymentTerms: $('#s-terms').value.trim(), standardNotes: $('#s-notes').value, unforeseenClause: $('#s-unf').value.trim() } }); toast('נשמר'); back(); }
  else if (t.dataset.act === 'cat-add') openCatalogItem();
  else if (t.dataset.catEdit) openCatalogItem(+t.dataset.catEdit);
  else if (t.dataset.act === 'backup-file') backupToFile();
  else if (t.dataset.seen) { await DB.save('alerts', { id: t.dataset.seen, seen_at: new Date().toISOString() }); renderAlerts(); }
  else if (t.dataset.restore) { const [tb, id] = t.dataset.restore.split(':'); await DB.restore(tb, id); if (tb === 'customers') for (const j of D.jobs.filter((j) => j.customer_id === id && j.deleted_at)) await DB.restore('jobs', j.id); render(); toast('שוחזר'); }
  else if (t.id === 'refresh') { toast('טוען…'); await DB.loadAll(); render(); toast('עודכן'); }
  else if (t.id === 'logout') { await sb.auth.signOut(); location.reload(); }
});
$('#photo-in').addEventListener('change', async (e) => {
  const files = [...e.target.files]; if (!files.length) return; const jid = e.target.dataset.forJob, cid = e.target.dataset.forCust, tag = e.target.dataset.forTag || null, forFinding = e.target.dataset.forFinding; e.target.value = '';
  toast(files.length + ' תמונות נשמרות…'); const rows = [];
  for (const f of files) { try { const r = await DB.uploadPhoto(f, jid, cid); if (tag) await DB.save('media', { id: r.id, tag }); rows.push(r); } catch (err) { console.warn(err); toast('תמונה אחת לא נקלטה'); } }
  if (forFinding && rows[0] && $('#fi-thumb')) { $('#fi-thumb').dataset.media = rows[0].id; $('#fi-thumb').innerHTML = `<img src="${rows[0].thumb_data}" alt="" style="width:72px;height:72px;object-fit:cover;border-radius:8px">`; return; }
  render(); toast(navigator.onLine ? 'התמונות נשמרו' : 'נשמרו במכשיר — יעלו כשתהיה רשת');
});
$('#lightbox').addEventListener('click', (e) => { if (e.target.id === 'lightbox') e.currentTarget.hidden = true; });
$('#search').addEventListener('input', (e) => { S.q = e.target.value; if (!['customers', 'work'].includes(S.view)) { S.stack = []; S.view = 'customers'; } render(); });   // הקלדה מכל מקום = חיפוש לקוחות
$('#li-go').addEventListener('click', login);
$('#li-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); });
async function login() {
  const email = $('#li-email').value.trim(), password = $('#li-pass').value;
  $('#li-msg').textContent = 'מתחבר…';
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) { $('#li-msg').textContent = 'לא הצלחתי להתחבר. בדוק אימייל וסיסמה.'; return; }
  await boot();
}
function setNet() { const n = $('#netdot'); n.classList.toggle('off', !navigator.onLine); const pc = DB.pendingCount(); n.classList.toggle('pending', pc > 0); n.title = !navigator.onLine ? 'אין רשת' : pc ? pc + ' עדיין לא עלו' : 'מסונכרן'; }
window.addEventListener('online', setNet); window.addEventListener('offline', setNet);

async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { $('#login').hidden = false; ['#top', '#views', '#tabs'].forEach((s) => $(s).hidden = true); return; }
  $('#login').hidden = true; ['#top', '#views', '#tabs'].forEach((s) => $(s).hidden = false); DB.onChange(setNet); setNet(); pinLock();
  cacheLoad(); render();
  try { await DB.loadAll(); render(); } catch (e) { console.warn(e); toast(navigator.onLine ? 'לא הצלחתי לטעון מהענן' : 'אין רשת — מציג את העותק האחרון'); }
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
