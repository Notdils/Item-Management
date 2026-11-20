import Link from "next/link";
import { Camera } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type Tone = "ok" | "warn" | "muted";

export function Thumb({ src, size = 56 }: { src?: string | null; size?: number }) {
  return (
    <div className="grid shrink-0 place-items-center overflow-hidden rounded-lg bg-muted text-muted-foreground" style={{ width: size, height: size }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed URL Supabase, bukan aset statis
        <img src={src} alt="" width={size} height={size} loading="lazy" decoding="async" className="size-full object-cover" />
      ) : (
        <Camera aria-hidden className="size-5 opacity-60" />
      )}
    </div>
  );
}

export function ItemRow({ href, name, meta, status, tone = "ok", photo }: {
  href?: string; name: string; meta: string; status: string; tone?: Tone; photo?: string | null;
}) {
  return (
    <Card className={cn("relative flex-row items-center gap-3 p-3", href && "hover:bg-accent")}>
      <Thumb src={photo} />
      <div className="min-w-0 flex-1">
        {href ? (
          <Link href={href} className="block truncate text-base font-semibold after:absolute after:inset-0">{name}</Link>
        ) : (
          <p className="truncate text-base font-semibold">{name}</p>
        )}
        <p className="mt-1 font-mono text-xs text-muted-foreground">{meta}</p>
      </div>
      <Badge variant={tone}>{status}</Badge>
    </Card>
  );
}
