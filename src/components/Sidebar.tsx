"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Camera, Hand, Package, Search, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Lapor barang", icon: Camera },
  { href: "/cari", label: "Cari", icon: Search },
  { href: "/dipegang", label: "Dipegang", icon: Hand },
  { href: "/stok", label: "Stok", icon: Package },
  { href: "/akun", label: "Akun", icon: User },
];

const isActive = (path: string, href: string) =>
  href === "/" ? path === "/" : path.startsWith(href) || (href === "/cari" && path.startsWith("/barang"));

function Wordmark() {
  return (
    <p className="flex items-baseline gap-2">
      <span className="text-[26px] font-extrabold leading-none [font-stretch:72%]">Bengkel</span>
      <span className="text-sm text-muted-foreground">Anargya EV</span>
    </p>
  );
}

// Navigasi desktop (>= 1024px). Semua menu setara; aksi utama ada di halaman, bukan di sidebar.
export function Sidebar({ name, division }: { name: string; division: string }) {
  const path = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col gap-8 border-r px-4 pt-9 pb-6 lg:flex">
      <div className="pl-3"><Wordmark /></div>
      <nav aria-label="Menu utama">
        <ul className="flex flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const on = isActive(path, href);
            return (
              <li key={href}>
                <Link href={href} aria-current={on ? "page" : undefined}
                  className={cn("flex min-h-11 items-center gap-3 rounded-md px-3 text-[15px] font-medium",
                    on ? "bg-primary text-primary-foreground" : "text-foreground/75 hover:bg-accent hover:text-foreground")}>
                  <Icon aria-hidden className="size-[18px]" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="mt-auto border-t pt-4 pl-3">
        <p className="text-[15px] font-semibold">{name}</p>
        <p className="text-sm text-muted-foreground">{division === "PLSS" ? "PLSS, admin data" : "Teknikal"}</p>
      </div>
    </aside>
  );
}

// Header tablet (768-1023px)
export function TopBar({ name, division }: { name: string; division: string }) {
  return (
    <header className="sticky top-0 z-20 hidden h-16 items-center justify-between border-b bg-background/95 px-12 backdrop-blur md:flex lg:hidden">
      <Wordmark />
      <p className="text-sm"><span className="font-semibold">{name}</span> <span className="text-muted-foreground">({division})</span></p>
    </header>
  );
}
