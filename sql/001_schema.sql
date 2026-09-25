-- אור בגג 2 — סכימה חדשה, נפרדת מהאפליקציה הישנה (שכותבת ל-public.sync_records ולא נוגעים בה).
-- עקרונות: הענן הוא האמת · שום דבר לא נמחק (deleted_at = סל מיחזור) · כל שינוי בהצעה = גרסה · יומן-אירועים לכל דבר.
create schema if not exists app2;

create table if not exists app2.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  phone text, address text, email text, notes text,
  source text,                      -- מאיפה הגיע (וואטסאפ / טלפון / מדרג / ישן)
  legacy_id text,                   -- המזהה באפליקציה הישנה (לייבוא, למניעת כפילות)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- עבודה אצל לקוח = דבר אחד בשלבים: lead → visit → quote → sent → approved → doing → paid
create table if not exists app2.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  customer_id uuid not null references app2.customers(id),
  title text,
  stage text not null default 'lead' check (stage in ('lead','visit','quote','sent','approved','doing','paid','lost')),
  stage_changed_at timestamptz not null default now(),
  problem text,                     -- תיאור הבעיה מהפנייה
  visit_at timestamptz,             -- מועד הביקור
  visit_notes text,                 -- הערות ומטראז'ים מהביקור
  quote_sent_at timestamptz,        -- "נשלחה" — מכאן סופרים ימים
  reminder_dismissed_until timestamptz,
  approved_at timestamptz, started_at timestamptz, finished_at timestamptz, paid_at timestamptz,
  price_agreed numeric,             -- הסכום שסוכם (מההצעה שאושרה)
  legacy_id text, legacy_kind text, -- lead/visit/project בישנה
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists app2.quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  job_id uuid not null references app2.jobs(id),
  number text,                      -- 2026-029
  version int not null default 1,   -- כל שמירה אחרי "נשלחה" = גרסה חדשה (הישנה נשמרת ב-quote_versions)
  status text not null default 'draft' check (status in ('draft','sent','accepted','rejected')),
  items jsonb not null default '[]',        -- [{title, description, qty, unit, price_per_unit, total, urgency}]
  discount jsonb,                            -- {type, value}
  vat_rate numeric not null default 18,
  validity_days int not null default 30,
  payment_terms text, notes text,
  options jsonb not null default '{}',       -- אילו חלקים להציג ב-PDF
  total_before_vat numeric, total numeric,
  sent_at timestamptz,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists app2.quote_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  quote_id uuid not null references app2.quotes(id),
  version int not null,
  snapshot jsonb not null,          -- ההצעה כפי שהייתה
  created_at timestamptz not null default now()
);

create table if not exists app2.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  job_id uuid not null references app2.jobs(id),
  amount numeric not null,
  paid_at date not null default current_date,
  method text, note text,
  invoice_issued boolean not null default false,   -- הוצאה חשבונית בחשבונית-ירוקה?
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists app2.media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  job_id uuid references app2.jobs(id),
  customer_id uuid references app2.customers(id),
  kind text not null default 'photo' check (kind in ('photo','video','sketch','doc')),
  storage_path text,                -- נתיב ב-Storage (bucket app2-media)
  thumb_data text,                  -- תמונה מוקטנת (base64 קטן) לתצוגה מהירה
  taken_at timestamptz, caption text,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- יומן-אירועים: כל יצירה/שינוי/מחיקה/שחזור — מי, מתי, מאיזה מכשיר, מה השתנה
create table if not exists app2.events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid(),
  at timestamptz not null default now(),
  device text,
  entity text not null, entity_id uuid not null,
  action text not null,             -- create/update/delete/restore/stage/sent
  diff jsonb
);

-- הגדרות העסק (פרטי העסק, תבנית הצעה, מונה מספרי-הצעות)
create table if not exists app2.settings (
  user_id uuid primary key default auth.uid(),
  business jsonb not null default '{}',
  quote_template jsonb not null default '{}',
  next_quote_number int not null default 1,
  quote_year int not null default extract(year from now())::int,
  catalog jsonb not null default '[]',      -- הקטלוג/מחירון
  updated_at timestamptz not null default now()
);

-- updated_at אוטומטי
create or replace function app2.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['customers','jobs','quotes','payments','media','settings'] loop
    execute format('drop trigger if exists touch_%1$s on app2.%1$s; create trigger touch_%1$s before update on app2.%1$s for each row execute function app2.touch_updated_at()', t);
  end loop; end $$;

-- מספר-הצעה אטומי: 2026-029 (מונה מתאפס בשנה חדשה)
create or replace function app2.next_quote_number() returns text language plpgsql security definer as $$
declare y int := extract(year from now())::int; n int; begin
  insert into app2.settings(user_id) values (auth.uid()) on conflict do nothing;
  update app2.settings set next_quote_number = case when quote_year = y then next_quote_number + 1 else 2 end,
      quote_year = y where user_id = auth.uid() returning case when quote_year = y then next_quote_number - 1 else 1 end into n;
  return y || '-' || lpad(n::text, 3, '0');
end $$;

-- הרשאות: כל טבלה — רק הבעלים (auth.uid()) רואה ומשנה
do $$ declare t text; begin
  foreach t in array array['customers','jobs','quotes','quote_versions','payments','media','events','settings'] loop
    execute format('alter table app2.%1$s enable row level security', t);
    execute format('drop policy if exists own_%1$s on app2.%1$s; create policy own_%1$s on app2.%1$s for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop; end $$;
grant usage on schema app2 to authenticated;
grant all on all tables in schema app2 to authenticated;
grant usage, select on all sequences in schema app2 to authenticated;
grant execute on function app2.next_quote_number() to authenticated;

-- לחשוף את הסכימה ל-API (PostgREST)
alter role authenticator set pgrst.db_schemas = 'public, app2';
notify pgrst, 'reload config';

-- אחסון תמונות
insert into storage.buckets (id, name, public) values ('app2-media', 'app2-media', false) on conflict do nothing;
drop policy if exists app2_media_own on storage.objects;
create policy app2_media_own on storage.objects for all to authenticated
  using (bucket_id = 'app2-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'app2-media' and (storage.foldername(name))[1] = auth.uid()::text);
