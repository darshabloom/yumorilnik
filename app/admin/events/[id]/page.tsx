"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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

      <article className="mx-auto max-w-5xl bg-white">
        <div className="group relative overflow-hidden bg-[#1b1714]">
          {event.image_url
            ? <img src={event.image_url} alt="" className="aspect-[16/9] w-full object-cover" />
            : <div className="flex aspect-[16/9] items-center justify-center bg-[#f5a047]/30 px-4 text-center text-sm text-gray-600">Add an event photograph</div>}
          {!isPreview && <button type="button" onClick={() => setEditingImage(!editingImage)} className="absolute bottom-4 right-4 rounded-lg bg-white px-4 py-3 text-sm font-bold shadow">✎ Change image</button>}
        </div>
        {!isPreview && editingImage && <div className="border-b bg-[#fff2db] p-4">
          <label htmlFor="image-url" className="text-sm font-bold">Event image URL</label>
          <input id="image-url" type="url" value={event.image_url ?? ""} onChange={e => change("image_url", e.target.value)} className="mt-2 w-full rounded-lg border border-black bg-white px-3 py-3" placeholder="https://…" />
          <p className="mt-2 text-xs text-gray-600">Direct image upload and galleries are coming next.</p>
        </div>}

        <div className="space-y-7 px-5 py-8 sm:px-10 sm:py-12">
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-pink-700">Юморильник · Афиша</p>
            {isPreview ? <h1 className="text-3xl font-black sm:text-5xl">{title || "Event title"}</h1> :
              <input aria-label={language === "ru" ? "Russian event title" : "English event title"} value={title}
                onChange={e => change(titleKey, e.target.value)} placeholder={language === "ru" ? "Название мероприятия" : "Event title"}
                className={`w-full min-w-0 bg-transparent text-3xl font-black sm:text-5xl ${editable}`} />}
            {!isPreview && <p className="text-xs text-gray-500">Tap the title to edit it directly.</p>}
          </div>

          <div className="rounded-xl bg-[#fff2db] p-4">
            {isPreview ? <p className="font-semibold">{event.event_date} · {event.event_time.slice(0,5)} · {event.location || "Venue TBC"}</p> :
              <button type="button" onClick={() => setEditingWhen(!editingWhen)} className="text-left font-bold underline decoration-dotted underline-offset-4">📅 {event.event_date} · {event.event_time.slice(0,5)} · {event.location || "Add venue"} ✎</button>}
            {!isPreview && editingWhen && <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <label className="text-sm font-bold">Date<input type="date" value={event.event_date} onChange={e=>change("event_date",e.target.value)} className="mt-1 w-full rounded-lg border p-3"/></label>
              <label className="text-sm font-bold">Time<input type="time" value={event.event_time.slice(0,5)} onChange={e=>change("event_time",e.target.value)} className="mt-1 w-full rounded-lg border p-3"/></label>
              <label className="text-sm font-bold">Venue<input value={event.location??""} onChange={e=>change("location",e.target.value)} className="mt-1 w-full rounded-lg border p-3"/></label>
            </div>}
          </div>

          <section className="space-y-3">
            <h2 className="text-xl font-black">{language === "ru" ? "О событии" : "About the event"}</h2>
            {isPreview ? <p className="whitespace-pre-wrap leading-relaxed">{description || "Event description"}</p> :
              <textarea aria-label={language === "ru" ? "Russian description" : "English description"} rows={Math.max(5, description.split("\n").length + 2)}
                value={description} onChange={e=>change(descKey,e.target.value)} placeholder={language === "ru" ? "Нажмите, чтобы написать описание…" : "Tap to write a description…"}
                className={`w-full resize-y bg-transparent p-2 leading-relaxed ${editable}`} />}
          </section>

          <section className="rounded-2xl border border-black/20 bg-[#fff2db] p-5">
            <h2 className="text-2xl font-black">{language === "ru" ? "Билеты" : "Tickets"}</h2>
            {tickets.length ? tickets.map(ticket => <div key={ticket.id} className="mt-3 flex justify-between gap-4 border-t border-black/10 pt-3">
              <span className="font-semibold">{ticket.name}</span>
              <span>{new Intl.NumberFormat("en-NZ",{style:"currency",currency:ticket.currency.toUpperCase()}).format(ticket.price_cents/100)}</span>
            </div>) : <p className="mt-3 text-sm text-gray-600">Ticket types will appear here.</p>}
            {!isPreview && <p className="mt-4 text-xs font-semibold text-gray-600">+ Add/edit ticket types — next milestone</p>}
          </section>
          {!isPreview && <label className="flex items-center gap-3 rounded-lg border border-black/20 p-4 font-bold">
            <input type="checkbox" checked={event.is_active} onChange={e=>change("is_active",e.target.checked)} className="h-5 w-5"/>
            Publish event
          </label>}
          {error && <p role="alert" className="rounded bg-red-100 p-3 text-sm text-red-900">{error}</p>}
          {status && <p role="status" className="rounded bg-green-100 p-3 text-sm text-green-900">{status}</p>}
          {!isPreview && <div className="flex flex-wrap gap-3">
            <button type="button" disabled={saving} onClick={save} className="rounded-lg bg-black px-6 py-4 font-bold text-white disabled:opacity-50">Save changes</button>
            <button type="button" onClick={()=>{if(savedVersion.current){setEvent({...savedVersion.current});setStatus("Unsaved edits discarded.");setError("");}}} className="rounded-lg border border-black px-6 py-4 font-bold">Discard unsaved edits</button>
          </div>}
        </div>
      </article>
    </main>
  );
}
