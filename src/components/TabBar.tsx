"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Camera, Hand, LayoutList, Package, Search, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { LinkPending } from "@/components/Pending";

type Tab = { href: string; label: string; icon: LucideIcon; camera?: boolean; badge?: number };

// Navigasi mobile & tablet (< 1024px). Desktop memakai Sidebar.
// Teknikal: beranda = lapor. PLSS: beranda = ringkasan, lapor lewat tombol kamera.
export function TabBar({ division, overdue = 0 }: { division: string; overdue?: number }) {
  const path = usePathname();
  const plss = division === "PLSS";
  const tabs: Tab[] = plss
    ? [
        { href: "/", label: "Ringkasan", icon: LayoutList, badge: overdue },
        { href: "/cari", label: "Cari", icon: Search },
        { href: "/lapor", label: "Lapor barang", icon: Camera, camera: true },
        { href: "/stok", label: "Stok", icon: Package },
        { href: "/akun", label: "Akun", icon: User },
      ]
    : [
        { href: "/cari", label: "Cari", icon: Search },
        { href: "/dipegang", label: "Dipegang", icon: Hand },
        { href: "/", label: "Lapor barang", icon: Camera, camera: true },
        { href: "/stok", label: "Stok", icon: Package },
        { href: "/akun", label: "Akun", icon: User },
      ];
  const isActive = (t: Tab) =>
    t.camera ? path === "/lapor" || (!plss && path === "/")
    : t.href === "/" ? path === "/"
    : path.startsWith(t.href) || (t.href === "/cari" && path.startsWith("/barang"));
  return (
    <nav aria-label="Menu utama"
      className="fixed inset-x-0 bottom-0 z-20 border-t bg-card pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-5 md:max-w-none">
        {tabs.map((t) => {
          const { href, label, icon: Icon } = t;
          const active = isActive(t);
          if (t.camera) {
            return (
              <li key={href} className="grid place-items-center">
                <Link href={href} aria-label={label} aria-current={active ? "page" : undefined}
                  className="grid size-12 place-items-center rounded-full bg-primary text-primary-foreground">
                  <LinkPending><Icon aria-hidden /></LinkPending>
                </Link>
              </li>
            );
          }
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined}
                aria-label={t.badge ? `${label}, ${t.badge} lewat 12 jam` : undefined}
                className={cn("relative flex flex-col items-center gap-1 pt-1.5 text-[11px] font-medium", active ? "text-primary" : "text-muted-foreground")}>
                <LinkPending><Icon aria-hidden /></LinkPending>
                {label}
                {!!t.badge && (
                  <span aria-hidden className="absolute top-0 left-1/2 ml-2 grid h-4 min-w-4 place-items-center rounded-full bg-warn px-1 font-mono text-[10px] font-bold text-[#0c1211]">
                    {t.badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
