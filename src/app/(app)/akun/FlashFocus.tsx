"use client";

import { useEffect, useRef } from "react";

// Pesan hasil aksi server: digulir ke layar + difokus supaya selalu terlihat (closure),
// lalu ?pesan= dibersihkan dari URL agar tidak muncul lagi saat reload.
export function FlashFocus({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    ref.current?.focus({ preventScroll: true });
    const url = new URL(window.location.href);
    if (url.searchParams.has("pesan") || url.searchParams.has("galat")) {
      url.searchParams.delete("pesan"); url.searchParams.delete("galat");
      window.history.replaceState(window.history.state, "", url);
    }
  });
  return <div ref={ref} tabIndex={-1} className="outline-none">{children}</div>;
}
