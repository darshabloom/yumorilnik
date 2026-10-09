"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import EventPresentation from "@/components/EventPresentation";

type EventRecord = {
  id: string; slug: string; title: string; title_en: string | null;
  description: string | null; description_en: string | null;
  event_date: string; event_time: string; location: string | null;
  image_url: string | null; detail_image_url:string|null; banner_fit:string; banner_position_x:number; banner_position_y:number; detail_fit:string; detail_position_x:number; detail_position_y:number; is_active: boolean;
};
type Ticket = { id: string; name: string; price_cents: number; currency: string; quantity_total: number };

export default function InlineEventEditor() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [language, setLanguage] = useState<"ru" | "en">("ru");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [editingImage, setEditingImage] = useState<"banner"|"detail"|null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingWhen, setEditingWhen] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const savedVersion = useRef<EventRecord | null>(null);
  const latestEvent = useRef<EventRecord | null>(null);
  const saveInProgress = useRef(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) { router.replace("/admin/login"); return; }
        const { data: admin, error: adminError } = await supabase.from("admin_users").select("role").eq("user_id", user.id).maybeSingle();
        if (adminError || !admin) { router.replace("/admin/login"); return; }
        const { data, error: loadError } = await supabase.from("events")
          .select("id,slug,title,title_en,description,description_en,event_date,event_time,location,image_url,detail_image_url,banner_fit,banner_position_x,banner_position_y,detail_fit,detail_position_x,detail_position_y,is_active")
          .eq("id", id).single();
        if (loadError) throw loadError;
        const { data: types } = await supabase.from("ticket_types")
          .select("id,name,price_cents,currency,quantity_total").eq("event_id", id);
        if (mounted) {
          latestEvent.current = data as EventRecord;
          setEvent(data as EventRecord);
          savedVersion.current = data as EventRecord;
          setTickets((types ?? []) as Ticket[]);
        }
      } catch (e) { if (mounted) setError(e instanceof Error ? e.message : "Unable to load event."); }
      finally { if (mounted) setLoading(false); }
    }
    void load();
    return () => { mounted = false; };
  }, [id, router]);

  function change<K extends keyof EventRecord>(field: K, value: EventRecord[K]) {
    setEvent(previous => {
      const next = previous ? { ...previous, [field]: value } : previous;
      latestEvent.current = next;
      return next;
    });
    setStatus("Unsaved changes");
  }

  async function uploadImage(e: ChangeEvent<HTMLInputElement>, target: "banner"|"detail") {
    const file = e.target.files?.[0];
    if (!file || !event) return;
    e.target.value = "";
    if (!["image/jpeg","image/png","image/webp","image/gif"].includes(file.type)) {
      setError("Choose a JPG, PNG, WebP or GIF image."); return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Choose an image smaller than 10 MB."); return;
    }
    setUploading(true); setError(""); setStatus("");
    try {
      const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "gif";
      const path = `${event.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("event-images")
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("event-images").getPublicUrl(path);
      change(target==="banner"?"image_url":"detail_image_url", data.publicUrl);
      setStatus("Image uploaded · saving…");
      setEditingImage(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed.");
    } finally { setUploading(false); }
  }

  async function save() {
    if (saveInProgress.current) return;
    const snapshot = latestEvent.current;
    if (!snapshot || !snapshot.title.trim() || !snapshot.event_date || !snapshot.event_time || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(snapshot.slug)) {
      setStatus("Unsaved changes");
      return;
    }
    if (JSON.stringify(snapshot) === JSON.stringify(savedVersion.current)) {
      setStatus("Saved");
      return;
    }
    saveInProgress.current = true;
    setSaving(true); setError(""); setStatus("Saving…");
    const payload = {
      slug: snapshot.slug.trim().toLowerCase(),
      title: snapshot.title.trim(), title_en: snapshot.title_en?.trim() || null,
      description: snapshot.description?.trim() || null, description_en: snapshot.description_en?.trim() || null,
      event_date: snapshot.event_date, event_time: snapshot.event_time,
      location: snapshot.location?.trim() || null, image_url: snapshot.image_url?.trim() || null,
      detail_image_url: snapshot.detail_image_url?.trim() || null,
      banner_fit:snapshot.banner_fit,banner_position_x:snapshot.banner_position_x,banner_position_y:snapshot.banner_position_y,
      detail_fit:snapshot.detail_fit,detail_position_x:snapshot.detail_position_x,detail_position_y:snapshot.detail_position_y,
      is_active:snapshot.is_active, updated_at:new Date().toISOString(),
    };
    const {error: saveError} = await supabase.from("events").update(payload).eq("id",snapshot.id);
    saveInProgress.current = false;
    setSaving(false);
    if (saveError) {
      setError("Autosave failed: " + saveError.message);
      setStatus("Not saved");
      return;
    }
    savedVersion.current = snapshot;
    if (JSON.stringify(latestEvent.current) === JSON.stringify(snapshot)) setStatus("Saved");
    else {
      setStatus("More changes to save…");
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      autosaveTimer.current = setTimeout(()=>{void save();},700);
    }
  }

  useEffect(()=>{
    if (!event || !savedVersion.current) return;
    if (JSON.stringify(event) === JSON.stringify(savedVersion.current)) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(()=>{void save();},850);
    return ()=>{if(autosaveTimer.current) clearTimeout(autosaveTimer.current);};
  },[event]);


  const editable = isPreview ? "" : "rounded-md outline-none transition-colors hover:bg-black/5 focus:bg-white focus:ring-2 focus:ring-pink-600";
  const titleKey = language === "ru" ? "title" : "title_en";
  const descKey = language === "ru" ? "description" : "description_en";
  const title = event?.[titleKey] ?? "";
  const description = event?.[descKey] ?? "";

  const imageEditor = (target:"banner"|"detail") => <div className="absolute bottom-full right-0 z-30 mb-2 w-[min(90vw,340px)] rounded-xl border border-black/20 bg-white p-4 text-left shadow-2xl" onClick={e=>e.stopPropagation()}>
    <div className="mb-3 flex items-center justify-between gap-2"><strong className="text-base">{target==="banner"?"Banner image":"Secondary image"}</strong><button type="button" onClick={()=>setEditingImage(null)} aria-label="Close image editor" className="rounded px-2 py-1 text-lg">×</button></div>
    <label htmlFor="event-image-upload" className={`flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-black bg-[#fff2db] px-4 py-3 text-sm font-bold transition-colors hover:bg-[#f5a047]/35 focus-within:ring-2 focus-within:ring-pink-600 ${uploading?"pointer-events-none opacity-50":""}`}>
      <span aria-hidden="true">↑</span> {uploading ? "Uploading image…" : "Choose image from device"}
      <input id="event-image-upload" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploading} onChange={e=>uploadImage(e,target)} className="sr-only"/>
    </label>
    <p className="mt-2 text-center text-xs text-gray-500">JPG, PNG, WebP or GIF · up to 10 MB</p>
    <label className="mt-3 block text-sm font-semibold">Or use image URL<input type="url" className="mt-1 w-full rounded border p-2 font-normal" value={target==="banner"?(event?.image_url??""):(event?.detail_image_url??"")} onChange={e=>change(target==="banner"?"image_url":"detail_image_url",e.target.value)}/></label>
    <div className="mt-4 border-t pt-3">
      <p className="mb-2 text-sm font-semibold">Image display</p>
      <div className="flex gap-2">
        {(["cover","contain"] as const).map(fit=><button key={fit} type="button"
          onClick={()=>change(target==="banner"?"banner_fit":"detail_fit",fit)}
          className={`rounded border px-3 py-2 text-xs font-bold ${(target==="banner"?event?.banner_fit:event?.detail_fit)===fit?"bg-black text-white":"bg-white"}`}>
          {fit==="cover"?"Fill frame (crop)":"Fit entire image"}
        </button>)}
      </div>
      <p className="mt-3 text-xs text-gray-600">Move the image within its frame</p>
      {(["x","y"] as const).map(axis=>{
        const field = target==="banner"?(axis==="x"?"banner_position_x":"banner_position_y"):(axis==="x"?"detail_position_x":"detail_position_y");
        return <label key={axis} className="mt-2 flex items-center gap-3 text-xs font-bold">{axis==="x"?"Horizontal":"Vertical"}
          <input aria-label={axis==="x"?"Horizontal image position":"Vertical image position"} type="range" min="0" max="100" step="1"
            className="min-w-0 flex-1" value={event?.[field]??50} onChange={e=>change(field,Number(e.target.value))}/>
        </label>;
      })}
      <button type="button" onClick={()=>{
        change(target==="banner"?"banner_position_x":"detail_position_x",50);
        change(target==="banner"?"banner_position_y":"detail_position_y",50);
      }} className="mt-3 text-xs font-bold underline">Centre image</button>
    </div>
    {uploading&&<p role="status" className="mt-2 text-sm">Uploading…</p>}
    {error&&<p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    {status&&<p role="status" className="mt-2 text-sm text-green-700">{status}</p>}
  </div>;

  if (loading) return <main className="min-h-[75vh] bg-[#fff2db] p-6" role="status">Loading event…</main>;
  if (!event) return <main className="min-h-[75vh] bg-[#fff2db] p-6" role="alert">{error || "Event unavailable."}</main>;

  return (
    <main className="min-h-screen bg-[#fff2db] text-black">
      <div className="sticky top-0 z-20 border-b border-black/20 bg-[#fff2db]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <Link href="/admin/events" className="text-sm font-bold underline">← All events</Link>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-3 py-2 text-xs font-bold">{event.is_active ? "Published" : "Draft"}</span>
            <button type="button" onClick={() => setLanguage(language === "ru" ? "en" : "ru")} className="rounded-lg border border-black px-3 py-2 text-sm font-bold">{language.toUpperCase()} ▾</button>
            <button type="button" onClick={() => setIsPreview(!isPreview)} className="rounded-lg border border-black px-3 py-2 text-sm font-bold">{isPreview ? "Edit" : "Preview"}</button>
            <span role="status" aria-live="polite" className="ml-auto whitespace-nowrap text-xs font-semibold text-gray-700 sm:text-sm">{status || (saving ? "Saving…" : "Auto-save")}</span>
          </div>
        </div>
      </div>

      {!isPreview&&<div className="mx-auto max-w-6xl px-4 pt-4">
        <label htmlFor="event-url-slug" className="block text-sm font-bold">Event URL</label>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-600">/events/</span>
          <input id="event-url-slug" type="text" value={event.slug} onChange={e=>change("slug",e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,""))} className="min-w-0 flex-1 rounded-lg border border-black/30 bg-white px-3 py-2 text-sm" spellCheck={false} aria-describedby="slug-help"/>
        </div>
        <p id="slug-help" className="mt-1 text-xs text-gray-600">Use letters, numbers and hyphens. Changes save automatically. Changing this URL will break previously shared links.</p>
      </div>}
      <EventPresentation
        event={{slug:event.slug,title,description,event_date:event.event_date,event_time:event.event_time,location:event.location,image_url:event.image_url,detail_image_url:event.detail_image_url,banner_fit:event.banner_fit,banner_position_x:event.banner_position_x,banner_position_y:event.banner_position_y,detail_fit:event.detail_fit,detail_position_x:event.detail_position_x,detail_position_y:event.detail_position_y}}
        heading={isPreview ? undefined : <textarea aria-label="Event title" value={title} onChange={e=>change(titleKey,e.target.value.replace(/\n/g," "))}
          rows={2} placeholder={language==="ru"?"Название мероприятия":"Event title"}
          className="block min-h-24 w-full min-w-0 resize-y whitespace-pre-wrap break-words rounded-md bg-transparent text-3xl font-black leading-tight outline-none hover:bg-black/5 focus:bg-white focus:ring-2 focus:ring-pink-600 sm:min-h-28 sm:text-5xl"/>}
        description={isPreview ? undefined : <textarea aria-label="Event description" rows={Math.max(8,description.split("\n").length+3)}
          value={description} onChange={e=>change(descKey,e.target.value)}
          placeholder="Click to write a description"
          className="w-full resize-y rounded-md bg-transparent p-2 leading-7 outline-none hover:bg-black/5 focus:bg-white focus:ring-2 focus:ring-pink-600"/>}
        dateAndPlace={isPreview ? undefined : <div className="space-y-2">
          <label className="block text-xs font-bold">Date<input type="date" value={event.event_date} onChange={e=>change("event_date",e.target.value)} className="mt-1 w-full rounded border p-2"/></label>
          <label className="block text-xs font-bold">Time<input type="time" value={event.event_time.slice(0,5)} onChange={e=>change("event_time",e.target.value)} className="mt-1 w-full rounded border p-2"/></label>
          <label className="block text-xs font-bold">Venue<input value={event.location??""} onChange={e=>change("location",e.target.value)} className="mt-1 w-full rounded border p-2"/></label>
        </div>}
        bannerControl={!isPreview?<div className="relative">{editingImage==="banner"&&imageEditor("banner")}<button type="button" onClick={()=>setEditingImage(editingImage==="banner"?null:"banner")} aria-expanded={editingImage==="banner"} className="rounded bg-white px-4 py-3 text-sm font-bold shadow">Change image</button></div>:undefined}
        imageControl={!isPreview?<div className="relative">{editingImage==="detail"&&imageEditor("detail")}<button type="button" onClick={()=>setEditingImage(editingImage==="detail"?null:"detail")} aria-expanded={editingImage==="detail"} className="rounded bg-white px-3 py-2 text-sm font-bold shadow">Edit photo</button></div>:undefined}
        bookingAction={()=>router.push(`/admin/events/${event.id}/tickets`)}
      />
      {!isPreview && <div className="w-full space-y-5 bg-white px-5 pb-12 sm:px-10 lg:px-[6vw]">

        <label className="flex items-center gap-3 rounded-lg border p-4 font-bold">
          <input type="checkbox" checked={event.is_active} onChange={e=>change("is_active",e.target.checked)} className="h-5 w-5"/> Publish event
        </label>
        {error && <p role="alert" className="rounded bg-red-100 p-3 text-red-900">{error}</p>}
        {status && <p role="status" className="rounded bg-green-100 p-3 text-green-900">{status}</p>}

      </div>}
    </main>
  );
}
