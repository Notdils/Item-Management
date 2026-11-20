import type { Metadata } from "next";
import Link from "next/link";
import { Package } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fmtAgo } from "@/lib/format";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { StockLevel } from "@/lib/types";

export const metadata: Metadata = { title: "Stok habis pakai" };

export default async function StokPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("stock_levels").select("*").order("name").order("location_code");
  const levels = (data ?? []) as StockLevel[];
  const kinds = new Set(levels.map((l) => l.item_id)).size;

  return (
    <>
      <h1 className="title">Stok habis pakai</h1>
      <Card className="md:w-[200px]">
        <CardHeader className="gap-1">
          <CardDescription>Jenis</CardDescription>
          <CardTitle className="font-mono text-[28px] font-medium">{kinds}</CardTitle>
        </CardHeader>
      </Card>

      {levels.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Package /></EmptyMedia>
            <EmptyTitle>Belum ada stok</EmptyTitle>
            <EmptyDescription>PLSS menambah stok lewat tombol foto, lalu pilih Tambah.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          {/* Mobile: daftar */}
          <Card className="gap-0 p-0 md:hidden">
            <ul>
              {levels.map((l) => (
                <li key={`${l.item_id}-${l.location_id}`} className="border-b last:border-b-0">
                  <Link href={`/barang/${l.item_id}`} className="flex items-center gap-3 px-3.5 py-3.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{l.name}</span>
                      <span className="flex items-center gap-2 text-sm text-muted-foreground"><span className="rack text-xs">{l.location_code}</span>{l.location_name}</span>
                    </span>
                    <span className="text-right">
                      <span className={cn("block font-mono text-[22px] font-medium", l.qty === 0 && "text-warn")}>{l.qty}</span>
                      <span className="font-mono text-xs text-muted-foreground">{l.unit}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          {/* Tablet/desktop: tabel */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Barang</TableHead><TableHead className="w-60">Lokasi</TableHead><TableHead className="w-20">Sisa</TableHead><TableHead className="w-20">Satuan</TableHead><TableHead className="hidden w-44 lg:table-cell">Terakhir berubah</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {levels.map((l) => (
                  <TableRow key={`${l.item_id}-${l.location_id}`}>
                    <TableCell><Link href={`/barang/${l.item_id}`} className="font-semibold hover:underline">{l.name}</Link></TableCell>
                    <TableCell><span className="flex items-center gap-2"><span className="rack text-xs">{l.location_code}</span>{l.location_name}</span></TableCell>
                    <TableCell className={cn("font-mono text-[15px]", l.qty === 0 && "text-warn")}>{l.qty}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{l.unit}</TableCell>
                    <TableCell className="hidden font-mono text-xs text-muted-foreground lg:table-cell">{fmtAgo(l.last_move_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </>
  );
}
