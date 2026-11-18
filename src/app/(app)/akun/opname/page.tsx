import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requirePlss } from "@/lib/session";
import type { Location, StockLevel } from "@/lib/types";
import { AdminHead, Flash } from "../Flash";
import { opname } from "../actions";

export const metadata: Metadata = { title: "Opname stok" };

export default async function OpnamePage({ searchParams }: { searchParams: Promise<{ pesan?: string; galat?: string }> }) {
  const sp = await searchParams;
  await requirePlss();
  const supabase = await createClient();
  const [items, locs, levels] = await Promise.all([
    supabase.from("items").select("name").eq("kind", "HABIS_PAKAI").is("archived_at", null).order("name"),
    supabase.from("locations").select("id, code, name, archived_at").is("archived_at", null).order("code"),
    supabase.from("stock_levels").select("*").order("name"),
  ]);

  return (
    <>
      <AdminHead title="Opname stok" />
      <p className="text-sm text-ink-2">Isi hasil hitung fisik. Selisihnya dicatat sebagai mutasi OPNAME, riwayat lama tidak diubah.</p>
      <Flash {...sp} />
      <form action={opname} className="card flex flex-col gap-3 p-3.5">
        <div>
          <label htmlFor="item" className="field-label">Barang</label>
          <select id="item" name="item" className="input" required defaultValue="">
            <option value="" disabled>Pilih barang habis pakai</option>
            {(items.data ?? []).map((i: { name: string }) => <option key={i.name} value={i.name}>{i.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="location" className="field-label">Lokasi</label>
          <select id="location" name="location" className="input" required defaultValue="">
            <option value="" disabled>Pilih lokasi</option>
            {((locs.data ?? []) as Location[]).map((l) => <option key={l.id} value={l.id}>{l.code} · {l.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="qty" className="field-label">Jumlah hasil hitung</label>
          <input id="qty" name="qty" className="input mono" inputMode="numeric" pattern="[0-9]+" required />
        </div>
        <div>
          <label htmlFor="note" className="field-label">Catatan (opsional)</label>
          <input id="note" name="note" className="input" maxLength={280} />
        </div>
        <button className="btn btn-primary">Simpan opname</button>
      </form>
      <section>
        <h2 className="eyebrow mb-2 text-ink-2">Stok tercatat</h2>
        <ul className="card divide-y divide-line">
          {((levels.data ?? []) as StockLevel[]).map((l) => (
            <li key={`${l.item_id}-${l.location_id}`} className="flex justify-between px-3.5 py-3 text-sm">
              <span>{l.name} <span className="mono text-ink-2">· {l.location_code}</span></span>
              <span className="mono">{l.qty} {l.unit}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
