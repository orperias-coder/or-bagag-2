/* data.js — הענן הוא האמת. כל כתיבה: (1) עדכון מיידי בזיכרון ובעותק המקומי, (2) שורה בתור IndexedDB,
   (3) ניסיון מיידי לשלוח; כשל/בלי-רשת → נשאר בתור ומנוסה כל 20 שניות וכשחוזרת רשת.
   מנצח בהתנגשות: מי שנשמר אחרון בענן. כל כתיבה נרשמת גם ביומן-האירועים (מי, מתי, מאיזה מכשיר, מה). */
const DB = (() => {
  const DEVICE = (() => { try { let d = localStorage.getItem('ob2_device'); if (!d) { d = crypto.randomUUID().slice(0, 8); localStorage.setItem('ob2_device', d); } return d; } catch (e) { return 'x'; } })();
  const uuid = () => crypto.randomUUID();

  // ---- תור ב-IndexedDB ----
  let idb;
  const openIDB = () => idb || (idb = new Promise((res, rej) => { const r = indexedDB.open('ob2', 1); r.onupgradeneeded = () => r.result.createObjectStore('queue', { keyPath: 'qid' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const qAll = async () => { const db = await openIDB(); return new Promise((res) => { const rq = db.transaction('queue').objectStore('queue').getAll(); rq.onsuccess = () => res(rq.result || []); }); };
  const qPut = async (item) => { const db = await openIDB(); return new Promise((res) => { const t = db.transaction('queue', 'readwrite'); t.objectStore('queue').put(item); t.oncomplete = res; }); };
  const qDel = async (qid) => { const db = await openIDB(); return new Promise((res) => { const t = db.transaction('queue', 'readwrite'); t.objectStore('queue').delete(qid); t.oncomplete = res; }); };
  let pending = 0; const listeners = new Set();
  const notify = () => listeners.forEach((f) => { try { f(); } catch (e) {} });
  async function refreshPending() { pending = (await qAll()).length; notify(); }

  // ---- עדכון מקומי ----
  function local(table, row) {
    if (table === 'settings') { D.settings = { ...(D.settings || {}), ...row }; cacheSave(); return; }
    const arr = D[table]; if (!Array.isArray(arr)) return;
    const i = arr.findIndex((x) => x.id === row.id);
    if (i >= 0) arr[i] = { ...arr[i], ...row }; else arr.unshift(row);
    cacheSave();
  }

  // ---- שליחה לענן ----
  async function send(item) {
    if (item.op === 'upsert') {
      const { error } = await sb.from(item.table).upsert(item.row, { onConflict: item.table === 'settings' ? 'user_id' : 'id' });
      if (error) throw error;
    } else if (item.op === 'event') {
      const { error } = await sb.from('events').insert(item.row); if (error) throw error;
    } else if (item.op === 'upload') {
      const { error } = await sb.storage.from('app2-media').upload(item.row.path, item.blob, { contentType: 'image/jpeg', upsert: true });
      if (error) throw error;
      const up = { id: item.row.id, storage_path: item.row.path, updated_at: new Date().toISOString() };
      const r2 = await sb.from('media').update(up).eq('id', item.row.id); if (r2.error) throw r2.error;
      local('media', up);
    }
  }
  let syncing = false;
  async function sync() {
    if (syncing || !navigator.onLine) return; syncing = true;
    try {
      for (const item of (await qAll()).sort((a, b) => a.at - b.at)) {
        try { await send(item); await qDel(item.qid); }
        catch (e) { console.warn('[queue]', item.op, item.table || '', e.message || e); break; }   // שומרים סדר: עוצרים בכשל הראשון
      }
    } finally { syncing = false; await refreshPending(); }
  }
  const trySync = () => setTimeout(sync, 30);
  async function enqueue(item) { item.qid = uuid(); item.at = Date.now(); await qPut(item); await refreshPending(); trySync(); }
  setInterval(sync, 20000); window.addEventListener('online', sync);

  // ---- API ----
  async function save(table, patch) {
    const now = new Date().toISOString(); const isNew = !patch.id;
    const base = table === 'settings' ? (D.settings || {}) : (isNew ? { id: uuid(), created_at: now } : ((D[table] || []).find((x) => x.id === patch.id) || {}));
    const row = { ...base, ...patch, updated_at: now };
    for (const k of Object.keys(row)) if (k.startsWith('_')) delete row[k];
    delete row.user_id;                                       // הענן ממלא auth.uid()
    local(table, row);
    const cloudRow = { ...row }; if (table === 'settings') cloudRow.user_id = D.uid;
    await enqueue({ op: 'upsert', table, row: cloudRow });
    await enqueue({ op: 'event', row: { entity: table, entity_id: table === 'settings' ? D.uid : row.id, action: isNew ? 'create' : 'update', device: DEVICE, diff: patch } });
    return row;
  }
  const trash = (table, id) => save(table, { id, deleted_at: new Date().toISOString() });
  const restore = (table, id) => save(table, { id, deleted_at: null });
  async function stage(jobId, st) {
    const now = new Date().toISOString(); const patch = { id: jobId, stage: st, stage_changed_at: now };
    if (st === 'sent') patch.quote_sent_at = now; if (st === 'approved') patch.approved_at = now; if (st === 'doing') patch.started_at = now; if (st === 'paid') patch.paid_at = now;
    const row = await save('jobs', patch);
    await enqueue({ op: 'event', row: { entity: 'jobs', entity_id: jobId, action: 'stage', device: DEVICE, diff: { stage: st } } });
    return row;
  }
  async function loadAll() {
    const { data: { user } } = await sb.auth.getUser(); D.uid = user && user.id;
    const sel = { customers: '*', jobs: '*', quotes: '*', quote_versions: 'id,quote_id,version,snapshot,created_at', payments: '*',
      media: 'id,job_id,customer_id,kind,storage_path,thumb_data,taken_at,caption,created_at,updated_at,deleted_at', alerts: '*' };
    const res = await Promise.all(Object.entries(sel).map(([t, s]) => sb.from(t).select(s).order(t === 'quote_versions' || t === 'alerts' ? 'created_at' : 'updated_at', { ascending: false }).limit(t === 'media' ? 800 : 3000).then((r) => [t, r])));
    for (const [t, r] of res) { if (r.error) { if (t === 'alerts') { D.alerts = []; continue; } throw r.error; } D[t] = r.data; }
    const st = await sb.from('settings').select('*').maybeSingle(); if (!st.error && st.data) D.settings = st.data;
    for (const it of await qAll()) if (it.op === 'upsert') local(it.table, it.row);   // מה שעוד לא עלה גובר
    D.loadedAt = Date.now(); cacheSave();
  }
  async function uploadPhoto(file, jobId, customerId) {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
    const draw = (max) => { const s = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * s)); c.height = Math.max(1, Math.round(img.height * s)); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c; };
    const thumb = draw(240).toDataURL('image/jpeg', 0.7);
    const full = await new Promise((res) => draw(1600).toBlob(res, 'image/jpeg', 0.85));
    const row = await save('media', { job_id: jobId || null, customer_id: customerId || null, kind: 'photo', thumb_data: thumb, taken_at: new Date().toISOString() });
    await enqueue({ op: 'upload', row: { id: row.id, path: `${D.uid}/${row.id}.jpg` }, blob: full });
    return row;
  }
  async function photoUrl(path) { const { data } = await sb.storage.from('app2-media').createSignedUrl(path, 3600); return data && data.signedUrl; }
  refreshPending();
  return { save, trash, restore, stage, loadAll, sync, uploadPhoto, photoUrl, pendingCount: () => pending, onChange: (f) => listeners.add(f), DEVICE, uuid };
})();
