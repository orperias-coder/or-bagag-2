/* data.js — הענן הוא האמת. כל כתיבה: (1) עדכון מיידי בזיכרון ובעותק המקומי, (2) שורה בתור IndexedDB,
   (3) ניסיון מיידי לשלוח; כשל/בלי-רשת → נשאר בתור ומנוסה כל 20 שניות וכשחוזרת רשת.
   מנצח בהתנגשות: מי שנשמר אחרון בענן. כל כתיבה נרשמת גם ביומן-האירועים (מי, מתי, מאיזה מכשיר, מה). */
const DB = (() => {
  const DEVICE = (() => { try { let d = localStorage.getItem('ob2_device'); if (!d) { d = crypto.randomUUID().slice(0, 8); localStorage.setItem('ob2_device', d); } return d; } catch (e) { return 'x'; } })();
  const uuid = () => crypto.randomUUID();

  // ---- תור ב-IndexedDB ----
  let idb;
  const openIDB = () => idb || (idb = new Promise((res, rej) => { const r = indexedDB.open('ob2', 2); r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('queue')) d.createObjectStore('queue', { keyPath: 'qid' }); if (!d.objectStoreNames.contains('failed')) d.createObjectStore('failed', { keyPath: 'qid' }); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const fAll = async () => { const db = await openIDB(); return new Promise((res) => { const rq = db.transaction('failed').objectStore('failed').getAll(); rq.onsuccess = () => res(rq.result || []); }); };
  const fPut = async (item) => { const db = await openIDB(); return new Promise((res) => { const t = db.transaction('failed', 'readwrite'); t.objectStore('failed').put(item); t.oncomplete = res; }); };
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
    } else if (item.op === 'update') {
      const { id, ...patch } = item.row; const { error, data } = await sb.from(item.table).update(patch).eq('id', id).select('id');
      if (error) throw error;
      if (!data || !data.length) { const e = new Error('row-missing-in-cloud'); e.code = 'PGRST_NOROW'; throw e; }   // השורה לא בענן (יצירה נכשלה?) — ל"כתיבות שנדחו"
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
        catch (e) {
          const msg = String((e && e.message) || e);
          // כשל-רשת → עוצרים ומנסים אחר-כך (שומרים סדר). כשל-נתונים (הענן דחה) → הפריט לא חוסם את השאר:
          // נשמר ב"כתיבות שנדחו" עם השגיאה, ונרשם ביומן-האירועים. שום דבר לא נזרק.
          const status = Number((e && (e.status || e.statusCode)) || 0);
          const isNet = !e || (!e.code && /fetch|network|Failed to|timeout|load failed/i.test(msg)) || status >= 500 || status === 429 || status === 408;
          console.warn('[queue]', item.op, item.table || '', msg);
          if (isNet) break;
          // כשל לא-רשתי: מנסים עוד כמה פעמים לפני שמוותרים (העלאת תמונה יכולה להיכשל זמנית)
          item.tries = (item.tries || 0) + 1;
          if (item.tries < (item.op === 'upload' ? 8 : 3)) { await qPut(item); break; }
          await fPut({ ...item, error: msg, failedAt: Date.now() }); await qDel(item.qid);
          try { await sb.from('events').insert({ entity: item.table || item.op, entity_id: (item.row && item.row.id) || uuid(), action: 'sync-failed', device: DEVICE, diff: { error: msg, op: item.op } }); } catch (e2) {}
        }
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
    const row = { ...base, ...patch }; if (!['quote_versions', 'alerts'].includes(table)) row.updated_at = now;   // ל-quote_versions אין updated_at (גרסה לא משתנה)
    for (const k of Object.keys(row)) if (k.startsWith('_')) delete row[k];
    delete row.user_id;                                       // הענן ממלא auth.uid()
    local(table, row);
    // לענן נשלחים רק השדות ששונו (patch) — כך שני מכשירים שעורכים שדות שונים באותו זמן לא דורסים זה את זה.
    // שורה חדשה נשלחת במלואה.
    const cloudRow = isNew || table === 'settings' ? { ...row } : { ...patch }; for (const k of Object.keys(cloudRow)) if (k.startsWith('_')) delete cloudRow[k];
    delete cloudRow.user_id; if (!isNew && !['settings', 'quote_versions', 'alerts'].includes(table)) cloudRow.updated_at = now;
    if (table === 'settings') cloudRow.user_id = D.uid;
    await enqueue({ op: isNew || table === 'settings' ? 'upsert' : 'update', table, row: cloudRow });
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
    const sel = { customers: '*', jobs: '*', quotes: '*', tasks: '*', quote_versions: 'id,quote_id,version,snapshot,created_at', payments: '*',
      media: 'id,job_id,customer_id,kind,tag,storage_path,thumb_data,taken_at,caption,created_at,updated_at,deleted_at', alerts: '*' };
    const res = await Promise.all(Object.entries(sel).map(([t, s]) => sb.from(t).select(s).order(t === 'alerts' ? 'at' : t === 'quote_versions' ? 'created_at' : 'updated_at', { ascending: false }).limit(t === 'media' ? 800 : 3000).then((r) => [t, r])));
    for (const [t, r] of res) { if (r.error) { if (t === 'alerts') { D.alerts = []; continue; } throw r.error; } D[t] = r.data; }
    const st = await sb.from('settings').select('*').maybeSingle(); if (!st.error && st.data) D.settings = st.data;
    for (const it of await qAll()) if (it.op === 'upsert' || it.op === 'update') local(it.table, it.row);   // מה שעוד לא עלה גובר
    D.loadedAt = Date.now(); cacheSave();
  }
  async function uploadPhoto(file, jobId, customerId) {
    let img;
    try { img = await createImageBitmap(file); }   // אמין יותר מ-Image לקבצים מהמצלמה (כולל סיבוב EXIF)
    catch (e) { img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('image-load')); i.src = URL.createObjectURL(file); }); }
    const draw = (max) => { const s = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * s)); c.height = Math.max(1, Math.round(img.height * s)); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c; };
    const thumb = draw(240).toDataURL('image/jpeg', 0.7);
    const full = await new Promise((res) => draw(1600).toBlob(res, 'image/jpeg', 0.85));
    const row = await save('media', { job_id: jobId || null, customer_id: customerId || null, kind: 'photo', thumb_data: thumb, taken_at: new Date().toISOString() });
    await enqueue({ op: 'upload', row: { id: row.id, path: `${D.uid}/${row.id}.jpg` }, blob: full });
    return row;
  }
  async function photoUrl(path) { const { data } = await sb.storage.from('app2-media').createSignedUrl(path, 3600); return data && data.signedUrl; }
  // ---- ספירת-שימוש: כל פעולה נספרת מקומית ונשלחת פעם ביום (לפי מכשיר) ----
  const USE_KEY = 'ob2_usage';
  function used(key) { try { const u = JSON.parse(localStorage.getItem(USE_KEY) || '{}'); const day = new Date().toISOString().slice(0, 10); u[day] = u[day] || {}; u[day][key] = (u[day][key] || 0) + 1; localStorage.setItem(USE_KEY, JSON.stringify(u)); } catch (e) {} }
  async function flushUsage() {
    if (!navigator.onLine || !D.uid) return; let u; try { u = JSON.parse(localStorage.getItem(USE_KEY) || '{}'); } catch (e) { return; }
    const today = new Date().toISOString().slice(0, 10); const rows = [];
    for (const day of Object.keys(u)) for (const key of Object.keys(u[day])) rows.push({ user_id: D.uid, device: DEVICE, key, day, count: u[day][key] });
    if (!rows.length) return;
    const { error } = await sb.from('usage').upsert(rows, { onConflict: 'user_id,device,key,day' });
    if (!error) { const keep = { [today]: u[today] || {} }; localStorage.setItem(USE_KEY, JSON.stringify(keep)); }
  }
  setInterval(flushUsage, 10 * 60 * 1000); setTimeout(flushUsage, 15000);
  refreshPending();
  return { used, flushUsage, save, trash, restore, stage, loadAll, sync, uploadPhoto, photoUrl, pendingCount: () => pending, onChange: (f) => listeners.add(f), DEVICE, uuid, _queue: qAll, _failed: fAll, _send: send };
})();
