"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {useParams,useRouter} from "next/navigation";
import {supabase} from "@/lib/supabaseClient";

type TableItem={id:string;event_id:string;label:string;x:number;y:number;width:number;height:number;rotation_deg:number;seats_top:number;seats_bottom:number;seats_left:number;seats_right:number;table_price_cents:number|null;is_active:boolean;shape:string};
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
 const [uploading,setUploading]=useState(false);
 const [selected,setSelected]=useState<string|null>(null);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const stage=useRef<HTMLDivElement|null>(null);
 const drag=useRef<{id:string;startX:number;startY:number;x:number;y:number}|null>(null);
 useEffect(()=>{let mounted=true;(async()=>{
  try{
   const {data:{user}}=await supabase.auth.getUser();if(!user){router.replace("/admin/login");return;}
   const {data:admin}=await supabase.from("admin_users").select("role").eq("user_id",user.id).maybeSingle();
   if(!admin){router.replace("/admin/login");return;}
   const [e,t,m]=await Promise.all([supabase.from("events").select("id,title,seating_mode,table_booking_mode").eq("id",id).single(),supabase.from("seating_tables").select("*").eq("event_id",id).order("created_at"),supabase.from("event_seating_maps").select("background_image_url").eq("event_id",id).maybeSingle()]);
   if(e.error)throw e.error;if(t.error)throw t.error;if(m.error)throw m.error;
   if(mounted){setEvent(e.data as EventItem);setTables((t.data??[]) as TableItem[]);setBackground(m.data?.background_image_url??null)}
  }catch(ex){if(mounted)setError(ex instanceof Error?ex.message:"Unable to load seating map")}
  finally{if(mounted)setLoading(false)}
 })();return()=>{mounted=false}},[id,router]);
 const current=tables.find(t=>t.id===selected);
 function mutate(id:string,patch:Partial<TableItem>){setTables(old=>old.map(t=>t.id===id?{...t,...patch}:t));setMessage("Unsaved changes")}
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
    const {error:dbError}=await supabase.from("event_seating_maps").upsert({event_id:id,background_image_url:data.publicUrl,canvas_width:W,canvas_height:H,updated_at:new Date().toISOString()},{onConflict:"event_id"});
    if(dbError)throw dbError;
    setBackground(data.publicUrl);setMessage("Floor plan uploaded and saved.");
  }catch(e){setError(e instanceof Error?e.message:"Upload failed");}
  finally{setUploading(false);}
 }
 async function clearFloorPlan(){
   const {error:e}=await supabase.from("event_seating_maps").update({background_image_url:null,updated_at:new Date().toISOString()}).eq("event_id",id);
   if(e)setError(e.message);else{setBackground(null);setMessage("Floor plan removed.");}
 }
 async function add(){
  const n=tables.length+1;
  const record={event_id:id,label:"Table "+n,shape:"rectangle",x:130+(n%4)*175,y:130+Math.floor(n/4)*140,width:140,height:65,rotation_deg:0,seats_top:2,seats_bottom:2,seats_left:1,seats_right:1,table_price_cents:null,is_active:true};
  setSaving(true);setError("");
  const {data,error:e}=await supabase.from("seating_tables").insert(record).select("*").single();
  if(e)setError(e.message);else{setTables(old=>[...old,data as TableItem]);setSelected(data.id);setMessage("Table added")}
  setSaving(false);
 }
 async function save(){
  setSaving(true);setError("");
  for(const t of tables){
   const {error:e}=await supabase.from("seating_tables").update({label:t.label,x:t.x,y:t.y,width:t.width,height:t.height,rotation_deg:t.rotation_deg,seats_top:t.seats_top,seats_bottom:t.seats_bottom,seats_left:t.seats_left,seats_right:t.seats_right,table_price_cents:t.table_price_cents,is_active:t.is_active}).eq("id",t.id).eq("event_id",id);
   if(e){setError(e.message);setSaving(false);return}
  }
  setMessage("Layout saved");setSaving(false);
 }
 async function remove(){
  if(!current||!confirm("Remove "+current.label+" from this event?"))return;
  const {error:e}=await supabase.from("seating_tables").delete().eq("id",current.id).eq("event_id",id);
  if(e){setError(e.message);return}
  setTables(old=>old.filter(t=>t.id!==current.id));setSelected(null);setMessage("Table removed");
 }
 function pointerDown(e:React.PointerEvent<HTMLButtonElement>,t:TableItem){
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
 if(loading)return <main className="bg-[#fffaf1] p-8">Loading seating builder…</main>;
 if(!event)return <main role="alert" className="p-8">{error||"Event unavailable"}</main>;
 const whole=event.seating_mode==="tables"&&event.table_booking_mode==="whole_table";
 return <main className="min-h-screen bg-[#fffaf1] px-4 py-6 text-black sm:px-8">
  <div className="mx-auto max-w-7xl">
   <Link href={`/admin/events/${id}/tickets`} className="text-sm font-bold underline">← Tickets</Link>
   <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-pink-700">Seating layout</p><h1 className="text-3xl font-black">{event.title}</h1></div><div className="flex gap-2"><button onClick={()=>void add()} disabled={saving} className="rounded-lg bg-black px-4 py-3 font-bold text-white">+ Add table</button><button onClick={()=>void save()} disabled={saving} className="rounded-lg border border-black px-4 py-3 font-bold">{saving?"Saving…":"Save layout"}</button></div></div>
   <p className="mt-3 text-sm text-gray-600">Drag a table to position it. Select a table to edit its size, seats, rotation and price. Pricing is per entire table in whole-table mode.</p>
   <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-black/15 bg-white p-3">
     <label className="cursor-pointer rounded-lg border-2 border-dashed border-black bg-[#fff2db] px-4 py-3 text-sm font-bold">
       {uploading?"Uploading…":background?"Replace floor plan":"Upload floor plan"}
       <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} className="sr-only" onChange={e=>{void uploadFloorPlan(e.target.files?.[0]);e.target.value="";}}/>
     </label>
     {background&&<button type="button" onClick={()=>void clearFloorPlan()} className="text-sm font-bold underline">Remove background</button>}
     <span className="text-xs text-gray-600">JPG, PNG, WebP · up to 10 MB. Tables remain editable above the image.</span>
   </div>
   {error&&<p role="alert" className="mt-4 rounded bg-red-100 p-3 text-red-800">{error}</p>}
   {message&&<p role="status" className="mt-3 text-sm font-semibold">{message}</p>}
   <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
    <div className="overflow-x-auto rounded-xl border border-black/20 bg-white p-2">
     <div ref={stage} className="relative w-full min-w-[420px] overflow-hidden rounded-lg bg-[#fff2db]" style={{aspectRatio:W+"/"+H,touchAction:"pan-y"}}>
       {background&&<img src={background} alt="Uploaded venue floor plan" className="pointer-events-none absolute inset-0 h-full w-full object-contain" />}
       <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-lg bg-[#f5a047] px-10 py-2 text-sm font-bold">Stage</div>
       {tables.filter(t=>t.is_active).map(t=><button key={t.id} type="button" onPointerDown={e=>pointerDown(e,t)} onPointerMove={pointerMove} onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}}
        className={`absolute select-none touch-none rounded-lg border-2 text-sm font-bold shadow ${selected===t.id?"border-pink-600 bg-[#ffd7e8]":"border-black/50 bg-white"}`}
        style={{left:t.x/W*100+"%",top:t.y/H*100+"%",width:t.width/W*100+"%",height:t.height/H*100+"%",transform:`rotate(${t.rotation_deg}deg)`}}>
         {t.label}<SeatMarkers t={t}/>
       </button>)}
     </div>
    </div>
    <aside className="rounded-xl border border-black/20 bg-white p-4">
     {current?<><h2 className="text-xl font-black">Edit {current.label}</h2>
       <label className="mt-4 block text-sm font-bold">Table name<input className="mt-1 w-full rounded border p-2" value={current.label} onChange={e=>mutate(current.id,{label:e.target.value})}/></label>
       <div className="mt-3 grid grid-cols-2 gap-3">{([{field:"width",label:"Width",min:80,max:340},{field:"height",label:"Height",min:45,max:240},{field:"rotation_deg",label:"Rotation °",min:-180,max:180} ] as const).map(o=><label key={o.field} className="text-sm font-bold">{o.label}<input type="number" min={o.min} max={o.max} value={current[o.field]} onChange={e=>mutate(current.id,{[o.field]:Math.max(o.min,Math.min(o.max,Number(e.target.value)||0))})} className="mt-1 w-full rounded border p-2"/></label>)}</div>
       <div className="mt-4"><label className="block text-sm font-bold">Turn table · {current.rotation_deg}°<input aria-label="Rotate table" className="mt-2 w-full" type="range" min="-180" max="180" step="5" value={current.rotation_deg} onChange={e=>mutate(current.id,{rotation_deg:Number(e.target.value)})}/></label>
        <div className="mt-2 flex gap-2">
         <button type="button" onClick={()=>mutate(current.id,{rotation_deg:Math.max(-180,current.rotation_deg-15)})} className="rounded border px-3 py-2 text-sm font-bold">↶ 15°</button>
         <button type="button" onClick={()=>mutate(current.id,{rotation_deg:Math.min(180,current.rotation_deg+15)})} className="rounded border px-3 py-2 text-sm font-bold">↷ 15°</button>
         <button type="button" onClick={()=>mutate(current.id,{rotation_deg:0})} className="rounded border px-3 py-2 text-sm font-bold">Reset</button>
        </div>
       </div>
       <h3 className="mt-5 font-bold">Seats around table · {seats(current)}</h3>
       <div className="mt-2 grid grid-cols-2 gap-3">{([{field:"seats_top",label:"Top"},{field:"seats_bottom",label:"Bottom"},{field:"seats_left",label:"Left"},{field:"seats_right",label:"Right"}] as const).map(o=><label key={o.field} className="text-sm font-semibold">{o.label}<input type="number" min="0" max="30" value={current[o.field]} onChange={e=>mutate(current.id,{[o.field]:Math.max(0,Math.min(30,Number(e.target.value)||0))})} className="mt-1 w-full rounded border p-2"/></label>)}</div>
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
