"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
      setError(err instanceof Error ? err.message : "Sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-[75vh] items-center justify-center bg-[#f5a047] px-5 py-12">
      <div className="w-full max-w-md rounded-2xl border-2 border-black bg-[#fff2db] p-6 shadow-[6px_6px_0_#171717] sm:p-9">
        <p className="text-sm font-bold uppercase tracking-widest text-pink-700">Юморильник</p>
        <h1 className="mt-3 text-3xl font-black">Admin sign in</h1>
        <p className="mt-2 text-sm">Sign in with your Yumorilnik administrator account.</p>
        <form onSubmit={submit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="email" className="mb-2 block font-semibold">Email</label>
            <input id="email" type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded-lg border-2 border-black bg-white px-4 py-3" />
          </div>
          <div>
            <label htmlFor="password" className="mb-2 block font-semibold">Password</label>
            <input id="password" type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-lg border-2 border-black bg-white px-4 py-3" />
          </div>
          {error && <p role="alert" className="rounded-lg bg-red-100 px-3 py-3 text-sm text-red-900">{error}</p>}
          <button type="submit" disabled={busy} className="w-full rounded-lg bg-black px-5 py-4 font-bold text-white disabled:opacity-50">{busy ? "Signing in…" : "Sign in"}</button>
        </form>
        <Link href="/admin/forgot-password" className="mt-4 inline-block text-sm font-semibold underline">Forgot password?</Link>
        <div />
        <Link href="/" className="mt-6 inline-block text-sm font-semibold underline">← Back to website</Link>
      </div>
    </main>
  );
}
