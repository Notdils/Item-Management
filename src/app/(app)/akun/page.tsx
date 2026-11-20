import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/session";
import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Flash } from "./Flash";
import { updateName } from "./actions";

export const metadata: Metadata = { title: "Akun" };

export default async function AkunPage({ searchParams }: { searchParams: Promise<{ pesan?: string; galat?: string }> }) {
  const sp = await searchParams;
  const profile = await requireProfile();
  const plss = profile.division === "PLSS";
  const supabase = await createClient();

  let menu: { href: string; label: string; meta: string; download?: boolean }[] = [];
  if (plss) {
    const count = (t: "locations" | "items" | "profiles") =>
      supabase.from(t).select("id", { count: "exact", head: true }).then((r) => r.count ?? 0);
    const [loc, items, members, kinds] = await Promise.all([
      count("locations"), count("items"), count("profiles"),
      supabase.from("items").select("id", { count: "exact", head: true }).eq("kind", "HABIS_PAKAI").is("archived_at", null).then((r) => r.count ?? 0),
    ]);
    menu = [
      { href: "/akun/lokasi", label: "Lokasi & rak", meta: `${loc} lokasi` },
      { href: "/akun/barang", label: "Daftar barang", meta: `${items} barang` },
      { href: "/akun/opname", label: "Opname stok", meta: `${kinds} jenis` },
      { href: "/akun/anggota", label: "Anggota", meta: `${members} akun` },
      { href: "/akun/ekspor", label: "Ekspor riwayat (CSV)", meta: "semua laporan", download: true },
    ];
  }

  return (
    <>
      <header className="flex flex-col gap-1.5">
        <p className="eyebrow text-muted-foreground">{plss ? "PLSS, admin data" : "Teknikal"}</p>
        <h1 className="title">{profile.full_name}</h1>
      </header>
      <Flash {...sp} />

      {menu.length > 0 && (
        <nav aria-label="Menu admin">
          <ul className="flex flex-col gap-2 md:grid md:grid-cols-2 md:gap-3 lg:grid-cols-3">
            {menu.map((m) => {
              const body = (
                <>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="font-medium">{m.label}</span>
                    <span className="font-mono text-xs text-muted-foreground">{m.meta}</span>
                  </span>
                  <ChevronRight aria-hidden className="size-[18px] text-muted-foreground" />
                </>
              );
              return (
                <li key={m.href}>
                  <Card className="p-0 hover:bg-accent">
                    {m.download
                      ? <a href={m.href} download className="flex items-center gap-3 px-4 py-4">{body}</a>
                      : <Link href={m.href} className="flex items-center gap-3 px-4 py-4">{body}</Link>}
                  </Card>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      <form action={updateName} className="lg:max-w-[456px]">
        <FieldGroup className="gap-3">
          <Field>
            <FieldLabel htmlFor="name">Nama tampilan</FieldLabel>
            <Input id="name" name="name" defaultValue={profile.full_name} autoComplete="name" required minLength={2} maxLength={80} />
          </Field>
          <Button variant="outline">Simpan nama</Button>
        </FieldGroup>
      </form>

      <form action={signOut}>
        <Button variant="outline" className="w-full lg:w-[200px]">Keluar</Button>
      </form>
    </>
  );
}
