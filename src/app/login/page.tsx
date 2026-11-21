import { LogOut } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getSessionProfile } from "@/lib/session";
import { signOut } from "./actions";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Masuk" };

// Mobile & tablet: satu kolom. Desktop: panel brand kiri + form kanan (Figma "Bengkel · Login").
export default async function LoginPage() {
  const { uid, profile } = await getSessionProfile();
  // Sudah login dan profil ada: langsung ke aplikasi. Sudah login tapi profil tidak ada:
  // jangan redirect (itu yang dulu memicu loop), tampilkan penjelasan + tombol keluar.
  if (profile) redirect("/");
  const orphan = !!uid;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-2">
      <aside className="hidden flex-col justify-between border-r border-border bg-card p-16 lg:flex">
        <p className="text-lg font-extrabold tracking-tight">Bengkel Anargya</p>
        <div className="flex max-w-lg flex-col gap-4">
          <p className="title text-5xl">Catat di mana barang bengkel berada.</p>
          <p className="text-[17px] text-muted-foreground">
            Foto barang di raknya, pilih Taruh atau Ambil. Waktu dan lokasi terisi otomatis, PLSS tinggal mencari.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">Anargya ITS EV Team</p>
      </aside>
      <main className="mx-auto flex max-w-md flex-col gap-7 px-4 pb-10 pt-[max(6rem,env(safe-area-inset-top))] md:max-w-[480px] md:pt-48 lg:max-w-[400px] lg:justify-center lg:px-0 lg:py-16">
        <header className="flex flex-col gap-2">
          <p className="text-lg font-extrabold tracking-tight lg:hidden">Bengkel Anargya</p>
          <h1 className="title">
            <span className="lg:hidden">Masuk untuk lapor barang</span>
            <span className="hidden lg:inline">Masuk</span>
          </h1>
          <p className="text-muted-foreground">Setiap laporan tercatat atas nama kamu.</p>
        </header>
        {orphan ? (
          <Alert variant="warning">
            <AlertTitle>Akun ini belum punya profil</AlertTitle>
            <AlertDescription>
              <p>Kamu sudah masuk, tetapi data profil akun ini belum ada di database. Minta PLSS menjalankan <code>supabase/bootstrap.sql</code> atau membuatkan akun lewat menu Anggota.</p>
              <form action={signOut} className="mt-3">
                <Button variant="destructive" className="bg-destructive text-[#1f0705] hover:bg-destructive/90 dark:bg-destructive"><LogOut aria-hidden />Keluar dan masuk dengan akun lain</Button>
              </form>
            </AlertDescription>
          </Alert>
        ) : (
          <LoginForm />
        )}
        <p className="text-sm text-muted-foreground">Belum punya akun? Minta dibuatkan oleh PLSS.</p>
      </main>
    </div>
  );
}
