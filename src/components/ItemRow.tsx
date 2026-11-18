import Link from "next/link";
import { Icon } from "./Icon";

type Tone = "green" | "warn" | "muted";
const TONE: Record<Tone, string> = { green: "text-green", warn: "text-warn", muted: "text-ink-2" };

export function Thumb({ src, size = 56 }: { src?: string | null; size?: number }) {
  return (
    <div className="grid shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-2 text-[#5b6764]"
      style={{ width: size, height: size }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed URL Supabase, bukan aset statis
        <img src={src} alt="" width={size} height={size} loading="lazy" decoding="async" className="size-full object-cover" />
      ) : (
        <Icon name="camera" size={20} />
      )}
    </div>
  );
}

export function ItemRow({ href, name, meta, status, tone = "green", photo }: {
  href?: string; name: string; meta: string; status: string; tone?: Tone; photo?: string | null;
}) {
  const body = (
    <>
      <Thumb src={photo} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold">{name}</p>
        <p className="mono mt-1 text-xs text-ink-2">{meta}</p>
      </div>
      <span className={`mono shrink-0 text-[11px] font-medium uppercase ${TONE[tone]}`}>{status}</span>
    </>
  );
  const cls = "card flex items-center gap-3 p-3";
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}
