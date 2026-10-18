-- 18.10.2026: תמונות/סרטונים של לידי-וואטסאפ — הכלי במק מעלה ל-app2-media/<owner>/wa/<jid>/<file>.
-- אין לו התחברות; ההרשאה היא הקוד הסודי בכותרת x-wa-secret (שירות-האחסון מעביר כותרות ל-request.headers).
-- הקריאה בטלפון — דרך המדיניות הקיימת app2_media_own (התיקייה הראשונה = מזהה המשתמש).
create or replace function public._wa_upload_ok(p_name text) returns boolean language sql stable security definer set search_path = app2, pg_temp as $$
  select coalesce((storage.foldername(p_name))[1] = public._wa_owner(current_setting('request.headers', true)::json->>'x-wa-secret')::text
                  and (storage.foldername(p_name))[2] = 'wa', false)
$$;
grant execute on function public._wa_upload_ok(text) to anon;
drop policy if exists wa_mac_upload on storage.objects;
create policy wa_mac_upload on storage.objects for insert to anon with check (bucket_id = 'app2-media' and public._wa_upload_ok(name));
drop policy if exists wa_mac_upsert on storage.objects;
create policy wa_mac_upsert on storage.objects for update to anon using (bucket_id = 'app2-media' and public._wa_upload_ok(name)) with check (bucket_id = 'app2-media' and public._wa_upload_ok(name));
drop policy if exists wa_mac_select on storage.objects;
create policy wa_mac_select on storage.objects for select to anon using (bucket_id = 'app2-media' and public._wa_upload_ok(name));
