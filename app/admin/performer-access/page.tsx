"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {supabase} from "@/lib/supabaseClient";
const EVENT_ID="3f6fa4d1-aaca-4326-9c01-5774cffca2f5";
type Table={id:string;label:string;is_active:boolean};
export default function PerformerAccessAdmin(){
 const [tables,setTables]=useState<Table[]>([]);
 const [selected,setSelected]=useState<string[]>([]);
 const [code,setCode]=useState("");
 const [enabled,setEnabled]=useState(false);
 const [configured,setConfigured]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 useEffect(()=>{void(async()=>{
  const {data:{user}}=await supabase.auth.getUser();
  if(!user){setMessage("Please sign in as an administrator.");return}
  const [{data:access,error:a},{data:rows,error:t}]=await Promise.all([
   supabase.rpc("admin_get_performer_table_access",{p_event_id:EVENT_ID}),
   supabase.from("seating_tables").select("id,label,is_active").eq("event_id",EVENT_ID).order("label"),
  ]);
  if(a||t){setMessage(a?.message||t?.message||"Unable to load configuration");return}
  setSelected(access?.table_ids??[]);setEnabled(access?.enabled??false);setConfigured(access?.configured??false);setTables(rows??[]);
 })()},[]);
 async function save(){
  setMessage("");
  if(code.trim().length<6){setMessage("Enter a code with at least six characters to save. The existing code cannot be displayed.");return}
  setBusy(true);
  const {error}=await supabase.rpc("admin_set_performer_table_access",{p_event_id:EVENT_ID,p_code:code.trim().toUpperCase(),p_table_ids:selected,p_enabled:enabled});
  setBusy(false);
  if(error){setMessage(error.message);return}
  setConfigured(true);setCode("");setMessage("Saved. Your shared code now controls the selected tables.");
 }
 return <main className="mx-auto max-w-3xl space-y-5 px-5 py-8"><Link href="/admin" className="underline">← Admin dashboard</Link><h1 className="text-2xl font-black">Performer friends table access</h1>
  <p>Use one shared code for performer friends. Choose active tables to hide from public booking until the code is entered. The code only unlocks seats: ordinary prices and discounts still apply.</p>
  {configured&&<p className="rounded-lg bg-amber-50 p-3 text-sm">A shared code is configured. Enter a new code when saving changes (you can enter the same code again).</p>}
  <label className="block font-semibold">Shared code<input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="e.g. PERFORMER2027" autoComplete="off" className="mt-2 block w-full rounded-lg border p-3"/></label>
  <label className="flex items-center gap-3"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Enable performer access</label>
  <fieldset className="rounded-xl border p-4"><legend className="font-bold">Reserved tables</legend><div className="grid gap-3 sm:grid-cols-2">{tables.map(t=><label key={t.id} className="flex items-center gap-2"><input type="checkbox" checked={selected.includes(t.id)} onChange={e=>setSelected(old=>e.target.checked?[...old,t.id]:old.filter(id=>id!==t.id))}/>{t.label}{!t.is_active&&<span className="text-xs text-red-700">Inactive — activate in seating editor</span>}</label>)}</div></fieldset>
  <button type="button" disabled={busy||code.trim().length<6} onClick={()=>void save()} className="rounded-lg bg-black px-6 py-3 font-semibold text-white disabled:opacity-40">{busy?"Saving…":"Save performer access"}</button>{message&&<p role="status" className="rounded-lg border p-3">{message}</p>}
 </main>;
}