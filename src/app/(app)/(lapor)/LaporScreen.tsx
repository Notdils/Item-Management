import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/session";
import { signPhotos } from "@/lib/photos";
import { fmtAgo } from "@/lib/format";
import { ItemRow } from "@/components/ItemRow";
import type { ItemOption, Location, StockLevel } from "@/lib/types";
import { Reporter, type Prefill } from "./Reporter";

type Supa = Awaited<ReturnType<typeof createClient>>;

type Recent = { id: number; kind: "TARUH" | "AMBIL"; created_at: string; photo_path: string | null;
  items: { id: number; name: string } | null; locations: { code: string } | null; voids: { id: number } | null };

const ACTIONS = ["TARUH", "AMBIL", "PAKAI"] as const;

// Layar lapor (dipakai di "/" untuk teknikal dan "/lapor" untuk semua)
export async function LaporScreen({ sp }: { sp: { item?: string; aksi?: string } }) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [items, locations, stock, recent] = await Promise.all([
    supabase.from("items").select("id, name, name_key, kind, unit").is("archived_at", null).order("name"),
    supabase.from("locations").select("id, code, name, archived_at").is("archived_at", null).order("code"),
    supabase.from("stock_levels").select("item_id, name, unit, location_id, location_code, location_name, qty, last_move_at"),
    supabase.from("reports")
      .select("id, kind, created_at, photo_path, items(id, name), locations(code), voids(id)")
      .eq("user_id", profile.id).order("created_at", { ascending: false }).limit(5),
  ]);
  const recentRows = (recent.data ?? []) as unknown as Recent[];
  const photos = await signPhotos(supabase, recentRows.map((r) => r.photo_path));

  const prefill = sp.item
    ? await buildPrefill(supabase, sp.item.slice(0, 80), ACTIONS.find((a) => a === sp.aksi) ?? "TARUH",
        (items.data ?? []) as ItemOption[], (stock.data ?? []) as StockLevel[])
    : undefined;

  const header = (
    <header className="flex flex-col gap-3">
      <h1 className="title">Lapor barang</h1>
      <p className="max-w-[52ch] text-base text-muted-foreground">Taruh atau ambil barang: foto, isi nama, kirim. PLSS langsung tahu posisinya.</p>
    </header>
  );
  const aside = recentRows.length > 0 ? (
    <section aria-labelledby="recent" className="flex flex-col gap-3">
      <h2 id="recent" className="text-lg font-bold">Laporan terakhir kamu</h2>
      <div className="flex flex-col gap-2 md:grid md:grid-cols-2 md:gap-3 lg:flex lg:flex-col lg:gap-2">
        {recentRows.map((r) => (
          <ItemRow key={r.id} href={r.items ? `/barang/${r.items.id}` : undefined}
            name={r.items?.name ?? "-"}
            place={r.kind === "TARUH" ? r.locations?.code : null}
            meta={r.kind === "TARUH" ? fmtAgo(r.created_at) : `Kamu bawa, ${fmtAgo(r.created_at)}`}
            status={r.voids ? "Dibatalkan" : r.kind === "TARUH" ? "Ditaruh" : "Diambil"} tone={r.voids ? "muted" : r.kind === "TARUH" ? "ok" : "warn"}
            photo={r.photo_path ? photos.get(r.photo_path) : null} />
        ))}
      </div>
    </section>
  ) : null;

  return (
    <Reporter
      key={prefill ? `${prefill.item}-${prefill.action}` : "blank"}
      uid={profile.id}
      isPlss={profile.division === "PLSS"}
      items={(items.data ?? []) as ItemOption[]}
      locations={(locations.data ?? []) as Location[]}
      stock={(stock.data ?? []) as StockLevel[]}
      prefill={prefill}
      header={header}
      aside={aside}
    />
  );
}

// Dari tombol Taruh/Ambil/Pakai: form langsung terbuka dengan barang, aksi, dan rak yang sesuai barang itu
async function buildPrefill(supabase: Supa, name: string, action: Prefill["action"], items: ItemOption[], stock: StockLevel[]): Promise<Prefill> {
  const item = items.find((i) => i.name_key === name.trim().replace(/\s+/g, " ").toLowerCase());
  if (!item) return { item: name, action };
  if (item.kind === "HABIS_PAKAI") {
    // Pakai dari rak yang stoknya paling banyak
    const best = stock.filter((s) => s.item_id === item.id && s.qty > 0).sort((a, b) => b.qty - a.qty)[0];
    return { item: item.name, action: "PAKAI", locationId: best?.location_id,
      context: best ? `Sisa ${best.qty} ${best.unit ?? ""} di ${best.location_code}` : "Stok kosong" };
  }
  const { data: pos } = await supabase.from("item_positions")
    .select("kind, location_id, location_code, user_name, reported_at").eq("item_id", item.id).maybeSingle();
  if (action === "TARUH") {
    // Rak asal = rak terakhir barang ini ditaruh
    const { data: last } = await supabase.from("reports").select("location_id").eq("item_id", item.id)
      .eq("kind", "TARUH").order("created_at", { ascending: false }).limit(1).maybeSingle();
    const context = pos?.kind === "AMBIL" ? `Dibawa ${pos.user_name} sejak ${fmtAgo(pos.reported_at)}`
      : pos ? `Sekarang di ${pos.location_code}` : undefined;
    return { item: item.name, action, locationId: last?.location_id ?? undefined, context };
  }
  return { item: item.name, action, context: pos?.kind === "TARUH" ? `Sekarang di ${pos.location_code}` : undefined };
}
