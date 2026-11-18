import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requirePlss } from "@/lib/session";
import type { Profile } from "@/lib/types";
import { AdminHead, Flash } from "../Flash";
import { addMember, setDivision } from "../actions";

export const metadata: Metadata = { title: "Anggota" };

export default async function AnggotaPage({ searchParams }: { searchParams: Promise<{ pesan?: string; galat?: string }> }) {
  const sp = await searchParams;
  const me = await requirePlss();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name, division").order("full_name");
  const rows = (data ?? []) as Profile[];

  return (
    <>
      <AdminHead title="Anggota" />
      <Flash {...sp} />
      <form action={addMember} className="card flex flex-col gap-3 p-3.5">
        <h2 className="font-semibold">Buat akun</h2>
        <div>
          <label htmlFor="m-name" className="field-label">Nama</label>
          <input id="m-name" name="name" className="input" required minLength={2} maxLength={80} autoComplete="off" />
        </div>
        <div>
          <label htmlFor="m-email" className="field-label">Email</label>
          <input id="m-email" name="email" type="email" className="input" required autoComplete="off" spellCheck={false} />
        </div>
        <div>
          <label htmlFor="m-pass" className="field-label">Kata sandi awal</label>
          <input id="m-pass" name="password" type="text" className="input mono" required minLength={8} autoComplete="new-password"
            aria-describedby="m-pass-help" />
          <p id="m-pass-help" className="mt-1 text-xs text-ink-2">Minimal 8 karakter. Berikan langsung ke orangnya.</p>
        </div>
        <fieldset className="segmented">
          <legend className="sr-only">Divisi</legend>
          <label><input type="radio" name="division" value="TEKNIKAL" defaultChecked /><span className="font-semibold">Teknikal</span></label>
          <label><input type="radio" name="division" value="PLSS" /><span className="font-semibold">PLSS</span></label>
        </fieldset>
        <button className="btn btn-primary">Buat akun</button>
      </form>

      <ul className="card divide-y divide-line">
        {rows.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-3.5 py-3">
            <span className="flex-1">
              <span className="block font-medium">{p.full_name}{p.id === me.id ? " (kamu)" : ""}</span>
              <span className={`mono text-xs ${p.division === "PLSS" ? "text-green" : "text-ink-2"}`}>{p.division}</span>
            </span>
            {p.id !== me.id && (
              <form action={setDivision}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="division" value={p.division === "PLSS" ? "TEKNIKAL" : "PLSS"} />
                <button className="btn btn-line btn-sm">{p.division === "PLSS" ? "Jadikan teknikal" : "Jadikan PLSS"}</button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
