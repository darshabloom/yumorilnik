import {PDFDocument,rgb} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {readFile} from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import {issueTicketCredential} from "@/lib/ticketCredential";
type Guest={guest_index:number;full_name:string;category:string;is_child_with_adult_seat?:boolean|null;childcare_hours?:number|null};
type Seat={guest_index:number|null;table_label:string;seat_number:number|null};
type Event={title:string;event_date:string;event_time?:string|null;location?:string|null};
export async function createTicketPdf(input:{bookingId:string;reference:string;event:Event;guests:Guest[];seats:Seat[];isTest:boolean;issuedAt?:string|null}){
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 // Use the immutable confirmed time for retry-stable PDF metadata.
 if(input.issuedAt){const issued=new Date(input.issuedAt);if(!Number.isNaN(issued.getTime())){pdf.setCreationDate(issued);pdf.setModificationDate(issued)}}
 const fontBytes=await readFile(path.join(process.cwd(),"assets","ticket-font.ttf"));
 const font=await pdf.embedFont(fontBytes,{subset:true}),bold=font;
 const safe=(value:unknown)=>String(value??"").replace(/\p{Cc}/gu," ").slice(0,95);
 for(const guest of input.guests){
  const page=pdf.addPage([595,842]);const {height}=page.getSize();
  const write=(s:string,y:number,size=14,em=false)=>page.drawText(safe(s),{x:48,y,size,font:em?bold:font,color:rgb(.12,.12,.12)});
  page.drawRectangle({x:0,y:height-132,width:595,height:132,color:rgb(.96,.64,.22)});
  write("YUMORILNIK",height-65,28,true);write(input.isTest?"TEST ONLY - NOT VALID FOR ENTRY":"EVENT ADMISSION TICKET",height-105,14,true);
  write(input.event.title,660,19,true);write("Date: "+input.event.event_date+" "+(input.event.event_time??""),622);
  write("Location: "+(input.event.location??"See event website"),592,12);
  write("Guest: "+guest.full_name,545,18,true);write("Booking: "+input.reference,514,13);
  const seat=input.seats.find(s=>s.guest_index===guest.guest_index);
  const tableName=seat?(/^(Table|Стол)\s+/iu.test(seat.table_label)?seat.table_label:"Table "+seat.table_label):"";
  write(seat?tableName+" / Seat "+(seat.seat_number??"-"):"No assigned seat",486,14);
  if(guest.category==="child")write("Childcare"+(guest.childcare_hours?" - "+guest.childcare_hours+" hours":""),456,12);
  if(!input.isTest){
   const code=issueTicketCredential(input.bookingId,guest.guest_index);
   const png=await QRCode.toDataURL(code,{errorCorrectionLevel:"M",margin:2,width:320});
   const qr=await pdf.embedPng(png);page.drawImage(qr,{x:185,y:155,width:225,height:225});
   write("Present this QR code at check-in.",126,13);
  }else{write("SAMPLE - NO ADMISSION QR CODE",320,20,true)}
  write("yumorilnik.com",58,12);
 }
 return Buffer.from(await pdf.save());
}
