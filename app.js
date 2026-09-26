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
const D = { customers: [], jobs: [], quotes: [], quote_versions: [], payments: [], media: [], alerts: [], settings: null, uid: null, loadedAt: 0 };
const CACHE_KEY = 'ob2_cache_v1';
function cacheSave() { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ...D, media: D.media.map((m) => ({ ...m, thumb_data: null })) })); } catch (e) {} }
function cacheLoad() { try { const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); if (c && c.customers) Object.assign(D, c); } catch (e) {} }
const live = (arr) => arr.filter((x) => !x.deleted_at);
const jobsOf = (cid) => live(D.jobs).filter((j) => j.customer_id === cid).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
const quotesOf = (jid) => live(D.quotes).filter((q) => q.job_id === jid).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
const paymentsOf = (jid) => live(D.payments).filter((p) => p.job_id === jid);
const mediaOf = (jid) => live(D.media).filter((m) => m.job_id === jid);
const custOf = (id) => D.customers.find((c) => c.id === id);

// ---------- ניווט ----------
const S = { view: 'customers', stack: [], tab: 'customers', q: '' };
function show(view, params) {
  if (view !== S.view || JSON.stringify(params) !== JSON.stringify(S.params)) S.stack.push({ view: S.view, params: S.params });
  S.view = view; S.params = params || {};
  render();
  window.scrollTo(0, 0);
}
function back() { const p = S.stack.pop(); if (!p) return show('customers'); S.view = p.view; S.params = p.params || {}; render(); }
function render() {
  document.querySelectorAll('.view').forEach((v) => v.hidden = true);
  const map = { customers: renderCustomers, work: renderWork, customer: renderCustomer, job: renderJob, money: renderMoney, more: renderMore };
  (map[S.view] || renderCustomers)();
  document.querySelectorAll('#tabs [data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === (S.view === 'customer' || S.view === 'job' ? 'customers' : S.view)));
}

// ---------- מסכים ----------
function custRow(c) {
  const js = jobsOf(c.id), top = js[0];
  const sub = [c.phone, c.address].filter(Boolean).join(' · ');
  const chip = top ? `<span class="chip ${top.stage}">${STAGE_HE[top.stage]}</span>` : '';
  return `<div class="row" data-cust="${c.id}"><div class="avatar">${esc((c.name || '?').trim()[0] || '?')}</div><div class="main"><div class="name">${esc(c.name)}</div><div class="sub">${esc(sub) || '&nbsp;'}</div></div>${chip}</div>`;
}
function renderCustomers() {
  const v = $('#v-customers'); v.hidden = false;
  const q = S.q.trim().toLowerCase();
  let list = live(D.customers);
  if (q) list = list.filter((c) => [c.name, c.phone, c.address, c.notes].some((x) => (x || '').toLowerCase().includes(q)) || jobsOf(c.id).some((j) => (j.title || '').toLowerCase().includes(q)));
  list.sort((a, b) => new Date(jobsOf(b.id)[0]?.updated_at || b.updated_at) - new Date(jobsOf(a.id)[0]?.updated_at || a.updated_at));
  $('#cust-list').innerHTML = list.length ? list.map(custRow).join('') : `<div class="empty">${q ? 'לא נמצא' : 'אין לקוחות עדיין'}</div>`;
}
function renderWork() {
  const v = $('#v-customers'); v.hidden = false;
  const q = S.q.trim().toLowerCase();
  const open = live(D.jobs).filter((j) => !['paid', 'lost'].includes(j.stage));
  const groups = STAGES.filter((s) => s !== 'paid').map((s) => [s, open.filter((j) => j.stage === s)]).filter(([, a]) => a.length);
  $('#cust-list').innerHTML = groups.map(([s, arr]) => `<div class="section">${STAGE_HE[s]} · ${arr.length}</div>` + arr.map((j) => {
    const c = custOf(j.customer_id) || {}; if (q && !(c.name || '').toLowerCase().includes(q)) return '';
    const days = j.stage === 'sent' ? daysSince(j.quote_sent_at) : null;
    return `<div class="row" data-job="${j.id}"><div class="avatar">${esc((c.name || '?')[0])}</div><div class="main"><div class="name">${esc(c.name)}</div><div class="sub">${esc(j.title || c.address || '')}</div></div>${days != null ? `<span class="chip days">${days} ימים</span>` : ''}</div>`;
  }).join('')).join('') || '<div class="empty">אין עבודות פתוחות</div>';
}
function renderCustomer() {
  const v = $('#v-customer'); v.hidden = false;
  const c = custOf(S.params.id); if (!c) return v.innerHTML = '<div class="empty">לקוח לא נמצא</div>';
  const js = jobsOf(c.id);
  v.innerHTML = `<button class="back" data-back>‹ חזרה</button>
  <div class="card"><h2>${esc(c.name)}</h2><div class="kv">${c.phone ? `<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a><a href="https://wa.me/972${esc(String(c.phone).replace(/\D/g, '').replace(/^0/, ''))}" target="_blank">וואטסאפ</a>` : ''}${c.address ? `<span>${esc(c.address)}</span>` : ''}</div>${c.notes ? `<div class="dim" style="margin-top:6px;white-space:pre-line">${esc(c.notes)}</div>` : ''}</div>
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
  <div class="kv"><span>${esc(c.name)}</span>${c.address ? `<span>${esc(c.address)}</span>` : ''}${j.visit_at ? `<span>ביקור ${dateHe(j.visit_at)}</span>` : ''}${days != null ? `<span class="chip days">נשלחה לפני ${days} ימים</span>` : ''}</div>
  ${j.problem ? `<div style="margin-top:8px"><b>הבעיה:</b> ${esc(j.problem)}</div>` : ''}${j.visit_notes ? `<div style="margin-top:8px;white-space:pre-line"><b>מהביקור:</b> ${esc(j.visit_notes)}</div>` : ''}</div>
  <div class="two"><div>
  ${qs.length ? `<div class="section">הצעות מחיר</div>` + qs.map(quoteBlock).join('') : ''}
  ${(j.price_agreed || ps.length) ? `<div class="section">כסף</div><div class="card"><div class="total"><span>סוכם</span><span>${money(j.price_agreed)}</span></div><div class="total" style="color:var(--ok)"><span>שולם</span><span>${money(paid)}</span></div>${j.price_agreed ? `<div class="total" style="color:var(--acc)"><span>נשאר</span><span>${money(Math.max(0, j.price_agreed - paid))}</span></div>` : ''}${ps.map((p) => `<div class="qitem"><span>${dateHe(p.paid_at)} ${esc(p.method || '')}${p.invoice_issued ? ' · חשבונית הוצאה' : ' · <b style="color:var(--warn)">בלי חשבונית</b>'}</span><b>${money(p.amount)}</b></div>`).join('')}</div>` : ''}
  </div><div>
  ${ms.length ? `<div class="section">תמונות · ${ms.length}</div><div class="card"><div class="thumbs">${ms.map((m) => m.thumb_data ? `<img src="${m.thumb_data}" alt="">` : `<div class="dim" style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;background:#eee;border-radius:10px;font-size:12px">תמונה</div>`).join('')}</div></div>` : ''}
  </div></div>`;
}
function renderMoney() {
  const v = $('#v-money'); v.hidden = false;
  const owe = live(D.jobs).filter((j) => ['approved', 'doing'].includes(j.stage) && j.price_agreed).map((j) => ({ j, left: j.price_agreed - paymentsOf(j.id).reduce((a, p) => a + Number(p.amount || 0), 0) })).filter((x) => x.left > 0);
  const noInv = live(D.payments).filter((p) => !p.invoice_issued);
  v.innerHTML = `<div class="section">חייבים לך</div><div class="list">${owe.map(({ j, left }) => `<div class="row" data-job="${j.id}"><div class="main"><div class="name">${esc(custOf(j.customer_id)?.name)}</div><div class="sub">${esc(j.title || '')}</div></div><b>${money(left)}</b></div>`).join('') || '<div class="empty">אין חובות פתוחים</div>'}</div>
  <div class="section">תשלומים בלי חשבונית · ${noInv.length}</div><div class="list">${noInv.map((p) => { const j = D.jobs.find((x) => x.id === p.job_id) || {}; return `<div class="row" data-job="${j.id}"><div class="main"><div class="name">${esc(custOf(j.customer_id)?.name)}</div><div class="sub">${dateHe(p.paid_at)}</div></div><b>${money(p.amount)}</b></div>`; }).join('') || '<div class="empty">הכל עם חשבונית</div>'}</div>`;
}
function renderMore() {
  const v = $('#v-more'); v.hidden = false;
  const trashed = D.customers.filter((c) => c.deleted_at).length + D.jobs.filter((j) => j.deleted_at).length + D.quotes.filter((q) => q.deleted_at).length;
  v.innerHTML = `<div class="card"><b>אור בגג 2</b> · גרסה ${APP_VERSION}<div class="dim">נתונים עודכנו ${D.loadedAt ? new Date(D.loadedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '—'} · ${live(D.customers).length} לקוחות · ${live(D.jobs).length} עבודות · ${live(D.quotes).length} הצעות</div></div>
  <div class="card"><b>סל המיחזור</b> · ${trashed} פריטים<div class="dim">שום דבר לא נמחק באמת. השחזור יגיע בשלב הבא.</div></div>
  <div class="card"><button class="btn" id="refresh">רענן נתונים מהענן</button> <button class="btn ghost" id="logout">התנתק</button></div>`;
}

// ---------- אירועים ----------
document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-cust],[data-job],[data-back],[data-tab],#plus,#refresh,#logout');
  if (!t) return;
  if (t.dataset.cust) show('customer', { id: t.dataset.cust });
  else if (t.dataset.job) show('job', { id: t.dataset.job });
  else if (t.hasAttribute('data-back')) back();
  else if (t.dataset.tab) { S.stack = []; S.q = ''; $('#search').value = ''; show(t.dataset.tab); }
  else if (t.id === 'plus') toast('הוספה מגיעה בשלב הבא');
  else if (t.id === 'refresh') { toast('טוען…'); await DB.loadAll(); render(); toast('עודכן'); }
  else if (t.id === 'logout') { await sb.auth.signOut(); location.reload(); }
});
$('#search').addEventListener('input', (e) => { S.q = e.target.value; if (!['customers', 'work'].includes(S.view)) { S.stack = []; S.view = 'customers'; } render(); });
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
  $('#login').hidden = true; ['#top', '#views', '#tabs'].forEach((s) => $(s).hidden = false); DB.onChange(setNet); setNet();
  cacheLoad(); render();
  try { await DB.loadAll(); render(); } catch (e) { console.warn(e); toast(navigator.onLine ? 'לא הצלחתי לטעון מהענן' : 'אין רשת — מציג את העותק האחרון'); }
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
