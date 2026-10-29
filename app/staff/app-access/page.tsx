"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useSiteLanguage } from "@/lib/useSiteLanguage";

export default function StaffAppAccess() {
  const en = useSiteLanguage() === "en";
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) throw new Error(en
          ? "Sign in with Google in Safari first, then return here."
          : "Сначала войдите через Google в Safari и вернитесь сюда.");
        const [{ data: role }, { data: events, error: staffError }] = await Promise.all([
          supabase.from("admin_users").select("role").eq("user_id", user.id).maybeSingle(),
          supabase.rpc("staff_available_events"),
        ]);
        const isAdmin = role && ["owner", "admin"].includes(role.role);
        const hasStaffAccess = !staffError && Array.isArray(events) && events.length > 0;
        if (!isAdmin && !hasStaffAccess) throw new Error(en
          ? "You need event check-in access from Marina before setting up the staff app."
          : "Для настройки приложения Марина должна предоставить вам доступ к регистрации.");
        if (active) { setEmail(user.email ?? ""); setAllowed(true); }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [en]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (password.length < 12) {
      setError(en ? "Use at least 12 characters." : "Пароль должен содержать не менее 12 символов.");
      return;
    }
    if (password !== confirm) {
      setError(en ? "Passwords do not match." : "Пароли не совпадают.");
      return;
    }
    setBusy(true); setError("");
    try {
      // Supabase supports adding email/password authentication to an existing
      // Google OAuth account without creating a second user or changing roles.
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setPassword(""); setConfirm(""); setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return <main className="min-h-[75vh] bg-[#fff2db] px-5 py-10 text-black">
    <section className="mx-auto max-w-lg space-y-5 rounded-2xl border-2 border-black bg-white p-6">
      <Link href="/staff/check-in" className="text-sm font-semibold underline">
        {en ? "← Back to check-in" : "← Назад к регистрации"}
      </Link>
      <h1 className="text-3xl font-black">{en ? "Staff app access" : "Доступ с телефона"}</h1>
      <p className="text-sm">
        {en ? "Set a Yumorilnik password on the same account you use with Google. It lets your Home Screen app sign in directly, avoiding Safari-to-app Google sign-in problems."
            : "Установите пароль Юморильника для того же аккаунта Google. Так можно войти прямо из приложения на главном экране, без переключения между Safari и приложением."}
      </p>
      {loading && <p role="status">{en ? "Checking access…" : "Проверяем доступ…"}</p>}
      {error && <p role="alert" className="rounded bg-red-100 p-3 text-sm text-red-900">{error}</p>}
      {allowed && <>
        <p className="break-all text-sm text-gray-700">{en ? "Account: " : "Аккаунт: "}{email}</p>
        {saved ? <div className="space-y-3 rounded-lg bg-green-50 p-4">
          <p role="status" className="font-bold">{en ? "App password saved." : "Пароль сохранён."}</p>
          <p className="text-sm">{en
            ? "In Safari, open yumorilnik.com/staff/check-in and choose Share → Add to Home Screen. Open the new icon, enter your email and this password once. Keep your device protected with a screen lock."
            : "В Safari откройте yumorilnik.com/staff/check-in → Поделиться → На экран «Домой». Откройте значок и один раз введите email и этот пароль. Используйте блокировку экрана телефона."}
          </p>
        </div> : <form onSubmit={e => void save(e)} className="space-y-3">
          <label htmlFor="app-password" className="block text-sm font-semibold">{en ? "App password (12+ characters)" : "Пароль (от 12 символов)"}</label>
          <input id="app-password" type="password" autoComplete="new-password" minLength={12} required
            value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-lg border border-black/30 bg-white p-3" />
          <label htmlFor="app-confirm" className="block text-sm font-semibold">{en ? "Confirm password" : "Подтвердите пароль"}</label>
          <input id="app-confirm" type="password" autoComplete="new-password" minLength={12} required
            value={confirm} onChange={e => setConfirm(e.target.value)} className="w-full rounded-lg border border-black/30 bg-white p-3" />
          <button type="submit" disabled={busy} className="w-full rounded-lg bg-black p-4 font-bold text-white disabled:opacity-50">
            {busy ? (en ? "Saving…" : "Сохраняем…") : (en ? "Save app password" : "Сохранить пароль")}
          </button>
          <p className="text-xs text-gray-600">{en
            ? "This is an account password, not a shared event PIN. Google sign-in remains available. Changing a password can end existing sessions."
            : "Это личный пароль аккаунта, а не общий код мероприятия. Вход через Google сохраняется. Смена пароля может завершить другие сеансы."}
          </p>
        </form>}
      </>}
      {!allowed && !loading && <Link href="/staff/login" className="inline-block rounded-lg bg-black px-4 py-3 font-bold text-white">
        {en ? "Sign in in Safari" : "Войти в Safari"}
      </Link>}
    </section>
  </main>;
}
