# Penyesuaian desain Figma "Bengkel" di atas komponen shadcn (new-york-v4).
# Jalankan setelah `npx shadcn@latest add ...`: python scripts/customize-ui.py src/components/ui
# Idempoten: aman dijalankan ulang. Juga mengganti import `from "cn"` (bug CLI) ke `@/lib/utils`.
import sys, os
ui = sys.argv[1]
# CLI kadang menulis `from "cn"` (bukan alias utils) dan memasang paket npm `cn` yang tidak terkait. Perbaiki import-nya.
for _f in os.listdir(ui):
    if _f.endswith('.tsx'):
        _p = os.path.join(ui, _f); _s = open(_p).read()
        if 'from "cn"' in _s: open(_p, 'w').write(_s.replace('from "cn"', 'from "@/lib/utils"')); print("import cn diperbaiki:", _f)
def ed(f, pairs, optional=False):
    p = os.path.join(ui, f)
    if not os.path.exists(p): print("lewati (tidak ada):", f); return
    s = open(p).read()
    for a, b in pairs:
        if b in s: continue
        if a not in s:
            print(f"!! pola tidak ditemukan di {f}: {a[:70]}"); continue
        s = s.replace(a, b)
    if f == 'card.tsx': s = s.replace(' px-6', '').replace('cn("px-6", className)', 'cn(className)')
    open(p, 'w').write(s); print("ok", f)

ed('button.tsx', [
 ('inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium', 'inline-flex shrink-0 items-center justify-center gap-2 rounded-[10px] text-sm font-semibold'),
 ('default: "h-9 px-4 py-2 has-[>svg]:px-3",', '// Figma: 52px untuk aksi utama (target sentuh), 40px untuk aksi di tabel\n        default: "h-13 px-5 text-base has-[>svg]:px-4",'),
 ('sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",', 'sm: "h-10 gap-1.5 px-4 has-[>svg]:px-3",'),
 ('"border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50"', '"border bg-transparent hover:bg-accent hover:text-accent-foreground"'),
])
ed('input.tsx', [
 ('"h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs', '"h-13 w-full min-w-0 rounded-[10px] border border-input bg-card px-3.5 py-1 text-base'),
 (' md:text-sm dark:bg-input/30",', '",'),
])
ed('native-select.tsx', [
 ('"group/native-select relative w-fit has-[select:disabled]:opacity-50"', '"group/native-select relative w-full has-[select:disabled]:opacity-50"'),
 ('"h-9 w-full min-w-0 appearance-none rounded-md border border-input bg-transparent px-3 py-2 pr-9 text-sm shadow-xs', '"h-13 w-full min-w-0 appearance-none rounded-[10px] border border-input bg-card px-3.5 py-2 pr-10 text-base'),
 (' data-[size=sm]:h-8 data-[size=sm]:py-1 dark:bg-input/30 dark:hover:bg-input/50",', ' data-[size=sm]:h-10 data-[size=sm]:py-1",'),
])
ed('card.tsx', [
 ('"flex flex-col gap-6 rounded-xl border bg-card py-6 text-card-foreground shadow-sm"', '"flex flex-col gap-3.5 rounded-xl bg-card p-4 text-card-foreground"'),
])
ed('table.tsx', [
 ('className="relative w-full overflow-x-auto"', 'className="relative w-full overflow-x-auto rounded-xl bg-card"'),
 ('"h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground', '"h-11 px-4 text-left align-middle font-mono text-xs font-medium whitespace-nowrap uppercase text-muted-foreground'),
 ('"p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]', '"px-4 py-3 align-middle [&:has([role=checkbox])]'),
])
ed('alert.tsx', [
 ('        destructive:\n          "bg-card text-destructive', '        // Figma: kartu bergaris hijau (berhasil) / kuning (peringatan)\n        success: "border-primary bg-card text-card-foreground",\n        warning: "border-warn bg-card text-card-foreground",\n        destructive:\n          "bg-card text-destructive'),
])
ed('field.tsx', [
 ('"group/field-label peer/field-label flex w-fit gap-2 leading-snug group-data-[disabled=true]/field:opacity-50",', '// Figma: label form mono, huruf besar, abu\n        "group/field-label peer/field-label flex w-fit gap-2 font-mono text-xs leading-snug font-medium uppercase text-muted-foreground group-data-[disabled=true]/field:opacity-50",'),
 ('"group/field flex w-full gap-3 data-[invalid=true]:text-destructive"', '"group/field flex w-full gap-1.5 data-[invalid=true]:text-destructive"'),
])
ed('badge.tsx', [
 ('        link: "text-primary underline-offset-4 [a&]:hover:underline",', '        link: "text-primary underline-offset-4 [a&]:hover:underline",\n        // Figma: label status mono tanpa latar (DI RAK, DIPEGANG, > 12 JAM)\n        ok: "rounded-none px-0 py-0 font-mono text-[11px] uppercase text-primary",\n        warn: "rounded-none px-0 py-0 font-mono text-[11px] uppercase text-warn",\n        muted: "rounded-none px-0 py-0 font-mono text-[11px] uppercase text-muted-foreground",'),
])
ed('toggle.tsx', [
 ('        outline:\n          "border border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground",', '        outline:\n          "border border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground",\n        // Figma: segmented control (Taruh/Ambil, Pakai/Tambah); item aktif hijau\n        segmented:\n          "h-auto min-h-13 flex-col gap-0.5 rounded-[9px] bg-transparent py-2 hover:bg-accent data-[state=on]:bg-primary data-[state=on]:text-primary-foreground",'),
])
ed('toggle-group.tsx', [
 ('"group/toggle-group flex w-fit items-center gap-[--spacing(var(--gap))] rounded-md data-[spacing=default]:data-[variant=outline]:shadow-xs",', '"group/toggle-group flex w-fit items-center gap-[--spacing(var(--gap))] rounded-md data-[spacing=default]:data-[variant=outline]:shadow-xs",\n        "data-[variant=segmented]:w-full data-[variant=segmented]:rounded-xl data-[variant=segmented]:border data-[variant=segmented]:bg-card data-[variant=segmented]:p-1",'),
 ('"w-auto min-w-0 shrink-0 px-3 focus:z-10 focus-visible:z-10",', '"w-auto min-w-0 shrink-0 px-3 focus:z-10 focus-visible:z-10 data-[variant=segmented]:flex-1",'),
])
