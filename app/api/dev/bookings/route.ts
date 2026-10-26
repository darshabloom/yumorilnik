import {randomUUID} from "node:crypto";
import {mkdir,readFile,rename,writeFile} from "node:fs/promises";
import {join,dirname} from "node:path";
import {NextRequest,NextResponse} from "next/server";
import type {DemoBooking,DemoBookingDraft,DemoGuest,DemoSelection,DemoTicket} from "@/lib/localDemoBookings";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const file=join(process.cwd(),".yumorilnik-local","bookings.json");
let pending:Promise<void>=Promise.resolve();

function localOnly(request:NextRequest){
 if(process.env.NODE_ENV!=="development")return false;
 const host=request.headers.get("host")??"";
 if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host))return false;
 const origin=request.headers.get("origin");
 if(origin){
  try{if(new URL(origin).host!==host)return false;}catch{return false;}
 }
 return true;
}
function denied(){return NextResponse.json({error:"Local fictional-booking demo only"},{status:404});}
function ok(data:unknown,status=200){
 return NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}});
}
function isRecord(value:unknown):value is Record<string,unknown>{
 return typeof value==="object"&&value!==null&&!Array.isArray(value);
}
function shortString(value:unknown,max=160):value is string{
 return typeof value==="string"&&value.trim().length>0&&value.length<=max;
}
function nullableMoney(value:unknown){
 return value===null||(typeof value==="number"&&Number.isSafeInteger(value)&&value>=0);
}
async function readBookings():Promise<DemoBooking[]>{
 try{
  const raw=JSON.parse(await readFile(file,"utf8")) as unknown;
  if(!Array.isArray(raw))throw new Error("Invalid local booking file");
  return raw as DemoBooking[];
 }catch(err){
  if(isRecord(err)&&err.code==="ENOENT")return [];
  throw err;
 }
}
async function saveBookings(items:DemoBooking[]){
 await mkdir(dirname(file),{recursive:true});
 const temporary=file+"."+randomUUID()+".tmp";
 await writeFile(temporary,JSON.stringify(items,null,2),"utf8");
 await rename(temporary,file);
}
function serial<T>(operation:()=>Promise<T>):Promise<T>{
 const result=pending.then(operation);
 pending=result.then(()=>undefined,()=>undefined);
 return result;
}
function validDraft(value:unknown):value is DemoBookingDraft{
 if(!isRecord(value)||!shortString(value.clientRequestId,80)
  ||!shortString(value.eventTitle)||!shortString(value.eventSlug,120)
  ||!shortString(value.currency,3)||!nullableMoney(value.totalCents)
  ||!Array.isArray(value.guests)||!Array.isArray(value.selections)||!Array.isArray(value.tickets)
  ||value.guests.length<1||value.guests.length>20||value.selections.length>40||value.tickets.length>20)return false;
 const guests=value.guests as unknown[];
 const selections=value.selections as unknown[];
 const tickets=value.tickets as unknown[];
 if(!guests.every((g):g is DemoGuest=>isRecord(g)
  &&typeof g.guestIndex==="number"&&Number.isInteger(g.guestIndex)&&g.guestIndex>=0
  &&(g.category==="adult"||g.category==="child")
  &&shortString(g.name)
  &&(g.email===null||typeof g.email==="string"&&g.email.length<=254)
  &&(g.phone===null||typeof g.phone==="string"&&g.phone.length<=40)
  &&(g.parentIndex===null||typeof g.parentIndex==="number"&&Number.isInteger(g.parentIndex))))return false;
 if(!selections.every((v):v is DemoSelection=>isRecord(v)
  &&shortString(v.tableLabel)
  &&(v.seatNumber===null||typeof v.seatNumber==="number"&&Number.isInteger(v.seatNumber)&&v.seatNumber>0)
  &&(v.guestIndex===null||typeof v.guestIndex==="number"&&Number.isInteger(v.guestIndex)&&v.guestIndex>=0)
  &&nullableMoney(v.priceCents)))return false;
 if(!tickets.every((t):t is DemoTicket=>isRecord(t)&&shortString(t.name,120)
  &&typeof t.quantity==="number"&&Number.isInteger(t.quantity)&&t.quantity>0&&t.quantity<=20
  &&typeof t.admissionCents==="number"&&Number.isSafeInteger(t.admissionCents)&&t.admissionCents>=0))return false;
 return true;
}
export async function GET(request:NextRequest){
 if(!localOnly(request))return denied();
 try{return ok({bookings:await readBookings()});}
 catch{return ok({error:"Unable to read local demo bookings"},500);}
}
export async function POST(request:NextRequest){
 if(!localOnly(request))return denied();
 let payload:unknown;
 try{
  const raw=await request.text();
  if(raw.length>25000)return ok({error:"Booking is too large"},413);
  payload=JSON.parse(raw);
 }catch{return ok({error:"Invalid booking JSON"},400);}
 if(!validDraft(payload))return ok({error:"Invalid fictional booking details"},400);
 return serial(async()=>{
  try{
   const list=await readBookings();
   const existing=list.find(b=>b.clientRequestId===payload.clientRequestId);
   if(existing)return ok({reference:existing.reference,status:existing.status,total_cents:existing.totalCents,localDemo:true});
   const id=randomUUID();
   const reference="YMR-DEMO-"+id.slice(0,8).toUpperCase();
   const booking:DemoBooking={...payload,id,reference,status:"requested",createdAt:new Date().toISOString(),cancelledAt:null,cancellationReason:null};
   list.unshift(booking);
   await saveBookings(list);
   return ok({reference,status:"requested",total_cents:booking.totalCents,localDemo:true},201);
  }catch{return ok({error:"Unable to write local demo file"},500);}
 });
}
export async function PATCH(request:NextRequest){
 if(!localOnly(request))return denied();
 let input:unknown;
 try{input=await request.json();}catch{return ok({error:"Invalid JSON"},400);}
 if(!isRecord(input)||typeof input.id!=="string"||input.action!=="cancel"&&input.action!=="delete")return ok({error:"Invalid action"},400);
 return serial(async()=>{
  try{
   const bookings=await readBookings();
   const index=bookings.findIndex(b=>b.id===input.id);
   if(index<0)return ok({error:"Test booking not found"},404);
   if(input.action==="delete"){
    bookings.splice(index,1);
   }else{
    const reason=typeof input.reason==="string"?input.reason.slice(0,500):"";
    bookings[index]={...bookings[index],status:"cancelled",cancelledAt:new Date().toISOString(),cancellationReason:reason||null};
   }
   await saveBookings(bookings);
   return ok({ok:true});
  }catch{return ok({error:"Unable to update local test booking"},500);}
 });
}
