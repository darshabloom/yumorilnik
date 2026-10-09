"use client";

import {useRef,useState} from "react";
import type {VenueFeature} from "@/components/VenueLines";

export type PublicTable={id:string;label:string;x:number;y:number;width:number;height:number;rotation_deg:number;seats_top:number;seats_bottom:number;seats_left:number;seats_right:number;table_price_cents:number|null;is_active:boolean};
export type PublicStage={stage_x:number;stage_y:number;stage_width:number;stage_height:number;stage_rotation:number};
type Seat={key:string;label:string;tableId:string;x:number;y:number};
type Mode="whole_table"|"individual_seats";
const WIDTH=1000,HEIGHT=700;
function seatPositions(table:PublicTable):Seat[]{
 const output:Seat[]=[];
 const sides=[{side:"top",n:table.seats_top},{side:"right",n:table.seats_right},{side:"bottom",n:table.seats_bottom},{side:"left",n:table.seats_left}];
 for(const {side,n} of sides)for(let i=0;i<n;i++){
  const ratio=(i+1)/(n+1),index=output.length+1;
  output.push({key:table.id+":"+index,label:String(index),tableId:table.id,
   x:side==="top"||side==="bottom"?ratio*table.width:side==="left"?-20:table.width+20,
   y:side==="left"||side==="right"?ratio*table.height:side==="top"?-20:table.height+20});
 }
 return output;
}
export default function CustomerVenueMap({tables,features,stage,mode="whole_table",selectedKeys=[],onToggle}:{tables:PublicTable[];features:VenueFeature[];stage:PublicStage|null;mode?:Mode;selectedKeys?:string[];onToggle?:(key:string)=>void}){
 const [view,setView]=useState({x:0,y:0,w:WIDTH,h:HEIGHT});
 const [focused,setFocused]=useState<string|null>(null);
 const svgRef=useRef<SVGSVGElement|null>(null);
 const pointers=useRef(new Map<number,{x:number;y:number}>());
 const gesture=useRef<{x:number;y:number;w:number;h:number;cx:number;cy:number;distance:number}|null>(null);
 const moved=useRef(false);
 const tap=useRef<{key:string;tableId:string}|null>(null);
 const downOrigin=useRef<{x:number;y:number}|null>(null);
 const selected=tables.find(t=>t.id===focused);
 const zoom=WIDTH/view.w;
 function clamp(x:number,y:number,w:number,h:number){return {x:Math.max(0,Math.min(WIDTH-w,x)),y:Math.max(0,Math.min(HEIGHT-h,y)),w,h};}
 function zoomTo(next:number){
  const scale=Math.max(1,Math.min(4,next)),w=WIDTH/scale,h=HEIGHT/scale;
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
  e.currentTarget.setPointerCapture(e.pointerId);
 }
 function move(e:React.PointerEvent<SVGSVGElement>){
  const prev=pointers.current.get(e.pointerId);if(!prev||!gesture.current)return;
  pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const p=getGesture();if(!p)return;
  if(downOrigin.current&&Math.hypot(e.clientX-downOrigin.current.x,e.clientY-downOrigin.current.y)>6)moved.current=true;
  const rect=e.currentTarget.getBoundingClientRect(),g=gesture.current;
  const ratio=g.distance&&p.distance?Math.max(1,Math.min(4,WIDTH/g.w*p.distance/g.distance)):WIDTH/g.w;
  const w=WIDTH/ratio,h=HEIGHT/ratio;
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
    <p className="text-sm text-gray-600">Перемещайте схему пальцем, увеличивайте двумя пальцами или кнопками.</p>
    <div className="flex items-center gap-1">
      <button type="button" aria-label="Уменьшить" onClick={()=>zoomTo(zoom/1.4)} className="h-10 w-10 rounded border border-black/30 bg-white font-bold">−</button>
      <button type="button" onClick={()=>zoomTo(1)} className="rounded border border-black/30 bg-white px-3 py-2 text-xs font-bold">{Math.round(zoom*100)}%</button>
      <button type="button" aria-label="Увеличить" onClick={()=>zoomTo(zoom*1.4)} className="h-10 w-10 rounded border border-black/30 bg-white font-bold">+</button>
    </div>
   </div>
   <div className="overflow-hidden rounded-xl border border-black/15 bg-[#fff2db]">
    <svg ref={svgRef} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} preserveAspectRatio="xMidYMid meet" aria-label="План зала" role="group" className="block aspect-[10/7] w-full cursor-grab touch-none" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      {features.map(f=><g key={f.id}>
       <polyline points={f.points.map(p=>p.x+","+p.y).join(" ")} stroke={f.kind==="entrance"?"#16803b":"#252525"} strokeWidth={f.kind==="entrance"?10:7} strokeDasharray={f.kind==="entrance"?"11 9":undefined} fill="none" strokeLinecap="round" strokeLinejoin="round"/>
       {f.label&&f.points[0]&&<text x={f.points[0].x+12} y={f.points[0].y-15} fontSize="18" fill="#16803b">{f.label}</text>}
      </g>)}
      {stage&&<g transform={`translate(${stage.stage_x} ${stage.stage_y}) rotate(${stage.stage_rotation} ${stage.stage_width/2} ${stage.stage_height/2})`}>
       <rect width={stage.stage_width} height={stage.stage_height} rx="7" fill="#f5a047" stroke="#9a5c19" strokeWidth="2"/>
       <text x={stage.stage_width/2} y={stage.stage_height/2+6} fontSize="19" textAnchor="middle" fontWeight="700">Сцена</text>
      </g>}
      {tables.filter(t=>t.is_active).map(t=><g key={t.id} transform={`translate(${t.x} ${t.y}) rotate(${t.rotation_deg} ${t.width/2} ${t.height/2})`}>
        <rect x="0" y="0" width={t.width} height={t.height} rx="7" fill={selectedKeys.includes(t.id)?"#f8c6dc":focused===t.id?"#ffe1ee":"#fff"} stroke={selectedKeys.includes(t.id)?"#c41e73":"#777"} strokeWidth="3" data-seat-key={mode==="whole_table"?t.id:""} data-table-id={t.id} style={{cursor:"pointer"}}/>
        <text x={t.width/2} y={t.height/2+7} fontSize="20" textAnchor="middle" fontWeight="700" pointerEvents="none">{t.label}</text>
        {seatPositions(t).map(s=><g key={s.key} data-seat-key={mode==="individual_seats"?s.key:t.id} data-table-id={t.id} style={{cursor:"pointer"}}>
          <circle cx={s.x} cy={s.y} r={13} fill={selectedKeys.includes(s.key)?"#f5a047":"#fff"} stroke="#333" strokeWidth="2"/>
          <text x={s.x} y={s.y+4} textAnchor="middle" fontSize="11" pointerEvents="none">{s.label}</text>
        </g>)}
      </g>)}
    </svg>
   </div>
   <div className="flex flex-wrap gap-4 text-xs text-gray-600"><span>◯ Место</span><span className="text-pink-700">● Выбрано</span><span>Бронирование ещё не открыто</span></div>
   {selected&&<div className="rounded-lg border border-black/15 bg-white p-4" aria-live="polite">
    <strong>{selected.label}</strong>
    <p className="text-sm">{seatPositions(selected).length} мест {mode==="whole_table"&&selected.table_price_cents!==null?" · Весь стол: "+money(selected.table_price_cents):""}</p>
    <p className="mt-1 text-xs text-gray-600">{mode==="whole_table"?"Нажмите на стол для предварительного выбора.":"Нажмите на отдельное место для предварительного выбора."} Это не бронь.</p>
   </div>}
 </div>;
}
