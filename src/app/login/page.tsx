import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Masuk" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-7 px-4 pb-10 pt-[max(6rem,env(safe-area-inset-top))]">
      <header className="flex flex-col gap-2">
        <p className="eyebrow text-green">Anargya · Bengkel</p>
        <h1 className="title text-[2rem]">Masuk untuk lapor barang</h1>
        <p className="text-ink-2">Setiap laporan tercatat atas nama kamu.</p>
      </header>
      <LoginForm />
      <p className="text-sm text-ink-2">Belum punya akun? Minta dibuatkan oleh PLSS.</p>
    </main>
  );
}
