-- 18.10.2026, בקשת אור: הלידים מכלי-הוואטסאפ בתוך האפליקציה, וסטטוס שמתעדכן מיד בטלפון ובמחשב.
-- הענן הוא מקור-האמת לסטטוס. הטלפון כותב ישירות (RLS); הכלי במק כותב/קורא דרך פונקציות עם הקוד הסודי
-- (אותו app2.scan_writer של 010). תוכן הליד (תקציר, הודעות, תמונות) מגיע מהסריקה; הסטטוס — ממי שסימן אחרון.
create table if not exists app2.wa_leads (
  jid text primary key,                    -- מזהה-השיחה בוואטסאפ (מפתח הדייג'סט במק)
  user_id uuid not null,
  name text,
  phone text,
  summary text,
  data jsonb not null default '{}'::jsonb, -- heat/band/why/awaiting/tasks/messages/kind/category/area — לתצוגה בלבד
  media jsonb not null default '[]'::jsonb,-- [{path, type: image|video}] בדלי app2-media תחת wa/
  status text not null default 'new' check (status in ('new','replied','visit','quote_sent','approved','done','skip')),
  status_at timestamptz not null default now(),
  status_by text not null default 'scan', -- phone | mac | scan
  customer_id uuid,                        -- אחרי "פתח כלקוח באפליקציה"
  last_activity timestamptz,
  scanned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table app2.wa_leads enable row level security;
drop policy if exists own_wa_leads on app2.wa_leads;
create policy own_wa_leads on app2.wa_leads for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, update on app2.wa_leads to authenticated;

create or replace function public._wa_owner(p_secret text) returns uuid language sql security definer set search_path = app2, pg_temp as $$
  select owner from app2.scan_writer where secret_sha256 = encode(sha256(convert_to(coalesce(p_secret, ''), 'UTF8')), 'hex')
$$;
revoke all on function public._wa_owner(text) from public, anon, authenticated;

-- הסריקה: תוכן הליד. סטטוס נכתב רק אם הסריקה זיהתה משהו (p_rows[i].status) והוא חדש יותר ממה שבענן,
-- או שאף אחד עוד לא סימן כלום (new מהסריקה) — כך הצעה שנשלחה לפני שהליד הגיע לענן עדיין נקלטת.
create or replace function public.upsert_wa_leads(p_secret text, p_rows jsonb)
returns int language plpgsql security definer set search_path = app2, pg_temp as $$
declare v_owner uuid := public._wa_owner(p_secret); r jsonb; n int := 0;
begin
  if v_owner is null then raise exception 'not allowed' using errcode = '42501'; end if;
  if jsonb_typeof(p_rows) <> 'array' or length(p_rows::text) > 5000000 then raise exception 'bad payload'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    insert into app2.wa_leads as w (jid, user_id, name, phone, summary, data, media, last_activity, scanned_at, status, status_at, status_by)
    values (r->>'jid', v_owner, r->>'name', r->>'phone', r->>'summary', coalesce(r->'data', '{}'), coalesce(r->'media', '[]'),
            (r->>'last_activity')::timestamptz, now(), coalesce(r->>'status', 'new'), coalesce((r->>'status_at')::timestamptz, now()), 'scan')
    on conflict (jid) do update set name = excluded.name, phone = excluded.phone, summary = excluded.summary, data = w.data || excluded.data,   -- מיזוג: הודעות משיחה שלא נסרקה עכשיו נשמרות
      media = case when jsonb_array_length(excluded.media) > 0 then excluded.media else w.media end,
      last_activity = excluded.last_activity, scanned_at = now(), updated_at = now(),
      status = case when r ? 'status' and (excluded.status_at > w.status_at or (w.status = 'new' and w.status_by = 'scan')) then excluded.status else w.status end,
      status_by = case when r ? 'status' and (excluded.status_at > w.status_at or (w.status = 'new' and w.status_by = 'scan')) then 'scan' else w.status_by end,
      status_at = case when r ? 'status' and (excluded.status_at > w.status_at or (w.status = 'new' and w.status_by = 'scan')) then excluded.status_at else w.status_at end
    where w.user_id = v_owner;
    n := n + 1;
  end loop;
  return n;
end $$;

-- הדשבורד במק: סימון סטטוס (מיידי לטלפון)
create or replace function public.set_wa_lead_status(p_secret text, p_jid text, p_status text)
returns timestamptz language plpgsql security definer set search_path = app2, pg_temp as $$
declare v_owner uuid := public._wa_owner(p_secret); v_at timestamptz := now();
begin
  if v_owner is null then raise exception 'not allowed' using errcode = '42501'; end if;
  update app2.wa_leads set status = p_status, status_at = v_at, status_by = 'mac', updated_at = v_at where jid = p_jid and user_id = v_owner;
  return v_at;
end $$;

-- הדשבורד במק והסריקה: מה סומן (גם בטלפון)
create or replace function public.get_wa_lead_statuses(p_secret text)
returns table (jid text, status text, status_at timestamptz, status_by text, customer_id uuid)
language plpgsql security definer set search_path = app2, pg_temp as $$
declare v_owner uuid := public._wa_owner(p_secret);
begin
  if v_owner is null then raise exception 'not allowed' using errcode = '42501'; end if;
  return query select w.jid, w.status, w.status_at, w.status_by, w.customer_id from app2.wa_leads w where w.user_id = v_owner and w.deleted_at is null;
end $$;

revoke all on function public.upsert_wa_leads(text, jsonb) from public;
revoke all on function public.set_wa_lead_status(text, text, text) from public;
revoke all on function public.get_wa_lead_statuses(text) from public;
grant execute on function public.upsert_wa_leads(text, jsonb) to anon, authenticated;
grant execute on function public.set_wa_lead_status(text, text, text) to anon, authenticated;
grant execute on function public.get_wa_lead_statuses(text) to anon, authenticated;

-- המק צריך את מזהה-הבעלים לנתיב התמונות (<owner>/wa/...)
create or replace function public.wa_owner_id(p_secret text) returns uuid language sql security definer set search_path = app2, pg_temp as $$ select public._wa_owner(p_secret) $$;
revoke all on function public.wa_owner_id(text) from public;
grant execute on function public.wa_owner_id(text) to anon, authenticated;
