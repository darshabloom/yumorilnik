// Shared, side-effect-free booking rules. Prices are integer NZ cents.
export type PartyCounts={adults:number;children:number;other:number};
export function classifyTicket(name:string):"adult"|"child"|"other"{
 if(/adult|взросл/i.test(name))return "adult";
 if(/child|детск|ребён|ребен/i.test(name))return "child";
 return "other";
}
export function partyCounts(tickets:{name:string;quantity:number}[]):PartyCounts{
 return tickets.reduce((result,t)=>{const category=classifyTicket(t.name);if(category==="adult")result.adults+=t.quantity;else if(category==="child")result.children+=t.quantity;else result.other+=t.quantity;return result;},{adults:0,children:0,other:0});
}
export function canStartBooking(counts:PartyCounts):boolean{
 return counts.adults+counts.children>0&&counts.other===0&&(counts.children===0||counts.adults>0);
}
export type GuestField="name"|"email"|"phone"|"parent"|"duration"|"age";
export type GuestValidationProblem={guestIndex:number;field:GuestField};

/** Return each actual missing field rather than showing a generic error after
 * a user has selected a parent or entered some of the requested details. */
export function guestValidationProblems(
 adults:number,
 children:number,
 guestInfo:Record<string,{name:string;email:string;phone:string}>,
 parents:Record<string,string>,
 options?:{
  adultSeatChildren?:Record<string,boolean>;
  childcareHours?:Record<string,string>;
  requireChildcareHours?:boolean;
  childAges?:Record<string,string>;
 },
):GuestValidationProblem[]{
 const result:GuestValidationProblem[]=[];
 if(!Number.isInteger(adults)||!Number.isInteger(children)||adults<0||children<0||adults+children<=0){
  return [{guestIndex:0,field:"name"}];
 }
 for(let i=0;i<adults+children;i++){
  const guest=guestInfo[String(i)];
  if(!guest?.name.trim())result.push({guestIndex:i,field:"name"});
  const markedChild=i<adults&&options?.adultSeatChildren?.[String(i)]===true;
  if(i<adults&&!markedChild){
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest?.email.trim()??""))result.push({guestIndex:i,field:"email"});
   if(!(guest?.phone.trim()))result.push({guestIndex:i,field:"phone"});
  }else{
   const ageRaw=options?.childAges?.[String(i)]??"";
   if(options?.childAges && (!/^\d{1,2}$/.test(ageRaw)||Number(ageRaw)>17))result.push({guestIndex:i,field:"age"});
   const raw=parents[String(i)];
   if(raw===undefined||raw===""||!Number.isInteger(Number(raw))||Number(raw)<0||Number(raw)>=adults||
      (markedChild&&Number(raw)===i)||options?.adultSeatChildren?.[raw]===true){
    result.push({guestIndex:i,field:"parent"});
   }
   if(i>=adults&&options?.requireChildcareHours&&
     !["3","6"].includes(options.childcareHours?.[String(i)]??"")){
    result.push({guestIndex:i,field:"duration"});
   }
  }
 }
 return result;
}
export function guestDetailsValid(
 adults:number,children:number,
 guestInfo:Record<string,{name:string;email:string;phone:string}>,
 parents:Record<string,string>,
):boolean{
 return guestValidationProblems(adults,children,guestInfo,parents).length===0;
}
export function reservedAdultSeats(adults:number,assignments:Record<string,string>):number{
 return new Set(Object.values(assignments).filter(id=>Number.isInteger(Number(id))&&Number(id)>=0&&Number(id)<adults)).size;
}
export function childReservedSeats(adults:number,children:number,assignments:Record<string,string>):number{
 return new Set(Object.values(assignments).filter(id=>Number.isInteger(Number(id))&&Number(id)>=adults&&Number(id)<adults+children)).size;
}
export function bookingTotalCents(admission:number,seatPrices:(number|null)[]):number|null{
 if(!Number.isSafeInteger(admission)||admission<0||seatPrices.some(p=>p===null||!Number.isSafeInteger(p)||p<0))return null;
 const total=seatPrices.reduce<number>((sum,p)=>sum+(p??0),admission);
 return Number.isSafeInteger(total)?total:null;
}

