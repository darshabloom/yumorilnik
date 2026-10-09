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
 return <BookingExperience event={event} tickets={tickets??[]}/>;
}
