import { LinkPending } from "@/components/Pending";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Hand, MapPin, PackageOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signPhotos } from "@/lib/photos";
import { fmtAgo, fmtShort, rackExtra } from "@/lib/format";
import { Thumb } from "@/components/ItemRow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ItemOverview, StockLevel } from "@/lib/types";

type Report = { id: number; kind: "TARUH" | "AMBIL"; created_at: string; photo_path: string | null; note: string | null;
  profiles: { full_name: string } | null; locations: { code: string; name: string } | null; voids: { id: number } | null };
type Move = { id: number; kind: "MASUK" | "PAKAI" | "OPNAME"; qty_delta: number; created_at: string; note: string | null;
  profiles: { full_name: string } | null; locations: { code: string } | null; voids: { id: number } | null };
type Entry = {
  id: number; when: string; action: string; where: string; who: string; note: string | null;
  tone: "ok" | "warn" | "muted"; photo?: string | null;
};

export default async function BarangPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id)) notFound();
  const supabase = await createClient();

  const { data: item } = await supabase.from("item_overview").select("*").eq("id", id).maybeSingle<ItemOverview>();
  if (!item) notFound();
  const enc = encodeURIComponent(item.name);

  if (item.kind === "HABIS_PAKAI") {
    const [levels, moves] = await Promise.all([
      supabase.from("stock_levels").select("*").eq("item_id", id).order("location_code"),
      supabase.from("stock_moves").select("id, kind, qty_delta, created_at, note, profiles(full_name), locations(code), voids(id)")
        .eq("item_id", id).order("created_at", { ascending: false }).limit(30),
    ]);
    const lv = (levels.data ?? []) as StockLevel[];
    return (
      <>
        <BackLink />
        <Head label={`Habis pakai, dalam ${item.unit ?? "pcs"}`} name={item.name} />
        {lv.length > 0 ? (
          <Card className="gap-0 p-0">
            {lv.map((l) => (
              <div key={l.location_id} className="flex items-center justify-between border-b px-4 py-3.5 last:border-b-0">
                <span className="flex items-center gap-2"><span className="rack text-sm">{l.location_code}</span> <span className="text-sm text-muted-foreground">{rackExtra(l.location_code, l.location_name)}</span></span>
                <span className="font-mono text-xl font-medium">{l.qty}</span>
              </div>
            ))}
          </Card>
        ) : <EmptyHistory text="Belum ada stok tercatat." />}
        <Button asChild className="md:w-fit md:min-w-56"><Link href={`/lapor?item=${enc}&aksi=PAKAI`}><LinkPending />Pakai</Link></Button>
        <History title="Riwayat stok" entries={((moves.data ?? []) as unknown as Move[]).map((m) => ({
          id: m.id,
          when: fmtShort(m.created_at),
          action: `${m.voids ? "Batal: " : ""}${m.kind === "MASUK" ? "Masuk" : m.kind === "PAKAI" ? "Dipakai" : "Hitung ulang"} ${m.qty_delta > 0 ? "+" : ""}${m.qty_delta}`,
          where: m.locations?.code ?? "-",
          who: m.profiles?.full_name ?? "-",
          note: m.note,
          tone: m.voids ? "muted" : m.kind === "PAKAI" ? "warn" : "ok",
        }))} />
      </>
    );
  }

  const { data: reports } = await supabase.from("reports")
    .select("id, kind, created_at, photo_path, note, profiles(full_name), locations(code, name), voids(id)")
    .eq("item_id", id).order("created_at", { ascending: false }).limit(30);
  const rows = (reports ?? []) as unknown as Report[];
  const photos = await signPhotos(supabase, rows.map((r) => r.photo_path));
  // Laporan yang dibatalkan tetap tampil di riwayat, tapi tidak menentukan posisi
  const last = rows.find((r) => !r.voids);
  const lastPhoto = rows.find((r) => r.photo_path);
  const placed = last?.kind === "TARUH";

  return (
    <>
      <BackLink />
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[480px_minmax(0,1fr)] lg:items-start lg:gap-8">
        <div className="relative grid aspect-video place-items-center overflow-hidden rounded-[14px] bg-muted text-muted-foreground lg:aspect-[4/3]">
          {lastPhoto?.photo_path && photos.get(lastPhoto.photo_path) ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed URL
            <img src={photos.get(lastPhoto.photo_path)} alt={`Foto terakhir ${item.name}`} className="absolute inset-0 size-full object-cover" />
          ) : <span className="text-sm">Belum ada foto</span>}
        </div>
        <div className="flex flex-col gap-5">
          <Head label={`Alat nomor ${item.id}`} name={item.name} />

          {last ? (
            <Card className={cn("border-l-4", placed ? "border-l-primary" : "border-l-warn")}>
              <CardHeader className="gap-1.5">
                <p className="text-sm text-muted-foreground">{placed ? "Sekarang ada di" : "Sedang dibawa"}</p>
                <CardTitle className="flex flex-wrap items-center gap-2.5 text-xl">
                  {placed ? <><MapPin aria-hidden className="size-5 text-primary" /><span className="rack text-xl">{last.locations?.code}</span> <span className="font-semibold">{rackExtra(last.locations?.code, last.locations?.name)}</span></>
                    : <><Hand aria-hidden className="size-5 text-warn" /> {last.profiles?.full_name}</>}
                </CardTitle>
                <CardDescription className="text-sm">
                  {placed ? "Ditaruh" : "Diambil"} oleh {last.profiles?.full_name}, {fmtAgo(last.created_at)}.
                  {last.note ? ` Catatan: ${last.note}` : ""}
                </CardDescription>
              </CardHeader>
            </Card>
          ) : <EmptyHistory text="Belum ada laporan posisi." />}

          <div className="grid grid-cols-2 gap-3">
            {last?.kind === "AMBIL"
              ? <Button asChild><Link href={`/lapor?item=${enc}&aksi=TARUH`}><LinkPending />Taruh</Link></Button>
              : <Button asChild><Link href={`/lapor?item=${enc}&aksi=AMBIL`}><LinkPending />Ambil barang</Link></Button>}
            <Button asChild variant="outline"><Link href={`/lapor?item=${enc}&aksi=TARUH`}><LinkPending />Pindah</Link></Button>
          </div>
        </div>
      </div>

      <History title="Riwayat" entries={rows.map((r) => ({
        id: r.id,
        when: fmtShort(r.created_at),
        action: r.voids ? `Batal: ${r.kind === "TARUH" ? "taruh" : "ambil"}` : r.kind === "TARUH" ? "Ditaruh" : "Diambil",
        where: r.locations?.code ?? "-",
        who: r.profiles?.full_name ?? "-",
        note: r.note,
        tone: r.voids ? "muted" : r.kind === "TARUH" ? "ok" : "warn",
        photo: r.photo_path ? photos.get(r.photo_path) : null,
      }))} />
    </>
  );
}

