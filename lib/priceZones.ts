export type PriceZone={id:string;event_id:string;name:string;price_cents:number;color:string;x:number;y:number;width:number;height:number;sort_order:number};
export function zoneForTable(table:{x:number;y:number;width:number;height:number},zones:PriceZone[]){
 const cx=table.x+table.width/2,cy=table.y+table.height/2;
 return [...zones].sort((a,b)=>b.sort_order-a.sort_order).find(z=>cx>=z.x&&cx<=z.x+z.width&&cy>=z.y&&cy<=z.y+z.height)??null;
}
