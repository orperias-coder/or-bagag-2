-- 16.11.2026, בקשת אור: "שהדשבורד יסרוק את החיבורים אחת ליום ויתריע לי בגדול מה צריך לעשות מבחינת
-- חשבוניות וקבלות". המק מריץ פעם ביום את accountant/docs_alert.py ושולח לכאן את רשימת החוסרים.
-- סוגים: income (נכנס כסף, אין חשבונית) · expense (חיוב עסקי בלי מסמך) · decide (עסקי או פרטי?) · source (חיבור נפל).
-- נראה רק לבעלים (RLS). תוספתי בלבד: טבלה חדשה + פונקציה חדשה. שום טבלה קיימת לא משתנה.
create table if not exists app2.doc_alerts (
  id text primary key,                       -- inc:/exp:/dec:/src: + מזהה יציב (אותו חוסר = אותה שורה בכל יום)
  user_id uuid not null,
  kind text not null check (kind in ('income', 'expense', 'decide', 'source')),
  happened date,
  amount numeric,
  who text,
  detail text,
  link text,                                 -- קישור לחידוש חיבור שנפל (Financy / מורנינג); ריק = אין
  link_label text,
  scanned_at timestamptz not null default now(),   -- הסריקה האחרונה שמצאה אותו
  gone_at timestamptz,                             -- הסריקה כבר לא מוצאת אותו (נסגר מעצמו: הוצאה חשבונית / נמצא מסמך)
  handled_at timestamptz,                          -- אור לחץ "טיפלתי" בלוח
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table app2.doc_alerts add column if not exists link text;
alter table app2.doc_alerts add column if not exists link_label text;
create index if not exists doc_alerts_open on app2.doc_alerts (user_id) where gone_at is null and handled_at is null;
alter table app2.doc_alerts enable row level security;
drop policy if exists own_doc_alerts on app2.doc_alerts;
create policy own_doc_alerts on app2.doc_alerts for select to authenticated using (user_id = auth.uid());
drop policy if exists own_doc_alerts_upd on app2.doc_alerts;
create policy own_doc_alerts_upd on app2.doc_alerts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select on app2.doc_alerts to authenticated;
grant update (handled_at, updated_at) on app2.doc_alerts to authenticated;   -- הלוח יכול רק לסמן "טיפלתי" / לבטל

-- מתי רצה הבדיקה האחרונה (כדי שהלוח יראה "הבדיקה לא רצה כבר X ימים" ולא ישתוק)
create table if not exists app2.doc_scan (
  user_id uuid primary key,
  scanned_at timestamptz not null default now(),
  counts jsonb
);
alter table app2.doc_scan enable row level security;
drop policy if exists own_doc_scan on app2.doc_scan;
create policy own_doc_scan on app2.doc_scan for select to authenticated using (user_id = auth.uid());
grant select on app2.doc_scan to authenticated;

create or replace function public.upsert_doc_alerts(p_secret text, p_items jsonb)
returns int language plpgsql security definer set search_path = app2, pg_temp as $$
declare v_owner uuid := public._wa_owner(p_secret); r jsonb; n int := 0; v_ids text[] := '{}';
begin
  if v_owner is null then raise exception 'not allowed' using errcode = '42501'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 2000 or length(p_items::text) > 1000000 then raise exception 'bad payload'; end if;
  for r in select * from jsonb_array_elements(p_items) loop
    if coalesce(r->>'id', '') = '' then continue; end if;
    v_ids := v_ids || (r->>'id');
    insert into app2.doc_alerts as a (id, user_id, kind, happened, amount, who, detail, link, link_label, scanned_at, gone_at, updated_at)
    values (r->>'id', v_owner, r->>'kind', (r->>'happened')::date, (r->>'amount')::numeric, r->>'who', r->>'detail',
            case when r->>'link' ~ '^https://' then r->>'link' end, r->>'link_label', now(), null, now())
    on conflict (id) do update set kind = excluded.kind, happened = excluded.happened, amount = excluded.amount, who = excluded.who,
      detail = excluded.detail, link = excluded.link, link_label = excluded.link_label, scanned_at = now(), gone_at = null, updated_at = now(),
      -- "טיפלתי" של אור נשאר — חוץ מחיבור שנפל: אם הסריקה של מחר עוד מוצאת אותו מנותק, הוא חוזר להופיע
      handled_at = case when excluded.kind = 'source' and a.handled_at < now() - interval '12 hours' then null else a.handled_at end
      where a.user_id = v_owner;
    if found then n := n + 1; end if;
  end loop;
  -- מה שהסריקה של היום כבר לא מוצאת — נסגר מעצמו
  update app2.doc_alerts set gone_at = now(), updated_at = now()
    where user_id = v_owner and gone_at is null and not (id = any (v_ids));
  insert into app2.doc_scan (user_id, scanned_at, counts)
    values (v_owner, now(), (select jsonb_object_agg(k, c) from (select x->>'kind' k, count(*) c from jsonb_array_elements(p_items) x group by 1) s))
    on conflict (user_id) do update set scanned_at = now(), counts = excluded.counts;
  return n;
end $$;
revoke all on function public.upsert_doc_alerts(text, jsonb) from public;
grant execute on function public.upsert_doc_alerts(text, jsonb) to anon, authenticated;
