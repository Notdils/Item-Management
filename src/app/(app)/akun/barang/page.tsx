import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requirePlss } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminHead, Flash } from "../Flash";
import { archiveItem, mergeItems, renameItem } from "../actions";

export const metadata: Metadata = { title: "Daftar barang" };

type Row = { id: number; name: string; kind: "ALAT" | "HABIS_PAKAI"; unit: string | null };
const kindLabel = (r: Row) => (r.kind === "ALAT" ? "Alat" : `Habis pakai · ${r.unit}`);

function RenameForm({ r, id }: { r: Row; id: string }) {
  return (
    <form action={renameItem} className="flex items-center gap-2">
      <input type="hidden" name="id" value={r.id} />
      <label htmlFor={id} className="sr-only">Nama barang #{r.id}</label>
      <Input id={id} name="name" defaultValue={r.name} required minLength={2} maxLength={80} />
      <Button variant="outline" size="sm">Simpan</Button>
    </form>
  );
}
function ArchiveForm({ r }: { r: Row }) {
  return (
    <form action={archiveItem}>
      <input type="hidden" name="id" value={r.id} />
      <Button variant="ghost" size="sm" className="text-destructive">Arsipkan</Button>
    </form>
  );
}

export default async function BarangAdminPage({ searchParams }: { searchParams: Promise<{ pesan?: string; galat?: string }> }) {
  const sp = await searchParams;
  await requirePlss();
  const supabase = await createClient();
  const { data } = await supabase.from("items").select("id, name, kind, unit").is("archived_at", null).order("name");
  const rows = (data ?? []) as Row[];
  const options = rows.map((r) => <NativeSelectOption key={r.id} value={r.id}>{r.name} ({r.kind === "ALAT" ? "alat" : "habis pakai"})</NativeSelectOption>);

  return (
    <>
      <AdminHead title="Daftar barang" />
      <Flash {...sp} />
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Gabungkan barang duplikat</CardTitle>
            <CardDescription>Semua riwayat barang pertama dipindah ke barang kedua, lalu barang pertama diarsip. Jenisnya harus sama.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={mergeItems}>
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="from">Duplikat</FieldLabel>
                  <NativeSelect id="from" name="from" required defaultValue="">
                    <NativeSelectOption value="" disabled>Pilih barang</NativeSelectOption>{options}
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="into">Gabung ke</FieldLabel>
                  <NativeSelect id="into" name="into" required defaultValue="">
                    <NativeSelectOption value="" disabled>Pilih barang</NativeSelectOption>{options}
                  </NativeSelect>
                </Field>
                <Button>Gabungkan</Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>

        <div>
          <Card className="gap-0 p-0 md:hidden">
            <ul>
              {rows.map((r) => (
                <li key={r.id} className="flex flex-col gap-2 border-b px-3.5 py-3 last:border-b-0">
                  <Badge variant="muted">{kindLabel(r)} #{r.id}</Badge>
                  <RenameForm r={r} id={`m-${r.id}`} />
                  <ArchiveForm r={r} />
                </li>
              ))}
            </ul>
          </Card>
          <div className="hidden md:block">
            <Table>
              <TableHeader><TableRow><TableHead className="w-12">#</TableHead><TableHead>Nama</TableHead><TableHead className="w-36">Jenis</TableHead><TableHead className="w-28"><span className="sr-only">Arsip</span></TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{r.id}</TableCell>
                    <TableCell><RenameForm r={r} id={`d-${r.id}`} /></TableCell>
                    <TableCell><Badge variant="muted">{kindLabel(r)}</Badge></TableCell>
                    <TableCell><ArchiveForm r={r} /></TableCell>
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
