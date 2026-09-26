-- תיקוני ביקורת גל ב'
alter table app2.settings add column if not exists workers jsonb not null default '[]';   -- עובדים/קבלני משנה (לא היה — השמירה נדחתה)
-- כפילויות שנוצרו באישור מקביל (נתוני-בדיקה): הכפול עובר לסל, הראשון נשאר
update app2.tasks t set deleted_at = now()
 where t.item_id is not null and t.deleted_at is null
   and exists (select 1 from app2.tasks o where o.user_id = t.user_id and o.job_id = t.job_id and o.item_id = t.item_id and o.deleted_at is null and o.created_at < t.created_at);
-- משימה אחת לכל סעיף גם כששני מכשירים מאשרים במקביל: ייחודיות על (job_id, item_id)
create unique index if not exists tasks_job_item_uq on app2.tasks (user_id, job_id, item_id) where item_id is not null and deleted_at is null;
