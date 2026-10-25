"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import {useSiteLanguage} from "@/lib/useSiteLanguage";

export default function ForgotPasswordPage() {
  const en=useSiteLanguage()==="en";
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/admin/reset-password`,
    });
    if (resetError) setError(resetError.message);
    else setSent(true);
    setBusy(false);
  }

  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-[#f5a047] px-5 py-12">
      <section className="w-full max-w-md rounded-2xl border-2 border-black bg-[#fff2db] p-6 sm:p-9">
        <h1 className="text-3xl font-black">{en?"Reset your password":"Сброс пароля"}</h1>
        <p className="mt-3 text-sm">{en?"We'll email you a link to choose a new password.":"Мы отправим ссылку для установки нового пароля."}</p>
        {sent ? (
          <p className="mt-6 rounded bg-white p-4" role="status">{en?"Check your inbox. If this email has an account, you'll receive a recovery link.":"Проверьте почту. Если аккаунт существует, вы получите ссылку для восстановления."}</p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label htmlFor="reset-email" className="block font-semibold">{en?"Email":"Электронная почта"}</label>
            <input id="reset-email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded border-2 border-black bg-white px-4 py-3" />
            {error && <p role="alert" className="rounded bg-red-100 p-3 text-sm text-red-900">{error}</p>}
            <button disabled={busy} className="w-full rounded bg-black px-5 py-4 font-bold text-white disabled:opacity-50" type="submit">{busy?(en?"Sending…":"Отправка…"):(en?"Email recovery link":"Отправить ссылку")}</button>
          </form>
        )}
        <Link href="/admin/login" className="mt-6 inline-block text-sm font-semibold underline">{en?"← Back to sign in":"← Вернуться ко входу"}</Link>
      </section>
    </main>
  );
}