function BackLink() {
  return (
    <Button asChild variant="ghost" className="-ml-3 w-fit px-3 text-[17px]">
      <Link href="/cari"><ChevronLeft data-icon="inline-start" />Cari</Link>
    </Button>
  );
}

function Head({ label, name }: { label: string; name: string }) {
  return (
    <header className="flex flex-col gap-1.5">
      <p className="eyebrow text-muted-foreground">{label}</p>
      <h1 className="title">{name}</h1>
    </header>
  );
}

function EmptyHistory({ text }: { text: string }) {
  return (
    <Empty className="border p-6 md:p-6">
      <EmptyHeader>
        <EmptyMedia variant="icon"><PackageOpen /></EmptyMedia>
        <EmptyTitle>Belum ada data</EmptyTitle>
        <EmptyDescription>{text}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function History({ title, entries }: { title: string; entries: Entry[] }) {
  if (!entries.length) return null;
  const withPhoto = entries.some((e) => e.photo !== undefined);
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h2 className="text-lg font-bold">{title}</h2>
      {/* Mobile: daftar · Tablet/desktop: tabel */}
      <ol className="md:hidden">
        {entries.map((e) => (
          <li key={e.id} className="flex items-center gap-3 py-2.5">
            <Badge variant={e.tone} className="w-20 shrink-0">{e.action}</Badge>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{e.where}</p>
              <p className="text-sm text-muted-foreground">{e.who}, <span className="font-mono text-xs">{e.when}</span>{e.note ? `. ${e.note}` : ""}</p>
            </div>
            {e.photo !== undefined && <Thumb src={e.photo} size={40} />}
          </li>
        ))}
      </ol>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow><TableHead className="w-40">Waktu</TableHead><TableHead className="w-32">Aksi</TableHead><TableHead>Lokasi</TableHead><TableHead className="w-44">Oleh</TableHead>{withPhoto && <TableHead className="hidden w-16 lg:table-cell">Foto</TableHead>}</TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-mono text-xs">{e.when}</TableCell>
                <TableCell><Badge variant={e.tone}>{e.action}</Badge></TableCell>
                <TableCell>{e.where}{e.note ? <span className="text-muted-foreground"> ({e.note})</span> : null}</TableCell>
                <TableCell>{e.who}</TableCell>
                {withPhoto && <TableCell className="hidden lg:table-cell"><Thumb src={e.photo} size={40} /></TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
