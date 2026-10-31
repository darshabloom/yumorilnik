import {NextRequest,NextResponse} from "next/server";
import {liveServices,NYE_EVENT_ID} from "@/lib/stripeLiveCheckout";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const respond=(body:object,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(req:NextRequest){
 let input:unknown;
 try{input=await req.json()}catch{return respond({error:"Invalid request"},400)}
 if(!input||typeof input!=="object")return respond({error:"Invalid request"},400);
 const body=input as {code?:unknown;event_id?:unknown;seat_keys?:unknown};
 const code=typeof body.code==="string"?body.code.trim().toUpperCase():"";
 if(!/^[A-Z0-9_-]{1,32}$/.test(code)||body.event_id!==NYE_EVENT_ID)return respond({error:"Invalid promotional code"},400);
 if(!Array.isArray(body.seat_keys)||body.seat_keys.length===0||body.seat_keys.length>20||
  body.seat_keys.some(x=>typeof x!=="string"||x.length>120)||new Set(body.seat_keys).size!==body.seat_keys.length)
  return respond({error:"Choose your seats before applying the code."},400);
 try{
  const {db}=liveServices();
  const {data:p,error:pe}=await db.from("booking_promotions").select("code,enabled,event_id,applies_to,discount_type,percent_off,amount_cents,max_uses,times_used,starts_at,ends_at,min_tickets,max_discount_cents").eq("code",code).maybeSingle();
  if(pe||!p||!p.enabled)return respond({error:"Code not recognised or inactive."},422);
  const now=Date.now();
  if((p.starts_at&&Date.parse(p.starts_at)>now)||(p.ends_at&&Date.parse(p.ends_at)<=now))
   return respond({error:"This code is not currently active."},422);
  if(p.max_uses!==null&&p.times_used>=p.max_uses)return respond({error:"This code has reached its usage limit."},422);
  if(p.event_id!==NYE_EVENT_ID||p.applies_to!=="adult")return respond({error:"This code is not eligible for these tickets."},422);
  if(p.min_tickets!==null&&body.seat_keys.length<p.min_tickets)return respond({error:"More tickets are required for this code."},422);
  const {data:assignment}=await db.from("event_discount_promotion_assignments").select("discount_category").eq("event_id",NYE_EVENT_ID).eq("promo_code",code).maybeSingle();
  if(!assignment||!["personal","flash"].includes(assignment.discount_category))return respond({error:"This code is not activated for this event."},422);
  const {data:budget}=await db.from("event_discount_budgets").select("total_budget_cents,personal_budget_cents,flash_budget_cents,personal_enabled,flash_enabled").eq("event_id",NYE_EVENT_ID).maybeSingle();
  if(!budget||(assignment.discount_category==="personal"?!budget.personal_enabled:!budget.flash_enabled))
   return respond({error:"This promotion is currently unavailable."},422);
  const ids=body.seat_keys.map((k:string)=>k.split(":")[0]);
  if(ids.some((id:string)=>!uuid.test(id)))return respond({error:"Invalid seat selection."},400);
  const {data:tables,error:te}=await db.from("seating_tables").select("id,seat_price_cents,is_active,seats_top,seats_bottom,seats_left,seats_right").eq("event_id",NYE_EVENT_ID).in("id",Array.from(new Set(ids))).eq("is_active",true);
  if(te||!tables||tables.length!==new Set(ids).size)return respond({error:"Unable to verify selected seats."},422);
  const byId=new Map(tables.map(t=>[t.id,t]));
  let discount=0,subtotal=0;
  for(const key of body.seat_keys as string[]){
   const [id,number,...extra]=key.split(":");
   const table=byId.get(id),seat=Number(number);
   if(extra.length||!/^\\d+$/.test(number)||!table||seat<1||seat>((table.seats_top??0)+(table.seats_bottom??0)+(table.seats_left??0)+(table.seats_right??0))||!Number.isSafeInteger(table.seat_price_cents))
    return respond({error:"Unable to verify selected seats."},422);
   const price=table.seat_price_cents;subtotal+=price;
   discount+=p.discount_type==="amount_off"?Math.min(price,p.amount_cents??0):
    p.discount_type==="percentage"?Math.min(price,Math.round(price*(p.percent_off??0)/100)):
    p.discount_type==="fixed_price"?Math.max(0,price-(p.amount_cents??0)):0;
  }
  discount=Math.min(discount,p.max_discount_cents??discount,subtotal);
  const {data:reservations,error:re}=await db.from("booking_discount_reservations").select("discount_type,amount_cents").eq("event_id",NYE_EVENT_ID).in("state",["reserved","committed"]);
  if(re)return respond({error:"Discount availability cannot be checked."},503);
  const used=(reservations??[]).reduce((n,r)=>n+r.amount_cents,0);
  const categoryUsed=(reservations??[]).filter(r=>r.discount_type===assignment.discount_category).reduce((n,r)=>n+r.amount_cents,0);
  const categoryCap=assignment.discount_category==="personal"?budget.personal_budget_cents:budget.flash_budget_cents;
  if(discount<=0)return respond({error:"This code does not reduce the selected ticket price."},422);
  if(used+discount>budget.total_budget_cents||categoryUsed+discount>categoryCap)return respond({error:"This promotion's discount budget is exhausted."},422);
  return respond({valid:true,code,discount_cents:discount,original_cents:subtotal,payable_cents:subtotal-discount,seat_keys:(body.seat_keys as string[]).join("|"),message:"Promo code applied. Final eligibility is checked again at checkout."});
 }catch{return respond({error:"Unable to validate this code right now."},503)}
}
