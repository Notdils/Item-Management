import { SubmitButton } from "@/components/Pending";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requirePlss } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Location } from "@/lib/types";
import { AdminHead, Flash } from "../Flash";
import { addLocation, toggleLocation } from "../actions";

export const metadata: Metadata = { title: "Lokasi & rak" };

function ToggleButton({ l }: { l: Location }) {
  return (
    <form action={toggleLocation}>
      <input type="hidden" name="id" value={l.id} />
      <input type="hidden" name="archive" value={l.archived_at ? "0" : "1"} />
      <SubmitButton variant="outline" size="sm" pendingText="Menyimpan...">{l.archived_at ? "Aktifkan" : "Arsip"}</SubmitButton>
    </form>
  );
}

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
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-6">
        <Card>
          <CardHeader><CardTitle>Tambah lokasi</CardTitle></CardHeader>
          <CardContent>
            <form action={addLocation}>
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="code">Kode</FieldLabel>
                  <Input id="code" name="code" className="font-mono uppercase" required pattern="[A-Za-z0-9]+([ \-][A-Za-z0-9]+)*"
                    maxLength={20} placeholder="RAK-A1" autoCapitalize="characters" autoComplete="off" spellCheck={false} aria-describedby="code-help" />
                  <FieldDescription id="code-help">Huruf, angka, dan tanda hubung. Ditulis di label rak.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="lname">Nama</FieldLabel>
                  <Input id="lname" name="name" required minLength={2} maxLength={80} placeholder="Lemari alat, rak 1" autoComplete="off" />
                </Field>
                <SubmitButton pendingText="Menambahkan...">Tambah lokasi</SubmitButton>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>

        <div>
          <Card className="gap-0 p-0 md:hidden">
            <ul>
              {rows.map((l) => (
                <li key={l.id} className={cn("flex items-center gap-3 border-b px-3.5 py-3 last:border-b-0", l.archived_at && "opacity-50")}>
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono font-medium">{l.code}</span>
                    <span className="text-sm text-muted-foreground">{l.name}{l.archived_at ? " (diarsip)" : ""}</span>
                  </span>
                  <ToggleButton l={l} />
                </li>
              ))}
            </ul>
          </Card>
          <div className="hidden md:block">
            <Table>
              <TableHeader><TableRow><TableHead className="w-32">Kode</TableHead><TableHead>Nama</TableHead><TableHead className="w-24">Status</TableHead><TableHead className="w-28"><span className="sr-only">Aksi</span></TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono">{l.code}</TableCell>
                    <TableCell>{l.name}</TableCell>
                    <TableCell><Badge variant={l.archived_at ? "muted" : "ok"}>{l.archived_at ? "Diarsip" : "Aktif"}</Badge></TableCell>
                    <TableCell><ToggleButton l={l} /></TableCell>
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
