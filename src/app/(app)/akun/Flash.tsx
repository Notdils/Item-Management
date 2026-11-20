import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Pesan hasil aksi server (?pesan= / ?galat=)
export function Flash({ pesan, galat }: { pesan?: string; galat?: string }) {
  if (!pesan && !galat) return null;
  return (
    <Alert variant={galat ? "destructive" : "success"} role={galat ? "alert" : "status"}>
      <AlertDescription><p className={galat ? undefined : "text-foreground"}>{galat ?? pesan}</p></AlertDescription>
    </Alert>
  );
}

export function AdminHead({ title, eyebrow = "PLSS, admin data" }: { title: string; eyebrow?: string }) {
  return (
    <header className="flex flex-col gap-1.5">
      <Link href="/akun" className="inline-flex min-h-8 w-fit items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft aria-hidden className="size-4" />Akun
      </Link>
      <p className="eyebrow text-muted-foreground">{eyebrow}</p>
      <h1 className="title">{title}</h1>
    </header>
  );
}
