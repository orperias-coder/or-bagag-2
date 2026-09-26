-- גל 2 ג': משימות חופשיות (וגם משימות-ביצוע מסעיפים בגל ב')
create table if not exists app2.tasks (
  id uuid primary key,
  user_id uuid not null default auth.uid(),
  title text not null,
  due date,
  job_id uuid references app2.jobs(id),
  item_id text,                       -- סעיף בהצעה שממנו נוצרה (גל ב')
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table app2.tasks enable row level security;
drop policy if exists own_tasks on app2.tasks;
create policy own_tasks on app2.tasks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant all on app2.tasks to authenticated;
