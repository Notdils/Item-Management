import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/** Profil pengguna yang login. Redirect ke /login kalau belum. Di-cache per request. */
export const requireProfile = cache(async (): Promise<Profile> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) redirect("/login");
  const { data } = await supabase.from("profiles").select("id, full_name, division").eq("id", uid).single();
  if (!data) redirect("/login");
  return data as Profile;
});

export async function requirePlss() {
  const p = await requireProfile();
  if (p.division !== "PLSS") redirect("/akun");
  return p;
}
