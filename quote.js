/* quote.js — הצעת מחיר: סעיפים (חופשי/קטלוג), הנחה, מע"מ, טיוטה שנשמרת בכל שינוי,
   מספר אטומי מהענן, גרסאות: כל שינוי אחרי "נשלחה" שומר את הקודמת ב-quote_versions ומעלה מספר-גרסה. */
const Q = {
  calc(q) {
    const items = (q.items || []).filter((i) => i.visible !== false);
    const sum = items.reduce((a, i) => a + Number(i.total || 0), 0);
    const d = q.discount || null;
    const disc = !d ? 0 : d.type === 'percent' ? sum * Number(d.value || 0) / 100 : Number(d.value || 0);
    const before = Math.max(0, sum - disc); const vat = before * Number(q.vat_rate ?? 18) / 100;
    return { sum, disc, before, vat, total: before + vat, advance: (before + vat) * 0.3 };
  },
  tpl() { return (D.settings && D.settings.quote_template) || {}; },
  async create(job) {
    const t = Q.tpl(); let number = null;
    try { if (navigator.onLine) { const { data } = await sb.rpc('next_quote_number'); number = data || null; } } catch (e) {}
    const row = await DB.save('quotes', { job_id: job.id, number, status: 'draft', version: 1, items: [], discount: null,
      vat_rate: Number(t.vatRate ?? 18), validity_days: Number(t.validityDays || 30),
      payment_terms: t.paymentTerms || '30% מקדמה במועד החתימה, 70% בסיום העבודה',
      notes: t.standardNotes || '', options: { unforeseen: true, signatures: true, urgency: !!t.showUrgency }, total_before_vat: 0, total: 0 });
    if (['lead', 'visit'].includes(job.stage)) await DB.stage(job.id, 'quote');
    return row;
  },
  cur(id) { return live(D.quotes).find((x) => x.id === id); },
  async save(q, patch, opts = {}) {
    const cur = Q.cur(q.id) || q; let version = cur.version || 1;
    if (cur.status !== 'draft' && !opts.noVersion) {        // אחרי "נשלחה": הישנה נשמרת, גרסה עולה
      await DB.save('quote_versions', { quote_id: cur.id, version, snapshot: { ...cur } });
      version += 1;
    }
    const k = Q.calc({ ...cur, ...patch });
    return DB.save('quotes', { ...patch, id: cur.id, version, total_before_vat: Math.round(k.before * 100) / 100, total: Math.round(k.total * 100) / 100 });
  },
  async ensureNumber(q) {
    if (q.number || !navigator.onLine) return q;
    try { const { data } = await sb.rpc('next_quote_number'); if (data) return Q.save(q, { number: data }, { noVersion: true }); } catch (e) {}
    return q;
  },
  async markSent(q) {
    q = await Q.ensureNumber(q);
    const row = await Q.save(q, { status: 'sent', sent_at: new Date().toISOString() }, { noVersion: true });
    await DB.stage(q.job_id, 'sent'); return row;
  },
  item(cat) { return { id: DB.uuid(), title: cat.name || '', description: cat.description || '', qty: 1, unit: cat.unit || '', price_per_unit: Number(cat.price || 0), total: Number(cat.price || 0), urgency: '', visible: true, catalog_id: cat.legacy_id || null }; },
  validUntil(q) { const d = new Date(q.sent_at || q.created_at); d.setDate(d.getDate() + Number(q.validity_days || 30)); return d; },
  shareText(q) { const j = D.jobs.find((x) => x.id === q.job_id) || {}, c = custOf(j.customer_id) || {}, k = Q.calc(q);
    return `היי ${c.name || ''}, מצורפת הצעת מחיר ${q.number || ''} על סך ${money(k.total)} כולל מע"מ. בתוקף עד ${dateHe(Q.validUntil(q))}. אשמח לענות על כל שאלה.\nאור - אור בגג`; },
};
const QSTAT = { draft: 'טיוטה', sent: 'נשלחה', accepted: 'אושרה', rejected: 'נדחתה' };

