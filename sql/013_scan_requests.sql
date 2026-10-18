-- 19.10.2026, בקשת אור: "רענון לכלי הוואטסאפ ישירות מהאפליקציה".
-- הטלפון רושם בקשה; השרת במק בודק כל 20 שניות (עם הקוד הסודי), מריץ סריקה ומעדכן את התוצאה.
create table if not exists app2.scan_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  requested_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','running','done','failed')),
  started_at timestamptz,
  finished_at timestamptz,
  message text
);
alter table app2.scan_requests enable row level security;
drop policy if exists own_scan_requests on app2.scan_requests;
create policy own_scan_requests on app2.scan_requests for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert on app2.scan_requests to authenticated;

-- המק: לוקח את הבקשה הממתינה הוותיקה (ומסמן running). בקשות כפולות שממתינות נבלעות באותה ריצה.
create or replace function public.claim_scan_request(p_secret text) returns uuid language plpgsql security definer set search_path = app2, pg_temp as $$
declare v_owner uuid := public._wa_owner(p_secret); v_id uuid;
begin
  if v_owner is null then raise exception 'not allowed' using errcode = '42501'; end if;
  select id into v_id from app2.scan_requests where user_id = v_owner and status = 'pending' order by requested_at limit 1 for update skip locked;
  if v_id is null then return null; end if;
  update app2.scan_requests set status = 'running', started_at = now() where user_id = v_owner and status = 'pending' and requested_at <= (select requested_at from app2.scan_requests where id = v_id);
  return v_id;
end $$;

create or replace function public.finish_scan_request(p_secret text, p_id uuid, p_status text, p_message text) returns void language plpgsql security definer set search_path = app2, pg_temp as $$
declare v_owner uuid := public._wa_owner(p_secret);
begin
  if v_owner is null then raise exception 'not allowed' using errcode = '42501'; end if;
  update app2.scan_requests set status = p_status, finished_at = now(), message = left(p_message, 500)
  where user_id = v_owner and status = 'running' and started_at <= (select started_at from app2.scan_requests where id = p_id);
end $$;

revoke all on function public.claim_scan_request(text) from public;
revoke all on function public.finish_scan_request(text, uuid, text, text) from public;
grant execute on function public.claim_scan_request(text) to anon, authenticated;
grant execute on function public.finish_scan_request(text, uuid, text, text) to anon, authenticated;
