import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import BookingExperience from "@/components/BookingExperience";

export default async function BookEvent({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{live_test?:string}>}){
 const {slug}=await params;
 const {live_test}=await searchParams;
 const {data:event,error}=await supabaseServer.from("events")
   .select("id,slug,title,title_en,image_url,booking_image_url,booking_image_fit,booking_image_position_x,booking_image_position_y,banner_fit,seating_mode,table_booking_mode,adult_seat_required,pricing_model,child_unseated_price_cents,is_active")
   .eq("slug",slug).eq("is_active",true).maybeSingle();
 if(error)throw new Error("Unable to load event.");
 if(!event)notFound();
 const {data:tickets,error:ticketError}=await supabaseServer.from("ticket_types")
   .select("id,name,description,price_cents,currency,quantity_total,quantity_sold,show_remaining")
   .eq("event_id",event.id).eq("is_active",true).order("price_cents",{ascending:false});
 if(ticketError)throw new Error("Unable to load ticket types.");
 const [tableResult,featureResult,mapResult,zoneResult]=await Promise.all([
   supabaseServer.from("seating_tables").select("id,label,shape,x,y,width,height,rotation_deg,seats_top,seats_bottom,seats_left,seats_right,table_price_cents,seat_price_cents,price_zone_id,is_active,seat_gap_top,seat_gap_right,seat_gap_bottom,seat_gap_left").eq("event_id",event.id).eq("is_active",true),
   supabaseServer.from("seating_features").select("id,event_id,kind,label,points").eq("event_id",event.id),
   supabaseServer.from("event_seating_maps").select("stage_x,stage_y,stage_width,stage_height,stage_rotation").eq("event_id",event.id).maybeSingle(),
   supabaseServer.from("event_price_zones").select("id,event_id,name,price_cents,color,x,y,width,height,sort_order,points").eq("event_id",event.id).order("sort_order")
 ]);
 if(tableResult.error||featureResult.error||mapResult.error||zoneResult.error)throw new Error("Unable to load venue layout.");
 return <BookingExperience event={event} tickets={tickets??[]}
  privateLiveTest={process.env.VERCEL_ENV==="production"&&process.env.LIVE_PAYMENT_TEST_ENABLED==="true"&&live_test==="1"&&event.id==="3f6fa4d1-aaca-4326-9c01-5774cffca2f5"}
  venue={{zones:zoneResult.data??[],tables:tableResult.data??[],features:(featureResult.data??[]) as import("@/components/VenueLines").VenueFeature[],stage:mapResult.data}}/>;
}
