alter table public.events add column if not exists event_type text not null default 'internal';
alter table public.events add column if not exists external_url text;
alter table public.events add constraint events_event_type_check check (event_type in ('internal','external'));
alter table public.events add constraint events_external_url_check check (event_type='internal' or (external_url is not null and external_url ~ '^https://'));
