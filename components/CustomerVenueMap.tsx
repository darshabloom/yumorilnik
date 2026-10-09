"use client";
import {useState} from "react";
import {VenueLines,type VenueFeature} from "@/components/VenueLines";
export type PublicTable={id:string;label:string;x:number;y:number;width:number;height:number;rotation_deg:number;seats_top:number;seats_bottom:number;seats_left:number;seats_right:number;table_price_cents:number|null;is_active:boolean};
export type PublicStage={stage_x:number;stage_y:number;stage_width:number;stage_height:number;stage_rotation:number};
export default function CustomerVenueMap({tables,features,stage}:{tables:PublicTable[];features:VenueFeature[];stage:PublicStage|null}){
 const [zoom,setZoom]=useState(1);
 const [picked,setPicked]=useState<string|null>(null);
 const selected=tables.find(t=>t.id===picked);
 return <div className="space-y-3">
   <div className="flex items-center justify-between gap-2">
     <p className="text-sm text-gray-600">Tap a table to see its details. Seat reservations are not open yet.</p>
     <div className="flex gap-1"><button type="button" aria-label="Zoom out" onClick={()=>setZoom(z=>Math.max(1,z-0.3))} className="rounded border px-3 py-2 font-bold">−</button><button type="button" aria-label="Zoom in" onClick={()=>setZoom(z=>Math.min(3,z+0.3))} className="rounded border px-3 py-2 font-bold">+</button></div>
   </div>
   <div className="overflow-auto rounded-xl border border-black/15 bg-[#fff2db]">
     <div className="relative mx-auto w-full min-w-[320px]" style={{aspectRatio:"1000/700",width:zoom*100+"%"}}>
       <VenueLines features={features}/>
       {stage&&<div className="absolute flex items-center justify-center rounded-md bg-[#f5a047] text-xs font-bold" style={{left:stage.stage_x/10+"%",top:stage.stage_y/7+"%",width:stage.stage_width/10+"%",height:stage.stage_height/7+"%",transform:`rotate(${stage.stage_rotation}deg)`}}>Сцена</div>}
       {tables.filter(t=>t.is_active).map(t=><button key={t.id} type="button" onClick={()=>setPicked(t.id)} className={`absolute flex items-center justify-center rounded-md border-2 text-[10px] font-bold shadow sm:text-sm ${picked===t.id?"border-pink-700 bg-pink-100":"border-black/50 bg-white"}`} style={{left:t.x/10+"%",top:t.y/7+"%",width:t.width/10+"%",height:t.height/7+"%",transform:`rotate(${t.rotation_deg}deg)`}}>{t.label}</button>)}
     </div>
   </div>
   {selected&&<div className="rounded-lg border bg-white p-4"><strong>{selected.label}</strong><p className="text-sm">{selected.seats_top+selected.seats_bottom+selected.seats_left+selected.seats_right} seats {selected.table_price_cents!==null?"· Whole table: $"+(selected.table_price_cents/100).toFixed(2):""}</p><p className="mt-1 text-xs text-gray-600">Booking is not enabled yet.</p></div>}
 </div>;
}
