\set ON_ERROR_STOP on
-- Anonymous customer submits 2 adults and 2 children, 3 table-A places.
set role anon;
select public.submit_booking(
 '11111111-1111-4111-8111-111111111111'::uuid,
 '77777777-7777-4777-8777-777777777777'::uuid,
 '[{"ticket_type_id":"22222222-2222-4222-8222-222222222222","quantity":2},
   {"ticket_type_id":"33333333-3333-4333-8333-333333333333","quantity":2}]'::jsonb,
 '[{"name":"Parent One","email":"first@example.com","phone":"021123456"},
   {"name":"Parent Two","email":"second@example.com","phone":"021123457"},
   {"name":"Child One","parent_index":0},{"name":"Child Two","parent_index":1}]'::jsonb,
 '[{"table_id":"44444444-4444-4444-8444-444444444444","seat_number":1,"guest_index":0},
   {"table_id":"44444444-4444-4444-8444-444444444444","seat_number":2,"guest_index":1},
   {"table_id":"44444444-4444-4444-8444-444444444444","seat_number":3,"guest_index":2}]'::jsonb
) as result;
-- Anonymous access must never expose PII or cancellations directly.
do $body$
declare denied boolean:=false;
begin
 begin perform count(*) from public.bookings;
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'SECURITY: anon can read private booking rows';end if;
 denied:=false;
 begin perform public.cancel_booking('00000000-0000-4000-8000-000000000000'::uuid,null);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'SECURITY: anon can cancel bookings';end if;
end;
$body$;
reset role;

do $body$
begin
 if (select count(*) from public.bookings where client_request_id='77777777-7777-4777-8777-777777777777')<>1
 then raise exception 'Booking was not stored';end if;
 if (select total_cents from public.bookings where client_request_id='77777777-7777-4777-8777-777777777777')<>37500
 then raise exception 'Family total did not equal 37500';end if;
 if (select count(*) from public.booking_guests)<>4
 then raise exception 'Named guests were not stored';end if;
 if (select count(*) from public.booking_selections)<>3
 then raise exception 'Seat assignments were not stored';end if;
end;
$body$;

-- Idempotent retries return the original booking and do not double-write.
set role anon;
select public.submit_booking(
 '11111111-1111-4111-8111-111111111111'::uuid,
 '77777777-7777-4777-8777-777777777777'::uuid,
 '[]'::jsonb,'[]'::jsonb,'[]'::jsonb
) as idempotent_result;
-- Missing table price still allows a saved *request*, not a confirmed ticket.
select public.submit_booking(
 '11111111-1111-4111-8111-111111111111'::uuid,
 '88888888-8888-4888-8888-888888888888'::uuid,
 '[{"ticket_type_id":"22222222-2222-4222-8222-222222222222","quantity":1}]'::jsonb,
 '[{"name":"Pending Parent","email":"pending@example.com","phone":"021234567"}]'::jsonb,
 '[{"table_id":"55555555-5555-4555-8555-555555555555","seat_number":1,"guest_index":0}]'::jsonb
) as pending_result;
reset role;

do $body$
begin
 if (select count(*) from public.bookings)<>2
 then raise exception 'Idempotency produced duplicate requests';end if;
 if (select total_cents from public.bookings where client_request_id='88888888-8888-4888-8888-888888888888') is not null
 then raise exception 'Missing table price incorrectly became numeric';end if;
end;
$body$;

-- Correct admin JWT can inspect guests and cancel. Unrecognised users cannot.
select set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999999',false);
set role authenticated;
do $body$
begin
 if (select count(*) from public.bookings)<>0 then
 raise exception 'SECURITY: unrelated signed-in user can read bookings';end if;
end;
$body$;
reset role;

select set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666666',false);
select id as booking_to_cancel from public.bookings
 where client_request_id='77777777-7777-4777-8777-777777777777' \gset
set role authenticated;
do $body$
begin
 if (select count(*) from public.bookings)<>2 then
 raise exception 'Admin cannot read bookings';end if;
 if (select count(*) from public.booking_guests)<>5 then
 raise exception 'Admin cannot inspect named guests';end if;
end;
$body$;
select public.cancel_booking(:'booking_to_cancel'::uuid,'test cancellation') as cancelled;
reset role;
do $body$
begin
 if (select status from public.bookings where id=:'booking_to_cancel'::uuid)<>'cancelled'
 then raise exception 'Cancellation did not persist';end if;
 if (select count(*) from public.bookings)<>2 then
 raise exception 'Soft cancellation unexpectedly erased the audit record';end if;
end;
$body$;
select 'booking request database contract passed' as result;
