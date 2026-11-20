"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlss } from "@/lib/session";

// Semua aksi PLSS divalidasi ulang di database (RLS + RPC require_plss).
// Pengecekan di sini hanya supaya pesan error lebih cepat.

function back(path: string, msg: { ok?: string; err?: string }): never {
  const p = new URLSearchParams(msg.ok ? { pesan: msg.ok } : { galat: msg.err ?? "Gagal" });
  revalidatePath(path);
  redirect(`${path}?${p}`);
}
const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function addLocation(f: FormData) {
  await requirePlss();
  const supabase = await createClient();
  const code = s(f, "code").toUpperCase().replace(/\s+/g, "-");
  const { error } = await supabase.from("locations").insert({ code, name: s(f, "name") });
  if (error) back("/akun/lokasi", { err: error.code === "23505" ? `Kode ${code} sudah dipakai` : "Kode hanya huruf besar, angka, dan tanda hubung (mis. RAK-A1). Nama 2-80 huruf." });
  back("/akun/lokasi", { ok: `Lokasi ${code} ditambahkan` });
}

export async function toggleLocation(f: FormData) {
  await requirePlss();
  const supabase = await createClient();
  const archive = s(f, "archive") === "1";
  const { error } = await supabase.from("locations")
    .update({ archived_at: archive ? new Date().toISOString() : null }).eq("id", Number(s(f, "id")));
  if (error) back("/akun/lokasi", { err: error.message });
  back("/akun/lokasi", { ok: archive ? "Lokasi diarsip" : "Lokasi diaktifkan" });
}

export async function renameItem(f: FormData) {
  await requirePlss();
  const supabase = await createClient();
  const { error } = await supabase.rpc("rename_item", { p_item: Number(s(f, "id")), p_name: s(f, "name") });
  if (error) back("/akun/barang", { err: error.code === "23505" ? "Nama itu sudah dipakai barang lain. Gabungkan saja." : error.message });
  back("/akun/barang", { ok: "Nama diganti" });
}

export async function archiveItem(f: FormData) {
  await requirePlss();
  const supabase = await createClient();
  const { error } = await supabase.rpc("archive_item", { p_item: Number(s(f, "id")) });
  if (error) back("/akun/barang", { err: error.message });
  back("/akun/barang", { ok: "Barang diarsip. Riwayatnya tetap tersimpan." });
}

export async function mergeItems(f: FormData) {
  await requirePlss();
  const supabase = await createClient();
  const { error } = await supabase.rpc("merge_items", { p_from: Number(s(f, "from")), p_into: Number(s(f, "into")) });
  if (error) back("/akun/barang", { err: error.message });
  back("/akun/barang", { ok: "Barang digabung. Semua riwayat dipindah." });
}

export async function opname(f: FormData) {
  await requirePlss();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("move_stock", {
    p_item_name: s(f, "item"), p_kind: "OPNAME", p_location_id: Number(s(f, "location")),
    p_qty: Number(s(f, "qty")), p_note: s(f, "note") || null,
  });
  if (error) back("/akun/opname", { err: error.message });
  const after = (data as { qty_after: number }[] | null)?.[0]?.qty_after;
  back("/akun/opname", { ok: `Opname tersimpan. Stok sekarang ${after}.` });
}

export async function setDivision(f: FormData) {
  await requirePlss();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_division", { p_user: s(f, "id"), p_division: s(f, "division") });
  if (error) back("/akun/anggota", { err: error.message });
  back("/akun/anggota", { ok: "Divisi diubah" });
}

export async function addMember(f: FormData) {
  await requirePlss();
  const division = s(f, "division") === "PLSS" ? "PLSS" : "TEKNIKAL";
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    back("/akun/anggota", { err: "SUPABASE_SECRET_KEY belum diisi di server" });
  }
  const { error } = await admin.auth.admin.createUser({
    email: s(f, "email"),
    password: s(f, "password"),
    email_confirm: true,
    user_metadata: { full_name: s(f, "name") },
    app_metadata: { division }, // dibaca trigger tg_new_user
  });
  if (error) back("/akun/anggota", { err: error.message.includes("already") ? "Email sudah terdaftar" : error.message });
  back("/akun/anggota", { ok: `Akun ${s(f, "email")} dibuat` });
}

export async function updateName(f: FormData) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const { error } = await supabase.from("profiles").update({ full_name: s(f, "name") }).eq("id", data?.claims?.sub ?? "");
  if (error) back("/akun", { err: "Nama 2-80 huruf" });
  revalidatePath("/", "layout"); // nama di sidebar/top bar ikut berubah
  back("/akun", { ok: `Nama disimpan: ${s(f, "name")}` });
}
