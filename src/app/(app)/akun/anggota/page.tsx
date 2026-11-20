import { SubmitButton } from "@/components/Pending";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requirePlss } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Profile } from "@/lib/types";
import { AdminHead, Flash } from "../Flash";
import { addMember, setDivision } from "../actions";
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
                  <FieldLegend variant="label" className="sr-only">Divisi</FieldLegend>
                  <DivisionToggle />
                </FieldSet>
                <SubmitButton pendingText="Membuat akun...">Buat akun</SubmitButton>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>

        <div>
          <Card className="gap-0 p-0 md:hidden">
            <ul>
              {rows.map((p) => (
                <li key={p.id} className="flex items-center gap-3 border-b px-3.5 py-3 last:border-b-0">
                  <span className="flex flex-1 flex-col gap-1">
                    <span className="font-medium">{p.full_name}{p.id === me.id ? " (kamu)" : ""}</span>
                    <Badge variant={p.division === "PLSS" ? "ok" : "muted"}>{p.division}</Badge>
                  </span>
                  {p.id !== me.id && <DivisionButton p={p} />}
                </li>
              ))}
            </ul>
          </Card>
          <div className="hidden md:block">
            <Table>
              <TableHeader><TableRow><TableHead>Nama</TableHead><TableHead className="w-32">Divisi</TableHead><TableHead className="w-48"><span className="sr-only">Aksi</span></TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-semibold">{p.full_name}{p.id === me.id ? " (kamu)" : ""}</TableCell>
                    <TableCell><Badge variant={p.division === "PLSS" ? "ok" : "muted"}>{p.division}</Badge></TableCell>
                    <TableCell>{p.id !== me.id && <DivisionButton p={p} />}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </>
  );
}
