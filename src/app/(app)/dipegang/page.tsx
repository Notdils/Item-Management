import { LinkPending } from "@/components/Pending";
import type { Metadata } from "next";
import Link from "next/link";
import { Hand } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/session";
import { signPhotos } from "@/lib/photos";
import { fmtDuration, fmtShort, HELD_LIMIT_HOURS } from "@/lib/format";
import { ItemRow, Thumb } from "@/components/ItemRow";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { HeldItem } from "@/lib/types";

export const metadata: Metadata = { title: "Sedang dipegang" };

export default async function DipegangPage({ searchParams }: { searchParams: Promise<{ semua?: string }> }) {
  const semua = (await searchParams).semua;
  const profile = await requireProfile();
  // PLSS mengawasi semua anggota: tab "Semua" jadi bawaan
  const all = semua ? semua === "1" : profile.division === "PLSS";
  const supabase = await createClient();
  const { data } = await supabase.from("held_items")
    .select("item_id, name, user_id, user_name, photo_path, reported_at, overdue")
    .order("reported_at", { ascending: true });
  const held = (data ?? []) as HeldItem[];
  const mine = held.filter((h) => h.user_id === profile.id);
  const rows = all ? held : mine;
  const myOverdue = mine.filter((h) => h.overdue);
  const photos = await signPhotos(supabase, rows.map((r) => r.photo_path));
  const taruh = (h: HeldItem) => `/lapor?item=${encodeURIComponent(h.name)}&aksi=TARUH`;

  return (
    <>
      <h1 className="title">Sedang dipegang</h1>
      {/* Tab = tautan, supaya pilihan tersimpan di URL */}
      <Tabs value={all ? "semua" : "saya"}>
        <TabsList>
          <TabsTrigger value="saya" asChild><Link href="/dipegang?semua=0">Saya ({mine.length})</Link></TabsTrigger>
          <TabsTrigger value="semua" asChild><Link href="/dipegang?semua=1">Semua ({held.length})</Link></TabsTrigger>
        </TabsList>
      </Tabs>

      {myOverdue.length > 0 && (
        <Alert variant="warning">
          <AlertDescription>
            <p className="text-foreground">
              {myOverdue.map((h) => h.name).join(", ")} sudah kamu pegang lebih dari {HELD_LIMIT_HOURS} jam. Taruh kembali atau laporkan posisinya.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {rows.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Hand /></EmptyMedia>
            <EmptyTitle>Tidak ada yang dipegang</EmptyTitle>
            <EmptyDescription>{all ? "Semua alat sedang ada di raknya." : "Kamu tidak sedang memegang alat apa pun."}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <section className="flex flex-col gap-2 md:grid md:grid-cols-2 md:gap-3 lg:hidden">
            {rows.map((h) => (
              <Card key={h.item_id} className="gap-0 p-0">
                <ItemRow href={`/barang/${h.item_id}`} name={h.name} photo={h.photo_path ? photos.get(h.photo_path) : null}
                  meta={all ? `${h.user_name}, ${fmtDuration(h.reported_at)}` : `Kamu bawa ${fmtDuration(h.reported_at)}`}
                  status={h.overdue ? `> ${HELD_LIMIT_HOURS} jam` : "Dipegang"} tone={h.overdue ? "warn" : "muted"} />
                {h.user_id === profile.id && (
                  <div className="px-3 pb-3">
                    <Button asChild size="sm" className="w-full"><Link href={taruh(h)}><LinkPending />Taruh sekarang</Link></Button>
                  </div>
                )}
              </Card>
            ))}
          </section>

          <div className="hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow><TableHead className="w-14"><span className="sr-only">Foto</span></TableHead><TableHead>Barang</TableHead>{all && <TableHead className="w-44">Pemegang</TableHead>}<TableHead className="w-40">Diambil</TableHead><TableHead className="w-28">Lama</TableHead><TableHead className="w-44"><span className="sr-only">Aksi</span></TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((h) => (
                  <TableRow key={h.item_id}>
                    <TableCell><Thumb src={h.photo_path ? photos.get(h.photo_path) : null} size={40} /></TableCell>
                    <TableCell><Link href={`/barang/${h.item_id}`} className="font-semibold hover:underline">{h.name}</Link></TableCell>
                    {all && <TableCell>{h.user_name}</TableCell>}
                    <TableCell className="font-mono text-xs">{fmtShort(h.reported_at)}</TableCell>
                    <TableCell><Badge variant={h.overdue ? "warn" : "muted"}>{h.overdue ? `> ${HELD_LIMIT_HOURS} jam` : fmtDuration(h.reported_at)}</Badge></TableCell>
                    <TableCell className="text-right">
                      {h.user_id === profile.id && <Button asChild size="sm"><Link href={taruh(h)}><LinkPending />Taruh sekarang</Link></Button>}
                    </TableCell>
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
