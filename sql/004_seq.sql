-- מספר-ההצעה הבא של אור: 2026-029 (028 קיימת בטלפון)
insert into app2.settings (user_id) values ('2f8efb6f-3f81-4f1a-b7f9-c654bb4c0667') on conflict do nothing;
update app2.settings set next_quote_number = greatest(next_quote_number, 29), quote_year = 2026 where user_id = '2f8efb6f-3f81-4f1a-b7f9-c654bb4c0667';
