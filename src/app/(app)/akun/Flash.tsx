import Link from "next/link";

export function Flash({ pesan, galat }: { pesan?: string; galat?: string }) {
  if (!pesan && !galat) return null;
  return (
    <p role={galat ? "alert" : "status"}
      className={`card border px-3.5 py-3 text-sm ${galat ? "border-danger text-danger" : "border-green"}`}>
      {galat ?? pesan}
    </p>
  );
}

export function AdminHead({ title, eyebrow = "PLSS · Admin data" }: { title: string; eyebrow?: string }) {
  return (
    <header className="flex flex-col gap-1.5">
      <Link href="/akun" className="mono inline-flex w-fit items-center text-xs text-ink-2">← Akun</Link>
      <p className="eyebrow text-green">{eyebrow}</p>
      <h1 className="title">{title}</h1>
    </header>
  );
}
