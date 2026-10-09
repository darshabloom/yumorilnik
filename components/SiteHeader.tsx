"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Language = "ru" | "en";

const labels = {
  ru: { home: "Главная", events: "Афиша", about: "О нас", contact: "Контакты", tickets: "Купить билеты", menu: "Открыть меню", close: "Закрыть меню" },
  en: { home: "Home", events: "Events", about: "About", contact: "Contact", tickets: "Book tickets", menu: "Open menu", close: "Close menu" },
};

export default function SiteHeader() {
  const [language, setLanguage] = useState<Language>("ru");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("yumorilnik-language");
    if (stored === "en" || stored === "ru") setLanguage(stored);
  }, []);

  const changeLanguage = (next: Language) => {
    setLanguage(next);
    window.localStorage.setItem("yumorilnik-language", next);
    document.documentElement.lang = next;
  };

  const t = labels[language];
  const links = [
    { href: "/", label: t.home },
    { href: "/events", label: t.events },
    { href: "/about", label: t.about },
    { href: "/contact", label: t.contact },
  ];

  return (
    <header className="relative z-30 bg-[#f5a047] text-black">
      <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-4 px-5 py-4 md:px-8">
        <Link href="/" className="text-3xl font-black tracking-tight text-pink-600 sm:text-4xl" onClick={() => setOpen(false)}>
          Юморильник
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-5 lg:flex">
          {links.map(({ href, label }) => (
            <Link key={href} href={href} className="font-semibold hover:underline focus-visible:underline">
              {label}
            </Link>
          ))}
          <Link href="/events" className="border-2 border-black px-4 py-2 font-bold transition-colors hover:bg-black hover:text-[#f5a047]">
            {t.tickets}
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-md border border-black/50 p-0.5 text-sm font-semibold" aria-label="Site language">
            {(["ru", "en"] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => changeLanguage(code)}
                aria-pressed={language === code}
                className={`rounded px-2 py-1 ${language === code ? "bg-black text-[#f5a047]" : "hover:bg-black/10"}`}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center border border-black lg:hidden"
            aria-label={open ? t.close : t.menu}
            aria-expanded={open}
            aria-controls="mobile-site-nav"
            onClick={() => setOpen(!open)}
          >
            <span aria-hidden="true" className="text-2xl leading-none">{open ? "×" : "☰"}</span>
          </button>
        </div>
      </div>

      <nav
        id="mobile-site-nav"
        aria-label="Mobile navigation"
        className={`${open ? "flex" : "hidden"} flex-col gap-1 border-t border-black/20 px-5 pb-5 pt-3 lg:hidden`}
      >
        {links.map(({ href, label }) => (
          <Link key={href} href={href} onClick={() => setOpen(false)} className="rounded px-3 py-3 text-lg font-semibold hover:bg-black/10">
            {label}
          </Link>
        ))}
        <Link href="/events" onClick={() => setOpen(false)} className="mt-2 bg-black px-4 py-3 text-center font-bold text-[#f5a047]">
          {t.tickets}
        </Link>
      </nav>
    </header>
  );
}
