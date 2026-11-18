"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/cari", label: "Cari", icon: "search" },
  { href: "/dipegang", label: "Dipegang", icon: "hand" },
  { href: "/", label: "Foto", icon: "camera" },
  { href: "/stok", label: "Stok", icon: "box" },
  { href: "/akun", label: "Akun", icon: "user" },
];

export function TabBar() {
  const path = usePathname();
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <nav aria-label="Menu utama"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {TABS.map((t) => {
          const active = isActive(t.href);
          if (t.href === "/") {
            return (
              <li key={t.href} className="grid place-items-center">
                <Link href="/" aria-label="Foto barang" aria-current={active ? "page" : undefined}
                  className="grid size-12 place-items-center rounded-full bg-green text-green-ink">
                  <Icon name="camera" />
                </Link>
              </li>
            );
          }
          return (
            <li key={t.href}>
              <Link href={t.href} aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 pt-1.5 text-[11px] font-medium ${active ? "text-green" : "text-ink-2"}`}>
                <Icon name={t.icon} />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
