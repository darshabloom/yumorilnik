import {NextRequest,NextResponse} from "next/server";
import {liveServices,NYE_EVENT_ID} from "@/lib/stripeLiveCheckout";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(req:NextRequest){
 let data:unknown;
 try{data=await req.json()}catch{return reply({error:"Invalid request"},400)}
 if(!data||typeof data!=="object")return reply({error:"Invalid request"},400);
 const selected=(data as {seat_keys?:unknown}).seat_keys;
 if(!Array.isArray(selected)||selected.length>20||selected.some(k=>typeof k!=="string"||k.length>120))
  return reply({error:"Invalid seating selection"},400);
 if(selected.length===0)return reply({discount_cents:0,discount_type:null,quote_only:true});
 const ids=selected.map((key:string)=>key.split(":")[0]);
 if(ids.some((id:string)=>!uuid.test(id))||new Set(selected).size!==selected.length)
  return reply({error:"Invalid seating selection"},400);
 try{
  const {db}=liveServices();
  const {data:tables,error}=await db.from("seating_tables")
    .select("id,seat_price_cents,is_active,seats_top,seats_bottom,seats_left,seats_right")
    .eq("event_id",NYE_EVENT_ID).in("id",Array.from(new Set(ids))).eq("is_active",true);
  if(error||!tables||tables.length!==new Set(ids).size)
   return reply({error:"Unavailable table"},409);
  const lookup=new Map(tables.map(t=>[t.id,t]));
  const prices:number[]=[];
  for(const key of selected as string[]){
   const parts=key.split(":");
   if(parts.length!==2||!/^\d+$/.test(parts[1]))return reply({error:"Invalid seat"},400);
   const table=lookup.get(parts[0]);
   if(!table||!Number.isSafeInteger(table.seat_price_cents)||table.seat_price_cents<0)
    return reply({error:"Seat price unavailable"},409);
   const seat=Number(parts[1]);
   const count=(table.seats_top??0)+(table.seats_bottom??0)+(table.seats_left??0)+(table.seats_right??0);
   if(seat<1||seat>count)return reply({error:"Invalid seat"},400);
   prices.push(table.seat_price_cents);
  }
  const {data:quote,error:quoteError}=await db.rpc("quote_nye_automatic_discount",{
    p_event_id:NYE_EVENT_ID,p_adult_seat_prices_cents:prices
  });
  if(quoteError||!quote)return reply({error:"Discount quotation unavailable"},503);
  return reply({...quote,quote_only:true});
 }catch{return reply({error:"Discount quotation unavailable"},503)}
}
