/**
 * Centre each seat in an equal-width slot along its table edge.
 *
 * Unlike fixed 8-unit end anchors, this makes EVERY seat move when the seat
 * count changes (4 -> 3, 3 -> 2, etc.) and keeps symmetrical edge clearance.
 * Reused by the admin seating editor and customer booking map.
 */
export function seatAxisPosition(length:number,count:number,index:number):number{
 if(count<=0||!Number.isFinite(length))return 0;
 return length*(index+0.5)/count;
}
