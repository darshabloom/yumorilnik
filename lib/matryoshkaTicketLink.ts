import {createHmac,timingSafeEqual} from "node:crypto";

export const YUMORILNIK_NYE_EVENT_ID="3f6fa4d1-aaca-4326-9c01-5774cffca2f5";
type TicketClaim={v:1;bid:string;event:string;recipient:string;exp:number};
const UUID=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
const key=()=>process.env.MATRYOSHKA_TICKET_LINK_SECRET;
export function createFoodOrderLink(bookingId:string,email:string):string|null{
 const secret=key(),base=process.env.MATRYOSHKA_FOOD_ORDER_URL;
 if(process.env.MATRYOSHKA_TICKET_LINK_ENABLED!=="true"||!secret||secret.length<32||!base||!UUID.test(bookingId))return null;
 let url:URL;
 try{url=new URL(base)}catch{return null}
 if(url.protocol!=="https:"||url.username||url.password||url.hash||url.search||url.pathname!=="/events/novogodnik26")return null;
 const claim:TicketClaim={v:1,bid:bookingId,event:YUMORILNIK_NYE_EVENT_ID,recipient:email.trim().toLowerCase(),exp:Math.floor(Date.now()/1000)+7*86400};
 const payload=Buffer.from(JSON.stringify(claim)).toString("base64url");
 const mac=createHmac("sha256",secret).update(payload).digest("base64url");
 url.searchParams.set("ticket_link",payload+"."+mac);
 return url.toString();
}
export function verifyFoodOrderToken(token:string):TicketClaim|null{
 const secret=key();if(!secret||secret.length<32||token.length>2000)return null;
 const parts=token.split(".");if(parts.length!==2||!parts.every(p=>/^[A-Za-z0-9_-]+$/.test(p)))return null;
 const mac=createHmac("sha256",secret).update(parts[0]).digest();
 let supplied:Buffer;try{supplied=Buffer.from(parts[1],"base64url")}catch{return null}
 if(mac.length!==supplied.length||!timingSafeEqual(mac,supplied))return null;
 try{const x=JSON.parse(Buffer.from(parts[0],"base64url").toString()) as TicketClaim;
  if(x.v!==1||x.event!==YUMORILNIK_NYE_EVENT_ID||!UUID.test(x.bid)||typeof x.recipient!=="string"||x.recipient.length>254||!Number.isInteger(x.exp)||x.exp<=Date.now()/1000)return null;
  return x;
 }catch{return null}
}
