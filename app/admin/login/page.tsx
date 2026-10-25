"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import {useSiteLanguage} from "@/lib/useSiteLanguage";

export default function AdminLogin() {
  const router = useRouter();
  const en=useSiteLanguage()==="en";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function readableAuthError(err: unknown) {
    const message=err instanceof Error?err.message:String(err);
    if (/failed to fetch|networkerror|fetch failed/i.test(message)) {
      return en
        ?"Cannot connect to Supabase authentication. Check your internet connection and NEXT_PUBLIC_SUPABASE_URL, then try again."
        :"Не удаётся подключиться к Supabase. Проверьте интернет и NEXT_PUBLIC_SUPABASE_URL, затем попробуйте ещё раз.";
    }
    return message;
  }

  async function signInWithGoogle() {
    setBusy(true);
    setError("");
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/admin` },
      });
      if (oauthError) throw oauthError;
    } catch (err) {
      setError(readableAuthError(err));
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      if (!data.user) throw new Error("Could not verify your account.");
      const { data: membership, error: roleError } = await supabase
        .from("admin_users").select("role").eq("user_id", data.user.id).maybeSingle();
      if (roleError || !membership) {
        await supabase.auth.signOut();
        throw new Error("This account does not have administrator access.");
      }
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      setError(readableAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-[75vh] items-center justify-center bg-[#f5a047] px-5 py-12">
      <div className="w-full max-w-md rounded-2xl border-2 border-black bg-[#fff2db] p-6 shadow-[6px_6px_0_#171717] sm:p-9">
        <p className="text-sm font-bold uppercase tracking-widest text-pink-700">Юморильник</p>
        <h1 className="mt-3 text-3xl font-black">{en?"Admin sign in":"Вход для администратора"}</h1>
        <p className="mt-2 text-sm">{en?"Sign in with your Yumorilnik administrator account.":"Войдите в учётную запись администратора Юморильника."}</p>
        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={busy}
          className="mt-8 flex w-full items-center justify-center gap-3 rounded-lg border-2 border-black bg-white px-5 py-4 font-bold hover:bg-gray-50 disabled:opacity-50"
        >
          <span aria-hidden="true" className="font-black text-[#4285f4]">G</span>
          {en?"Continue with Google":"Продолжить через Google"}
        </button>
        <div className="my-5 flex items-center gap-3 text-sm text-gray-600">
          <span className="h-px flex-1 bg-black/20" />
          {en?"or sign in with email":"или войдите по email"}
          <span className="h-px flex-1 bg-black/20" />
        </div>
        <form onSubmit={submit} className="space-y-5">
          <div>
            <label htmlFor="email" className="mb-2 block font-semibold">{en?"Email":"Электронная почта"}</label>
            <input id="email" type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded-lg border-2 border-black bg-white px-4 py-3" />
          </div>
          <div>
            <label htmlFor="password" className="mb-2 block font-semibold">{en?"Password":"Пароль"}</label>
            <input id="password" type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-lg border-2 border-black bg-white px-4 py-3" />
          </div>
          {error && <p role="alert" className="rounded-lg bg-red-100 px-3 py-3 text-sm text-red-900">{error}</p>}
          <button type="submit" disabled={busy} className="w-full rounded-lg bg-black px-5 py-4 font-bold text-white disabled:opacity-50">{busy ? (en?"Signing in…":"Вход…") : (en?"Sign in":"Войти")}</button>
        </form>
        <Link href="/admin/forgot-password" className="mt-4 inline-block text-sm font-semibold underline">{en?"Forgot password?":"Забыли пароль?"}</Link>
        <div />
        <Link href="/" className="mt-6 inline-block text-sm font-semibold underline">{en?"← Back to website":"← На сайт"}</Link>
      </div>
    </main>
  );
}
