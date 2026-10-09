"use client";
import {useState} from "react";
export type Point={x:number;y:number};
export type VenueFeature={id:string;event_id:string;kind:"wall"|"entrance";label:string|null;points:Point[]};
export function VenueLines({features,editing=false,onPointMove,onPick,onPointPick}:{features:VenueFeature[];editing?:boolean;onPointMove?:(id:string,index:number,point:Point)=>void;onPick?:(id:string)=>void;onPointPick?:(id:string,index:number)=>void}){
 const [drag,setDrag]=useState<{id:string;index:number}|null>(null);
 function coordinate(e:React.PointerEvent<SVGSVGElement>):Point{
  const svg=e.currentTarget;const rect=svg.getBoundingClientRect();
  return {x:Math.round(Math.max(0,Math.min(1000,(e.clientX-rect.left)/rect.width*1000))),y:Math.round(Math.max(0,Math.min(700,(e.clientY-rect.top)/rect.height*700)))};
 }
 return <svg viewBox="0 0 1000 700" preserveAspectRatio="none" className="absolute inset-0 z-[12] h-full w-full" style={{pointerEvents:"none",touchAction:editing?"none":"auto"}} onPointerMove={e=>{if(drag){e.stopPropagation();if(onPointMove)onPointMove(drag.id,drag.index,coordinate(e));}}} onPointerUp={e=>{if(drag)e.stopPropagation();setDrag(null)}} onPointerCancel={e=>{if(drag)e.stopPropagation();setDrag(null)}}>
  {features.map(f=><g key={f.id}>
   <polyline points={f.points.map(p=>p.x+","+p.y).join(" ")} fill="none" stroke={f.kind==="entrance"?"#15803d":"#232323"} strokeWidth={f.kind==="entrance"?9:6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={f.kind==="entrance"?"10 7":undefined}/>
   {editing&&f.points.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={11} fill="white" stroke={f.kind==="entrance"?"#15803d":"#db2777"} strokeWidth="3" style={{cursor:"grab",pointerEvents:"auto"}} onPointerDown={e=>{e.stopPropagation();setDrag({id:f.id,index:i});e.currentTarget.setPointerCapture(e.pointerId);onPick?.(f.id);onPointPick?.(f.id,i);}}/>)}
   {f.label&&f.points[0]&&<text x={f.points[0].x+12} y={f.points[0].y-10} fontSize="20" fill={f.kind==="entrance"?"#15803d":"#333"}>{f.label}</text>}
  </g>)}
 </svg>;
}
