import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { StockLevel } from "@/lib/types";

export const metadata: Metadata = { title: "Stok habis pakai" };

export default async function StokPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("stock_levels").select("*").order("name").order("location_code");
  const levels = (data ?? []) as StockLevel[];
  const kinds = new Set(levels.map((l) => l.item_id)).size;

  return (
    <>
      <h1 className="title">Stok habis pakai</h1>
      <div className="card flex flex-col gap-1 p-3.5">
        <p className="eyebrow text-ink-2">Jenis</p>
        <p className="mono text-[28px] font-medium">{kinds}</p>
      </div>
      <ul className="card divide-y divide-line">
        {levels.map((l) => (
          <li key={`${l.item_id}-${l.location_id}`}>
            <Link href={`/barang/${l.item_id}`} className="flex items-center gap-3 px-3.5 py-3.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{l.name}</span>
                <span className="mono text-xs text-ink-2">{l.location_code} · {l.location_name}</span>
              </span>
              <span className="text-right">
                <span className={`mono block text-[22px] font-medium ${l.qty === 0 ? "text-warn" : ""}`}>{l.qty}</span>
                <span className="mono text-xs text-ink-2">{l.unit}</span>
              </span>
            </Link>
          </li>
        ))}
        {levels.length === 0 && <li className="px-4 py-6 text-center text-sm text-ink-2">Belum ada stok. PLSS menambah stok lewat tombol foto, pilih Tambah.</li>}
      </ul>
    </>
  );
}
