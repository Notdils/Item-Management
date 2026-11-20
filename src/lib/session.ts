import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/** Sesi + profil pengguna (di-cache per request). Tidak pernah redirect sendiri. */
export const getSessionProfile = cache(async (): Promise<{ uid: string | null; profile: Profile | null }> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub ?? null;
  if (!uid) return { uid: null, profile: null };
  const { data, error } = await supabase.from("profiles").select("id, full_name, division, team").eq("id", uid).maybeSingle();
  // Gagal query (jaringan, izin) = error sungguhan: tampilkan error.tsx, jangan redirect.
  if (error) throw new Error(`Gagal membaca profil: ${error.message}`);
  return { uid, profile: (data as Profile | null) ?? null };
});

/** Profil pengguna yang login. Belum login atau belum punya profil: ke /login (halaman login menjelaskan). */
export const requireProfile = cache(async (): Promise<Profile> => {
  const { profile } = await getSessionProfile();
  if (!profile) redirect("/login");
  return profile;
});

export async function requirePlss() {
  const p = await requireProfile();
  if (p.division !== "PLSS") redirect("/akun");
  return p;
}
