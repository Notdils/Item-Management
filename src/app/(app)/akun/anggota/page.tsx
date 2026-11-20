import { SubmitButton } from "@/components/Pending";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requirePlss } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { Profile } from "@/lib/types";
import { AdminHead, Flash } from "../Flash";
import { addMember, setDivision, setTeam } from "../actions";
import { TEAM_LABEL } from "@/lib/team";
import { DivisionToggle } from "../DivisionToggle";

export const metadata: Metadata = { title: "Anggota" };

function DivisionButton({ p }: { p: Profile }) {
  return (
    <form action={setDivision}>
      <input type="hidden" name="id" value={p.id} />
      <input type="hidden" name="division" value={p.division === "PLSS" ? "TEKNIKAL" : "PLSS"} />
      <SubmitButton variant="outline" size="sm" pendingText="Menyimpan...">{p.division === "PLSS" ? "Jadikan teknikal" : "Jadikan PLSS"}</SubmitButton>
    </form>
  );
}

function TeamButton({ p }: { p: Profile }) {
  const next = p.team === "MECHANICAL" ? "ELECTRICAL" : "MECHANICAL";
  return (
    <form action={setTeam}>
      <input type="hidden" name="id" value={p.id} />
      <input type="hidden" name="name" value={p.full_name} />
      <input type="hidden" name="team" value={next} />
      <SubmitButton variant="outline" size="sm" pendingText="Menyimpan...">
        {p.team ? `Pindah ke ${TEAM_LABEL[next]}` : `Jadikan ${TEAM_LABEL[next]}`}
      </SubmitButton>
    </form>
  );
}

export default async function AnggotaPage({ searchParams }: { searchParams: Promise<{ pesan?: string; galat?: string }> }) {
  const sp = await searchParams;
  const me = await requirePlss();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name, division, team").order("full_name");
  const rows = (data ?? []) as Profile[];
  // Dikelompokkan sesuai struktur tim: PLSS (non-teknikal), Mechanical, Electrical
  const groups = [
    { key: "plss", title: "PLSS", rows: rows.filter((p) => p.division === "PLSS") },
    { key: "mech", title: "Teknikal, Mechanical", rows: rows.filter((p) => p.division === "TEKNIKAL" && p.team === "MECHANICAL") },
    { key: "elec", title: "Teknikal, Electrical", rows: rows.filter((p) => p.division === "TEKNIKAL" && p.team === "ELECTRICAL") },
    { key: "none", title: "Teknikal, belum ada divisi tim", rows: rows.filter((p) => p.division === "TEKNIKAL" && !p.team) },
  ];

  return (
    <>
      <AdminHead title="Anggota" />
      <Flash {...sp} />
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-6">
        <Card>
          <CardHeader><CardTitle>Buat akun</CardTitle></CardHeader>
          <CardContent>
            <form action={addMember}>
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="m-name">Nama</FieldLabel>
                  <Input id="m-name" name="name" required minLength={2} maxLength={80} autoComplete="off" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="m-email">Email</FieldLabel>
                  <Input id="m-email" name="email" type="email" required autoComplete="off" spellCheck={false} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="m-pass">Kata sandi awal</FieldLabel>
                  <Input id="m-pass" name="password" type="text" className="font-mono" required minLength={8} autoComplete="new-password" aria-describedby="m-pass-help" />
                  <FieldDescription id="m-pass-help">Minimal 8 karakter. Berikan langsung ke orangnya.</FieldDescription>
                </Field>
                <FieldSet className="gap-2">
                  <FieldLegend variant="label">Divisi</FieldLegend>
                  <DivisionToggle />
                </FieldSet>
                <SubmitButton pendingText="Membuat akun...">Buat akun</SubmitButton>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          {groups.map((g) => g.rows.length > 0 && (
            <section key={g.key} aria-labelledby={`g-${g.key}`} className="flex flex-col gap-2">
              <h2 id={`g-${g.key}`} className="flex items-baseline gap-2 text-lg font-bold">
                {g.title} <span className="font-mono text-base text-muted-foreground">{g.rows.length}</span>
              </h2>
              <Card className="gap-0 p-0">
                <ul>
                  {g.rows.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3 last:border-b-0">
                      <span className="min-w-[10rem] flex-1 font-medium">{p.full_name}{p.id === me.id ? " (kamu)" : ""}</span>
                      {p.id !== me.id && (
                        <span className="flex flex-wrap gap-2">
                          {p.division === "TEKNIKAL" && <TeamButton p={p} />}
                          <DivisionButton p={p} />
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
