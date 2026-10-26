\set ON_ERROR_STOP on
-- This runs in the isolated PostgreSQL fixture, never in the live database.
-- The earlier booking smoke leaves an active requested booking with 1 adult.
do $body$
begin
 if (select count(*) from public.marketing_contacts)<>0
 then raise exception 'Marketing contacts must start empty: no automatic import';end if;
end;
$body$;

set role anon;
-- Wrong booking secrets cannot add arbitrary contacts.
select public.marketing_opt_in('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,0) as invalid_optin;
select public.marketing_opt_in('88888888-8888-4888-8888-888888888888'::uuid,1) as invalid_child;
-- Only an affirmative extra call for an adult signs them up.
select public.marketing_opt_in('88888888-8888-4888-8888-888888888888'::uuid,0) as opted_in;
do $body$
declare denied boolean:=false;
begin
 begin perform count(*) from public.marketing_contacts;
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'SECURITY: anon can directly read marketing PII';end if;
end;
$body$;
reset role;

do $body$
begin
 if (select count(*) from public.marketing_contacts)<>1
 then raise exception 'Opt-in did not create exactly one contact';end if;
 if (select status from public.marketing_contacts limit 1)<>'subscribed'
 then raise exception 'New opted-in contact is not subscribed';end if;
 if (select consent_source from public.marketing_contacts limit 1)<>'booking_request_checkbox'
 then raise exception 'Missing consent provenance';end if;
end;
$body$;

-- Repeated opt-in does not duplicate the address.
set role anon;
select public.marketing_opt_in('88888888-8888-4888-8888-888888888888'::uuid,0) as repeated_optin;
reset role;
do $body$
begin
 if (select count(*) from public.marketing_contacts)<>1
 then raise exception 'Repeated opt-in created a duplicate';end if;
end;
$body$;

-- Unsubscribe is possible using an unguessable link token, without login.
select unsubscribe_token as token from public.marketing_contacts limit 1 \gset
set role anon;
select public.marketing_unsubscribe(:'token'::uuid) as unsubscribe_success;
reset role;
do $body$
begin
 if (select status from public.marketing_contacts limit 1)<>'unsubscribed'
 then raise exception 'Public unsubscribe did not revoke consent';end if;
end;
$body$;
set role anon;
select public.marketing_opt_in('88888888-8888-4888-8888-888888888888'::uuid,0) as blocked_resubscribe;
reset role;
do $body$
begin
 if (select status from public.marketing_contacts limit 1)<>'unsubscribed'
 then raise exception 'SECURITY: normal booking re-subscribed an opted-out email';end if;
end;
$body$;

-- Create a separate, valid adult request to check authorised admin unsubscribe.
set role anon;
select public.submit_booking(
 '11111111-1111-4111-8111-111111111111'::uuid,
 '99999999-9999-4999-8999-999999999999'::uuid,
 '[{"ticket_type_id":"22222222-2222-4222-8222-222222222222","quantity":1}]'::jsonb,
 '[{"name":"Another Adult","email":"another@example.com","phone":"021654321"}]'::jsonb,
 '[{"table_id":"44444444-4444-4444-8444-444444444444","seat_number":4,"guest_index":0}]'::jsonb
) as second_booking;
select public.marketing_opt_in('99999999-9999-4999-8999-999999999999'::uuid,0) as second_optin;
reset role;

select id as marketing_contact_id from public.marketing_contacts where email='another@example.com' \gset
select set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666666',false);
set role authenticated;
do $body$
begin
 if (select count(*) from public.marketing_contacts)<>2 then
 raise exception 'Authorised admin cannot see contact list';end if;
end;
$body$;
select public.marketing_admin_unsubscribe(:'marketing_contact_id'::uuid) as admin_unsubscribed;
reset role;
do $body$
begin
 if (select status from public.marketing_contacts where email='another@example.com')<>'unsubscribed'
 then raise exception 'Admin could not unsubscribe contact';end if;
end;
$body$;
select 'marketing consent and unsubscribe contract passed' as result;
