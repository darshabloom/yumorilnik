"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function initialise() {
      try {
        // Supabase recovery emails may use a URL fragment; the Supabase client
        // handles exchanging fragment tokens and storing a recovery session.
        const hash = new URLSearchParams(window.location.hash.slice(1));
        if (hash.get("error_description")) throw new Error(hash.get("error_description") ?? "Invalid recovery link");
        const access = hash.get("access_token");
        const refresh = hash.get("refresh_token");
        if (access && refresh) {
          const { error: sessionError } = await supabase.auth.setSession({ access_token: access, refresh_token: refresh });
          if (sessionError) throw sessionError;
          window.history.replaceState({}, "", window.location.pathname);
        }
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) throw new Error("This recovery link is expired or invalid. Request a new link.");
        if (mounted) setReady(true);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : "Could not verify your recovery link.");
      }
    }
    void initialise();
    return () => { mounted = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 12) { setError("Use at least 12 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setSaving(true);
    setError("");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
    } else {
      await supabase.auth.signOut();
      setDone(true);
      setPassword("");
      setConfirm("");
    }
    setSaving(false);
  }

  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-[#f5a047] px-5 py-12">
      <section className="w-full max-w-md rounded-2xl border-2 border-black bg-[#fff2db] p-6 sm:p-9">
        <h1 className="text-3xl font-black">Set a new password</h1>
        {done ? (
          <div className="mt-6 space-y-4">
            <p role="status">Password updated. You can now sign in.</p>
            <Link href="/admin/login" className="inline-block bg-black px-5 py-3 font-bold text-white">Go to admin login</Link>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm">Choose a password for your Yumorilnik account.</p>
            {error && <p role="alert" className="mt-5 rounded bg-red-100 p-3 text-sm text-red-900">{error}</p>}
            {!ready && !error && <p className="mt-5" role="status">Checking recovery link…</p>}
            {ready && (
              <form onSubmit={submit} className="mt-6 space-y-4">
                <label className="block font-semibold" htmlFor="new-password">New password</label>
                <input id="new-password" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded border-2 border-black bg-white px-4 py-3" />
                <label className="block font-semibold" htmlFor="confirm-password">Confirm password</label>
                <input id="confirm-password" type="password" autoComplete="new-password" minLength={12} required value={confirm} onChange={e => setConfirm(e.target.value)} className="w-full rounded border-2 border-black bg-white px-4 py-3" />
                <button type="submit" disabled={saving} className="w-full rounded bg-black px-5 py-4 font-bold text-white disabled:opacity-50">{saving ? "Saving…" : "Save new password"}</button>
              </form>
            )}
            <Link href="/admin/login" className="mt-6 inline-block text-sm font-semibold underline">Return to sign in</Link>
          </>
        )}
      </section>
    </main>
  );
}
