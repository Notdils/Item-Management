"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Camera, ChevronRight, ClipboardCheck, Download, Hand, LayoutList, MapPin, Package, Search, Tags, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { DownloadLink, LinkPending } from "@/components/Pending";

type NavItem = { href: string; label: string; icon: LucideIcon; badge?: number };

// Teknikal: beranda = lapor. PLSS: beranda = ringkasan + grup Kelola (alat kerja admin, bukan pengaturan akun).
const navFor = (plss: boolean, overdue: number): NavItem[] => plss
  ? [
      { href: "/", label: "Ringkasan", icon: LayoutList, badge: overdue },
      { href: "/lapor", label: "Lapor barang", icon: Camera },
      { href: "/cari", label: "Cari", icon: Search },
      { href: "/dipegang", label: "Dipegang", icon: Hand },
      { href: "/stok", label: "Stok", icon: Package },
    ]
  : [
      { href: "/", label: "Lapor barang", icon: Camera },
      { href: "/cari", label: "Cari", icon: Search },
      { href: "/dipegang", label: "Dipegang", icon: Hand },
      { href: "/stok", label: "Stok", icon: Package },
    ];

const KELOLA: NavItem[] = [
  { href: "/akun/lokasi", label: "Lokasi & rak", icon: MapPin },
  { href: "/akun/barang", label: "Daftar barang", icon: Tags },
  { href: "/akun/opname", label: "Opname stok", icon: ClipboardCheck },
  { href: "/akun/anggota", label: "Anggota", icon: Users },
];

const isActive = (path: string, href: string) =>
  href === "/" ? path === "/" : path.startsWith(href) || (href === "/cari" && path.startsWith("/barang"));

function NavList({ items, path, label }: { items: NavItem[]; path: string; label: string }) {
  return (
    <ul aria-label={label} className="flex flex-col gap-1">
      {items.map(({ href, label, icon: Icon, badge }) => {
        const on = isActive(path, href);
        return (
          <li key={href}>
            <Link href={href} aria-current={on ? "page" : undefined} className={navItem(on)}>
              <LinkPending><Icon aria-hidden className="size-5" /></LinkPending>
              <span className="flex-1">{label}</span>
              {!!badge && (
                <span className="rounded-full bg-warn px-2 py-0.5 font-mono text-xs font-bold text-[#0c1211]" aria-label={`${badge} lewat 12 jam`}>{badge}</span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

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
export function Sidebar({ name, division, overdue = 0 }: { name: string; division: string; overdue?: number }) {
  const path = usePathname();
  const onAkun = path === "/akun";
  return (
    <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col gap-8 border-r bg-card px-4 pt-8 pb-4 lg:flex">
      <div className="pl-3"><Brand /></div>
      <nav aria-label="Menu utama" className="flex flex-col gap-6 overflow-y-auto">
        <NavList items={navFor(division === "PLSS", overdue)} path={path} label="Menu utama" />
        {division === "PLSS" && (
          <div className="flex flex-col gap-1">
            <p className="px-3 pb-1 text-[13px] font-semibold text-muted-foreground">Kelola</p>
            <NavList items={KELOLA} path={path} label="Kelola" />
            <DownloadLink href="/akun/ekspor" className={navItem(false)}>
              <Download aria-hidden className="size-5" />
              <span className="flex-1">Ekspor riwayat (CSV)</span>
            </DownloadLink>
          </div>
        )}
      </nav>
      <Link href="/akun" aria-current={onAkun ? "page" : undefined} aria-label={`Akun: ${name}`}
        className={cn(navItem(onAkun), "mt-auto min-h-14 py-2")}>
        <Avatar name={name} className={onAkun ? "bg-primary text-primary-foreground" : undefined} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-foreground">{name}</span>
          <span className="block truncate text-[13px] text-muted-foreground">{divisionLabel(division)}</span>
        </span>
        <LinkPending><ChevronRight aria-hidden className="size-4 text-muted-foreground" /></LinkPending>
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
