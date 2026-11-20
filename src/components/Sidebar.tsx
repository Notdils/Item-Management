"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Camera, Hand, Package, Search, User, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/cari", label: "Cari", icon: Search },
  { href: "/dipegang", label: "Dipegang", icon: Hand },
  { href: "/stok", label: "Stok", icon: Package },
  { href: "/akun", label: "Akun", icon: User },
];

// Navigasi desktop (>= 1024px). Mobile & tablet memakai TabBar.
export function Sidebar({ name, division }: { name: string; division: string }) {
  const path = usePathname();
  const active = (href: string) => path.startsWith(href) || (href === "/cari" && path.startsWith("/barang"));
  return (
    <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col gap-4 border-r bg-card px-4 pt-8 pb-6 lg:flex">
      <div className="flex flex-col gap-1 pb-2 pl-2">
        <p className="eyebrow text-primary">Anargya · Bengkel</p>
        <p className="font-mono text-xs text-muted-foreground">Manajemen barang</p>
      </div>
      <Button asChild>
        <Link href="/" aria-current={path === "/" ? "page" : undefined}>
          <Camera data-icon="inline-start" /> Lapor barang
        </Link>
      </Button>
      <nav aria-label="Menu utama">
        <ul className="flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const on = active(href);
            return (
              <li key={href}>
                <Link href={href} aria-current={on ? "page" : undefined}
                  className={cn("flex min-h-11 items-center gap-3 rounded-lg px-3 text-[15px] font-medium", on ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60")}>
                  <Icon aria-hidden className={cn("size-5", on && "text-primary")} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="mt-auto flex flex-col gap-4">
        <Separator />
        <div className="pl-3">
          <p className="text-[15px] font-semibold">{name}</p>
          <p className="font-mono text-xs text-muted-foreground">{division}</p>
        </div>
      </div>
    </aside>
  );
}

// Header tablet (768-1023px)
export function TopBar({ name, division }: { name: string; division: string }) {
  return (
    <header className="sticky top-0 z-20 hidden h-16 items-center justify-between border-b bg-card px-12 md:flex lg:hidden">
      <p className="eyebrow text-primary">Anargya · Bengkel</p>
      <p className="flex items-center gap-2 text-sm font-medium">
        {name} <span className="font-mono text-[11px] text-primary">{division}</span>
      </p>
    </header>
  );
}
