import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/session";
import { signPhotos } from "@/lib/photos";
import { fmtDuration, fmtShort, HELD_LIMIT_HOURS } from "@/lib/format";
import { ItemRow } from "@/components/ItemRow";
import type { HeldItem } from "@/lib/types";

export const metadata: Metadata = { title: "Sedang dipegang" };

export default async function DipegangPage({ searchParams }: { searchParams: Promise<{ semua?: string }> }) {
  const all = (await searchParams).semua === "1";
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase.from("held_items")
    .select("item_id, name, user_id, user_name, photo_path, reported_at, overdue")
    .order("reported_at", { ascending: true });
  const held = (data ?? []) as HeldItem[];
  const mine = held.filter((h) => h.user_id === profile.id);
  const rows = all ? held : mine;
  const myOverdue = mine.filter((h) => h.overdue);
  const photos = await signPhotos(supabase, rows.map((r) => r.photo_path));

  return (
    <>
      <h1 className="title">Sedang dipegang</h1>
      <nav aria-label="Tampilan" className="flex gap-5 border-b border-line">
        {[{ label: `Saya · ${mine.length}`, href: "/dipegang", on: !all }, { label: `Semua · ${held.length}`, href: "/dipegang?semua=1", on: all }].map((t) => (
          <Link key={t.href} href={t.href} aria-current={t.on ? "page" : undefined}
            className={`-mb-px pb-2.5 text-[15px] font-semibold ${t.on ? "border-b-2 border-green" : "text-ink-2"}`}>{t.label}</Link>
        ))}
      </nav>

      {myOverdue.length > 0 && (
        <p role="status" className="card border border-warn px-3.5 py-3 text-sm">
          {myOverdue.map((h) => h.name).join(", ")} sudah kamu pegang lebih dari {HELD_LIMIT_HOURS} jam.
          Taruh kembali atau laporkan posisinya.
        </p>
      )}

      <section className="flex flex-col gap-2">
        {rows.map((h) => (
          <div key={h.item_id} className="card">
            <ItemRow href={`/barang/${h.item_id}`} name={h.name} photo={h.photo_path ? photos.get(h.photo_path) : null}
              meta={`${all ? `${h.user_name} · ` : ""}Diambil ${fmtShort(h.reported_at)} · ${fmtDuration(h.reported_at)}`}
              status={h.overdue ? `> ${HELD_LIMIT_HOURS} jam` : "Dipegang"} tone={h.overdue ? "warn" : "muted"} />
            {h.user_id === profile.id && (
              <div className="px-3 pb-3">
                <Link href={`/?item=${encodeURIComponent(h.name)}&aksi=TARUH`} className="btn btn-primary btn-sm w-full">Taruh sekarang</Link>
              </div>
            )}
          </div>
        ))}
        {rows.length === 0 && (
          <p className="card px-4 py-6 text-center text-sm text-ink-2">
            {all ? "Tidak ada alat yang sedang dipegang." : "Kamu tidak sedang memegang alat apa pun."}
          </p>
        )}
      </section>
    </>
  );
}
