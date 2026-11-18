import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requirePlss } from "@/lib/session";
import { AdminHead, Flash } from "../Flash";
import { archiveItem, mergeItems, renameItem } from "../actions";

export const metadata: Metadata = { title: "Daftar barang" };

type Row = { id: number; name: string; kind: "ALAT" | "HABIS_PAKAI"; unit: string | null };

export default async function BarangAdminPage({ searchParams }: { searchParams: Promise<{ pesan?: string; galat?: string }> }) {
  const sp = await searchParams;
  await requirePlss();
  const supabase = await createClient();
  const { data } = await supabase.from("items").select("id, name, kind, unit").is("archived_at", null).order("name");
  const rows = (data ?? []) as Row[];
  const opt = (r: Row) => <option key={r.id} value={r.id}>{r.name} ({r.kind === "ALAT" ? "alat" : "habis pakai"})</option>;

  return (
    <>
      <AdminHead title="Daftar barang" />
      <Flash {...sp} />

      <form action={mergeItems} className="card flex flex-col gap-3 p-3.5">
        <h2 className="font-semibold">Gabungkan barang duplikat</h2>
        <p className="text-sm text-ink-2">Semua riwayat barang pertama dipindah ke barang kedua, lalu barang pertama diarsip. Jenisnya harus sama.</p>
        <div>
          <label htmlFor="from" className="field-label">Duplikat</label>
          <select id="from" name="from" className="input" required defaultValue="">
            <option value="" disabled>Pilih barang</option>{rows.map(opt)}
          </select>
        </div>
        <div>
          <label htmlFor="into" className="field-label">Gabung ke</label>
          <select id="into" name="into" className="input" required defaultValue="">
            <option value="" disabled>Pilih barang</option>{rows.map(opt)}
          </select>
        </div>
        <button className="btn btn-primary">Gabungkan</button>
      </form>

      <ul className="card divide-y divide-line">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 px-3.5 py-3">
            <form action={renameItem} className="flex items-end gap-2">
              <input type="hidden" name="id" value={r.id} />
              <div className="flex-1">
                <label htmlFor={`n-${r.id}`} className="field-label">{r.kind === "ALAT" ? "Alat" : `Habis pakai · ${r.unit}`} #{r.id}</label>
                <input id={`n-${r.id}`} name="name" defaultValue={r.name} className="input" required minLength={2} maxLength={80} />
              </div>
              <button className="btn btn-line btn-sm">Simpan</button>
            </form>
            <form action={archiveItem}>
              <input type="hidden" name="id" value={r.id} />
              <button className="text-sm font-semibold text-danger">Arsipkan</button>
            </form>
          </li>
        ))}
        {rows.length === 0 && <li className="px-4 py-6 text-center text-sm text-ink-2">Belum ada barang.</li>}
      </ul>
    </>
  );
}
