"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {useParams,useRouter} from "next/navigation";
import {supabase} from "@/lib/supabaseClient";
import {VenueLines, type VenueFeature, type Point} from "@/components/VenueLines";
import CustomerVenueMap from "@/components/CustomerVenueMap";

type TableItem={id:string;event_id:string;label:string;x:number;y:number;width:number;height:number;rotation_deg:number;seats_top:number;seats_bottom:number;seats_left:number;seats_right:number;table_price_cents:number|null;seat_price_cents:number|null;is_active:boolean;shape:string};
type EventItem={id:string;title:string;seating_mode:string;table_booking_mode:string};
const W=1000,H=700;
function seats(t:TableItem){return t.seats_top+t.seats_bottom+t.seats_left+t.seats_right}
function SeatMarkers({t}:{t:TableItem}){
 const dots:{x:number;y:number;label:string}[]=[];
 function add(n:number,side:string){for(let i=0;i<n;i++){const f=(i+1)/(n+1);dots.push({x:side==="top"||side==="bottom"?f*t.width:side==="left"?-14:t.width+14,y:side==="left"||side==="right"?f*t.height:side==="top"?-14:t.height+14,label:String(dots.length+1)})}}
 add(t.seats_top,"top");add(t.seats_right,"right");add(t.seats_bottom,"bottom");add(t.seats_left,"left");
 return <>{dots.map((p,i)=><div key={i} className="absolute flex h-5 w-5 items-center justify-center rounded-full border border-black bg-[#fffaf1] text-[9px]" style={{left:p.x-10,top:p.y-10}}>{p.label}</div>)}</>;
}
export default function SeatingBuilder(){
 const {id}=useParams<{id:string}>();
 const router=useRouter();
 const [event,setEvent]=useState<EventItem|null>(null);
 const [tables,setTables]=useState<TableItem[]>([]);
 const [background,setBackground]=useState<string|null>(null);
 const [showFloorPhoto,setShowFloorPhoto]=useState(true);
 const [features,setFeatures]=useState<VenueFeature[]>([]);
 const [traceMode,setTraceMode]=useState<"wall"|"entrance"|null>(null);
 const [draftPoints,setDraftPoints]=useState<Point[]>([]);
 const [featureSelected,setFeatureSelected]=useState<string|null>(null);
 const [selectedPoint,setSelectedPoint]=useState<{id:string;index:number}|null>(null);
 const [featureSaving,setFeatureSaving]=useState(false);
 const featureTimers=useRef<Record<string,ReturnType<typeof setTimeout>>>({});
 const [stageItem,setStageItem]=useState({x:440,y:18,width:130,height:42,rotation:0});
 const [editingStage,setEditingStage]=useState(false);
 const stageDrag=useRef<{px:number;py:number;x:number;y:number}|null>(null);
 const [uploading,setUploading]=useState(false);
 const [zoom,setZoom]=useState(1);
 const [panX,setPanX]=useState(50);
 const [panY,setPanY]=useState(50);
 const [framing,setFraming]=useState(false);
 const [framingSaving,setFramingSaving]=useState(false);
 const panDrag=useRef<{px:number;py:number;x:number;y:number}|null>(null);
 const [selected,setSelected]=useState<string|null>(null);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const stage=useRef<HTMLDivElement|null>(null);
 const drag=useRef<{id:string;startX:number;startY:number;x:number;y:number}|null>(null);
 const resize=useRef<{id:string;startX:number;startY:number;width:number;height:number;angle:number}|null>(null);
 const rotating=useRef<{id:string;centerX:number;centerY:number}|null>(null);
 const pending=useRef<Record<string,TableItem>>({});
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const flushing=useRef(false);
 const latest=useRef<TableItem[]>([]);
 const framingSaved=useRef("");
 const stageSaved=useRef("");
 useEffect(()=>{let mounted=true;(async()=>{
  try{
   const {data:{user}}=await supabase.auth.getUser();if(!user){router.replace("/admin/login");return;}
   const {data:admin}=await supabase.from("admin_users").select("role").eq("user_id",user.id).maybeSingle();
   if(!admin){router.replace("/admin/login");return;}
   const [e,t,m,v]=await Promise.all([supabase.from("events").select("id,title,seating_mode,table_booking_mode").eq("id",id).single(),supabase.from("seating_tables").select("*").eq("event_id",id).order("created_at"),supabase.from("event_seating_maps").select("background_image_url,background_zoom,background_x,background_y,stage_x,stage_y,stage_width,stage_height,stage_rotation").eq("event_id",id).maybeSingle(),supabase.from("seating_features").select("id,event_id,kind,label,points").eq("event_id",id).order("created_at")]);
   if(e.error)throw e.error;if(t.error)throw t.error;if(m.error)throw m.error;if(v.error)throw v.error;
   if(mounted){setEvent(e.data as EventItem);setFeatures((v.data??[]) as VenueFeature[]);setTables((t.data??[]) as TableItem[]);latest.current=(t.data??[]) as TableItem[];setBackground(m.data?.background_image_url??null);setZoom(Number(m.data?.background_zoom??1));setPanX(Number(m.data?.background_x??50));setPanY(Number(m.data?.background_y??50));setStageItem({x:Number(m.data?.stage_x??440),y:Number(m.data?.stage_y??18),width:Number(m.data?.stage_width??130),height:Number(m.data?.stage_height??42),rotation:Number(m.data?.stage_rotation??0)});stageSaved.current=JSON.stringify([Number(m.data?.stage_x??440),Number(m.data?.stage_y??18),Number(m.data?.stage_width??130),Number(m.data?.stage_height??42),Number(m.data?.stage_rotation??0)]);framingSaved.current=JSON.stringify([Number(m.data?.background_zoom??1),Number(m.data?.background_x??50),Number(m.data?.background_y??50)])}
  }catch(ex){if(mounted)setError(ex instanceof Error?ex.message:"Unable to load seating map")}
  finally{if(mounted)setLoading(false)}
 })();return()=>{mounted=false}},[id,router]);
 useEffect(()=>{
  if(loading)return;
  const key=JSON.stringify([stageItem.x,stageItem.y,stageItem.width,stageItem.height,stageItem.rotation]);
  if(key===stageSaved.current)return;
  setMessage("Saving stage…");
  const timer=setTimeout(async()=>{
   const {error:e}=await supabase.from("event_seating_maps").upsert({event_id:id,stage_x:stageItem.x,stage_y:stageItem.y,stage_width:stageItem.width,stage_height:stageItem.height,stage_rotation:stageItem.rotation,updated_at:new Date().toISOString()},{onConflict:"event_id"});
   if(e){setError("Stage autosave failed: "+e.message);setMessage("Not saved");}
   else{stageSaved.current=key;setMessage("Stage saved");}
  },1100);
  return()=>clearTimeout(timer);
 },[stageItem,loading,id]);
 useEffect(()=>{
  if(loading||!background)return;
  const key=JSON.stringify([zoom,panX,panY]);
  if(key===framingSaved.current)return;
  const timer=setTimeout(async()=>{
   const {error:e}=await supabase.from("event_seating_maps").update({background_zoom:zoom,background_x:panX,background_y:panY,updated_at:new Date().toISOString()}).eq("event_id",id);
   if(e){setError("Background autosave failed: "+e.message);setMessage("Not saved");}
   else{framingSaved.current=key;setMessage("Floor plan saved");}
  },1100);
  return()=>clearTimeout(timer);
 },[zoom,panX,panY,background,loading,id]);
 const current=tables.find(t=>t.id===selected);
 function mutate(id:string,patch:Partial<TableItem>){
  const next=latest.current.map(t=>t.id===id?{...t,...patch}:t);
  latest.current=next;setTables(next);
  const t=next.find(t=>t.id===id);if(t)pending.current[id]=t;
  setMessage("Unsaved changes");
  if(timer.current)clearTimeout(timer.current);
  timer.current=setTimeout(()=>{void flushChanges()},950);
 }
 async function flushChanges(){
  if(flushing.current)return;
  flushing.current=true;
  const batch=pending.current;pending.current={};
  const work=Object.values(batch);
  if(work.length){setMessage("Saving…");setError("");}
  for(const t of work){
   const {error:e}=await supabase.from("seating_tables").update({label:t.label,x:t.x,y:t.y,width:t.width,height:t.height,rotation_deg:t.rotation_deg,seats_top:t.seats_top,seats_bottom:t.seats_bottom,seats_left:t.seats_left,seats_right:t.seats_right,table_price_cents:t.table_price_cents,seat_price_cents:t.seat_price_cents,is_active:t.is_active}).eq("id",t.id).eq("event_id",id);
   if(e){pending.current[t.id]=pending.current[t.id]??t;setError("Autosave failed: "+e.message);setMessage("Not saved");}
  }
  flushing.current=false;
  if(Object.keys(pending.current).length){if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>{void flushChanges()},1100);}
  else if(work.length)setMessage("Saved");
 }

 async function saveStage(){
  setSaving(true);setError("");
  const {error:e}=await supabase.from("event_seating_maps").upsert({event_id:id,stage_x:stageItem.x,stage_y:stageItem.y,stage_width:stageItem.width,stage_height:stageItem.height,stage_rotation:stageItem.rotation,updated_at:new Date().toISOString()},{onConflict:"event_id"});
  if(e)setError(e.message);else setMessage("Stage position saved.");
  setSaving(false);
 }
 function beginStageDrag(e:React.PointerEvent<HTMLButtonElement>){
  if(e.button!==0)return;
  e.preventDefault();e.stopPropagation();
  setEditingStage(true);setSelected(null);
  const scale=stage.current?.getBoundingClientRect().width/W||1;
  stageDrag.current={px:e.clientX/scale,py:e.clientY/scale,x:stageItem.x,y:stageItem.y};
  e.currentTarget.setPointerCapture(e.pointerId);
 }
 function moveStageDrag(e:React.PointerEvent<HTMLButtonElement>){
  if(!stageDrag.current)return;
  const scale=stage.current?.getBoundingClientRect().width/W||1;
  const d=stageDrag.current;
  setStageItem(old=>({...old,x:Math.round(Math.max(0,Math.min(W-old.width,d.x+e.clientX/scale-d.px))),y:Math.round(Math.max(0,Math.min(H-old.height,d.y+e.clientY/scale-d.py)))}));
  setMessage("Stage position not saved");
 }
 async function saveFraming(z=zoom,x=panX,y=panY){
  setFramingSaving(true);setError("");
  const {error:e}=await supabase.from("event_seating_maps").update({background_zoom:z,background_x:x,background_y:y,updated_at:new Date().toISOString()}).eq("event_id",id);
  if(e)setError(e.message);else setMessage("Floor plan framing saved.");
  setFramingSaving(false);
 }
 function startPan(e:React.PointerEvent<HTMLDivElement>){
  if(!framing || traceMode || !background || e.target!==e.currentTarget)return;
  e.preventDefault();
  panDrag.current={px:e.clientX,py:e.clientY,x:panX,y:panY};
  e.currentTarget.setPointerCapture(e.pointerId);
 }
 function movePan(e:React.PointerEvent<HTMLDivElement>){
  if(!framing||traceMode||!panDrag.current||!stage.current)return;
  const rect=stage.current.getBoundingClientRect();
  const x=Math.max(0,Math.min(100,panDrag.current.x+(e.clientX-panDrag.current.px)/rect.width*100));
  const y=Math.max(0,Math.min(100,panDrag.current.y+(e.clientY-panDrag.current.py)/rect.height*100));
  setPanX(Math.round(x));setPanY(Math.round(y));setMessage("Background position not saved");
 }
 async function uploadFloorPlan(file:File|undefined){
  if(!file)return;
  if(!["image/jpeg","image/png","image/webp"].includes(file.type)){setError("Upload a JPG, PNG or WebP image.");return;}
  if(file.size>10*1024*1024){setError("Floor plan must be smaller than 10 MB.");return;}
  setUploading(true);setError("");setMessage("");
  try{
    const ext=file.type==="image/jpeg"?"jpg":file.type==="image/png"?"png":"webp";
    const key=`${id}/floor-plan-${crypto.randomUUID()}.${ext}`;
    const {error:uploadError}=await supabase.storage.from("event-images").upload(key,file,{upsert:false,contentType:file.type});
    if(uploadError)throw uploadError;
    const {data}=supabase.storage.from("event-images").getPublicUrl(key);
    const {error:dbError}=await supabase.from("event_seating_maps").upsert({event_id:id,background_image_url:data.publicUrl,background_zoom:1,background_x:50,background_y:50,canvas_width:W,canvas_height:H,updated_at:new Date().toISOString()},{onConflict:"event_id"});
    if(dbError)throw dbError;
    setBackground(data.publicUrl);setZoom(1);setPanX(50);setPanY(50);framingSaved.current=JSON.stringify([1,50,50]);setMessage("Floor plan uploaded and saved.");
  }catch(e){setError(e instanceof Error?e.message:"Upload failed");}
  finally{setUploading(false);}
 }
 async function clearFloorPlan(){
   const {error:e}=await supabase.from("event_seating_maps").update({background_image_url:null,updated_at:new Date().toISOString()}).eq("event_id",id);
   if(e)setError(e.message);else{setBackground(null);setMessage("Floor plan removed.");}
 }
 function coord(e:React.MouseEvent<SVGSVGElement>):Point{
   const rect=e.currentTarget.getBoundingClientRect();
   return {x:Math.round((e.clientX-rect.left)/rect.width*W),y:Math.round((e.clientY-rect.top)/rect.height*H)};
 }
 async function finishFeature(){
  if(!traceMode||draftPoints.length<2){setError("Place at least two points to finish.");return;}
  setFeatureSaving(true);setError("");
  const {data,error:e}=await supabase.from("seating_features").insert({event_id:id,kind:traceMode,label:traceMode==="entrance"?"Entrance":null,points:draftPoints}).select("id,event_id,kind,label,points").single();
  if(e)setError(e.message);else {setFeatures(old=>[...old,data as VenueFeature]);setDraftPoints([]);setMessage("Wall or entrance saved.");}
  setFeatureSaving(false);
 }
 function moveFeaturePoint(fid:string,index:number,p:Point){
  setFeatures(old=>old.map(item=>item.id===fid?{...item,points:item.points.map((old,i)=>i===index?p:old)}:item));
  setMessage("Saving wall…");
  if(featureTimers.current[fid])clearTimeout(featureTimers.current[fid]);
  featureTimers.current[fid]=setTimeout(async()=>{
    const currentFeatures=featuresRef.current;
    const feat=currentFeatures.find(item=>item.id===fid);
    if(!feat)return;
    const {error:e}=await supabase.from("seating_features").update({points:feat.points,updated_at:new Date().toISOString()}).eq("id",fid).eq("event_id",id);
    if(e)setError(e.message);else setMessage("Wall saved.");
  },900);
 }
 const featuresRef=useRef<VenueFeature[]>(features);
 featuresRef.current=features;
 async function deletePoint(){
   if(!selectedPoint)return;
   const feature=featuresRef.current.find(f=>f.id===selectedPoint.id);
   if(!feature)return;
   if(feature.points.length<=2){setError("A wall or entrance needs at least two points. Delete the whole feature instead.");return;}
   const points=feature.points.filter((_,i)=>i!==selectedPoint.index);
   setError("");setMessage("Saving point deletion…");
   if(featureTimers.current[feature.id])clearTimeout(featureTimers.current[feature.id]);
   const {error:e}=await supabase.from("seating_features").update({points,updated_at:new Date().toISOString()}).eq("id",feature.id).eq("event_id",id);
   if(e){setError(e.message);setMessage("Not saved");return;}
   setFeatures(old=>old.map(f=>f.id===feature.id?{...f,points}:f));setSelectedPoint(null);setMessage("Point deleted and saved.");
 }
 async function deleteFeature(){
   if(!featureSelected)return;
   const {error:e}=await supabase.from("seating_features").delete().eq("id",featureSelected).eq("event_id",id);
   if(e){setError(e.message);return;}
   setFeatures(old=>old.filter(item=>item.id!==featureSelected));setFeatureSelected(null);setSelectedPoint(null);setMessage("Feature deleted.");
 }
 async function applySuggestedSeatPrices(){
  if(!confirm("Apply the proposed $10/$20/$30 seat prices? This will replace existing seat surcharges for the named tables, but leave all other tables unchanged."))return;
  const pricing:Record<number,number>={1:10,4:10,5:10,7:10,9:10,17:10,2:20,3:20,6:20,11:20,12:20,16:20,10:30,13:30,14:30,15:30,18:30};
  const changes=latest.current.flatMap(t=>{
    const match=t.label.match(/^(?:table\\s*|t)(\\d+)$/i);
    const amount=match?pricing[Number(match[1])]:undefined;
    return amount===undefined?[]:[{...t,seat_price_cents:amount*100}];
  });
  if(!changes.length){setError("No matching numbered tables found. Edit each table price manually.");return;}
  setSaving(true);setError("");
  let saved=0;
  for(const t of changes){
    const {error:e}=await supabase.from("seating_tables").update({seat_price_cents:t.seat_price_cents}).eq("id",t.id).eq("event_id",id);
    if(e){setError("Bulk pricing stopped: "+e.message);break;}
    saved++;
    setTables(old=>{const next=old.map(row=>row.id===t.id?{...row,seat_price_cents:t.seat_price_cents}:row);latest.current=next;return next});
  }
  setMessage(saved+" table surcharge(s) saved. Other tables unchanged.");
  setSaving(false);
 }
 async function add(){
  const n=tables.length+1;
  const source=tables.find(t=>t.id===selected)??tables[tables.length-1];
  const used=new Set(tables.map(t=>t.label));
  let nextNumber=n;while(used.has("Table "+nextNumber))nextNumber++;
  const record={event_id:id,label:"Table "+nextNumber,shape:source?.shape??"rectangle",x:source?Math.min(900,source.x+35):130,y:source?Math.min(620,source.y+45):130,width:source?.width??140,height:source?.height??65,rotation_deg:source?.rotation_deg??0,seats_top:source?.seats_top??2,seats_bottom:source?.seats_bottom??2,seats_left:source?.seats_left??1,seats_right:source?.seats_right??1,table_price_cents:source?.table_price_cents??null,seat_price_cents:source?.seat_price_cents??null,is_active:true};
  setSaving(true);setError("");
  const {data,error:e}=await supabase.from("seating_tables").insert(record).select("*").single();
  if(e)setError(e.message);else{setTables(old=>{const next=[...old,data as TableItem];latest.current=next;return next});setSelected(data.id);setMessage("Table added")}
  setSaving(false);
 }
 async function save(){
  setSaving(true);setError("");
  if(timer.current)clearTimeout(timer.current);
  for(const t of latest.current){
   const {error:e}=await supabase.from("seating_tables").update({label:t.label,x:t.x,y:t.y,width:t.width,height:t.height,rotation_deg:t.rotation_deg,seats_top:t.seats_top,seats_bottom:t.seats_bottom,seats_left:t.seats_left,seats_right:t.seats_right,table_price_cents:t.table_price_cents,seat_price_cents:t.seat_price_cents,is_active:t.is_active}).eq("id",t.id).eq("event_id",id);
   if(e){setError(e.message);setSaving(false);return}
  }
  pending.current={};setMessage("Layout saved");setSaving(false);
 }
 async function remove(){
  if(!current||!confirm("Remove "+current.label+" from this event?"))return;
  const {error:e}=await supabase.from("seating_tables").delete().eq("id",current.id).eq("event_id",id);
  if(e){setError(e.message);return}
  setTables(old=>{const next=old.filter(t=>t.id!==current.id);latest.current=next;return next});delete pending.current[current.id];setSelected(null);setMessage("Table removed");
 }
 function pointerDown(e:React.PointerEvent<HTMLButtonElement>,t:TableItem){
  setEditingStage(false);
  if(e.button!==0)return;
  e.preventDefault();setSelected(t.id);
  const scale=stage.current?.getBoundingClientRect().width/W||1;
  drag.current={id:t.id,startX:e.clientX/scale,startY:e.clientY/scale,x:t.x,y:t.y};
  e.currentTarget.setPointerCapture(e.pointerId);
 }
 function pointerMove(e:React.PointerEvent<HTMLButtonElement>){
  const d=drag.current;if(!d)return;
  const scale=stage.current?.getBoundingClientRect().width/W||1;
  mutate(d.id,{x:Math.round(Math.max(0,Math.min(900,d.x+e.clientX/scale-d.startX))),y:Math.round(Math.max(0,Math.min(620,d.y+e.clientY/scale-d.startY)))});
 }
 function rotateDown(e:React.PointerEvent<HTMLButtonElement>,t:TableItem){
  e.stopPropagation();e.preventDefault();setSelected(t.id);setEditingStage(false);
  const rect=stage.current?.getBoundingClientRect();if(!rect)return;
  const scale=rect.width/W;
  rotating.current={id:t.id,centerX:rect.left+(t.x+t.width/2)*scale,centerY:rect.top+(t.y+t.height/2)*scale};
  e.currentTarget.setPointerCapture(e.pointerId);
 }
 function rotateMove(e:React.PointerEvent<HTMLButtonElement>){
  const d=rotating.current;if(!d)return;e.preventDefault();e.stopPropagation();
  const angle=Math.atan2(e.clientY-d.centerY,e.clientX-d.centerX)*180/Math.PI+90;
  const normalized=((Math.round(angle/5)*5+180+360)%360)-180;
  mutate(d.id,{rotation_deg:normalized});
 }
 function resizeDown(e:React.PointerEvent<HTMLButtonElement>,t:TableItem){
  e.preventDefault();e.stopPropagation();setSelected(t.id);setEditingStage(false);
  resize.current={id:t.id,startX:e.clientX,startY:e.clientY,width:t.width,height:t.height,angle:t.rotation_deg*Math.PI/180};
  e.currentTarget.setPointerCapture(e.pointerId);
 }
 function resizeMove(e:React.PointerEvent<HTMLButtonElement>){
  const d=resize.current;if(!d)return;
  e.preventDefault();e.stopPropagation();
  const scale=stage.current?.getBoundingClientRect().width/W||1;
  const dx=(e.clientX-d.startX)/scale,dy=(e.clientY-d.startY)/scale;
  const localX=dx*Math.cos(d.angle)+dy*Math.sin(d.angle);
  const localY=-dx*Math.sin(d.angle)+dy*Math.cos(d.angle);
  mutate(d.id,{width:Math.round(Math.max(40,Math.min(400,d.width+localX))),height:Math.round(Math.max(25,Math.min(300,d.height+localY)))});
 }
 if(loading)return <main className="bg-[#fffaf1] p-8">Loading seating builder…</main>;
 if(!event)return <main role="alert" className="p-8">{error||"Event unavailable"}</main>;
 const whole=event.seating_mode==="tables"&&event.table_booking_mode==="whole_table";
 return <main className="min-h-screen bg-[#fffaf1] px-4 py-6 text-black sm:px-8">
  <section className="mx-auto max-w-xl space-y-4 lg:hidden">
    <Link href={`/admin/events/${id}/tickets`} className="text-sm font-bold underline">← Tickets</Link>
    <div className="rounded-xl border border-black/15 bg-white p-5">
      <h1 className="text-xl font-black">{event.title}</h1>
      <p className="mt-2 text-sm text-gray-700">The venue plan is for viewing on a phone. To move tables, trace walls or change prices, open this page on a computer.</p>
    </div>
    <CustomerVenueMap tables={tables} features={features} stage={{stage_x:stageItem.x,stage_y:stageItem.y,stage_width:stageItem.width,stage_height:stageItem.height,stage_rotation:stageItem.rotation}} mode={whole?"whole_table":"individual_seats"}/>
  </section>
  <div className="mx-auto hidden max-w-7xl lg:block">
   <Link href={`/admin/events/${id}/tickets`} className="text-sm font-bold underline">← Tickets</Link>
   <div className="sticky top-0 z-40 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-black/15 bg-[#fffaf1]/95 px-3 py-3 shadow-sm backdrop-blur"><div><p className="text-xs font-bold uppercase tracking-widest text-pink-700">Seating layout</p><h1 className="text-3xl font-black">{event.title}</h1></div><div className="flex gap-2"><button onClick={()=>void add()} disabled={saving} className="rounded-lg bg-black px-4 py-3 font-bold text-white">+ Add table</button><button onClick={()=>void save()} disabled={saving} className="rounded-lg border border-black px-4 py-3 font-bold">{saving?"Saving…":"Save layout"}</button></div></div>
   <p className="mt-3 text-sm text-gray-600">Drag the stage to its actual location. Drag a table to position it. Select a table to edit its size, seats, rotation and price. Pricing is per entire table in whole-table mode.</p>
   <details className="mt-3 hidden rounded-xl border border-black/15 bg-white lg:block"><summary className="cursor-pointer px-4 py-3 text-sm font-bold">Floor plan image & framing controls ▾</summary><div className="border-t border-black/10 p-2">   <div className="flex flex-wrap items-center gap-3 p-3">
     <label className="cursor-pointer rounded-lg border-2 border-dashed border-black bg-[#fff2db] px-4 py-3 text-sm font-bold">
       {uploading?"Uploading…":background?"Replace floor plan":"Upload floor plan"}
       <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} className="sr-only" onChange={e=>{void uploadFloorPlan(e.target.files?.[0]);e.target.value="";}}/>
     </label>
     {background&&<button type="button" onClick={()=>void clearFloorPlan()} className="text-sm font-bold underline">Remove background</button>}
     <span className="text-xs text-gray-600">JPG, PNG, WebP · up to 10 MB. Tables remain editable above the image.</span>
   </div>
   {background&&<div className="rounded-xl border border-black/15 bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-black">Adjust floor plan</h2><p className="text-sm text-gray-600">Zoom and move the image behind the tables. Table positions are unchanged.</p></div>
      <button type="button" onClick={()=>setFraming(!framing)} className={`rounded-lg border px-4 py-2 text-sm font-bold ${framing?"bg-black text-white":"bg-white"}`}>{framing?"Finish moving image":"Move image on canvas"}</button>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <label className="text-sm font-semibold">Zoom · {Math.round(zoom*100)}%<input className="mt-2 w-full" type="range" min=".5" max="5" step=".05" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/></label>
      <label className="text-sm font-semibold">Move left/right · {panX}%<input className="mt-2 w-full" type="range" min="0" max="100" value={panX} onChange={e=>setPanX(Number(e.target.value))}/></label>
      <label className="text-sm font-semibold">Move up/down · {panY}%<input className="mt-2 w-full" type="range" min="0" max="100" value={panY} onChange={e=>setPanY(Number(e.target.value))}/></label>
    </div>
    <div className="mt-3 flex gap-2">
      <button type="button" onClick={()=>{setZoom(1);setPanX(50);setPanY(50);setMessage("Background framing reset; save to keep changes.");}} className="rounded-lg border px-4 py-2 text-sm font-bold">Reset framing</button>
      <button type="button" disabled={framingSaving} onClick={()=>void saveFraming()} className="rounded-lg bg-black px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{framingSaving?"Saving…":"Save image framing"}</button>
    </div>
   </div>}
