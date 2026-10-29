"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import type {VenueFeature} from "@/components/VenueLines";
import {useSiteLanguage} from "@/lib/useSiteLanguage";
import {zonePoints,type PriceZone} from "@/lib/priceZones";

export type PublicTable={id:string;label:string;shape?:string;x:number;y:number;width:number;height:number;rotation_deg:number;seats_top:number;seats_bottom:number;seats_left:number;seats_right:number;table_price_cents:number|null;seat_price_cents:number|null;price_zone_id?:string|null;is_active:boolean};
export type PublicStage={stage_x:number;stage_y:number;stage_width:number;stage_height:number;stage_rotation:number};
type Seat={key:string;label:string;tableId:string;x:number;y:number};
type Mode="whole_table"|"individual_seats";
const WIDTH=1000,HEIGHT=700;
const MAX_SEAT_RADIUS=6;
const MAX_HIT_RADIUS=9;
const SEAT_DISTANCE=11;
function seatPositions(table:PublicTable):Seat[]{
 const output:Seat[]=[];
 const sides=[{side:"top",n:table.seats_top},{side:"right",n:table.seats_right},{side:"bottom",n:table.seats_bottom},{side:"left",n:table.seats_left}];
 for(const {side,n} of sides)for(let i=0;i<n;i++){
  const ratio=(i+1)/(n+1),index=output.length+1;
  output.push({key:table.id+":"+index,label:String(index),tableId:table.id,
   x:side==="top"||side==="bottom"?ratio*table.width:side==="left"?-SEAT_DISTANCE:table.width+SEAT_DISTANCE,
   y:side==="left"||side==="right"?ratio*table.height:side==="top"?-SEAT_DISTANCE:table.height+SEAT_DISTANCE});
 }
 return output;
}
export default function CustomerVenueMap({tables,features,stage,mode="whole_table",selectedKeys=[],onToggle,zones=[]}:{zones?:PriceZone[];tables:PublicTable[];features:VenueFeature[];stage:PublicStage|null;mode?:Mode;selectedKeys?:string[];onToggle?:(key:string)=>void}){
 const en=useSiteLanguage()==="en";
 const [view,setView]=useState({x:0,y:0,w:WIDTH,h:HEIGHT});
 const [baseWidth,setBaseWidth]=useState(WIDTH);
 const [baseHeight,setBaseHeight]=useState(HEIGHT);
 const [expanded,setExpanded]=useState(false);
 const wrapper=useRef<HTMLDivElement|null>(null);
 const [focused,setFocused]=useState<string|null>(null);
 const svgRef=useRef<SVGSVGElement|null>(null);
 const pointers=useRef(new Map<number,{x:number;y:number}>());
 const gesture=useRef<{x:number;y:number;w:number;h:number;cx:number;cy:number;distance:number}|null>(null);
 const moved=useRef(false);
 const tap=useRef<{key:string;tableId:string}|null>(null);
 const downOrigin=useRef<{x:number;y:number}|null>(null);
 const selected=tables.find(t=>t.id===focused);
 // Determine click targets in venue coordinates, including rotated tables.
 // A seat's hit area must never overlap the area of another numbered seat.
 const seatRadii=useMemo(()=>{
  const positions=tables.filter(t=>t.is_active).flatMap(t=>{
   const a=(t.rotation_deg??0)*Math.PI/180,c=Math.cos(a),sn=Math.sin(a);
   const cx=t.width/2,cy=t.height/2;
   return seatPositions(t).map(seat=>{
    const x=seat.x-cx,y=seat.y-cy;
    return {key:seat.key,x:t.x+cx+x*c-y*sn,y:t.y+cy+x*sn+y*c};
   });
  });
  return new Map(positions.map(p=>{
   let nearest=Infinity;
   for(const q of positions){
    if(p.key===q.key)continue;
    nearest=Math.min(nearest,Math.hypot(p.x-q.x,p.y-q.y));
   }
   const half=Math.max(2,(nearest-2)/2);
   return [p.key,{visible:Math.min(MAX_SEAT_RADIUS,half),hit:Math.min(MAX_HIT_RADIUS,half)}] as const;
  }));
 },[tables]);


 const zoom=baseWidth/view.w;
 useEffect(()=>{
   const element=wrapper.current;if(!element)return;
   const measure=()=>{
     const ratio=element.clientWidth/Math.max(1,element.clientHeight);
     // Initial view must show the entire venue, not crop its top/bottom.
     const w=Math.max(WIDTH,HEIGHT*ratio),h=w/ratio;
     setBaseWidth(w);setBaseHeight(h);
     setView({x:(WIDTH-w)/2,y:(HEIGHT-h)/2,w,h});
   };
   const observer=new ResizeObserver(measure);observer.observe(element);measure();return()=>observer.disconnect();
 },[expanded]);
 function clamp(x:number,y:number,w:number,h:number){return {x:Math.max(Math.min(0,WIDTH-w),Math.min(Math.max(0,WIDTH-w),x)),y:Math.max(Math.min(0,HEIGHT-h),Math.min(Math.max(0,HEIGHT-h),y)),w,h};}
 function focusTable(tableId:string){
   const table=tables.find(t=>t.id===tableId);if(!table)return;
   const scale=3;
   const w=baseWidth/scale,h=baseHeight/scale;
   setView(clamp(table.x+table.width/2-w/2,table.y+table.height/2-h/2,w,h));
 }
 function zoomTo(next:number){
  const scale=Math.max(1,Math.min(8,next)),w=baseWidth/scale,h=baseHeight/scale;
  setView(v=>clamp(v.x+(v.w-w)/2,v.y+(v.h-h)/2,w,h));
 }
 function getGesture(){
  const ps=Array.from(pointers.current.values());
  if(!ps.length)return null;
  const a=ps[0],b=ps[1];
  return {cx:b?(a.x+b.x)/2:a.x,cy:b?(a.y+b.y)/2:a.y,distance:b?Math.hypot(a.x-b.x,a.y-b.y):0};
 }
 function down(e:React.PointerEvent<SVGSVGElement>){
  if(pointers.current.size===0){
    const target=e.target as Element;
    const element=target.closest("[data-table-id]");
    tap.current=element?.getAttribute("data-table-id")?{key:element.getAttribute("data-seat-key")??"",tableId:element.getAttribute("data-table-id")??""}:null;
    downOrigin.current={x:e.clientX,y:e.clientY};
  }
  pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const p=getGesture();if(!p)return;
  const rect=e.currentTarget.getBoundingClientRect();
  gesture.current={x:view.x,y:view.y,w:view.w,h:view.h,cx:(p.cx-rect.left)/rect.width,cy:(p.cy-rect.top)/rect.height,distance:p.distance};
  moved.current=pointers.current.size>1;
  if(e.pointerType!=="touch"||expanded)e.currentTarget.setPointerCapture(e.pointerId);
 }
 function move(e:React.PointerEvent<SVGSVGElement>){
  const prev=pointers.current.get(e.pointerId);if(!prev||!gesture.current)return;
  pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const p=getGesture();if(!p)return;
  if(downOrigin.current&&Math.hypot(e.clientX-downOrigin.current.x,e.clientY-downOrigin.current.y)>6)moved.current=true;
  if(e.pointerType==="touch"&&!expanded&&pointers.current.size===1)return;
  const rect=e.currentTarget.getBoundingClientRect(),g=gesture.current;
  const ratio=g.distance&&p.distance?Math.max(1,Math.min(8,baseWidth/g.w*p.distance/g.distance)):baseWidth/g.w;
  const w=baseWidth/ratio,h=baseHeight/ratio;
  const cx=(p.cx-rect.left)/rect.width,cy=(p.cy-rect.top)/rect.height;
  const x=g.x+g.cx*g.w-cx*w,y=g.y+g.cy*g.h-cy*h;
  setView(clamp(x,y,w,h));
 }
 function up(e:React.PointerEvent<SVGSVGElement>){
  pointers.current.delete(e.pointerId);
  if(pointers.current.size===0){
   if(!moved.current&&tap.current){
    setFocused(tap.current.tableId);
    if(tap.current.key)onToggle?.(tap.current.key);
    else if(mode==="individual_seats")focusTable(tap.current.tableId);
   }
   tap.current=null;downOrigin.current=null;gesture.current=null;return;
  }
  const p=getGesture(),rect=e.currentTarget.getBoundingClientRect();if(!p)return;
  gesture.current={x:view.x,y:view.y,w:view.w,h:view.h,cx:(p.cx-rect.left)/rect.width,cy:(p.cy-rect.top)/rect.height,distance:p.distance};
 }
 const money=(cents:number)=>new Intl.NumberFormat("en-NZ",{style:"currency",currency:"NZD"}).format(cents/100);
 const tablePriceGroups=useMemo(()=>{
  const groups=new Map<string,{price:number|null;labels:string[]}>();
  for(const table of tables.filter(t=>t.is_active)){
   const price=mode==="individual_seats"?table.seat_price_cents:table.table_price_cents;
   const key=price===null?"unset":String(price);
   const current=groups.get(key)??{price,labels:[]};
   current.labels.push(table.label);groups.set(key,current);
  }
  return Array.from(groups.values()).sort((a,b)=>(a.price??Infinity)-(b.price??Infinity));
 },[tables,mode]);
 return <div className="space-y-3">
   <div className="flex flex-wrap items-center justify-between gap-2">
    <p className="text-sm text-gray-600">{en?"Tap a table to zoom in, then tap a numbered seat. Pinch or use +/− to zoom.":"Нажмите на стол, чтобы приблизить его, затем выберите место по номеру. Увеличивайте схему двумя пальцами или кнопками +/−."}</p>
    <div className="flex items-center gap-1">
      <button type="button" onClick={()=>setExpanded(v=>!v)} className="rounded border border-black/30 bg-white px-3 py-2 text-xs font-bold">{expanded?(en?"Exit full screen":"Свернуть"):(en?"Full screen":"На весь экран")}</button>
      <button type="button" aria-label={en?"Zoom out":"Уменьшить"} onClick={()=>zoomTo(zoom/1.4)} className="h-10 w-10 rounded border border-black/30 bg-white font-bold">−</button>
      <button type="button" onClick={()=>zoomTo(1)} className="rounded border border-black/30 bg-white px-3 py-2 text-xs font-bold">{Math.round(zoom*100)}%</button>
      <button type="button" aria-label={en?"Zoom in":"Увеличить"} onClick={()=>zoomTo(zoom*1.4)} className="h-10 w-10 rounded border border-black/30 bg-white font-bold">+</button>
    </div>
   </div>
   <section className="rounded-xl border border-black/20 bg-white p-4" aria-label={en?"Seating price guide":"Стоимость мест"}>
    <h3 className="font-bold">{en?"Seating price guide (NZD)":"Стоимость мест (NZD)"}</h3>
    <p className="mt-1 text-sm text-gray-600">{mode==="individual_seats"?(en?"Prices are per numbered seat, not per whole table.":"Цены указаны за одно пронумерованное место, а не за весь стол."):(en?"Prices are per whole table.":"Цены указаны за стол целиком.")}</p>
    {zones.length>0&&<div className="mt-3 flex flex-wrap gap-3">{zones.map(z=><div key={z.id} className="flex items-center gap-2 text-sm"><span className="h-4 w-4 shrink-0 rounded border border-black/20" style={{backgroundColor:z.color}}/><span>{z.name}: <strong>{money(z.price_cents)}</strong></span></div>)}</div>}
    <div className="mt-3 grid gap-2 sm:grid-cols-2">{tablePriceGroups.map(group=><div key={group.price??"unset"} className="rounded-lg border border-black/10 bg-[#fff8f1] px-3 py-2 text-sm"><strong>{group.price===null?(en?"Price not set":"Цена не указана"):money(group.price)}</strong><span className="ml-2 text-gray-700">{en?"Tables":"Столы"} {group.labels.join(", ")}</span></div>)}</div>
    <p className="mt-2 text-xs text-gray-600">{en?"Table-specific prices shown above are used for checkout; zone colours help identify sections.":"При оформлении заказа применяются цены конкретных столов, указанные выше. Цвета показывают зоны зала."}</p>
   </section>
   <div className="grid items-start gap-4">
   <div ref={wrapper} className={expanded?"fixed inset-0 z-50 overflow-hidden bg-[#F6F5F1]":"relative h-[48svh] min-h-[310px] overflow-hidden rounded-xl border border-black/15 bg-[#F6F5F1] lg:h-[min(78vh,880px)]"}>
    {expanded&&<button type="button" onClick={()=>setExpanded(false)} className="absolute right-3 top-3 z-10 rounded-lg bg-white px-4 py-3 font-bold shadow">{en?"Close ✕":"Закрыть ✕"}</button>}
    <svg ref={svgRef} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} preserveAspectRatio="xMidYMid meet" aria-label={en?"Venue seating plan":"План зала"} role="group" className={`block h-full w-full ${expanded?"cursor-grab touch-none":"cursor-pointer touch-pan-y lg:cursor-grab lg:touch-none"}`} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      {zones.map(z=><g key={z.id}><polygon points={zonePoints(z).map(p=>p.x+","+p.y).join(" ")} fill={z.color} opacity=".44" stroke={z.color} strokeWidth="3"/></g>)}
      {features.map(f=><g key={f.id}>
       <polyline points={f.points.map(p=>p.x+","+p.y).join(" ")} stroke={f.kind==="entrance"?"#16803b":"#252525"} strokeWidth={f.kind==="entrance"?10:7} strokeDasharray={f.kind==="entrance"?"11 9":undefined} fill="none" strokeLinecap="round" strokeLinejoin="round"/>
       {f.label&&f.points[0]&&<text x={f.points[0].x+12} y={f.points[0].y-15} fontSize="18" fill="#16803b">{f.label}</text>}
      </g>)}
      {stage&&<g transform={`translate(${stage.stage_x} ${stage.stage_y}) rotate(${stage.stage_rotation} ${stage.stage_width/2} ${stage.stage_height/2})`}>
       <rect width={stage.stage_width} height={stage.stage_height} rx="7" fill="#f5a047" stroke="#9a5c19" strokeWidth="2"/>
       <text x={stage.stage_width/2} y={stage.stage_height/2+6} fontSize="19" textAnchor="middle" fontWeight="700">{en?"Stage":"Сцена"}</text>
      </g>}
      {tables.filter(t=>t.is_active).map(t=><g key={t.id} transform={`translate(${t.x} ${t.y}) rotate(${t.rotation_deg} ${t.width/2} ${t.height/2})`}>
        <rect x="0" y="0" width={t.width} height={t.height} rx={t.shape==="round"||t.shape==="oval"?Math.min(t.width,t.height)/2:7} fill={selectedKeys.includes(t.id)?"#f8c6dc":focused===t.id?"#ffe1ee":"#fff"} stroke={selectedKeys.includes(t.id)?"#c41e73":"#777"} strokeWidth="2" data-seat-key={mode==="whole_table"?t.id:""} data-table-id={t.id} style={{cursor:"pointer"}}/>
        <text x={t.width/2} y={t.height/2+7} fontSize="16" textAnchor="middle" fontWeight="700" pointerEvents="none">{t.label}</text>
        {seatPositions(t).map(s=><g key={s.key} data-seat-key={mode==="individual_seats"?s.key:t.id} data-table-id={t.id} style={{cursor:"pointer"}}>
          <circle cx={s.x} cy={s.y} r={seatRadii.get(s.key)?.visible??MAX_SEAT_RADIUS} fill={selectedKeys.includes(s.key)?"#f5a047":"#fff"} stroke={selectedKeys.includes(s.key)?"#ad5d09":"#525252"} strokeWidth="1.3" pointerEvents="none"/>
          <circle cx={s.x} cy={s.y} r={seatRadii.get(s.key)?.hit??MAX_HIT_RADIUS} fill="transparent" pointerEvents="all" />
          <text x={s.x} y={s.y+4} textAnchor="middle" fontSize="8" fontWeight="600" pointerEvents="none">{s.label}</text>
        </g>)}
      </g>)}
    </svg>
   </div>
   </div>
   <div className="flex flex-wrap gap-4 text-xs text-gray-600"><span>{en?"◯ Seat":"◯ Место"}</span><span className="text-pink-700">{en?"● Selected":"● Выбрано"}</span><span>{en?"Reservations are not open yet":"Бронирование ещё не открыто"}</span></div>
   {selected&&<p className="rounded-lg border border-black/15 bg-white p-3 text-sm text-gray-700" aria-live="polite"><strong>{selected.label}</strong> · {mode==="whole_table"?(selected.table_price_cents!==null?money(selected.table_price_cents):(en?"Price pending":"Цена уточняется")):(selected.seat_price_cents!==null?money(selected.seat_price_cents)+(en?" per adult place":" за взрослое место"):(en?"Adult price not set for this table":"Взрослая цена для этого стола не указана"))}</p>}
 </div>;
}
