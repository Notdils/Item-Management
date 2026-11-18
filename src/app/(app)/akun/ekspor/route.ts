import { createClient } from "@/lib/supabase/server";

type R = { created_at: string; taken_at: string; kind: string; lat: number | null; lng: number | null; note: string | null;
  items: { name: string } | null; locations: { code: string } | null; profiles: { full_name: string } | null };
type M = { created_at: string; taken_at: string; kind: string; qty_delta: number; note: string | null;
  items: { name: string; unit: string | null } | null; locations: { code: string } | null; profiles: { full_name: string } | null };

// Sel CSV aman: dikutip, dan diawali ' kalau bisa dibaca Excel sebagai rumus (=, +, -, @).
function cell(v: unknown) {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET() {
  const supabase = await createClient();
  const { data: plss } = await supabase.rpc("is_plss");
  if (!plss) return new Response("Khusus PLSS", { status: 403 });

  const [reports, moves] = await Promise.all([
    supabase.from("reports").select("created_at, taken_at, kind, lat, lng, note, items(name), locations(code), profiles(full_name)").order("created_at"),
    supabase.from("stock_moves").select("created_at, taken_at, kind, qty_delta, note, items(name, unit), locations(code), profiles(full_name)").order("created_at"),
  ]);
  if (reports.error || moves.error) return new Response("Gagal membaca data", { status: 500 });

  const head = ["waktu_server", "waktu_foto", "barang", "aksi", "jumlah", "satuan", "lokasi", "pelapor", "lat", "lng", "catatan"];
  const rows = [
    ...(reports.data as unknown as R[]).map((r) => [r.created_at, r.taken_at, r.items?.name, r.kind, "", "", r.locations?.code, r.profiles?.full_name, r.lat, r.lng, r.note]),
    ...(moves.data as unknown as M[]).map((m) => [m.created_at, m.taken_at, m.items?.name, m.kind, m.qty_delta, m.items?.unit, m.locations?.code, m.profiles?.full_name, "", "", m.note]),
  ].sort((a, b) => String(a[0]).localeCompare(String(b[0])));

  const csv = "﻿" + [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="riwayat-bengkel-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