</div></details>
   <div className="mt-3 hidden flex-wrap items-center gap-2 rounded-xl border border-black/15 bg-white p-3 lg:flex">
     <span className="mr-2 text-sm font-black">Room layout</span>
     {background&&<button type="button" onClick={()=>setShowFloorPhoto(v=>!v)} aria-pressed={!showFloorPhoto} className="rounded-lg border border-black px-4 py-2 text-sm font-bold">{showFloorPhoto?"Hide photo":"Show photo"}</button>}
     <button type="button" onClick={()=>{setTraceMode(traceMode==="wall"?null:"wall");setDraftPoints([]);setFraming(false);panDrag.current=null;}} className={`rounded-lg border px-4 py-2 text-sm font-bold ${traceMode==="wall"?"bg-black text-white":""}`}>Trace walls</button>
     <button type="button" onClick={()=>{setTraceMode(traceMode==="entrance"?null:"entrance");setDraftPoints([]);setFraming(false);panDrag.current=null;}} className={`rounded-lg border px-4 py-2 text-sm font-bold ${traceMode==="entrance"?"bg-black text-white":""}`}>Mark entrance</button>
     {traceMode&&<><button type="button" disabled={featureSaving||draftPoints.length<2} onClick={()=>void finishFeature()} className="rounded-lg bg-black px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Finish & save</button>
     <button type="button" onClick={()=>setDraftPoints(old=>old.slice(0,-1))} className="rounded border px-3 py-2 text-sm">Undo point</button>
     <button type="button" onClick={()=>{setTraceMode(null);setDraftPoints([])}} className="rounded border px-3 py-2 text-sm">Done tracing</button></>}
     <span className="text-xs text-gray-600">{traceMode?"Click points along the photo. Double-click to finish. Drag pink endpoints to correct walls.":"Walls and entrances appear on the customer map."}</span>
   </div>
   {error&&<p role="alert" className="mt-4 rounded bg-red-100 p-3 text-red-800">{error}</p>}
   {message&&<p role="status" className="mt-3 text-sm font-semibold">{message}</p>}
   <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
    <div className="overflow-x-auto rounded-xl border border-black/20 bg-white p-2">
     <div ref={stage} className="pointer-events-none relative w-full min-w-[320px] overflow-hidden rounded-lg bg-[#fff2db] lg:pointer-events-auto" style={{aspectRatio:W+"/"+H,touchAction:framing?"none":"pan-y"}} onPointerDown={startPan} onPointerMove={movePan} onPointerUp={()=>{panDrag.current=null}} onPointerCancel={()=>{panDrag.current=null}}>
       {background&&showFloorPhoto&&<div className="pointer-events-none absolute inset-0 overflow-hidden"><img src={background} alt="Uploaded venue floor plan" className="absolute h-full w-full object-contain" style={{transform:`scale(${zoom})`,objectPosition:`${panX}% ${panY}%`,transformOrigin:`${panX}% ${panY}%`}}/></div>}
       <VenueLines features={features} editing={!!traceMode} onPointMove={moveFeaturePoint} onPick={setFeatureSelected} onPointPick={(fid,index)=>setSelectedPoint({id:fid,index})}/>
       {traceMode&&<svg viewBox="0 0 1000 700" preserveAspectRatio="none" className="absolute inset-0 z-[11] h-full w-full cursor-crosshair" onClick={e=>{if(e.detail>1)return;const point=coord(e);setDraftPoints(old=>[...old,point])}} onDoubleClick={e=>{e.preventDefault();void finishFeature()}}>
          {draftPoints.length>0&&<polyline points={draftPoints.map(p=>p.x+","+p.y).join(" ")} fill="none" stroke="#db2777" strokeWidth="5" strokeDasharray="10 6"/>}
          {draftPoints.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="8" fill="#db2777" stroke="white" strokeWidth="3"/>)}
        </svg>}
       {!framing&&!traceMode&&<button type="button" onPointerDown={beginStageDrag} onPointerMove={moveStageDrag} onPointerUp={()=>{stageDrag.current=null}} onPointerCancel={()=>{stageDrag.current=null}} onClick={()=>{setEditingStage(true);setSelected(null)}} className={`absolute z-10 flex touch-none select-none items-center justify-center rounded-lg border-2 border-black/25 bg-[#f5a047] text-sm font-bold ${editingStage?"ring-2 ring-pink-600":""}`} style={{left:stageItem.x/W*100+"%",top:stageItem.y/H*100+"%",width:stageItem.width/W*100+"%",height:stageItem.height/H*100+"%",transform:`rotate(${stageItem.rotation}deg)`}}>Stage</button>}
       {!framing&&tables.filter(t=>t.is_active).map(t=><div key={t.id} className={traceMode?"pointer-events-none absolute opacity-75":"absolute"} style={{left:t.x/W*100+"%",top:t.y/H*100+"%",width:t.width/W*100+"%",height:t.height/H*100+"%",transform:`rotate(${t.rotation_deg}deg)`}}><button type="button" onPointerDown={e=>pointerDown(e,t)} onPointerMove={pointerMove} onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}}
        className={`absolute select-none touch-none rounded-lg border-2 text-sm font-bold shadow ${selected===t.id?"border-pink-600 bg-[#ffd7e8]":"border-black/50 bg-white"}`}
        style={{width:"100%",height:"100%"}}>
         {t.label}<SeatMarkers t={t}/>
       </button>
       {!traceMode&&selected===t.id&&<button type="button" aria-label={"Rotate "+t.label} title="Drag to rotate" onPointerDown={e=>rotateDown(e,t)} onPointerMove={rotateMove} onPointerUp={()=>{rotating.current=null}} onPointerCancel={()=>{rotating.current=null}} className="absolute -top-10 left-1/2 z-20 flex h-8 w-8 -translate-x-1/2 touch-none items-center justify-center rounded-full border-2 border-pink-600 bg-white text-lg font-black shadow">⟳</button>}
       {!traceMode&&selected===t.id&&<button type="button" aria-label={"Resize "+t.label} title="Drag to resize table" onPointerDown={e=>resizeDown(e,t)} onPointerMove={resizeMove} onPointerUp={()=>{resize.current=null}} onPointerCancel={()=>{resize.current=null}} className="absolute -bottom-3 -right-3 z-20 flex h-7 w-7 touch-none items-center justify-center rounded-md border-2 border-pink-600 bg-white text-sm font-black shadow">↘</button>}
       </div>)}
     </div>
    </div>
    <aside className="hidden rounded-xl border border-black/20 bg-white p-4 lg:sticky lg:block lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto">
     <button type="button" disabled={saving} onClick={()=>void applySuggestedSeatPrices()} className="mb-4 w-full rounded-lg border border-black/30 bg-[#fff2db] p-3 text-left text-sm font-semibold disabled:opacity-50">Apply proposed seat tiers · $10 / $20 / $30</button>
     {traceMode?<><h2 className="text-xl font-black">Tracing walls</h2><p className="mt-2 text-sm">Click along walls to create connected segments. Double-click or Finish to save. Drag circular points to make corrections.</p>
       <h3 className="mt-5 font-bold">Saved features</h3>
       {features.map(f=><button key={f.id} type="button" onClick={()=>{setFeatureSelected(f.id);setSelectedPoint(null)}} className={`mt-2 block w-full rounded border p-2 text-left text-sm ${featureSelected===f.id?"border-pink-600 bg-pink-50":""}`}>{f.kind==="wall"?"Wall":"Entrance"} · {f.points.length} points</button>)}
       {selectedPoint&&featureSelected===selectedPoint.id&&<div className="mt-3 rounded-lg border border-pink-300 bg-pink-50 p-3">
         <p className="text-sm font-semibold">Selected point {selectedPoint.index+1}</p>
         <button type="button" onClick={()=>void deletePoint()} className="mt-2 rounded border border-red-700 px-3 py-2 text-sm font-bold text-red-700">Delete this point</button>
       </div>}
       {featureSelected&&<button type="button" onClick={()=>void deleteFeature()} className="mt-3 font-bold text-red-700 underline">Delete entire wall / entrance</button>}
     </>:editingStage?<><h2 className="text-xl font-black">Edit stage</h2><p className="mt-2 text-sm text-gray-600">Drag the stage into place or adjust its size and rotation here.</p>
       <div className="mt-4 grid grid-cols-2 gap-3">
         {([{key:"width",label:"Width",min:60,max:400},{key:"height",label:"Height",min:25,max:220},{key:"rotation",label:"Rotation °",min:-180,max:180}] as const).map(f=><label key={f.key} className="text-sm font-bold">{f.label}<input type="number" className="mt-1 w-full rounded border p-2" min={f.min} max={f.max} value={stageItem[f.key]} onChange={e=>setStageItem(old=>({...old,[f.key]:Math.max(f.min,Math.min(f.max,Number(e.target.value)||0))}))}/></label>)}
       </div>
       <label className="mt-4 block text-sm font-bold">Turn stage · {stageItem.rotation}°<input type="range" min="-180" max="180" step="5" className="mt-2 w-full" value={stageItem.rotation} onChange={e=>setStageItem(old=>({...old,rotation:Number(e.target.value)}))}/></label>
       <div className="mt-3 flex gap-2"><button onClick={()=>setStageItem(old=>({...old,rotation:old.rotation-15< -180?165:old.rotation-15}))} className="rounded border px-3 py-2">↶ 15°</button><button onClick={()=>setStageItem(old=>({...old,rotation:old.rotation+15>180?-165:old.rotation+15}))} className="rounded border px-3 py-2">↷ 15°</button></div>
       <button onClick={()=>void saveStage()} disabled={saving} className="mt-5 w-full rounded-lg bg-black px-4 py-3 font-bold text-white">Save stage position</button>
     </>:current?<><h2 className="text-xl font-black">Edit {current.label}</h2>
       <label className="mt-4 block text-sm font-bold">Table name<input className="mt-1 w-full rounded border p-2" value={current.label} onChange={e=>mutate(current.id,{label:e.target.value})}/></label>
       <div className="mt-3 grid grid-cols-2 gap-3">{([{field:"width",label:"Width",min:80,max:340},{field:"height",label:"Height",min:45,max:240},{field:"rotation_deg",label:"Rotation °",min:-180,max:180} ] as const).map(o=><label key={o.field} className="text-sm font-bold">{o.label}<input type="number" min={o.min} max={o.max} value={current[o.field]} onChange={e=>mutate(current.id,{[o.field]:Math.max(o.min,Math.min(o.max,Number(e.target.value)||0))})} className="mt-1 w-full rounded border p-2"/></label>)}</div>
       <p className="mt-2 text-xs text-gray-600">Use the ↘ handle on the selected table to resize it directly.</p>
       <div className="mt-4"><label className="block text-sm font-bold">Turn table · {current.rotation_deg}°<input aria-label="Rotate table" className="mt-2 w-full" type="range" min="-180" max="180" step="5" value={current.rotation_deg} onChange={e=>mutate(current.id,{rotation_deg:Number(e.target.value)})}/></label>
        <div className="mt-2 flex gap-2">
         <button type="button" onClick={()=>mutate(current.id,{rotation_deg:Math.max(-180,current.rotation_deg-15)})} className="rounded border px-3 py-2 text-sm font-bold">↶ 15°</button>
         <button type="button" onClick={()=>mutate(current.id,{rotation_deg:Math.min(180,current.rotation_deg+15)})} className="rounded border px-3 py-2 text-sm font-bold">↷ 15°</button>
         <button type="button" onClick={()=>mutate(current.id,{rotation_deg:0})} className="rounded border px-3 py-2 text-sm font-bold">Reset</button>
        </div>
       </div>
       <h3 className="mt-5 font-bold">Seats around table · {seats(current)}</h3>
       <div className="mt-2 grid grid-cols-2 gap-3">{([{field:"seats_top",label:"Top"},{field:"seats_bottom",label:"Bottom"},{field:"seats_left",label:"Left"},{field:"seats_right",label:"Right"}] as const).map(o=><label key={o.field} className="text-sm font-semibold">{o.label}<input type="number" min="0" max="30" value={current[o.field]} onChange={e=>mutate(current.id,{[o.field]:Math.max(0,Math.min(30,Number(e.target.value)||0))})} className="mt-1 w-full rounded border p-2"/></label>)}</div>
       <label className="mt-5 block font-bold">Seat surcharge (NZD)
         <input type="number" min="0" step="0.01" placeholder="Not set" value={current.seat_price_cents===null?"":(current.seat_price_cents/100).toFixed(2)} onChange={e=>mutate(current.id,{seat_price_cents:e.target.value===""?null:Math.max(0,Math.round(Number(e.target.value)*100))})} className="mt-1 w-full rounded border p-3"/>
       </label>
       <p className="mt-1 text-xs text-gray-600">Per reserved seat, in addition to admission. Autosaves.</p>
       <label className="mt-5 block font-bold">Whole-table price (NZD)<input type="number" min="0" step=".01" placeholder="Not set" value={current.table_price_cents===null?"":(current.table_price_cents/100).toFixed(2)} onChange={e=>mutate(current.id,{table_price_cents:e.target.value===""?null:Math.max(0,Math.round(Number(e.target.value)*100))})} className="mt-1 w-full rounded border p-3"/></label>
       <p className="mt-1 text-xs text-gray-600">{whole?"This is the complete price for the table, not per person.":"Saved for whole-table mode only. Individual-seat bookings use ticket prices."}</p>
       <label className="mt-4 flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={current.is_active} onChange={e=>mutate(current.id,{is_active:e.target.checked})}/>Table active</label>
       <button onClick={()=>void remove()} className="mt-5 text-sm font-bold text-red-700 underline">Remove table</button>
     </>:<><h2 className="text-xl font-black">Tables</h2><p className="mt-2 text-sm">Add a table or select one on the map.</p></>}
     <div className="mt-5 border-t pt-4">{tables.map(t=><button key={t.id} onClick={()=>setSelected(t.id)} className="block w-full rounded px-2 py-2 text-left text-sm hover:bg-[#fff2db]">{t.label} · {seats(t)} seats {t.table_price_cents!==null?"· $"+(t.table_price_cents/100).toFixed(2):""}</button>)}</div>
    </aside>
   </div>
  </div>
 </main>;
}
