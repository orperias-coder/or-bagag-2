-- גל 2 ב': ביצוע וסגירה
alter table app2.jobs add column if not exists work_days int;
alter table app2.jobs add column if not exists work_notes text;
alter table app2.jobs add column if not exists warranty_months int;
alter table app2.quotes add column if not exists addon boolean not null default false;   -- "תוספת" באמצע העבודה
create table if not exists app2.expenses (
  id uuid primary key,
  user_id uuid not null default auth.uid(),
  job_id uuid not null references app2.jobs(id),
  kind text not null default 'material',   -- material / sub / worker / other
  title text,
  amount numeric not null default 0,
  worker text,
  days numeric,
  receipt boolean not null default false,  -- התקבלה חשבונית/קבלה
  spent_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table app2.expenses enable row level security;
drop policy if exists own_expenses on app2.expenses;
create policy own_expenses on app2.expenses for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant all on app2.expenses to authenticated;
