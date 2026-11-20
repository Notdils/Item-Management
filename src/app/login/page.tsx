import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Masuk" };

// Mobile & tablet: satu kolom. Desktop: panel brand kiri + form kanan (Figma "Bengkel · Login").
export default function LoginPage() {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-2">
      <aside className="hidden flex-col justify-between border-r border-border bg-card p-16 lg:flex">
        <p className="eyebrow text-primary">Anargya · Bengkel</p>
        <div className="flex max-w-lg flex-col gap-4">
          <p className="title text-5xl">Catat di mana barang bengkel berada.</p>
          <p className="text-[17px] text-muted-foreground">
            Foto barang di raknya, pilih Taruh atau Ambil. Waktu dan lokasi terisi otomatis, PLSS tinggal mencari.
          </p>
        </div>
        <p className="font-mono text-xs text-muted-foreground">Anargya ITS EV Team</p>
      </aside>
      <main className="mx-auto flex max-w-md flex-col gap-7 px-4 pb-10 pt-[max(6rem,env(safe-area-inset-top))] md:max-w-[480px] md:pt-48 lg:max-w-[400px] lg:justify-center lg:px-0 lg:py-16">
        <header className="flex flex-col gap-2">
          <p className="eyebrow text-primary lg:hidden">Anargya · Bengkel</p>
          <h1 className="title">
            <span className="lg:hidden">Masuk untuk lapor barang</span>
            <span className="hidden lg:inline">Masuk</span>
          </h1>
          <p className="text-muted-foreground">Setiap laporan tercatat atas nama kamu.</p>
        </header>
        <LoginForm />
        <p className="text-sm text-muted-foreground">Belum punya akun? Minta dibuatkan oleh PLSS.</p>
      </main>
    </div>
  );
}
