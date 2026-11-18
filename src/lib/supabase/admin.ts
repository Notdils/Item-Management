import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// Secret key hanya ada di server (Vercel env / .env.local), tidak pernah dikirim ke browser.
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY belum diisi");
  return createClient(env.url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}
