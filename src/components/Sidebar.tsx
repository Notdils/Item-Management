"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Camera, ChevronRight, Hand, Package, Search, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Lapor barang", icon: Camera },
  { href: "/cari", label: "Cari", icon: Search },
  { href: "/dipegang", label: "Dipegang", icon: Hand },
  { href: "/stok", label: "Stok", icon: Package },
];

const isActive = (path: string, href: string) =>
  href === "/" ? path === "/" : path.startsWith(href) || (href === "/cari" && path.startsWith("/barang"));

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

const divisionLabel = (d: string) => (d === "PLSS" ? "PLSS, admin data" : "Teknikal");

function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span aria-hidden className={cn("grid size-9 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-foreground", className)}>
      {initials(name)}
    </span>
  );
}

function Brand() {
  return (
    <p className="flex flex-col">
      <span className="text-lg font-extrabold leading-tight tracking-tight">Bengkel Anargya</span>
      <span className="text-[13px] text-muted-foreground">Manajemen barang</span>
    </p>
  );
}

// Penanda aktif yang sama untuk semua menu, termasuk blok akun: garis hijau kiri + teks hijau
const navItem = (on: boolean) =>
  cn("relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-[15px] font-medium",
    on ? "bg-accent text-primary before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-primary"
      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground");

// Navigasi desktop (>= 1024px). Akun = blok profil di kiri bawah (pola umum Slack/Notion/Vercel).
export function Sidebar({ name, division }: { name: string; division: string }) {
  const path = usePathname();
  const onAkun = path.startsWith("/akun");
  return (
    <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col gap-8 border-r bg-card px-4 pt-8 pb-4 lg:flex">
      <div className="pl-3"><Brand /></div>
      <nav aria-label="Menu utama">
        <ul className="flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const on = isActive(path, href);
            return (
              <li key={href}>
                <Link href={href} aria-current={on ? "page" : undefined} className={navItem(on)}>
                  <Icon aria-hidden className="size-5" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <Link href="/akun" aria-current={onAkun ? "page" : undefined} aria-label={`Akun: ${name}`}
        className={cn(navItem(onAkun), "mt-auto min-h-14 py-2")}>
        <Avatar name={name} className={onAkun ? "bg-primary text-primary-foreground" : undefined} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-foreground">{name}</span>
          <span className="block truncate text-[13px] text-muted-foreground">{divisionLabel(division)}</span>
        </span>
        <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
      </Link>
    </aside>
  );
}

// Header tablet (768-1023px): akun di kanan atas
export function TopBar({ name, division }: { name: string; division: string }) {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-20 hidden h-16 items-center justify-between border-b bg-card px-12 md:flex lg:hidden">
      <Brand />
      <Link href="/akun" aria-current={path.startsWith("/akun") ? "page" : undefined} aria-label={`Akun: ${name}`}
        className="flex min-h-11 items-center gap-2.5 rounded-full py-1 pr-3 pl-1 hover:bg-accent">
        <Avatar name={name} className="size-8 text-xs" />
        <span className="text-sm font-semibold">{name}</span>
        <span className="text-[13px] text-muted-foreground">{division}</span>
      </Link>
    </header>
  );
}
