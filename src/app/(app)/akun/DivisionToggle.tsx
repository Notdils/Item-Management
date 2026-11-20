"use client";

import { useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

// ToggleGroup tidak mengirim nilai lewat form, jadi nilainya disalin ke input tersembunyi.
// Anggota teknikal wajib punya divisi tim (Mechanical / Electrical); PLSS tidak.
export function DivisionToggle() {
  const [division, setDivision] = useState("TEKNIKAL");
  const [team, setTeam] = useState("MECHANICAL");
  return (
    <div className="flex flex-col gap-2">
      <ToggleGroup type="single" variant="segmented" spacing={1} aria-label="Divisi" value={division} onValueChange={(v) => v && setDivision(v)}>
        <ToggleGroupItem value="TEKNIKAL"><span className="text-[15px] font-semibold">Teknikal</span></ToggleGroupItem>
        <ToggleGroupItem value="PLSS"><span className="text-[15px] font-semibold">PLSS</span></ToggleGroupItem>
      </ToggleGroup>
      {division === "TEKNIKAL" && (
        <ToggleGroup type="single" variant="segmented" spacing={1} aria-label="Divisi tim teknikal" value={team} onValueChange={(v) => v && setTeam(v)}>
          <ToggleGroupItem value="MECHANICAL"><span className="text-[15px] font-semibold">Mechanical</span></ToggleGroupItem>
          <ToggleGroupItem value="ELECTRICAL"><span className="text-[15px] font-semibold">Electrical</span></ToggleGroupItem>
        </ToggleGroup>
      )}
      <input type="hidden" name="division" value={division} />
      <input type="hidden" name="team" value={division === "TEKNIKAL" ? team : ""} />
    </div>
  );
}
