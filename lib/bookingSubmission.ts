export type BookingGuestInput={name:string;email:string;phone:string};
export type BookingSubmitArgs={
 eventId:string;clientRequestId:string;
 tickets:{id:string;quantity:number}[];
 guestInfo:Record<string,BookingGuestInput>;
 childParents:Record<string,string>;
 adultCount:number;childCount:number;
 wholeTable:boolean;
 selectedKeys:string[];
 seatAssignments:Record<string,string>;
 adultSeatChildren?:Record<string,boolean>;
 childcareHours?:Record<string,string>;
};

/** Stable, minimal payload for the database RPC. Prices are NEVER submitted by
 * customers: the database recalculates them from active ticket and table rows. */
export function buildBookingSubmission(args:BookingSubmitArgs){
 const p_tickets=args.tickets.filter(x=>x.quantity>0).map(x=>({
  ticket_type_id:x.id,quantity:x.quantity,
 }));
 const p_guests=Array.from({length:args.adultCount+args.childCount},(_,i)=>{
  const guest=args.guestInfo[String(i)];
  if(i<args.adultCount){
   if(args.adultSeatChildren?.[String(i)]===true){
    const parentIndex=Number(args.childParents[String(i)]);
    const guardian=args.guestInfo[String(parentIndex)];
    return {name:guest.name.trim(),email:guardian.email.trim(),phone:guardian.phone.trim(),
     parent_index:parentIndex,is_child_with_adult_seat:true};
   }
   return {name:guest.name.trim(),email:guest.email.trim(),phone:guest.phone.trim(),
    is_child_with_adult_seat:false};
  }
  return {name:guest.name.trim(),parent_index:Number(args.childParents[String(i)]),
   ...(args.childcareHours?.[String(i)]?{childcare_hours:Number(args.childcareHours[String(i)])}:{})};
 });
 const p_selections=args.selectedKeys.map(key=>{
  if(args.wholeTable)return {table_id:key,seat_number:null,guest_index:null};
  const split=key.lastIndexOf(":");
  return {
   table_id:key.slice(0,split),
   seat_number:Number(key.slice(split+1)),
   guest_index:Number(args.seatAssignments[key]),
  };
 });
 return {
  p_event_id:args.eventId,
  p_client_request_id:args.clientRequestId,
  p_tickets,p_guests,p_selections,
 };
}
