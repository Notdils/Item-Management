import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signPhotos } from "@/lib/photos";
import { fmtAgo, fmtDuration, HELD_LIMIT_HOURS } from "@/lib/format";
import { ItemRow } from "@/components/ItemRow";
import { Icon } from "@/components/Icon";
import type { ItemOverview } from "@/lib/types";

export const metadata: Metadata = { title: "Cari barang" };

const FILTERS = [
  { key: "", label: "Semua" },
  { key: "ALAT", label: "Alat" },
  { key: "HABIS_PAKAI", label: "Habis pakai" },
] as const;

export default async function CariPage({ searchParams }: { searchParams: Promise<{ q?: string; jenis?: string }> }) {
  const { q = "", jenis = "" } = await searchParams;
  const supabase = await createClient();

  let query = supabase.from("item_overview").select("*").order("name").limit(100);
  const term = q.trim().toLowerCase().replace(/\s+/g, " ");
  // escape wildcard LIKE supaya input "%" atau "_" dicari apa adanya
  if (term) query = query.ilike("name_key", `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  if (jenis === "ALAT" || jenis === "HABIS_PAKAI") query = query.eq("kind", jenis);
  const { data } = await query;
  const rows = (data ?? []) as ItemOverview[];
  const photos = await signPhotos(supabase, rows.map((r) => r.photo_path));

  return (
    <>
      <h1 className="title">Cari barang</h1>
      <search>
        <form action="/cari" className="flex flex-col gap-3">
          <div>
            <label htmlFor="q" className="field-label">Cari</label>
            <div className="relative">
              <Icon name="search" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-2" />
              <input id="q" name="q" type="search" defaultValue={q} className="input pl-10" enterKeyHint="search"
                autoComplete="off" autoCorrect="off" spellCheck={false} placeholder="nama barang" />
            </div>
          </div>
          {jenis && <input type="hidden" name="jenis" value={jenis} />}
        </form>
      </search>
      <nav aria-label="Filter jenis" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = jenis === f.key;
          const params = new URLSearchParams({ ...(q && { q }), ...(f.key && { jenis: f.key }) });
          return (
            <Link key={f.key} href={`/cari${params.size ? `?${params}` : ""}`} aria-current={active ? "page" : undefined}
              className={`inline-flex items-center rounded-full px-3.5 text-sm font-medium ${active ? "bg-ink text-bg" : "border border-line"}`}>
              {f.label}
            </Link>
          );
        })}
      </nav>

      <section aria-label="Hasil" className="flex flex-col gap-2">
        <p className="eyebrow text-ink-2" aria-live="polite">{rows.length} hasil</p>
        {rows.map((r) => <OverviewRow key={r.id} r={r} photo={r.photo_path ? photos.get(r.photo_path) : null} />)}
        {rows.length === 0 && (
          <p className="card px-4 py-6 text-center text-sm text-ink-2">
            Tidak ada barang{term ? ` dengan nama "${q}"` : ""}. Barang baru otomatis terdaftar saat pertama kali dilaporkan.
          </p>
        )}
      </section>
    </>
  );
}

function OverviewRow({ r, photo }: { r: ItemOverview; photo?: string | null }) {
  const href = `/barang/${r.id}`;
  if (r.kind === "HABIS_PAKAI") {
    return <ItemRow href={href} name={r.name} photo={photo}
      meta={`${r.location_count ?? 0} lokasi · habis pakai`} status={`${r.qty_total ?? 0} ${r.unit ?? ""}`}
      tone={(r.qty_total ?? 0) > 0 ? "green" : "warn"} />;
  }
  if (!r.last_kind) return <ItemRow href={href} name={r.name} meta="Belum ada laporan" status="-" tone="muted" />;
  if (r.last_kind === "AMBIL") {
    const late = Date.now() - new Date(r.reported_at!).getTime() > HELD_LIMIT_HOURS * 3_600_000;
    return <ItemRow href={href} name={r.name} photo={photo}
      meta={`Dipegang ${r.user_name} · ${fmtDuration(r.reported_at!)}`} status="Dipegang" tone={late ? "warn" : "muted"} />;
  }
  return <ItemRow href={href} name={r.name} photo={photo}
    meta={`${r.location_code} · oleh ${r.user_name} · ${fmtAgo(r.reported_at!)}`} status="Di rak" />;
}
