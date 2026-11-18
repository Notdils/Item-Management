import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requirePlss } from "@/lib/session";
import type { Location } from "@/lib/types";
import { AdminHead, Flash } from "../Flash";
import { addLocation, toggleLocation } from "../actions";

export const metadata: Metadata = { title: "Lokasi & rak" };

export default async function LokasiPage({ searchParams }: { searchParams: Promise<{ pesan?: string; galat?: string }> }) {
  const sp = await searchParams;
  await requirePlss();
  const supabase = await createClient();
  const { data } = await supabase.from("locations").select("id, code, name, archived_at").order("code");
  const rows = (data ?? []) as Location[];

  return (
    <>
      <AdminHead title="Lokasi & rak" />
      <Flash {...sp} />
      <form action={addLocation} className="card flex flex-col gap-3 p-3.5">
        <div>
          <label htmlFor="code" className="field-label">Kode</label>
          <input id="code" name="code" className="input mono uppercase" required pattern="[A-Za-z0-9]+([ -][A-Za-z0-9]+)*"
            maxLength={20} placeholder="RAK-A1" autoCapitalize="characters" autoComplete="off" spellCheck={false} aria-describedby="code-help" />
          <p id="code-help" className="mt-1 text-xs text-ink-2">Huruf, angka, dan tanda hubung. Ditulis di label rak.</p>
        </div>
        <div>
          <label htmlFor="lname" className="field-label">Nama</label>
          <input id="lname" name="name" className="input" required minLength={2} maxLength={80} placeholder="Lemari alat, rak 1" autoComplete="off" />
        </div>
        <button className="btn btn-primary">Tambah lokasi</button>
      </form>
      <ul className="card divide-y divide-line">
        {rows.map((l) => (
          <li key={l.id} className={`flex items-center gap-3 px-3.5 py-3 ${l.archived_at ? "opacity-50" : ""}`}>
            <span className="min-w-0 flex-1">
              <span className="mono block font-medium">{l.code}</span>
              <span className="text-sm text-ink-2">{l.name}{l.archived_at ? " · diarsip" : ""}</span>
            </span>
            <form action={toggleLocation}>
              <input type="hidden" name="id" value={l.id} />
              <input type="hidden" name="archive" value={l.archived_at ? "0" : "1"} />
              <button className="btn btn-line btn-sm">{l.archived_at ? "Aktifkan" : "Arsip"}</button>
            </form>
          </li>
        ))}
      </ul>
    </>
  );
}
