import { LinkPending } from "@/components/Pending";
import type { Metadata } from "next";
import Link from "next/link";
import { Hand } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/session";
import { signPhotos } from "@/lib/photos";
import { fmtDuration, fmtShort, HELD_LIMIT_HOURS } from "@/lib/format";
import { ItemRow } from "@/components/ItemRow";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import type { HeldItem } from "@/lib/types";

export const metadata: Metadata = { title: "Sedang dipegang" };

function HeldList({ rows, photos, me, showHolder }: {
  rows: HeldItem[]; photos: Map<string, string>; me: string; showHolder: boolean;
}) {
  const taruh = (h: HeldItem) => `/lapor?item=${encodeURIComponent(h.name)}&aksi=TARUH`;
  return (
    <ul className="flex flex-col gap-2 md:grid md:grid-cols-2 md:gap-3 xl:grid-cols-3">
      {rows.map((h) => (
        <li key={h.item_id}>
          <Card className="h-full gap-0 p-0">
            <ItemRow href={`/barang/${h.item_id}`} name={h.name} photo={h.photo_path ? photos.get(h.photo_path) : null}
              meta={showHolder ? h.user_name : `Sejak ${fmtShort(h.reported_at)}`}
              status={h.overdue ? `Lewat ${HELD_LIMIT_HOURS} jam` : fmtDuration(h.reported_at)} tone={h.overdue ? "warn" : "muted"} />
            {h.user_id === me && (
              <div className="px-3 pb-3">
                <Button asChild size="sm" className="w-full"><Link href={taruh(h)}><LinkPending />Taruh sekarang</Link></Button>
              </div>
            )}
          </Card>
        </li>
      ))}
    </ul>
  );
}

// Semua anggota melihat siapa yang sedang membawa alat apa: yang dicari langsung tahu harus tanya siapa.
export default async function DipegangPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase.from("held_items")
    .select("item_id, name, user_id, user_name, photo_path, reported_at, overdue")
    .order("reported_at", { ascending: true });
  const held = (data ?? []) as HeldItem[];
  const mine = held.filter((h) => h.user_id === profile.id);
  const others = held.filter((h) => h.user_id !== profile.id);
  const myOverdue = mine.filter((h) => h.overdue);
  const photos = await signPhotos(supabase, held.map((r) => r.photo_path));

  return (
    <>
      <header className="flex flex-col gap-3">
        <h1 className="title">Sedang dipegang</h1>
        <p className="max-w-[56ch] text-muted-foreground">Alat yang sedang dibawa anggota, paling lama di atas.</p>
      </header>

      {myOverdue.length > 0 && (
        <Alert variant="warning">
          <AlertDescription>
            <p className="text-foreground">
              {myOverdue.map((h) => h.name).join(", ")} sudah kamu pegang lebih dari {HELD_LIMIT_HOURS} jam. Taruh kembali atau laporkan posisinya.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {held.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Hand /></EmptyMedia>
            <EmptyTitle>Tidak ada yang dipegang</EmptyTitle>
            <EmptyDescription>Semua alat sedang ada di raknya.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          {profile.division !== "PLSS" && (
            <section aria-labelledby="mine" className="flex flex-col gap-3">
              <h2 id="mine" className="flex items-baseline gap-2 text-lg font-bold">
                Kamu bawa <span className="font-mono text-base text-muted-foreground">{mine.length}</span>
              </h2>
              {mine.length === 0
                ? <p className="text-sm text-muted-foreground">Kamu tidak sedang membawa alat apa pun.</p>
                : <HeldList rows={mine} photos={photos} me={profile.id} showHolder={false} />}
            </section>
          )}
          <section aria-labelledby="others" className="flex flex-col gap-3">
            <h2 id="others" className="flex items-baseline gap-2 text-lg font-bold">
              {profile.division === "PLSS" ? "Dibawa anggota" : "Dibawa anggota lain"}
              <span className="font-mono text-base text-muted-foreground">{others.length}</span>
            </h2>
            {others.length === 0
              ? <p className="text-sm text-muted-foreground">Tidak ada alat yang dibawa anggota lain.</p>
              : <HeldList rows={others} photos={photos} me={profile.id} showHolder />}
          </section>
        </>
      )}
    </>
  );
}
