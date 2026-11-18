"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signIn(_: string | null, form: FormData): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(form.get("email") ?? "").trim(),
    password: String(form.get("password") ?? ""),
  });
  if (error) {
    if (error.code === "invalid_credentials") return "Email atau kata sandi salah.";
    if (error.code === "email_not_confirmed") return "Email belum dikonfirmasi. Minta PLSS mengaktifkan akun.";
    // Error lain (env server salah, Supabase tidak terjangkau): tampilkan apa adanya supaya mudah dilacak
    console.error("signIn", error.code, error.message);
    return `Login gagal: ${error.message}`;
  }
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
