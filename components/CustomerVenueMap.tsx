"use client";

import {useEffect,useRef,useState} from "react";
import type {VenueFeature} from "@/components/VenueLines";
import {useSiteLanguage} from "@/lib/useSiteLanguage";
import {zoneForTable,zonePoints,type PriceZone} from "@/lib/priceZones";

export type PublicTable={id:string;label:string;shape?:string;x:number;y:number;width:number;height:number;rotation_deg:number;seats_top:number;seats_bottom:number;seats_left:number;seats_right:number;table_price_cents:number|null;seat_price_cents:number|null;price_zone_id?:string|null;is_active:boolean};
export type PublicStage={stage_x:number;stage_y:number;stage_width:number;stage_height:number;stage_rotation:number};
type Seat={key:string;label:string;tableId:string;x:number;y:number};
type Mode="whole_table"|"individual_seats";
const WIDTH=1000,HEIGHT=700;
const SEAT_RADIUS=9;
const SEAT_DISTANCE=16;
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
    const element=target.closest("[data-seat-key]");
    tap.current=element&&element.getAttribute("data-seat-key")?{key:element.getAttribute("data-seat-key")??"",tableId:element.getAttribute("data-table-id")??""}:null;
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
    onToggle?.(tap.current.key);
   }
   tap.current=null;downOrigin.current=null;gesture.current=null;return;
  }
  const p=getGesture(),rect=e.currentTarget.getBoundingClientRect();if(!p)return;
  gesture.current={x:view.x,y:view.y,w:view.w,h:view.h,cx:(p.cx-rect.left)/rect.width,cy:(p.cy-rect.top)/rect.height,distance:p.distance};
 }
 const money=(cents:number)=>new Intl.NumberFormat("en-NZ",{style:"currency",currency:"NZD"}).format(cents/100);
 return <div className="space-y-3">
   <div className="flex flex-wrap items-center justify-between gap-2">
    <p className="text-sm text-gray-600">{en?"Swipe to scroll the page. Pinch or use +/− to zoom the seating map.":"Прокручивайте страницу одним пальцем. Увеличивайте схему двумя пальцами или кнопками."}</p>
    <div className="flex items-center gap-1">
      <button type="button" onClick={()=>setExpanded(v=>!v)} className="rounded border border-black/30 bg-white px-3 py-2 text-xs font-bold">{expanded?(en?"Exit full screen":"Свернуть"):(en?"Full screen":"На весь экран")}</button>
      <button type="button" aria-label={en?"Zoom out":"Уменьшить"} onClick={()=>zoomTo(zoom/1.4)} className="h-10 w-10 rounded border border-black/30 bg-white font-bold">−</button>
      <button type="button" onClick={()=>zoomTo(1)} className="rounded border border-black/30 bg-white px-3 py-2 text-xs font-bold">{Math.round(zoom*100)}%</button>
      <button type="button" aria-label={en?"Zoom in":"Увеличить"} onClick={()=>zoomTo(zoom*1.4)} className="h-10 w-10 rounded border border-black/30 bg-white font-bold">+</button>
    </div>
   </div>
   {zones.length>0&&<div className="relative z-10 -mx-1 rounded-lg border border-black/10 bg-white/95 px-2 py-2 shadow-sm backdrop-blur lg:hidden" aria-label={en?"Seat prices":"Стоимость мест"}>
     <div className="grid grid-cols-3 gap-1.5">{[...zones].sort((a,b)=>b.price_cents-a.price_cents).map(z=><div key={z.id} className="flex min-w-0 items-center gap-1.5 rounded-md px-1 py-1">
       <span className="h-5 w-5 shrink-0 rounded border border-black/10" style={{backgroundColor:z.color}}/>
       <span className="min-w-0 text-[11px] leading-tight"><span className="block truncate font-semibold">{z.name}</span><strong className="block text-xs">{money(z.price_cents)}</strong></span>
     </div>)}</div>
   </div>}
   <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
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
          <circle cx={s.x} cy={s.y} r={SEAT_RADIUS} fill={selectedKeys.includes(s.key)?"#f5a047":"#fff"} stroke={selectedKeys.includes(s.key)?"#ad5d09":"#525252"} strokeWidth="1.3"/>
          <text x={s.x} y={s.y+4} textAnchor="middle" fontSize="9" fontWeight="600" pointerEvents="none">{s.label}</text>
        </g>)}
      </g>)}
    </svg>
   </div>
   {zones.length>0&&<aside aria-label={en?"Seat price areas":"Ценовые зоны"} className="rounded-xl border border-black/15 bg-white p-4 lg:sticky lg:top-5">
     <h3 className="text-base font-bold">{en?"Seat price areas":"Цены по зонам"}</h3>
     <p className="mt-1 text-xs text-gray-600">{en?"Full price per reserved seat":"Полная стоимость одного места"}</p>
     <div className="mt-4 space-y-3">{[...zones].sort((a,b)=>b.price_cents-a.price_cents).map(z=><div key={z.id} className="flex items-center gap-3">
       <span className="h-8 w-8 shrink-0 rounded-lg border border-black/10" style={{backgroundColor:z.color}} aria-hidden="true"/>
       <span className="min-w-0 flex-1"><strong className="block text-sm">{z.name}</strong><span className="text-xs text-gray-600">{en?"per seat":"за место"}</span></span>
       <strong className="text-base tabular-nums">{money(z.price_cents)}</strong>
     </div>)}</div>
     <p className="mt-4 border-t border-black/10 pt-3 text-xs text-gray-600">{en?"Each table has one price, including tables manually assigned to a price area.":"У всех мест за одним столом одна цена, включая столы, назначенные в зону вручную."}</p>
   </aside>}
   </div>
   <div className="flex flex-wrap gap-4 text-xs text-gray-600"><span>{en?"◯ Seat":"◯ Место"}</span><span className="text-pink-700">{en?"● Selected":"● Выбрано"}</span><span>{en?"Reservations are not open yet":"Бронирование ещё не открыто"}</span></div>
   {selected&&<p className="text-sm text-gray-700" aria-live="polite"><strong>{selected.label}</strong> · {en?"Tap numbered seats on the map to select or deselect them.":"Нажмите на номер места на схеме, чтобы выбрать или отменить выбор."} {zones.length>0&&zoneForTable(selected,zones)?<span className="font-semibold"> · {money(zoneForTable(selected,zones)!.price_cents)} {en?"per seat":"за место"}</span>:null}</p>}
 </div>;
}
