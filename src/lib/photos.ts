import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Satu request untuk semua foto di halaman. URL berlaku 1 jam. */
export async function signPhotos(supabase: SupabaseClient, paths: (string | null | undefined)[]) {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  const map = new Map<string, string>();
  if (!unique.length) return map;
  const { data } = await supabase.storage.from("photos").createSignedUrls(unique, 3600);
  data?.forEach((d) => d.path && d.signedUrl && map.set(d.path, d.signedUrl));
  return map;
}
