"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useLinkStatus } from "next/link";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

// Tombol submit form server action: langsung nonaktif + spinner saat diproses,
// supaya pengguna tahu aksinya jalan dan tidak menekan berulang kali.
export function SubmitButton({ children, pendingText, ...props }:
  React.ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending && <Spinner data-icon="inline-start" />}
      {pending ? (pendingText ?? "Memproses...") : children}
    </Button>
  );
}

// Dipasang di dalam <Link>: spinner kecil selama halaman tujuan dimuat
export function LinkPending({ children }: { children?: React.ReactNode }) {
  const { pending } = useLinkStatus();
  if (!pending) return <>{children}</>;
  return <Spinner aria-label="Memuat" className="size-4 shrink-0 animate-spin" />;
}

// Tautan unduhan (CSV): tidak ada navigasi, jadi status ditampilkan sendiri beberapa detik
export function DownloadLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  const [busy, setBusy] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(t.current), []);
  return (
    <a href={href} download className={className} aria-busy={busy}
      onClick={() => { setBusy(true); clearTimeout(t.current); t.current = setTimeout(() => setBusy(false), 3000); }}>
      {children}
      {busy && <span role="status" className="sr-only">Menyiapkan file unduhan</span>}
      {busy ? <Spinner aria-hidden className="size-4 shrink-0" /> : null}
    </a>
  );
}
