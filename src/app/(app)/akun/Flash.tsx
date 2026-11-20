import Link from "next/link";
import { ChevronLeft, CircleAlert, CircleCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LinkPending } from "@/components/Pending";
import { FlashFocus } from "./FlashFocus";

// Pesan hasil aksi server (?pesan= / ?galat=)
export function Flash({ pesan, galat }: { pesan?: string; galat?: string }) {
  if (!pesan && !galat) return null;
  return (
    <FlashFocus>
      <Alert variant={galat ? "destructive" : "success"} role={galat ? "alert" : "status"}>
        {galat ? <CircleAlert aria-hidden /> : <CircleCheck aria-hidden className="text-primary" />}
        <AlertDescription><p className={galat ? undefined : "text-foreground"}>{galat ?? pesan}</p></AlertDescription>
      </Alert>
    </FlashFocus>
  );
}

export function AdminHead({ title, eyebrow = "PLSS, admin data" }: { title: string; eyebrow?: string }) {
  return (
    <header className="flex flex-col gap-1.5">
      <Link href="/akun" className="inline-flex min-h-8 w-fit items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground">
        <LinkPending><ChevronLeft aria-hidden className="size-4" /></LinkPending>Akun
      </Link>
      <p className="eyebrow text-muted-foreground">{eyebrow}</p>
      <h1 className="title">{title}</h1>
    </header>
  );
}
