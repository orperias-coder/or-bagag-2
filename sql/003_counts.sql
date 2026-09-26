-- ספירה לילית + התראה על ירידה (תרחיש 6: "שום דבר לא נעלם")
create table if not exists app2.daily_counts (day date, user_id uuid, customers int, jobs int, quotes int, payments int, media int, primary key (day, user_id));
create table if not exists app2.alerts (id uuid primary key default gen_random_uuid(), user_id uuid not null, at timestamptz default now(), kind text, message text, seen_at timestamptz);
alter table app2.alerts enable row level security;
drop policy if exists own_alerts on app2.alerts; create policy own_alerts on app2.alerts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table app2.daily_counts enable row level security;
drop policy if exists own_counts on app2.daily_counts; create policy own_counts on app2.daily_counts for select to authenticated using (user_id = auth.uid());
grant all on app2.alerts to authenticated; grant select on app2.daily_counts to authenticated;
create or replace function app2.snapshot_counts() returns void language plpgsql security definer set search_path = app2 as $$
declare u record; c record; prev record; begin
  for u in select distinct user_id from app2.customers loop
    select (select count(*) from app2.customers where user_id=u.user_id and deleted_at is null) customers,
           (select count(*) from app2.jobs where user_id=u.user_id and deleted_at is null) jobs,
           (select count(*) from app2.quotes where user_id=u.user_id and deleted_at is null) quotes,
           (select count(*) from app2.payments where user_id=u.user_id and deleted_at is null) payments,
           (select count(*) from app2.media where user_id=u.user_id and deleted_at is null) media into c;
    select * into prev from app2.daily_counts where user_id=u.user_id and day < current_date order by day desc limit 1;
    insert into app2.daily_counts values (current_date, u.user_id, c.customers, c.jobs, c.quotes, c.payments, c.media)
      on conflict (day,user_id) do update set customers=excluded.customers, jobs=excluded.jobs, quotes=excluded.quotes, payments=excluded.payments, media=excluded.media;
    if prev is not null and (c.customers < prev.customers or c.jobs < prev.jobs or c.quotes < prev.quotes) then
      insert into app2.alerts (user_id, kind, message) values (u.user_id, 'drop', format('ירידה במספרים מול הספירה הקודמת: לקוחות %s→%s, עבודות %s→%s, הצעות %s→%s. לבדוק בסל המיחזור.', prev.customers, c.customers, prev.jobs, c.jobs, prev.quotes, c.quotes));
    end if;
  end loop; end $$;
create extension if not exists pg_cron;
select cron.unschedule('app2-nightly-counts') where exists (select 1 from cron.job where jobname='app2-nightly-counts');
select cron.schedule('app2-nightly-counts', '30 0 * * *', $$select app2.snapshot_counts()$$);
select app2.snapshot_counts();
