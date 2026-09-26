-- תיקון קריטי מביקורת גל א': ממצאים כשורות נפרדות (לא מערך על העבודה) — שני מכשירים לא דורסים זה את זה
create table if not exists app2.findings (
  id uuid primary key,
  user_id uuid not null default auth.uid(),
  job_id uuid not null references app2.jobs(id),
  title text not null,
  description text,
  qty numeric not null default 1,
  unit text,
  price_per_unit numeric not null default 0,
  media_id uuid,
  catalog_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table app2.findings enable row level security;
drop policy if exists own_findings on app2.findings;
create policy own_findings on app2.findings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant all on app2.findings to authenticated;
