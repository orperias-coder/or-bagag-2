-- ניקוי נתוני-בדיקה של משתמש-הבדיקה בלבד (app2test@example.com). החריג היחיד לחוק "שום מחיקה" — לעולם לא על נתוני אור.
-- מזהה משתמש-הבדיקה: f234ee6d-c039-4976-a166-f8dd962e7a97. לקוחות-בדיקה: e2e* / ADV* / לידים שנוצרו בבדיקה (source וואטסאפ, טלפון 05233*)
create temp table tc as select id from app2.customers where user_id='f234ee6d-c039-4976-a166-f8dd962e7a97' and (name like 'e2e%' or name like 'ADV%' or legacy_id like 'e2e:%' or name like 'dbg%' or name like '%ADV%' or (source='וואטסאפ' and (name ~ '^0?5[0-9]{8}$' or name ~ '^05[0-9]{8}$')));
create temp table tj as select id from app2.jobs where user_id='f234ee6d-c039-4976-a166-f8dd962e7a97' and (title like 'e2e%' or title like 'ADV%' or customer_id in (select id from tc));
delete from app2.quote_versions where user_id='f234ee6d-c039-4976-a166-f8dd962e7a97' and quote_id in (select id from app2.quotes where user_id='f234ee6d-c039-4976-a166-f8dd962e7a97' and (legacy_id like 'e2e:%' or job_id in (select id from tj)));
delete from app2.quotes where user_id='f234ee6d-c039-4976-a166-f8dd962e7a97' and (legacy_id like 'e2e:%' or job_id in (select id from tj));
delete from app2.payments where user_id='f234ee6d-c039-4976-a166-f8dd962e7a97' and job_id in (select id from tj);
delete from app2.media where user_id='f234ee6d-c039-4976-a166-f8dd962e7a97' and job_id in (select id from tj);
delete from app2.tasks where user_id='f234ee6d-c039-4976-a166-f8dd962e7a97' and (job_id in (select id from tj) or title like 'e2e%' or title like 'ADV%');
delete from app2.findings where user_id='f234ee6d-c039-4976-a166-f8dd962e7a97' and job_id in (select id from tj);
delete from app2.expenses where user_id='f234ee6d-c039-4976-a166-f8dd962e7a97' and job_id in (select id from tj);
delete from app2.events where user_id='f234ee6d-c039-4976-a166-f8dd962e7a97' and entity_id in (select id from tj union select id from tc);
delete from app2.jobs where user_id='f234ee6d-c039-4976-a166-f8dd962e7a97' and id in (select id from tj);
delete from app2.customers where user_id='f234ee6d-c039-4976-a166-f8dd962e7a97' and id in (select id from tc);
delete from app2.alerts where user_id='f234ee6d-c039-4976-a166-f8dd962e7a97' and kind='test';
update app2.settings set workers='[]' where user_id='f234ee6d-c039-4976-a166-f8dd962e7a97';
select (select count(*) from app2.customers where user_id='f234ee6d-c039-4976-a166-f8dd962e7a97') customers_left, (select count(*) from app2.jobs where user_id='f234ee6d-c039-4976-a166-f8dd962e7a97') jobs_left, (select count(*) from app2.tasks where user_id='f234ee6d-c039-4976-a166-f8dd962e7a97') tasks_left;
