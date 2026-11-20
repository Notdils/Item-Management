import { SubmitButton } from "@/components/Pending";
import { rackLabel } from "@/lib/format";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requirePlss } from "@/lib/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Location, StockLevel } from "@/lib/types";
import { AdminHead, Flash } from "../Flash";
import { opname } from "../actions";

export const metadata: Metadata = { title: "Hitung ulang stok" };

export default async function OpnamePage({ searchParams }: { searchParams: Promise<{ pesan?: string; galat?: string }> }) {
  const sp = await searchParams;
  await requirePlss();
  const supabase = await createClient();
  const [items, locs, levels] = await Promise.all([
    supabase.from("items").select("name").eq("kind", "HABIS_PAKAI").is("archived_at", null).order("name"),
    supabase.from("locations").select("id, code, name, archived_at").is("archived_at", null).order("code"),
    supabase.from("stock_levels").select("*").order("name"),
  ]);
  const stock = (levels.data ?? []) as StockLevel[];

  return (
    <>
      <AdminHead title="Hitung ulang stok" />
      <Flash {...sp} />
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Hasil hitung fisik</CardTitle>
            <CardDescription>Hitung barang di rak, lalu isi jumlah sebenarnya. Selisih dengan catatan aplikasi dicatat otomatis (stok opname); riwayat lama tidak diubah.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={opname}>
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="item">Barang</FieldLabel>
                  <NativeSelect id="item" name="item" required defaultValue="">
                    <NativeSelectOption value="" disabled>Pilih barang habis pakai</NativeSelectOption>
                    {(items.data ?? []).map((i: { name: string }) => <NativeSelectOption key={i.name} value={i.name}>{i.name}</NativeSelectOption>)}
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="location">Lokasi</FieldLabel>
                  <NativeSelect id="location" name="location" required defaultValue="">
                    <NativeSelectOption value="" disabled>Pilih lokasi</NativeSelectOption>
                    {((locs.data ?? []) as Location[]).map((l) => <NativeSelectOption key={l.id} value={l.id}>{rackLabel(l.code, l.name)}</NativeSelectOption>)}
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="qty">Jumlah hasil hitung</FieldLabel>
                  <Input id="qty" name="qty" className="font-mono" inputMode="numeric" pattern="[0-9]+" required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="note">Catatan (opsional)</FieldLabel>
                  <Input id="note" name="note" maxLength={280} />
                </Field>
                <SubmitButton pendingText="Menyimpan...">Simpan hasil hitung</SubmitButton>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-bold">Stok tercatat</h2>
          <Card className="gap-0 p-0 md:hidden">
            <ul>
              {stock.map((l) => (
                <li key={`${l.item_id}-${l.location_id}`} className="flex justify-between border-b px-3.5 py-3 text-sm last:border-b-0">
                  <span>{l.name} <span className="rack text-xs">{l.location_code}</span></span>
                  <span className="font-mono">{l.qty} {l.unit}</span>
                </li>
              ))}
            </ul>
          </Card>
          <div className="hidden md:block">
            <Table>
              <TableHeader><TableRow><TableHead>Barang</TableHead><TableHead className="w-32">Lokasi</TableHead><TableHead className="w-28">Sisa</TableHead></TableRow></TableHeader>
              <TableBody>
                {stock.map((l) => (
                  <TableRow key={`${l.item_id}-${l.location_id}`}>
                    <TableCell className="font-semibold">{l.name}</TableCell>
                    <TableCell className="font-mono">{l.location_code}</TableCell>
                    <TableCell className="font-mono">{l.qty} {l.unit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </>
  );
}
