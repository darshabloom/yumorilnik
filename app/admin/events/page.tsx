"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type EventRow = {
  id: string; slug: string; title: string; title_en: string | null;
  description: string | null; description_en: string | null;
  event_date: string; event_time: string; location: string | null;
  image_url: string | null; is_active: boolean;
};
type Fields = Omit<EventRow, "id">;
const empty: Fields = { slug: "", title: "", title_en: "", description: "",
  description_en: "", event_date: "", event_time: "19:00", location: "",
  image_url: "", is_active: false };

export default function AdminEventsPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [fields, setFields] = useState<Fields>(empty);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) { router.replace("/admin/login"); return; }
        const { data: membership, error: roleError } = await supabase.from("admin_users")
          .select("role").eq("user_id", user.id).maybeSingle();
        if (roleError || !membership) { router.replace("/admin/login"); return; }
        if (!active) return;
        setAllowed(true);
        const { data, error: dbError } = await supabase.from("events")
          .select("id,slug,title,title_en,description,description_en,event_date,event_time,location,image_url,is_active")
          .order("event_date", { ascending: false });
        if (dbError) throw dbError;
        if (active) setEvents((data ?? []) as EventRow[]);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Unable to load events.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [router]);

  function edit(item: EventRow) {
    setShowForm(true);
    setSelectedId(item.id);
    setFields({ slug: item.slug, title: item.title, title_en: item.title_en ?? "",
      description: item.description ?? "", description_en: item.description_en ?? "",
      event_date: item.event_date, event_time: item.event_time.slice(0, 5),
      location: item.location ?? "", image_url: item.image_url ?? "",
      is_active: item.is_active });
    setError(""); setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reset() { setSelectedId(null); setFields(empty); setError(""); setMessage(""); setShowForm(true); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function backToList() { setShowForm(false); setSelectedId(null); setFields(empty); setError(""); setMessage(""); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function update<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields(current => ({ ...current, [key]: value }));
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!fields.slug.trim() || !fields.title.trim() || !fields.event_date) {
      setError("Russian title, slug and date are required."); return;
    }
    setSaving(true); setError(""); setMessage("");
    const payload = { ...fields, slug: fields.slug.trim().toLowerCase(),
      title: fields.title.trim(), title_en: fields.title_en?.trim() || null,
      description: fields.description?.trim() || null, description_en: fields.description_en?.trim() || null,
      location: fields.location?.trim() || null, image_url: fields.image_url?.trim() || null,
      updated_at: new Date().toISOString() };
    const query = selectedId
      ? supabase.from("events").update(payload).eq("id", selectedId).select("id,slug,title,title_en,description,description_en,event_date,event_time,location,image_url,is_active").single()
      : supabase.from("events").insert(payload).select("id,slug,title,title_en,description,description_en,event_date,event_time,location,image_url,is_active").single();
    const { data, error: saveError } = await query;
    if (saveError) setError(saveError.message);
    else if (data) {
      setEvents(current => [data as EventRow, ...current.filter(item => item.id !== data.id)]
        .sort((a, b) => b.event_date.localeCompare(a.event_date)));
      setSelectedId(data.id);
      setMessage(data.is_active ? "Published event saved." : "Draft saved.");
      setShowForm(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    setSaving(false);
  }

  const inputClass = "mt-2 w-full rounded-lg border-2 border-black bg-white px-4 py-3 text-base";
  const labelClass = "block text-sm font-bold";
  if (loading) return <main className="min-h-[75vh] bg-[#fff2db] p-6" role="status">Loading events…</main>;
  if (!allowed) return <main className="min-h-[75vh] bg-[#fff2db] p-6" role="alert">{error || "Checking access…"}</main>;
  return (
    <main className="min-h-[80vh] bg-[#fff2db] px-4 py-8 text-black sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/admin" className="text-sm font-bold underline">← Dashboard</Link>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-widest text-pink-700">Yumorilnik / Admin</p>
          <h1 className="mt-1 text-3xl font-black">Manage events</h1></div>
          <button type="button" onClick={reset} className="rounded-lg bg-black px-4 py-3 font-bold text-white">+ Add event</button>
        </div>

        {message && !showForm && <p role="status" className="mt-5 rounded bg-green-100 p-4 text-green-900">{message}</p>}
        {error && !showForm && <p role="alert" className="mt-5 rounded bg-red-100 p-4 text-red-900">{error}</p>}
        {showForm && <form onSubmit={save} className="mt-7 space-y-6 rounded-2xl border-2 border-black bg-white p-5 sm:p-8">
          <button type="button" onClick={backToList} className="text-sm font-bold underline">← Back to events</button>
          <div><h2 className="text-xl font-black">{selectedId ? "Edit event" : "Create event"}</h2>
          <p className="mt-1 text-sm text-gray-600">Basic details and publishing. Ticketing and seating come next.</p></div>

          <section className="space-y-4">
            <h3 className="border-b pb-2 text-lg font-black">1. Basic details</h3>
            <div><label htmlFor="event-title" className={labelClass}>Russian title *</label>
              <input id="event-title" required className={inputClass} value={fields.title} onChange={e => update("title", e.target.value)} /></div>
            <div><label htmlFor="event-title-en" className={labelClass}>English title</label>
              <input id="event-title-en" className={inputClass} value={fields.title_en ?? ""} onChange={e => update("title_en", e.target.value)} /></div>
            <div><label htmlFor="event-slug" className={labelClass}>URL slug * (Latin letters, digits and hyphens)</label>
              <input id="event-slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" className={inputClass} value={fields.slug}
                onChange={e => update("slug", e.target.value.toLowerCase())} placeholder="new-year-2026" /></div>
            <div><label htmlFor="event-description" className={labelClass}>Russian description</label>
              <textarea id="event-description" rows={4} className={inputClass} value={fields.description ?? ""} onChange={e => update("description", e.target.value)} /></div>
            <div><label htmlFor="event-description-en" className={labelClass}>English description</label>
              <textarea id="event-description-en" rows={4} className={inputClass} value={fields.description_en ?? ""} onChange={e => update("description_en", e.target.value)} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label htmlFor="event-date" className={labelClass}>Date *</label>
                <input id="event-date" required type="date" className={inputClass} value={fields.event_date} onChange={e => update("event_date", e.target.value)} /></div>
              <div><label htmlFor="event-time" className={labelClass}>Time *</label>
                <input id="event-time" required type="time" className={inputClass} value={fields.event_time} onChange={e => update("event_time", e.target.value)} /></div>
            </div>
            <div><label htmlFor="event-location" className={labelClass}>Venue / location</label>
              <input id="event-location" className={inputClass} value={fields.location ?? ""} onChange={e => update("location", e.target.value)} /></div>
            <div><label htmlFor="event-image" className={labelClass}>Image URL (upload coming later)</label>
              <input id="event-image" type="url" className={inputClass} value={fields.image_url ?? ""} onChange={e => update("image_url", e.target.value)} placeholder="https://..." /></div>
          </section>

          <section className="space-y-3 border-t pt-5">
            <h3 className="text-lg font-black">2. Publishing</h3>
            <label className="flex items-center gap-3 rounded-lg bg-[#fff2db] p-4 font-semibold">
              <input type="checkbox" checked={fields.is_active} onChange={e => update("is_active", e.target.checked)} className="h-5 w-5 accent-black"/>
              Published (visible on public event listings)
            </label>
            <p className="text-xs text-gray-600">Leave unchecked to save as a draft. Translation can be added later.</p>
          </section>
          {error && <p role="alert" className="rounded bg-red-100 p-3 text-sm text-red-900">{error}</p>}
          {message && <p role="status" className="rounded bg-green-100 p-3 text-sm text-green-900">{message}</p>}
          <button type="submit" disabled={saving} className="w-full rounded-lg bg-black px-5 py-4 font-bold text-white disabled:opacity-50">
            {saving ? "Saving…" : fields.is_active ? "Save and publish" : "Save draft"}
          </button>
        </form>}

        {!showForm && <section className="mt-8">
          <h2 className="text-2xl font-black">Existing events</h2>
          {events.length === 0 ? <p className="mt-4 text-sm">No events yet. Create your first one above.</p> :
          <div className="mt-4 grid gap-3">
            {events.map(item => <article key={item.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-black bg-white p-4">
              <div><h3 className="font-black">{item.title}</h3>
                <p className="text-sm">{item.event_date} · {item.location || "Venue TBD"}</p>
                <p className="mt-1 text-xs font-bold">{item.is_active ? "Published" : "Draft"}</p></div>
              <button type="button" onClick={() => router.push(`/admin/events/${item.id}`)} className="rounded-lg border-2 border-black px-5 py-3 font-bold">Open event →</button>
            </article>)}
          </div>}
        </section>}
      </div>
    </main>
  );
}
