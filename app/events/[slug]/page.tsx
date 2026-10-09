import { supabaseServer } from "@/lib/supabaseServer";
import EventPresentation from "@/components/EventPresentation";
import { notFound } from "next/navigation";

export default async function EventDetails({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 const {data,eventError:error}=await (async()=>{const result=await supabaseServer.from("events").select("slug,title,description,event_date,event_time,location,image_url,detail_image_url,banner_fit,banner_position_x,banner_position_y,detail_fit,detail_position_x,detail_position_y,is_active").eq("slug",slug).eq("is_active",true).maybeSingle();return {data:result.data,eventError:result.error};})();
 if(error)throw new Error("Unable to load event.");
 if(!data)notFound();
 return <main className="bg-[#fffaf1]"><EventPresentation event={data}/></main>;
}
