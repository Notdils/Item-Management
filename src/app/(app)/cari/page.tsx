import type { Metadata } from "next";
import Link from "next/link";
import { PackageSearch, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signPhotos } from "@/lib/photos";
import { fmtAgo, fmtDuration, HELD_LIMIT_HOURS } from "@/lib/format";
import { ItemRow, Thumb, type Tone } from "@/components/ItemRow";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ItemOverview } from "@/lib/types";
import { KindFilter } from "./KindFilter";

export const metadata: Metadata = { title: "Cari barang" };

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
  const photo = (r: ItemOverview) => (r.photo_path ? photos.get(r.photo_path) : null);

  return (
    <>
      <h1 className="title">Cari barang</h1>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <search className="lg:flex-1">
          <form action="/cari">
            <label htmlFor="q" className="sr-only">Cari nama barang</label>
            <div className="relative">
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted-foreground" />
              <Input id="q" name="q" type="search" defaultValue={q} className="pl-10" enterKeyHint="search"
                autoComplete="off" autoCorrect="off" spellCheck={false} placeholder="nama barang" />
            </div>
            {jenis && <input type="hidden" name="jenis" value={jenis} />}
          </form>
        </search>
        <KindFilter q={q} jenis={jenis} />
      </div>

      <section aria-label="Hasil" className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">{rows.length} hasil</p>
        {rows.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon"><PackageSearch /></EmptyMedia>
              <EmptyTitle>Tidak ada barang{term ? ` "${q}"` : ""}</EmptyTitle>
              <EmptyDescription>Barang baru otomatis terdaftar saat pertama kali dilaporkan.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <div className="flex flex-col gap-2 md:grid md:grid-cols-2 md:gap-3 lg:hidden">
              {rows.map((r) => { const s = summary(r); return <ItemRow key={r.id} href={`/barang/${r.id}`} name={r.name} photo={photo(r)} place={s.place} meta={s.meta} status={s.status} tone={s.tone} />; })}
            </div>
            <div className="hidden lg:block">
              <Table>
                <TableHeader>
                  <TableRow><TableHead className="w-14"><span className="sr-only">Foto</span></TableHead><TableHead>Barang</TableHead><TableHead className="w-56">Posisi</TableHead><TableHead className="w-40">Oleh</TableHead><TableHead className="w-36">Waktu</TableHead><TableHead className="w-28">Status</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const s = summary(r);
                    return (
                      <TableRow key={r.id} className="relative">
                        <TableCell><Thumb src={photo(r)} size={40} /></TableCell>
                        <TableCell><Link href={`/barang/${r.id}`} className="font-semibold after:absolute after:inset-0">{r.name}</Link></TableCell>
                        <TableCell>{s.place ? <span className="flex items-center gap-2"><span className="rack text-xs">{s.place}</span>{r.location_name}</span> : s.where}</TableCell>
                        <TableCell>{s.who}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{s.when}</TableCell>
                        <TableCell><Badge variant={s.tone}>{s.status}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </section>
    </>
  );
}

// Ringkasan satu barang untuk daftar (mobile/tablet) dan tabel (desktop)
function summary(r: ItemOverview): { place?: string | null; meta: string; where: string; who: string; when: string; status: string; tone: Tone } {
  if (r.kind === "HABIS_PAKAI") {
    const qty = r.qty_total ?? 0;
    return { meta: `Habis pakai, di ${r.location_count ?? 0} lokasi`, where: `Habis pakai, di ${r.location_count ?? 0} lokasi`, who: "-", when: "-", status: `${qty} ${r.unit ?? ""}`, tone: qty > 0 ? "ok" : "warn" };
  }
  if (!r.last_kind) return { meta: "Belum ada laporan", where: "Belum ada laporan", who: "-", when: "-", status: "-", tone: "muted" };
  if (r.last_kind === "AMBIL") {
    const late = Date.now() - new Date(r.reported_at!).getTime() > HELD_LIMIT_HOURS * 3_600_000;
    const dur = fmtDuration(r.reported_at!);
    return { meta: `Dipegang ${r.user_name} selama ${dur}`, where: "Dipegang", who: r.user_name ?? "-", when: dur, status: "Dipegang", tone: late ? "warn" : "muted" };
  }
  const ago = fmtAgo(r.reported_at!);
  return { place: r.location_code, meta: `${r.user_name}, ${ago}`, where: `${r.location_code} (${r.location_name})`, who: r.user_name ?? "-", when: ago, status: "Di rak", tone: "ok" };
}
