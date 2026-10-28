import {createHmac,timingSafeEqual} from "node:crypto";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function key(){const k=process.env.TICKET_SIGNING_SECRET;if(!k||! /^[0-9a-f]{64}$/i.test(k))throw Error("Ticket credentials are not configured");return k;}
export function issueTicketCredential(bookingId:string,guestIndex:number){
 if(!uuid.test(bookingId)||!Number.isInteger(guestIndex)||guestIndex<0||guestIndex>100)throw Error("Invalid ticket identity");
 const payload=bookingId.toLowerCase()+":"+guestIndex;
 const signature=createHmac("sha256",key()).update("yumorilnik-ticket-v1:"+payload).digest("hex");
 return "ymt1."+Buffer.from(payload).toString("base64url")+"."+signature;
}
export function parseTicketCredential(input:string){
 const parts=input.trim().split(".");if(parts.length!==3||parts[0]!=="ymt1"||parts[1].length>128||! /^[a-f0-9]{64}$/i.test(parts[2]))return null;
 let value="";try{value=Buffer.from(parts[1],"base64url").toString("utf8")}catch{return null}
 const match=value.match(/^([0-9a-f-]{36}):([0-9]{1,3})$/);if(!match||!uuid.test(match[1]))return null;
 const index=Number(match[2]);if(index>100)return null;
 const expected=issueTicketCredential(match[1],index).split(".")[2];
 if(!timingSafeEqual(Buffer.from(expected,"hex"),Buffer.from(parts[2],"hex")))return null;
 return {bookingId:match[1],guestIndex:index};
}
