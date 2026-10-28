"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {useSiteLanguage} from "@/lib/useSiteLanguage";

type Role = "owner" | "admin";
type Access = { email: string; role: Role } | null;
const tiles = [
  { title: "Events", ruTitle:"Мероприятия", detail: "Create events, update dates and ticket types",ruDetail:"Создавайте мероприятия, редактируйте даты и типы билетов", icon: "📅", href: "/admin/events" },
  { title: "Promo codes",ruTitle:"Промокоды", detail: "Manage discounts for any ticket type",ruDetail:"Промокоды для любых типов билетов", icon: "🏷️", href: "/admin/promotions" },
  { title: "Bookings & seating",ruTitle:"Брони и рассадка", detail: "See ticket types, guest contacts, named seats, childcare and sandbox payments",ruDetail:"Билеты, контакты гостей, закреплённые места, присмотр и тестовые оплаты", icon: "🎟️", href: "/admin/bookings" },
  { title: "Future invitations",ruTitle:"Будущие приглашения",detail:"Manage opted-in adults and event invitation contacts",ruDetail:"Контакты для будущих приглашений по согласию",icon:"✉️",href:"/admin/contacts" },
  { title: "Test booking email",ruTitle:"Тест письма", detail: "Send a sample booking confirmation to your organiser email",ruDetail:"Отправить образец подтверждения брони на почту организатора",icon:"✉️",href:"/admin/test-email" },
  { title: "Check-in",ruTitle:"Регистрация", detail: "Search guests and mark arrivals",ruDetail:"Поиск гостей и отметка о приходе", icon: "✅", href: "/staff/check-in" },
  { title: "Door staff access",ruTitle:"Доступ персонала", detail: "Grant or revoke check-in access per event",ruDetail:"Выдайте или отзовите доступ для регистрации гостей",icon: "🔑",href: "/admin/check-in-staff" },
  { title: "Website content",ruTitle:"Содержимое сайта", detail: "Update images, homepage and videos",ruDetail:"Обновление изображений, главной страницы и видео", icon: "✏️", href: null },
];

export default function AdminHome() {
  const router = useRouter();
  const en=useSiteLanguage()==="en";
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

  if (loading || !access) return <main className="min-h-[70vh] bg-[#fff2db] p-8" aria-live="polite">{en?"Checking admin access…":"Проверяем права доступа…"}</main>;

  return (
    <main className="min-h-[80vh] bg-[#fff2db] px-4 py-8 text-black sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-pink-700">Yumorilnik / Admin</p>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">{en?"Welcome back!":"С возвращением!"}</h1>
            <p className="mt-2 break-all text-sm text-gray-700">{access.email} · {access.role}</p>
          </div>
          <button type="button" onClick={signOut} className="rounded-lg border-2 border-black px-4 py-3 font-bold">{en?"Sign out":"Выйти"}</button>
        </div>
        <section className="mt-8 rounded-2xl border border-black bg-[#f5a047] p-5 sm:p-7">
          <h2 className="text-xl font-black">{en?"Your management dashboard":"Панель управления"}</h2>
          <p className="mt-2 max-w-2xl text-sm">{en?"Manage events and promotions, review bookings with assigned seats, or open door check-in. Real confirmations and sandbox tests are clearly separated.":"Управляйте мероприятиями и промокодами, просматривайте брони с закреплёнными местами или открывайте регистрацию гостей. Настоящие подтверждения и тестовые заказы разделены."}</p>
        </section>
        <section className="mt-6 grid gap-4 sm:grid-cols-2" aria-label="Admin tools">
          {tiles.map(tile => (
            <article key={tile.title} className="rounded-2xl border-2 border-black bg-white p-5">
              <span aria-hidden="true" className="text-3xl">{tile.icon}</span>
              <h2 className="mt-3 text-xl font-black">{en?tile.title:tile.ruTitle}</h2>
              <p className="mt-2 text-sm text-gray-700">{en?tile.detail:tile.ruDetail}</p>
              {tile.href ? <Link href={tile.href} className="mt-5 inline-block rounded-lg bg-black px-4 py-3 text-sm font-bold text-white">{tile.href==="/admin/bookings"?(en?"Manage bookings →":"Управлять бронями →"):tile.href==="/admin/contacts"?(en?"Manage contacts →":"Контакты →"):tile.href==="/staff/check-in"?(en?"Open check-in →":"Открыть регистрацию →"):tile.href==="/admin/check-in-staff"?(en?"Manage staff →":"Управлять доступом →"):tile.href==="/admin/promotions"?(en?"Manage codes →":"Управлять кодами →"):(en?"Manage events →":"Управлять мероприятиями →")}</Link> : <span className="mt-5 inline-block rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold">{en?"Coming next":"Скоро"}</span>}
            </article>
          ))}
        </section>
        <Link href="/" className="mt-8 inline-block font-semibold underline">{en?"← Public website":"← На сайт"}</Link>
      </div>
    </main>
  );
}
