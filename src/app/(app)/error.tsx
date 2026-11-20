"use client";

import { useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

// Error di halaman aplikasi: tampilkan pesan + kode (digest) yang bisa dicari di log Vercel
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <Alert variant="destructive" className="gap-y-3 p-4">
      <AlertTitle className="text-lg font-bold text-foreground">Halaman gagal dimuat</AlertTitle>
      <AlertDescription>
        <p>Coba lagi. Kalau masih gagal, kirim kode di bawah ke admin.</p>
        <p className="font-mono text-xs break-all text-destructive">{error.digest ? `Kode: ${error.digest}` : error.message}</p>
      </AlertDescription>
      <Button type="button" onClick={reset} className="col-start-2">Coba lagi</Button>
    </Alert>
  );
}
