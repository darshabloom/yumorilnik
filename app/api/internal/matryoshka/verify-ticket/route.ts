import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {timingSafeEqual} from "node:crypto";
import {verifyFoodOrderToken,YUMORILNIK_NYE_EVENT_ID} from "@/lib/matryoshkaTicketLink";
export const runtime="nodejs";export const dynamic="force-dynamic";
const json=(x:unknown,status=200)=>NextResponse.json(x,{status,headers:{"Cache-Control":"no-store","Pragma":"no-cache"}});
export async function POST(req:NextRequest){
 if(process.env.MATRYOSHKA_TICKET_LINK_ENABLED!=="true")return json({error:"Disabled"},503);
 const shared=process.env.MATRYOSHKA_API_SHARED_SECRET,header=req.headers.get("authorization")||"";
 const actual=Buffer.from(header),expected=Buffer.from("Bearer "+(shared||""));
 if(!shared||shared.length<32||actual.length!==expected.length||!timingSafeEqual(actual,expected))return json({error:"Unauthorized"},401);
 let token="";try{const b=await req.json();if(typeof b.token==="string")token=b.token}catch{}
 const claim=verifyFoodOrderToken(token);if(!claim)return json({valid:false},200);
 const url=process.env.SUPABASE_URL??process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
 if(!url||!key||!url.includes("vzzabkviwyarrdkevqco.supabase.co"))return json({error:"Yumorilnik database unavailable"},503);
 const db=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data,error}=await db.from("bookings").select("id,event_id,status,booking_guests(guest_index,email,category,is_child_with_adult_seat)").eq("id",claim.bid).eq("event_id",YUMORILNIK_NYE_EVENT_ID).maybeSingle();
 if(error)return json({error:"Booking verification unavailable"},503);
 const guests=(data?.booking_guests??[]) as {email:string|null;category:string;is_child_with_adult_seat:boolean}[];
 const valid=Boolean(data?.status==="confirmed"&&guests.some(g=>g.category==="adult"&&!g.is_child_with_adult_seat&&g.email?.trim().toLowerCase()===claim.recipient));
 return json(valid?{valid:true,event:"novogodnik26",email:claim.recipient,referenceId:claim.bid}:{valid:false});
}
