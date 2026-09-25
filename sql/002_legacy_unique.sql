-- מפתח ייחודי ל-legacy_id (לכל משתמש) — כדי שייבוא חוזר יעדכן ולא יכפיל
create unique index if not exists customers_legacy_uq on app2.customers (user_id, legacy_id) where legacy_id is not null;
create unique index if not exists jobs_legacy_uq on app2.jobs (user_id, legacy_id) where legacy_id is not null;
create unique index if not exists quotes_legacy_uq on app2.quotes (user_id, legacy_id) where legacy_id is not null;
create unique index if not exists payments_legacy_uq on app2.payments (user_id, legacy_id) where legacy_id is not null;
create unique index if not exists media_legacy_uq on app2.media (user_id, legacy_id) where legacy_id is not null;
