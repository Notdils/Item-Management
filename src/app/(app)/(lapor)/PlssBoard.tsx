import Link from "next/link";
import { CircleCheck, PackageOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signPhotos } from "@/lib/photos";
import { fmtDuration, fmtShort, HELD_LIMIT_HOURS } from "@/lib/format";
import { ItemRow } from "@/components/ItemRow";
import { LinkPending } from "@/components/Pending";
import { Card } from "@/components/ui/card";
import type { HeldItem, ItemOverview } from "@/lib/types";

// Beranda PLSS: yang perlu ditindaklanjuti dulu (lewat 12 jam), lalu yang sedang dipegang, lalu stok kosong.
export async function PlssBoard() {
  const supabase = await createClient();
  const [held, stock] = await Promise.all([
    supabase.from("held_items").select("item_id, name, user_id, user_name, photo_path, reported_at, overdue")
      .order("reported_at", { ascending: true }),
    supabase.from("item_overview").select("id, name, unit, qty_total").eq("kind", "HABIS_PAKAI").order("name"),
  ]);
  const rows = (held.data ?? []) as HeldItem[];
  const overdue = rows.filter((h) => h.overdue);
  const holding = rows.filter((h) => !h.overdue);
  const empty = ((stock.data ?? []) as Pick<ItemOverview, "id" | "name" | "unit" | "qty_total">[])
    .filter((s) => (s.qty_total ?? 0) <= 0);
  const photos = await signPhotos(supabase, rows.map((r) => r.photo_path));

  return (
    <>
      <header className="flex flex-col gap-3">
        <h1 className="title">Ringkasan bengkel</h1>
        <p className="max-w-[56ch] text-muted-foreground">
          Barang yang belum kembali dan stok yang perlu diisi. Paling lama di atas.
        </p>
      </header>

      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-10">
        <section aria-labelledby="overdue" className="flex flex-col gap-3">
          <h2 id="overdue" className="flex items-baseline gap-2 text-lg font-bold">
            Lewat {HELD_LIMIT_HOURS} jam
            <span className={overdue.length ? "font-mono text-base text-warn" : "font-mono text-base text-muted-foreground"}>{overdue.length}</span>
          </h2>
          {overdue.length === 0 ? (
            <Card className="flex-row items-center gap-3">
              <CircleCheck aria-hidden className="size-5 shrink-0 text-primary" />
              <p>Semua alat yang dibawa masih di bawah {HELD_LIMIT_HOURS} jam.</p>
            </Card>
          ) : (
            <ul className="flex flex-col gap-2">
              {overdue.map((h) => (
                <li key={h.item_id}>
                  <ItemRow href={`/barang/${h.item_id}`} name={h.name}
                    meta={`${h.user_name}, sejak ${fmtShort(h.reported_at)}`}
                    status={fmtDuration(h.reported_at)} tone="warn"
                    photo={h.photo_path ? photos.get(h.photo_path) : null} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-8">
          <section aria-labelledby="holding" className="flex flex-col gap-3">
            <h2 id="holding" className="flex items-baseline gap-2 text-lg font-bold">
              Sedang dibawa <span className="font-mono text-base text-muted-foreground">{holding.length}</span>
            </h2>
            {holding.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada alat lain yang sedang dibawa.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {holding.map((h) => (
                  <li key={h.item_id}>
                    <ItemRow href={`/barang/${h.item_id}`} name={h.name} meta={h.user_name}
                      status={fmtDuration(h.reported_at)} tone="muted"
                      photo={h.photo_path ? photos.get(h.photo_path) : null} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="empty-stock" className="flex flex-col gap-3">
            <h2 id="empty-stock" className="flex items-baseline gap-2 text-lg font-bold">
              Stok kosong <span className={empty.length ? "font-mono text-base text-warn" : "font-mono text-base text-muted-foreground"}>{empty.length}</span>
            </h2>
            {empty.length === 0 ? (
              <p className="text-sm text-muted-foreground">Semua barang habis pakai masih ada stoknya.</p>
            ) : (
              <Card className="gap-0 p-0">
                <ul>
                  {empty.map((s) => (
                    <li key={s.id} className="border-b last:border-b-0">
                      <Link href={`/barang/${s.id}`} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5 hover:bg-accent">
                        <span className="flex items-center gap-2 font-medium"><PackageOpen aria-hidden className="size-4 text-muted-foreground" />{s.name}</span>
                        <span className="flex items-center gap-2 font-mono text-xs text-warn">0 {s.unit ?? ""}<LinkPending /></span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link href="/akun/opname" className="flex min-h-11 items-center justify-center gap-2 border-t px-4 text-sm font-semibold text-primary hover:bg-accent">
                  Hitung ulang stok<LinkPending />
                </Link>
              </Card>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
