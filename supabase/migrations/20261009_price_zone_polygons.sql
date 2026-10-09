alter table public.event_price_zones add column if not exists points jsonb;
update public.event_price_zones set points=jsonb_build_array(
 jsonb_build_object('x',x,'y',y),
 jsonb_build_object('x',x+width,'y',y),
 jsonb_build_object('x',x+width,'y',y+height),
 jsonb_build_object('x',x,'y',y+height)
) where points is null;
alter table public.event_price_zones add constraint price_zone_polygon_valid check (
 points is null or (jsonb_typeof(points)='array' and jsonb_array_length(points)>=3)
);
