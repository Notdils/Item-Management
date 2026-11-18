import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/session";
import { signPhotos } from "@/lib/photos";
import { fmtAgo } from "@/lib/format";
import { ItemRow } from "@/components/ItemRow";
import type { ItemOption, Location, StockLevel } from "@/lib/types";
import { Reporter, type Prefill } from "./Reporter";

type Recent = { id: number; kind: "TARUH" | "AMBIL"; created_at: string; photo_path: string | null;
  items: { id: number; name: string } | null; locations: { code: string } | null };

const ACTIONS = ["TARUH", "AMBIL", "PAKAI"] as const;

export default async function LaporPage({ searchParams }: { searchParams: Promise<{ item?: string; aksi?: string }> }) {
  const sp = await searchParams;
  const profile = await requireProfile();
  const supabase = await createClient();

  const [items, locations, stock, recent] = await Promise.all([
    supabase.from("items").select("id, name, name_key, kind, unit").is("archived_at", null).order("name"),
    supabase.from("locations").select("id, code, name, archived_at").is("archived_at", null).order("code"),
    supabase.from("stock_levels").select("item_id, name, unit, location_id, location_code, location_name, qty, last_move_at"),
    supabase.from("reports")
      .select("id, kind, created_at, photo_path, items(id, name), locations(code)")
      .eq("user_id", profile.id).order("created_at", { ascending: false }).limit(5),
  ]);
  const recentRows = (recent.data ?? []) as unknown as Recent[];
  const photos = await signPhotos(supabase, recentRows.map((r) => r.photo_path));

  const prefill: Prefill | undefined = sp.item
    ? { item: sp.item.slice(0, 80), action: ACTIONS.find((a) => a === sp.aksi) ?? "TARUH" }
    : undefined;

  return (
    <>
      <header className="flex flex-col gap-2">
        <p className="eyebrow text-green">Halo, {profile.full_name} · {profile.division}</p>
        <h1 className="title">Taruh atau ambil barang</h1>
      </header>

      <Reporter
        key={prefill ? `${prefill.item}-${prefill.action}` : "blank"}
        uid={profile.id}
        isPlss={profile.division === "PLSS"}
        items={(items.data ?? []) as ItemOption[]}
        locations={(locations.data ?? []) as Location[]}
        stock={(stock.data ?? []) as StockLevel[]}
        prefill={prefill}
      />

      {recentRows.length > 0 && (
        <section aria-labelledby="recent" className="flex flex-col gap-2">
          <h2 id="recent" className="eyebrow text-ink-2">Laporan terakhir kamu</h2>
          {recentRows.map((r) => (
            <ItemRow key={r.id} href={r.items ? `/barang/${r.items.id}` : undefined}
              name={r.items?.name ?? "-"}
              meta={`${r.kind === "TARUH" ? r.locations?.code ?? "-" : "Kamu bawa"} · ${fmtAgo(r.created_at)}`}
              status={r.kind === "TARUH" ? "Ditaruh" : "Diambil"} tone={r.kind === "TARUH" ? "green" : "warn"}
              photo={r.photo_path ? photos.get(r.photo_path) : null} />
          ))}
        </section>
      )}
    </>
  );
}
