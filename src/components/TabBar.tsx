"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Camera, Hand, Package, Search, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/cari", label: "Cari", icon: Search },
  { href: "/dipegang", label: "Dipegang", icon: Hand },
  { href: "/", label: "Foto", icon: Camera },
  { href: "/stok", label: "Stok", icon: Package },
  { href: "/akun", label: "Akun", icon: User },
];

// Navigasi mobile & tablet (< 1024px). Desktop memakai Sidebar.
export function TabBar() {
  const path = usePathname();
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href) || (href === "/cari" && path.startsWith("/barang")));
  return (
    <nav aria-label="Menu utama"
      className="fixed inset-x-0 bottom-0 z-20 border-t bg-card pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-5 md:max-w-none">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          if (href === "/") {
            return (
              <li key={href} className="grid place-items-center">
                <Link href="/" aria-label="Foto barang" aria-current={active ? "page" : undefined}
                  className="grid size-12 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Icon aria-hidden />
                </Link>
              </li>
            );
          }
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined}
                className={cn("flex flex-col items-center gap-1 pt-1.5 text-[11px] font-medium", active ? "text-primary" : "text-muted-foreground")}>
                <Icon aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
