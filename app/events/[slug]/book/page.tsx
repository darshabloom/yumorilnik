import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import BookingExperience from "@/components/BookingExperience";

export default async function BookEvent({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 const {data:event,error}=await supabaseServer.from("events")
   .select("id,slug,title,image_url,banner_fit,seating_mode,table_booking_mode,is_active")
   .eq("slug",slug).eq("is_active",true).maybeSingle();
 if(error)throw new Error("Unable to load event.");
 if(!event)notFound();
 const {data:tickets,error:ticketError}=await supabaseServer.from("ticket_types")
   .select("id,name,description,price_cents,currency,quantity_total,quantity_sold,show_remaining")
   .eq("event_id",event.id).eq("is_active",true).order("price_cents",{ascending:false});
 if(ticketError)throw new Error("Unable to load ticket types.");
 const [tableResult,featureResult,mapResult]=await Promise.all([
   supabaseServer.from("seating_tables").select("id,label,x,y,width,height,rotation_deg,seats_top,seats_bottom,seats_left,seats_right,table_price_cents,is_active").eq("event_id",event.id).eq("is_active",true),
   supabaseServer.from("seating_features").select("id,event_id,kind,label,points").eq("event_id",event.id),
   supabaseServer.from("event_seating_maps").select("stage_x,stage_y,stage_width,stage_height,stage_rotation").eq("event_id",event.id).maybeSingle()
 ]);
 if(tableResult.error||featureResult.error||mapResult.error)throw new Error("Unable to load venue layout.");
 return <BookingExperience event={event} tickets={tickets??[]} venue={{tables:tableResult.data??[],features:(featureResult.data??[]) as import("@/components/VenueLines").VenueFeature[],stage:mapResult.data}}/>;
}
