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
  image_url: string | null; is_active: boolean;
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
  const [editingImage, setEditingImage] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingWhen, setEditingWhen] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const savedVersion = useRef<EventRecord | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) { router.replace("/admin/login"); return; }
        const { data: admin, error: adminError } = await supabase.from("admin_users").select("role").eq("user_id", user.id).maybeSingle();
        if (adminError || !admin) { router.replace("/admin/login"); return; }
        const { data, error: loadError } = await supabase.from("events")
          .select("id,slug,title,title_en,description,description_en,event_date,event_time,location,image_url,is_active")
          .eq("id", id).single();
        if (loadError) throw loadError;
        const { data: types } = await supabase.from("ticket_types")
          .select("id,name,price_cents,currency,quantity_total").eq("event_id", id);
        if (mounted) {
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
    setEvent(previous => previous ? { ...previous, [field]: value } : previous);
    setStatus("");
  }

  async function uploadImage(e: ChangeEvent<HTMLInputElement>) {
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
      change("image_url", data.publicUrl);
      setStatus("Image uploaded. Save changes to publish it.");
      setEditingImage(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed.");
    } finally { setUploading(false); }
  }

  async function save() {
    if (!event || !event.title.trim()) { setError("A Russian title is required."); return; }
    setSaving(true); setError(""); setStatus("");
    const payload = {
      title: event.title.trim(), title_en: event.title_en?.trim() || null,
      description: event.description?.trim() || null, description_en: event.description_en?.trim() || null,
      event_date: event.event_date, event_time: event.event_time,
      location: event.location?.trim() || null, image_url: event.image_url?.trim() || null,
      is_active: event.is_active, updated_at: new Date().toISOString(),
    };
    const { data, error: saveError } = await supabase.from("events")
      .update(payload).eq("id", event.id)
      .select("id,slug,title,title_en,description,description_en,event_date,event_time,location,image_url,is_active").single();
    if (saveError) setError(saveError.message);
    else if (data) {
      setEvent(data as EventRecord);
      savedVersion.current = data as EventRecord;
      setStatus("Changes saved.");
    }
    setSaving(false);
  }

  const editable = isPreview ? "" : "rounded-md outline-none transition-colors hover:bg-black/5 focus:bg-white focus:ring-2 focus:ring-pink-600";
  const titleKey = language === "ru" ? "title" : "title_en";
  const descKey = language === "ru" ? "description" : "description_en";
  const title = event?.[titleKey] ?? "";
  const description = event?.[descKey] ?? "";

  const imageEditor = <div className="absolute bottom-full right-0 z-30 mb-2 w-[min(90vw,340px)] rounded-xl border border-black/20 bg-white p-4 text-left shadow-2xl" onClick={e=>e.stopPropagation()}>
    <div className="mb-3 flex items-center justify-between gap-2"><strong className="text-base">Event image</strong><button type="button" onClick={()=>setEditingImage(false)} aria-label="Close image editor" className="rounded px-2 py-1 text-lg">×</button></div>
    <label htmlFor="event-image-upload" className="text-sm font-semibold">Upload from device</label>
    <input id="event-image-upload" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploading} onChange={uploadImage} className="mt-2 block w-full text-sm"/>
    <p className="mt-1 text-xs text-gray-500">JPG, PNG, WebP or GIF · up to 10 MB</p>
    <label className="mt-3 block text-sm font-semibold">Or use image URL<input type="url" className="mt-1 w-full rounded border p-2 font-normal" value={event?.image_url??""} onChange={e=>change("image_url",e.target.value)}/></label>
    {uploading&&<p role="status" className="mt-2 text-sm">Uploading…</p>}
    {error&&<p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    {status&&<p role="status" className="mt-2 text-sm text-green-700">{status}</p>}
  </div>;

  if (loading) return <main className="min-h-[75vh] bg-[#fff2db] p-6" role="status">Loading event…</main>;
  if (!event) return <main className="min-h-[75vh] bg-[#fff2db] p-6" role="alert">{error || "Event unavailable."}</main>;

  return (
    <main className="min-h-screen bg-[#fff2db] text-black">
      <div className="sticky top-0 z-20 border-b border-black/20 bg-[#fff2db]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <Link href="/admin/events" className="text-sm font-bold underline">← All events</Link>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white px-3 py-2 text-xs font-bold">{event.is_active ? "Published" : "Draft"}</span>
            <button type="button" onClick={() => setLanguage(language === "ru" ? "en" : "ru")} className="rounded-lg border border-black px-3 py-2 text-sm font-bold">{language.toUpperCase()} ▾</button>
            <button type="button" onClick={() => setIsPreview(!isPreview)} className="rounded-lg border border-black px-3 py-2 text-sm font-bold">{isPreview ? "Edit" : "Preview"}</button>
            <button type="button" disabled={saving} onClick={save} className="rounded-lg bg-black px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </div>

      <EventPresentation
        event={{slug:event.slug,title,description,event_date:event.event_date,event_time:event.event_time,location:event.location,image_url:event.image_url}}
        heading={isPreview ? undefined : <input aria-label="Event title" value={title} onChange={e=>change(titleKey,e.target.value)}
          placeholder={language==="ru"?"Название мероприятия":"Event title"}
          className="w-full rounded-md bg-transparent text-3xl font-black outline-none hover:bg-black/5 focus:bg-white focus:ring-2 focus:ring-pink-600 sm:text-5xl"/>}
        description={isPreview ? undefined : <textarea aria-label="Event description" rows={Math.max(8,description.split("\n").length+3)}
          value={description} onChange={e=>change(descKey,e.target.value)}
          placeholder="Click to write a description"
          className="w-full resize-y rounded-md bg-transparent p-2 leading-7 outline-none hover:bg-black/5 focus:bg-white focus:ring-2 focus:ring-pink-600"/>}
        dateAndPlace={isPreview ? undefined : <div className="space-y-2">
          <label className="block text-xs font-bold">Date<input type="date" value={event.event_date} onChange={e=>change("event_date",e.target.value)} className="mt-1 w-full rounded border p-2"/></label>
          <label className="block text-xs font-bold">Time<input type="time" value={event.event_time.slice(0,5)} onChange={e=>change("event_time",e.target.value)} className="mt-1 w-full rounded border p-2"/></label>
          <label className="block text-xs font-bold">Venue<input value={event.location??""} onChange={e=>change("location",e.target.value)} className="mt-1 w-full rounded border p-2"/></label>
        </div>}
        bannerControl={!isPreview?<div className="relative">{editingImage&&imageEditor}<button type="button" onClick={()=>setEditingImage(!editingImage)} aria-expanded={editingImage} className="rounded bg-white px-4 py-3 text-sm font-bold shadow">Change image</button></div>:undefined}
        imageControl={!isPreview?<button type="button" onClick={()=>{setEditingImage(true);window.scrollTo({top:0,behavior:"smooth"});}} className="rounded bg-white px-3 py-2 text-sm font-bold shadow">Edit photo ↑</button>:undefined}
        bookingAction={()=>{}}
        bookingDisabled
      />
      {!isPreview && <div className="w-full space-y-5 bg-white px-5 pb-12 sm:px-10 lg:px-[6vw]">

        <label className="flex items-center gap-3 rounded-lg border p-4 font-bold">
          <input type="checkbox" checked={event.is_active} onChange={e=>change("is_active",e.target.checked)} className="h-5 w-5"/> Publish event
        </label>
        {error && <p role="alert" className="rounded bg-red-100 p-3 text-red-900">{error}</p>}
        {status && <p role="status" className="rounded bg-green-100 p-3 text-green-900">{status}</p>}
        <button disabled={saving} onClick={save} className="rounded-lg bg-black px-6 py-4 font-bold text-white">Save changes</button>
        <button type="button" onClick={()=>{if(savedVersion.current){setEvent({...savedVersion.current});setStatus("Unsaved edits discarded.");}}} className="ml-3 rounded-lg border px-5 py-4 font-bold">Discard edits</button>
      </div>}
    </main>
  );
}
