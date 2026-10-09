export type ZonePoint={x:number;y:number};
export type PriceZone={id:string;event_id:string;name:string;price_cents:number;color:string;x:number;y:number;width:number;height:number;sort_order:number;points:ZonePoint[]|null};
export function zonePoints(zone:PriceZone):ZonePoint[]{
 return zone.points?.length>=3?zone.points:[{x:zone.x,y:zone.y},{x:zone.x+zone.width,y:zone.y},{x:zone.x+zone.width,y:zone.y+zone.height},{x:zone.x,y:zone.y+zone.height}];
}
export function insidePolygon(point:ZonePoint,polygon:ZonePoint[]):boolean{
 let inside=false;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const a=polygon[i],b=polygon[j];
  if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }
 return inside;
}
export function zoneForTable(table:{x:number;y:number;width:number;height:number;price_zone_id?:string|null},zones:PriceZone[]){
 const override=table.price_zone_id?zones.find(z=>z.id===table.price_zone_id):null;
 if(override)return override;
 const centre={x:table.x+table.width/2,y:table.y+table.height/2};
 return [...zones].sort((a,b)=>b.sort_order-a.sort_order).find(z=>insidePolygon(centre,zonePoints(z)))??null;
}
