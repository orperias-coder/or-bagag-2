-- גל 2 א': ממצאים בביקור, תיוג תמונות, פרופיל גג, ספירת-שימוש (כדי לדעת מה להוריד אחרי חודש)
alter table app2.jobs add column if not exists findings jsonb not null default '[]';        -- [{id,title,description,qty,unit,price_per_unit,media_id,catalog_id,at}]
alter table app2.media add column if not exists tag text;                                   -- roof / outside / interior
alter table app2.customers add column if not exists roof jsonb;                             -- {tiles,access,slope,floors,notes}
create table if not exists app2.usage (user_id uuid not null default auth.uid(), device text not null, key text not null, day date not null, count int not null default 0, primary key (user_id, device, key, day));
alter table app2.usage enable row level security;
drop policy if exists own_usage on app2.usage; create policy own_usage on app2.usage for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant all on app2.usage to authenticated;
notify pgrst, 'reload schema';
