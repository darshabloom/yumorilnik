import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const eventId="3f6fa4d1-aaca-4326-9c01-5774cffca2f5";
function db(){const url=process.env.SUPABASE_URL??process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SECRET_KEY??process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw Error("Unavailable");return createClient(url,key,{auth:{persistSession:false}})}
const reply=(data:object,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}});
export async function POST(req:NextRequest){
 let input:unknown;try{input=await req.json()}catch{return reply({error:"Invalid request"},400)}
 const code=typeof (input as {code?:unknown})?.code==="string"?(input as {code:string}).code.trim().toUpperCase():"";
 if(code.length<6||code.length>64)return reply({error:"Invalid access code"},400);
 try{
  const client=db();
  const {data:valid,error}=await client.rpc("is_performer_access_valid",{p_event_id:eventId,p_code:code});
  if(error)return reply({error:"Access code validation unavailable"},503);
  if(valid!==true)return reply({error:"Access code not recognised"},422);
  const {data:restricted,error:readError}=await client.from("performer_table_access").select("table_id").eq("event_id",eventId);
  if(readError)return reply({error:"Restricted tables unavailable"},503);
  const ids=(restricted??[]).map(x=>x.table_id);
  const {data:tables,error:te}=await client.from("seating_tables").select("id,label,shape,x,y,width,height,rotation_deg,seats_top,seats_bottom,seats_left,seats_right,table_price_cents,seat_price_cents,price_zone_id,is_active,seat_gap_top,seat_gap_right,seat_gap_bottom,seat_gap_left").eq("event_id",eventId).in("id",ids.length?ids:["00000000-0000-0000-0000-000000000000"]).eq("is_active",true);
  if(te)return reply({error:"Restricted tables unavailable"},503);
  if(!tables?.length)return reply({error:"The access code is valid, but no reserved tables are active. Please ask the organiser to activate Tables 22 and 23 in the seating editor."},422);
  return reply({valid:true,tables});
 }catch{return reply({error:"Access service unavailable"},503)}
}