"use client";

// Error di layout akar: gaya inline karena CSS aplikasi mungkin tidak termuat
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="id">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#e3e4df", color: "#1c1f1e", fontFamily: "system-ui, sans-serif", padding: 24 }}>
        <div role="alert" style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 22 }}>Aplikasi gagal dimuat</h1>
          <p style={{ opacity: 0.7, fontSize: 14 }}>{error.digest ? `Kode: ${error.digest}` : error.message}</p>
          <button type="button" onClick={reset} style={{ minHeight: 48, padding: "0 20px", border: 0, borderRadius: 10, background: "#1c1f1e", color: "#f6f6f2", fontWeight: 600 }}>
            Coba lagi
          </button>
        </div>
      </body>
    </html>
  );
}
