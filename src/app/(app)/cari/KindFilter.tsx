"use client";

import { useRouter } from "next/navigation";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const OPTIONS = [
  { value: "semua", label: "Semua" },
  { value: "ALAT", label: "Alat" },
  { value: "HABIS_PAKAI", label: "Habis pakai" },
];

// Filter jenis barang (opsi 2-7 = ToggleGroup). Nilai disimpan di URL supaya bisa dibagikan.
export function KindFilter({ q, jenis }: { q: string; jenis: string }) {
  const router = useRouter();
  return (
    <ToggleGroup type="single" variant="outline" spacing={2} aria-label="Filter jenis" value={jenis || "semua"}
      onValueChange={(v) => {
        if (!v) return;
        const p = new URLSearchParams({ ...(q && { q }), ...(v !== "semua" && { jenis: v }) });
        router.push(`/cari${p.size ? `?${p}` : ""}`);
      }}>
      {OPTIONS.map((o) => <ToggleGroupItem key={o.value} value={o.value}>{o.label}</ToggleGroupItem>)}
    </ToggleGroup>
  );
}
