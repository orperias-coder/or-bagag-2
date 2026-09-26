# אור בגג 2 — המערכת החדשה (בנייה מחדש, 25.09.2026)
מוביל: Claude (הכרעת אור 25.09; קודקס לא בתמונה). המסמך המאושר: https://claude.ai/artifact/Qox8f5ataUPDJNzvVXjbv9
- קבצים: index.html + app.js + style.css + sw.js (בלי build). ענן: Supabase פרויקט Or-Bagag, **סכימת app2** (הישנה ב-public.sync_records — לא נוגעים).
- SQL: sql/*.sql מורצים עם `supabase db query --linked -f` (הפרויקט מקושר). ייבוא: import/import_backup.py (אידמפוטנטי לפי legacy_id).
- בדיקות: `OB2_PW_FILE=<קובץ-סיסמת-משתמש-הבדיקה> node tests/e2e.js && node tests/scenarios.js` על `python3 -m http.server 8746`. משתמש-בדיקה: app2test@example.com (למחיקה בסיום).
- חוקים: שום מחיקה (deleted_at); דיפלוי רק באישור מפורש; כל טענה "בדקתי"/"השערה"; באג — לדווח מיד.
- מזהה-המשתמש של אור: 2f8efb6f-3f81-4f1a-b7f9-c654bb4c0667.
