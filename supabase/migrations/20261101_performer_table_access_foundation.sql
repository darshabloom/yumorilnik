-- Shared performer access, isolated from discount codes.
-- Run in Yumorilnik Supabase (vzzabkviwyarrdkevqco).
-- Tables remain active; their visibility is governed by this restricted list.
CREATE TABLE IF NOT EXISTS public.performer_table_access (
 event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
 table_id uuid NOT NULL REFERENCES public.seating_tables(id) ON DELETE CASCADE,
 PRIMARY KEY(event_id,table_id)
);
CREATE TABLE IF NOT EXISTS public.performer_access_settings (
 event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
 code_hash text NOT NULL,
 enabled boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.performer_table_access, public.performer_access_settings FROM PUBLIC,anon,authenticated;
ALTER TABLE public.performer_table_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performer_access_settings ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.is_performer_access_valid(p_event_id uuid,p_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT EXISTS(SELECT 1 FROM public.performer_access_settings a
 WHERE a.event_id=p_event_id AND a.enabled AND a.code_hash=encode(extensions.digest(upper(btrim(coalesce(p_code,''))),'sha256'),'hex'));
$$;
REVOKE ALL ON FUNCTION public.is_performer_access_valid(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.is_performer_access_valid(uuid,text) TO service_role;
-- No access rights are granted to shoppers by these tables. The server must
-- validate at checkout, not just while rendering the seating map.