function renderQuote() {
  const v = $('#v-quote'); v.hidden = false;
  const q = Q.cur(S.params.id); if (!q) return v.innerHTML = '<div class="empty">הצעה לא נמצאה</div>';
  const j = D.jobs.find((x) => x.id === q.job_id) || {}, c = custOf(j.customer_id) || {}, k = Q.calc(q);
  const items = q.items || [];
  v.innerHTML = `<button class="back" data-back>‹ ${esc(c.name || 'חזרה')}</button>
  <div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div><b>הצעה <span id="q-number">${esc(q.number || 'טיוטה')}</span></b> · גרסה <span id="q-version">${q.version || 1}</span></div><span class="chip ${q.status === 'draft' ? 'quote' : q.status === 'rejected' ? 'lost' : q.status === 'accepted' ? 'approved' : 'sent'}">${QSTAT[q.status] || q.status}</span></div>
  <div class="dim">${esc(c.name)}${c.address ? ' · ' + esc(c.address) : ''}${q.sent_at ? ' · נשלחה ' + dateHe(q.sent_at) : ''} · בתוקף עד ${dateHe(Q.validUntil(q))}</div></div>
  <div class="section">סעיפים · ${items.length}</div>
  <div class="card" id="q-items">${items.map((i, n) => `<div class="qitem" data-idx="${n}"><div style="flex:1;min-width:0"><div class="t">${n + 1}. ${esc(i.title)}</div>${i.description ? `<div class="d">${esc(i.description)}</div>` : ''}<div class="dim">${i.qty} ${esc(i.unit || '')} × ${money(i.price_per_unit)}${i.urgency ? ' · דחיפות: ' + esc(i.urgency) : ''}</div></div><div style="text-align:left"><b>${money(i.total)}</b><div class="row2" style="margin-top:4px"><button class="btn sm ghost" data-act="edit-item" data-idx="${n}">ערוך</button><button class="btn sm ghost" data-act="del-item" data-idx="${n}">הסר</button></div></div></div>`).join('') || '<div class="empty">אין סעיפים עדיין</div>'}
  <div class="row2"><button class="btn pri" data-act="add-catalog">מהקטלוג</button><button class="btn" data-act="add-item">סעיף חופשי</button></div></div>
  <div class="card" id="q-totals"><div class="qitem"><span>סה"כ סעיפים</span><b>${money(k.sum)}</b></div>
  <div class="qitem"><span>הנחה <button class="btn sm ghost" data-act="discount">${q.discount ? (q.discount.type === 'percent' ? q.discount.value + '%' : money(q.discount.value)) + ' · שנה' : 'הוסף'}</button></span><b>${k.disc ? '−' + money(k.disc) : ''}</b></div>
  <div class="qitem"><span>סה"כ לפני מע"מ</span><b>${money(k.before)}</b></div><div class="qitem"><span>מע"מ ${q.vat_rate}%</span><b>${money(k.vat)}</b></div>
  <div class="total"><span>סה"כ לתשלום</span><span>${money(k.total)}</span></div><div class="qitem dim"><span>מקדמה 30%</span><b>${money(k.advance)}</b></div></div>
  <div class="card"><label class="dim" for="q-terms">תנאי תשלום</label><input id="q-terms" class="txt" value="${esc(q.payment_terms || '')}"><label class="dim" for="q-notes" style="margin-top:8px;display:block">הערות להצעה</label><textarea id="q-notes" class="txt" rows="3">${esc(q.notes || '')}</textarea></div>
  <div class="actions"><button class="btn pri" data-act="pdf">PDF / הדפסה</button>${q.status === 'draft' ? '<button class="btn" data-act="mark-sent">נשלחה ללקוח</button>' : `<button class="btn" data-act="versions">גרסאות (${q.version})</button>`}<button class="btn ghost" data-act="share">טקסט לוואטסאפ</button><button class="btn ghost danger" data-act="trash-quote">לסל</button></div>
  <div id="v-versions" hidden></div>`;
  const opts = { noVersion: q.status === 'draft' };
  $('#q-terms', v).onblur = (e) => { if (e.target.value !== (q.payment_terms || '')) Q.save(q, { payment_terms: e.target.value }, opts).then(render); };
  $('#q-notes', v).onblur = (e) => { if (e.target.value !== (q.notes || '')) Q.save(q, { notes: e.target.value }, opts).then(render); };
}
function openItemForm(q, idx) {
  const it = idx != null ? q.items[idx] : { id: DB.uuid(), title: '', description: '', qty: 1, unit: '', price_per_unit: '', total: 0, urgency: '', visible: true };
  const w = sheet('t-item-form'); $('#i-title', w).value = it.title || ''; $('#i-desc', w).value = it.description || ''; $('#i-qty', w).value = it.qty; $('#i-unit', w).value = it.unit || ''; $('#i-ppu', w).value = it.price_per_unit; $('#i-urg', w).value = it.urgency || '';
  const recalc = () => { const t = (Number($('#i-qty', w).value) || 0) * (Number($('#i-ppu', w).value) || 0); $('#i-total', w).textContent = money(Math.round(t)); };
  $('#i-qty', w).oninput = recalc; $('#i-ppu', w).oninput = recalc; recalc();
  $('#i-save', w).onclick = async () => {
    const n = { ...it, title: $('#i-title', w).value.trim(), description: $('#i-desc', w).value.trim(), qty: Number($('#i-qty', w).value) || 1, unit: $('#i-unit', w).value.trim(), price_per_unit: Number($('#i-ppu', w).value) || 0, urgency: $('#i-urg', w).value };
    n.total = Math.round(n.qty * n.price_per_unit); if (!n.title) return toast('צריך שם לסעיף');
    const items = [...(q.items || [])]; if (idx != null) items[idx] = n; else items.push(n);
    await Q.save(q, { items }, { noVersion: q.status === 'draft' }); closeSheet(); render();
  };
  setTimeout(() => $('#i-title', w).focus(), 50);
}
function openCatalog(q) {
  const cat = ((D.settings && D.settings.catalog) || []).filter((c) => !c.hidden);
  const w = sheet('t-catalog'); const list = $('#cat-list', w);
  const draw = (f) => { list.innerHTML = cat.filter((c) => !f || (c.name || '').includes(f) || (c.category || '').includes(f)).slice(0, 60).map((c, i) => `<div class="row" data-cat="${cat.indexOf(c)}"><div class="main"><div class="name">${esc(c.name)}</div><div class="sub">${esc(c.category || '')}${c.price != null ? ' · ' + money(c.price) + (c.unit ? ' / ' + esc(c.unit) : '') : ''}</div></div></div>`).join('') || '<div class="empty">לא נמצא בקטלוג</div>'; };
  draw(''); $('#cat-search', w).oninput = (e) => draw(e.target.value.trim());
  list.onclick = async (e) => { const r = e.target.closest('[data-cat]'); if (!r) return; await Q.save(q, { items: [...(q.items || []), Q.item(cat[+r.dataset.cat])] }, { noVersion: q.status === 'draft' }); closeSheet(); render(); toast('נוסף — אפשר לערוך כמות ומחיר'); };
  setTimeout(() => $('#cat-search', w).focus(), 50);
}
function openDiscount(q) {
  const w = sheet('t-discount'); if (q.discount) { $('#d-type', w).value = q.discount.type; $('#d-value', w).value = q.discount.value; }
  $('#d-save', w).onclick = async () => { const val = Number($('#d-value', w).value) || 0; await Q.save(q, { discount: val > 0 ? { type: $('#d-type', w).value, value: val } : null }, { noVersion: q.status === 'draft' }); closeSheet(); render(); };
}
function renderVersions(q) {
  const box = $('#v-versions'); const vs = D.quote_versions.filter((x) => x.quote_id === q.id).sort((a, b) => b.version - a.version);
  box.hidden = false; box.innerHTML = `<div class="section">גרסאות קודמות</div>` + (vs.map((x) => `<div class="card"><b>גרסה ${x.version}</b> <span class="dim">· ${dateHe(x.created_at)}</span>${((x.snapshot && x.snapshot.items) || []).map((i) => `<div class="qitem"><span>${esc(i.title)} · ${i.qty} × ${money(i.price_per_unit)}</span><b>${money(i.total)}</b></div>`).join('')}<div class="total"><span>סה"כ</span><span>${money((x.snapshot || {}).total)}</span></div></div>`).join('') || '<div class="empty">אין גרסאות קודמות</div>');
}
async function quoteAction(act, t) {
  const q = Q.cur(S.params.id); if (!q) return;
  if (act === 'add-item') openItemForm(q);
  else if (act === 'edit-item') openItemForm(q, +t.dataset.idx);
  else if (act === 'del-item') confirmAsk('להסיר את הסעיף?', q.status === 'draft' ? 'הסעיף יוסר מהטיוטה.' : 'הגרסה הנוכחית נשמרת ותיווצר גרסה חדשה.', async () => { const items = [...q.items]; items.splice(+t.dataset.idx, 1); await Q.save(q, { items }, { noVersion: q.status === 'draft' }); render(); });
  else if (act === 'add-catalog') openCatalog(q);
  else if (act === 'discount') openDiscount(q);
  else if (act === 'mark-sent') { if (!(q.items || []).length) return toast('אין סעיפים בהצעה'); await Q.markSent(q); render(); toast('סומן: נשלחה. סופרים ימים.'); }
  else if (act === 'versions') renderVersions(q);
  else if (act === 'share') { const text = Q.shareText(q); if (navigator.share) { try { await navigator.share({ text }); } catch (e) {} } else { await navigator.clipboard.writeText(text); toast('הטקסט הועתק'); } }
  else if (act === 'pdf') show('print', { id: q.id });
  else if (act === 'trash-quote') confirmAsk('להעביר את ההצעה לסל?', 'אפשר לשחזר מ"עוד".', async () => { await DB.trash('quotes', q.id); back(); });
}
