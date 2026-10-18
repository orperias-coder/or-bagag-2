-- 18.10.2026, בקשת אור: סיכום סריקת-הוואטסאפ קופץ באפליקציה אחרי כל ריצה שלא ראה.
-- הכלי במק (whatsapp-leads) כותב דרך post_scan_digest עם קוד סודי ששמור רק במק (~/.config/orbagag/scan-secret);
-- ה-hash שלו בטבלה סגורה. האפליקציה רק קוראת ומסמנת "ראיתי". אין מחיקה: deleted_at בלבד.
create table if not exists app2.scan_digests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  scan_id text not null unique,          -- scanId של scan_summary.py (זמן-הריצה) — ריצה שנשלחת פעמיים לא מכפילה
  scanned_at timestamptz not null,
  prose text,                            -- הפסקה "במילים של קלוד"
  data jsonb not null,                   -- מטען scan_summary: ספירות + פריטים (שם, תקציר, מחכה, חום)
  seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table app2.scan_digests enable row level security;
drop policy if exists own_scan_digests on app2.scan_digests;
create policy own_scan_digests on app2.scan_digests for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, update on app2.scan_digests to authenticated;

-- טבלה סגורה: אין policy ואין grant — רק פונקציית security definer קוראת ממנה
create table if not exists app2.scan_writer (secret_sha256 text primary key, owner uuid not null);
alter table app2.scan_writer enable row level security;
revoke all on app2.scan_writer from anon, authenticated;

create or replace function app2.post_scan_digest(p_secret text, p_scan_id text, p_scanned_at timestamptz, p_prose text, p_data jsonb)
returns uuid language plpgsql security definer set search_path = app2, pg_temp as $$
declare v_owner uuid; v_id uuid;
begin
  select owner into v_owner from app2.scan_writer where secret_sha256 = encode(sha256(convert_to(coalesce(p_secret, ''), 'UTF8')), 'hex');
  if v_owner is null then raise exception 'not allowed' using errcode = '42501'; end if;
  if length(p_data::text) > 300000 or length(coalesce(p_prose, '')) > 5000 then raise exception 'too large'; end if;
  insert into app2.scan_digests (user_id, scan_id, scanned_at, prose, data)
  values (v_owner, p_scan_id, p_scanned_at, p_prose, p_data)
  on conflict (scan_id) do update set prose = excluded.prose, data = excluded.data, updated_at = now()
  returning id into v_id;
  return v_id;
end $$;
revoke all on function app2.post_scan_digest(text, text, timestamptz, text, jsonb) from public;
grant execute on function app2.post_scan_digest(text, text, timestamptz, text, jsonb) to anon, authenticated;
-- רישום הקוד (פעם אחת, מהמק, בלי לשמור את הקוד בקובץ הזה):
--   insert into app2.scan_writer values (encode(sha256(convert_to('<secret>','UTF8')),'hex'), '2f8efb6f-3f81-4f1a-b7f9-c654bb4c0667') on conflict do nothing;