/** An explicitly configured legacy event must not silently become zone-priced. */
export function usesFullZoneSeatPricing(
 seatingMode:string|null|undefined,
 tableBookingMode:string|null|undefined,
 pricingModel:string|null|undefined,
 zoneCount:number,
):boolean{
 if(seatingMode==="general_admission"||(seatingMode==="tables"&&tableBookingMode==="whole_table"))return false;
 if(pricingModel==="zone_full_seat")return true;
 if(pricingModel==="admission_plus_seat")return false;
 return zoneCount>0;
}

export type SeatAssignmentResult={
 assignments:Record<string,string>;
 outcome:"assigned"|"removed"|"occupied"|"invalid";
};

/** Each named guest may hold one seat; already assigned seats cannot be silently stolen. */
export function changeNamedSeat(
 assignments:Record<string,string>,
 seatKey:string,
 guestIndex:number,
 adultCount:number,
 childCount:number,
 step:"seats"|"children",
):SeatAssignmentResult{
 const first=step==="children"?adultCount:0;
 const limit=step==="children"?adultCount+childCount:adultCount;
 if(!seatKey||!Number.isInteger(guestIndex)||guestIndex<first||guestIndex>=limit)return {assignments,outcome:"invalid"};
 const guestId=String(guestIndex);
 const owner=assignments[seatKey];
 if(owner!==undefined&&owner!==guestId)return {assignments,outcome:"occupied"};
 const next={...assignments};
 if(owner===guestId){
  delete next[seatKey];
  return {assignments:next,outcome:"removed"};
 }
 for(const key of Object.keys(next))if(next[key]===guestId)delete next[key];
 next[seatKey]=guestId;
 return {assignments:next,outcome:"assigned"};
}

/** Children may have no assigned seat. Whole-table capacity protects adult seating. */
export function selectedTableCapacity(
 selectedIds:string[],
 tables:{id:string;is_active:boolean;seats_top:number;seats_bottom:number;seats_left:number;seats_right:number}[],
):number{
 return selectedIds.reduce((sum,id)=>{
  const table=tables.find(t=>t.id===id&&t.is_active);
  return sum+(table?Math.max(0,table.seats_top)+Math.max(0,table.seats_bottom)+Math.max(0,table.seats_left)+Math.max(0,table.seats_right):0);
 },0);
}


/** A review preview is allowed before every price is configured; checkout is not. */
export function bookingReadyForReview(options:{
 ticketCount:number;guestDetailsComplete:boolean;totalCents:number|null;
 generalAdmission:boolean;wholeTable:boolean;selectedCount:number;
 tableCapacity:number;adultCount:number;assignedAdultSeats:number;
 adultSeatsRequired:boolean;seatOverage:boolean;
}):boolean{
 const o=options;
 if(o.ticketCount<=0||!o.guestDetailsComplete||o.seatOverage)return false;
 if(o.generalAdmission)return true;
 if(o.wholeTable)return o.selectedCount>0&&o.tableCapacity>=o.adultCount;
 if(o.adultSeatsRequired&&o.assignedAdultSeats!==o.adultCount)return false;
 return true;
}

/** Never enable actual checkout with an incomplete or unsafe total. */
export function bookingPriceReadyForCheckout(totalCents:number|null):boolean{
 return totalCents!==null&&Number.isSafeInteger(totalCents)&&totalCents>=0;
}

/** The price belongs to the table, not an individual chair. Every chosen place
 * at that table inherits the same adult price. */
export function tablePlacePriceCents(table:{seat_price_cents:number|null}|null|undefined):number|null{
 return table?.seat_price_cents??null;
}

/** At seated events, an adult's admission is included in their table place.
 * Child admission remains separate, even if the child takes a reserved place. */
export function admissionTotalForEventCents(
 seatingMode:string|null|undefined,
 tickets:{name:string;price_cents:number;quantity:number}[],
):number|null{
 let total=0;
 for(const ticket of tickets){
  if(!Number.isSafeInteger(ticket.quantity)||ticket.quantity<0)return null;
  const needsAdmission=seatingMode==="general_admission"||classifyTicket(ticket.name)!=="adult";
  if(!needsAdmission||ticket.quantity===0)continue;
  if(!Number.isSafeInteger(ticket.price_cents)||ticket.price_cents<0)return null;
  total+=ticket.price_cents*ticket.quantity;
  if(!Number.isSafeInteger(total))return null;
 }
 return total;
}
