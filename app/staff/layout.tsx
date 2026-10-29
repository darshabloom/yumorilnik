import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Юморильник | Staff Check-in",
  description: "Yumorilnik secure staff ticket scanning and event check-in",
  manifest: "/staff.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Yumorilnik Staff",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/staff-icon.svg",
    apple: "/favicon.ico",
  },
};

export default function StaffLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
