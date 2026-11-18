import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/session";
import { Icon } from "@/components/Icon";
import { signOut } from "@/app/login/actions";
import { Flash } from "./Flash";
import { updateName } from "./actions";

export const metadata: Metadata = { title: "Akun" };

export default async function AkunPage({ searchParams }: { searchParams: Promise<{ pesan?: string; galat?: string }> }) {
  const sp = await searchParams;
  const profile = await requireProfile();
  const plss = profile.division === "PLSS";
  const supabase = await createClient();

  let menu: { href: string; label: string; meta: string; warn?: boolean; download?: boolean }[] = [];
  if (plss) {
    const count = (t: "locations" | "items" | "profiles") =>
      supabase.from(t).select("id", { count: "exact", head: true }).then((r) => r.count ?? 0);
    const [loc, items, members, kinds] = await Promise.all([
      count("locations"), count("items"), count("profiles"),
      supabase.from("items").select("id", { count: "exact", head: true }).eq("kind", "HABIS_PAKAI").is("archived_at", null).then((r) => r.count ?? 0),
    ]);
    menu = [
      { href: "/akun/lokasi", label: "Lokasi & rak", meta: `${loc} lokasi` },
      { href: "/akun/barang", label: "Daftar barang", meta: `${items} barang` },
      { href: "/akun/opname", label: "Opname stok", meta: `${kinds} jenis` },
      { href: "/akun/anggota", label: "Anggota", meta: `${members} akun` },
      { href: "/akun/ekspor", label: "Ekspor riwayat (CSV)", meta: "semua laporan", download: true },
    ];
  }

  return (
    <>
      <header className="flex flex-col gap-1.5">
        <p className="eyebrow text-green">{plss ? "PLSS · Admin data" : "Teknikal"}</p>
        <h1 className="title">{profile.full_name}</h1>
      </header>
      <Flash {...sp} />

      {menu.length > 0 && (
        <ul className="card divide-y divide-line">
          {menu.map((m) => (
            <li key={m.href}>
              {m.download ? (
                <a href={m.href} download className="flex items-center gap-3 px-3.5 py-4">
                  <span className="flex-1 font-medium">{m.label}</span>
                  <span className="mono text-xs text-ink-2">{m.meta}</span>
                  <Icon name="chev" size={18} className="text-[#5b6764]" />
                </a>
              ) : (
                <Link href={m.href} className="flex items-center gap-3 px-3.5 py-4">
                  <span className="flex-1 font-medium">{m.label}</span>
                  <span className="mono text-xs text-ink-2">{m.meta}</span>
                  <Icon name="chev" size={18} className="text-[#5b6764]" />
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}

      <form action={updateName} className="flex flex-col gap-3">
        <div>
          <label htmlFor="name" className="field-label">Nama tampilan</label>
          <input id="name" name="name" defaultValue={profile.full_name} className="input" autoComplete="name"
            required minLength={2} maxLength={80} />
        </div>
        <button className="btn btn-line">Simpan nama</button>
      </form>

      <form action={signOut}>
        <button className="btn btn-line w-full">Keluar</button>
      </form>
    </>
  );
}
