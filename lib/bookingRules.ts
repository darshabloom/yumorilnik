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
export function guestDetailsValid(adults:number,children:number,guestInfo:Record<string,{name:string;email:string;phone:string}>,parents:Record<string,string>):boolean{
 if(adults+children<=0)return false;
 return Array.from({length:adults+children},(_,i)=>{
  const guest=guestInfo[String(i)];
  if(!guest?.name.trim())return false;
  if(i<adults)return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest.email)&&!!guest.phone.trim();
  const raw=parents[String(i)];
  return raw!==undefined&&raw!==""&&Number.isInteger(Number(raw))&&Number(raw)>=0&&Number(raw)<adults;
 }).every(Boolean);
}
export function reservedAdultSeats(adults:number,assignments:Record<string,string>):number{
 return new Set(Object.values(assignments).filter(id=>Number.isInteger(Number(id))&&Number(id)>=0&&Number(id)<adults)).size;
}
export function childReservedSeats(adults:number,children:number,assignments:Record<string,string>):number{
 return new Set(Object.values(assignments).filter(id=>Number.isInteger(Number(id))&&Number(id)>=adults&&Number(id)<adults+children)).size;
}
export function bookingTotalCents(admission:number,seatPrices:(number|null)[]):number|null{
 if(!Number.isSafeInteger(admission)||admission<0||seatPrices.some(p=>p===null||!Number.isSafeInteger(p)||p<0))return null;
 return admission+seatPrices.reduce<number>((sum,p)=>sum+(p??0),0);
}
