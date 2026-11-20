"use client";

import { useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

// ToggleGroup tidak mengirim nilai lewat form, jadi nilainya disalin ke input tersembunyi
export function DivisionToggle({ name = "division" }: { name?: string }) {
  const [value, setValue] = useState("TEKNIKAL");
  return (
    <>
      <ToggleGroup type="single" variant="segmented" spacing={1} aria-label="Divisi" value={value} onValueChange={(v) => v && setValue(v)}>
        <ToggleGroupItem value="TEKNIKAL"><span className="text-[15px] font-semibold">Teknikal</span></ToggleGroupItem>
        <ToggleGroupItem value="PLSS"><span className="text-[15px] font-semibold">PLSS</span></ToggleGroupItem>
      </ToggleGroup>
      <input type="hidden" name={name} value={value} />
    </>
  );
}
