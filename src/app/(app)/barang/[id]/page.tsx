import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signPhotos } from "@/lib/photos";
import { fmtAgo, fmtShort } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { Thumb } from "@/components/ItemRow";
import type { ItemOverview, StockLevel } from "@/lib/types";

type Report = { id: number; kind: "TARUH" | "AMBIL"; created_at: string; photo_path: string | null; note: string | null;
  profiles: { full_name: string } | null; locations: { code: string; name: string } | null };
type Move = { id: number; kind: "MASUK" | "PAKAI" | "OPNAME"; qty_delta: number; created_at: string; note: string | null;
  profiles: { full_name: string } | null; locations: { code: string } | null };

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
      supabase.from("stock_moves").select("id, kind, qty_delta, created_at, note, profiles(full_name), locations(code)")
        .eq("item_id", id).order("created_at", { ascending: false }).limit(30),
    ]);
    return (
      <>
        <BackLink />
        <Head label={`Habis pakai · ${item.unit ?? "pcs"}`} name={item.name} />
        <section className="card flex flex-col divide-y divide-line">
          {((levels.data ?? []) as StockLevel[]).map((l) => (
            <div key={l.location_id} className="flex items-center justify-between px-4 py-3.5">
              <span><span className="font-semibold">{l.location_code}</span> <span className="text-sm text-ink-2">{l.location_name}</span></span>
              <span className="mono text-xl font-medium">{l.qty}</span>
            </div>
          ))}
          {!levels.data?.length && <p className="px-4 py-3.5 text-sm text-ink-2">Belum ada stok tercatat.</p>}
        </section>
        <Link href={`/?item=${enc}&aksi=PAKAI`} className="btn btn-primary">Pakai</Link>
        <History title="Riwayat stok" entries={((moves.data ?? []) as unknown as Move[]).map((m) => ({
          id: m.id,
          title: `${m.kind === "MASUK" ? "Masuk" : m.kind === "PAKAI" ? "Dipakai" : "Opname"} ${m.qty_delta > 0 ? "+" : ""}${m.qty_delta} di ${m.locations?.code}`,
          meta: `${m.profiles?.full_name} · ${fmtShort(m.created_at)}${m.note ? ` · ${m.note}` : ""}`,
          tone: m.kind === "PAKAI" ? "warn" : "green",
        }))} />
      </>
    );
  }

  const { data: reports } = await supabase.from("reports")
    .select("id, kind, created_at, photo_path, note, profiles(full_name), locations(code, name)")
    .eq("item_id", id).order("created_at", { ascending: false }).limit(30);
  const rows = (reports ?? []) as unknown as Report[];
  const photos = await signPhotos(supabase, rows.map((r) => r.photo_path));
  const last = rows[0];
  const lastPhoto = rows.find((r) => r.photo_path);

  return (
    <>
      <BackLink />
      <div className="grid aspect-[16/10] place-items-center overflow-hidden rounded-[14px] bg-surface-2 text-ink-2">
        {lastPhoto?.photo_path && photos.get(lastPhoto.photo_path) ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed URL
          <img src={photos.get(lastPhoto.photo_path)} alt={`Foto terakhir ${item.name}`} className="size-full object-cover" />
        ) : <span className="mono text-xs">belum ada foto</span>}
      </div>
      <Head label={`Alat · #${item.id}`} name={item.name} />

      {last ? (
        <section className={`card flex flex-col gap-1.5 border p-4 ${last.kind === "TARUH" ? "border-green" : "border-warn"}`}>
          <p className="flex items-center gap-2 text-lg font-bold">
            <Icon name={last.kind === "TARUH" ? "pin" : "hand"} size={20} className={last.kind === "TARUH" ? "text-green" : "text-warn"} />
            {last.kind === "TARUH" ? `${last.locations?.code} · ${last.locations?.name}` : `Dipegang ${last.profiles?.full_name}`}
          </p>
          <p className="mono text-xs text-ink-2">
            {last.kind === "TARUH" ? "Ditaruh" : "Diambil"} oleh {last.profiles?.full_name} · {fmtAgo(last.created_at)}
            {last.note ? ` · ${last.note}` : ""}
          </p>
        </section>
      ) : <p className="card p-4 text-sm text-ink-2">Belum ada laporan posisi.</p>}

      <div className="grid grid-cols-2 gap-2">
        {last?.kind === "AMBIL"
          ? <Link href={`/?item=${enc}&aksi=TARUH`} className="btn btn-primary">Taruh</Link>
          : <Link href={`/?item=${enc}&aksi=AMBIL`} className="btn btn-primary">Ambil barang</Link>}
        <Link href={`/?item=${enc}&aksi=TARUH`} className="btn btn-line">Pindah</Link>
      </div>

      <History title="Riwayat" entries={rows.map((r) => ({
        id: r.id,
        title: r.kind === "TARUH" ? `Ditaruh di ${r.locations?.code}` : "Diambil",
        meta: `${r.profiles?.full_name} · ${fmtShort(r.created_at)}${r.note ? ` · ${r.note}` : ""}`,
        tone: r.kind === "TARUH" ? "green" : "warn",
        photo: r.photo_path ? photos.get(r.photo_path) : null,
      }))} />
    </>
  );
}

function BackLink() {
  return (
    <Link href="/cari" className="-ml-2 flex w-fit items-center gap-2 pr-2 text-[17px] font-semibold">
      <Icon name="back" /> Cari
    </Link>
  );
}

function Head({ label, name }: { label: string; name: string }) {
  return (
    <header className="flex flex-col gap-1.5">
      <p className="eyebrow text-green">{label}</p>
      <h1 className="title text-[1.75rem]">{name}</h1>
    </header>
  );
}

function History({ title, entries }: {
  title: string; entries: { id: number; title: string; meta: string; tone: "green" | "warn"; photo?: string | null }[];
}) {
  if (!entries.length) return null;
  return (
    <section aria-label={title}>
      <h2 className="eyebrow mb-1 text-ink-2">{title}</h2>
      <ol>
        {entries.map((e) => (
          <li key={e.id} className="flex items-center gap-3 py-2.5">
            <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${e.tone === "green" ? "bg-green" : "bg-warn"}`} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{e.title}</p>
              <p className="mono text-xs text-ink-2">{e.meta}</p>
            </div>
            {e.photo !== undefined && <Thumb src={e.photo} size={40} />}
          </li>
        ))}
      </ol>
    </section>
  );
}
