"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Role = "owner" | "admin";
type Access = { email: string; role: Role } | null;
const tiles = [
  { title: "Events", detail: "Create events, update dates and ticket types", icon: "📅" },
  { title: "Bookings", detail: "Find guests and review ticket sales", icon: "🎟️" },
  { title: "Check-in", detail: "Scan tickets at the venue", icon: "✅" },
  { title: "Website content", detail: "Update images, homepage and videos", icon: "✏️" },
];

export default function AdminHome() {
  const router = useRouter();
  const [access, setAccess] = useState<Access>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function check() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error("Not signed in");
        const { data, error } = await supabase.from("admin_users").select("role").eq("user_id", user.id).maybeSingle();
        if (error || !data || !["owner", "admin"].includes(data.role)) throw new Error("No admin access");
        if (active) setAccess({ email: user.email ?? "", role: data.role as Role });
      } catch {
        if (active) router.replace("/admin/login");
      } finally {
        if (active) setLoading(false);
      }
    }
    void check();
    return () => { active = false; };
  }, [router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/admin/login");
  }

  if (loading || !access) return <main className="min-h-[70vh] bg-[#fff2db] p-8" aria-live="polite">Checking admin access…</main>;

  return (
    <main className="min-h-[80vh] bg-[#fff2db] px-4 py-8 text-black sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-pink-700">Yumorilnik / Admin</p>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">Welcome back!</h1>
            <p className="mt-2 break-all text-sm text-gray-700">{access.email} · {access.role}</p>
          </div>
          <button type="button" onClick={signOut} className="rounded-lg border-2 border-black px-4 py-3 font-bold">Sign out</button>
        </div>
        <section className="mt-8 rounded-2xl border border-black bg-[#f5a047] p-5 sm:p-7">
          <h2 className="text-xl font-black">Your management dashboard</h2>
          <p className="mt-2 max-w-2xl text-sm">Administrator access is connected. The tools below will be activated as we build event management, booking search and mobile check-in.</p>
        </section>
        <section className="mt-6 grid gap-4 sm:grid-cols-2" aria-label="Admin tools">
          {tiles.map(tile => (
            <article key={tile.title} className="rounded-2xl border-2 border-black bg-white p-5">
              <span aria-hidden="true" className="text-3xl">{tile.icon}</span>
              <h2 className="mt-3 text-xl font-black">{tile.title}</h2>
              <p className="mt-2 text-sm text-gray-700">{tile.detail}</p>
              <span className="mt-5 inline-block rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold">Coming next</span>
            </article>
          ))}
        </section>
        <Link href="/" className="mt-8 inline-block font-semibold underline">← Public website</Link>
      </div>
    </main>
  );
}
