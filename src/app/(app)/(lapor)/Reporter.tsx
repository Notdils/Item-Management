"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressPhoto, photoExt } from "@/lib/image";
import { errMessage, fmtDateTime } from "@/lib/format";
import type { ItemKind, ItemOption, Location, StockLevel } from "@/lib/types";
import { Camera, ChevronDown, ChevronLeft, Clock, LocateFixed, MapPin, Minus, Plus, type LucideIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type Action = "TARUH" | "AMBIL" | "PAKAI" | "MASUK";
export type Prefill = { item: string; action: Exclude<Action, "MASUK"> };

type Gps = { state: "idle" | "loading" | "ok" | "off"; lat?: number; lng?: number; acc?: number };

const LAST_LOC_KEY = "bengkel-last-location";
const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

function readLastLocation(): number | null {
  try {
    const v = Number(localStorage.getItem(LAST_LOC_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}
function saveLastLocation(id: number) {
  try {
    localStorage.setItem(LAST_LOC_KEY, String(id));
  } catch {
    /* mode privat: abaikan */
  }
}

export function Reporter({ uid, isPlss, items, locations, stock, prefill, header, aside }: {
  uid: string; isPlss: boolean; items: ItemOption[]; locations: Location[]; stock: StockLevel[]; prefill?: Prefill;
  header?: React.ReactNode; aside?: React.ReactNode;
}) {
  const router = useRouter();
  const ids = useId();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"start" | "form">("start");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [takenAt, setTakenAt] = useState<Date>(() => new Date());
  const [gps, setGps] = useState<Gps>({ state: "idle" });

  const [name, setName] = useState(prefill?.item ?? "");
  const [newKind, setNewKind] = useState<ItemKind>("ALAT");
  const [action, setAction] = useState<Action>(prefill?.action ?? "TARUH");
  const [locationId, setLocationId] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const [unit, setUnit] = useState("pcs");
  const [note, setNote] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // Lokasi default = rak terakhir yang dipilih di HP ini
  useEffect(() => {
    const last = readLastLocation();
    setLocationId(last && locations.some((l) => l.id === last) ? last : locations[0]?.id ?? null);
  }, [locations]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const match = useMemo(() => items.find((i) => i.name_key === norm(name)), [items, name]);
  const isNew = name.trim().length >= 2 && !match;
  const kind: ItemKind = match?.kind ?? (isPlss ? newKind : "ALAT");

  // Aksi harus cocok dengan jenis barang
  const effAction: Action =
    kind === "ALAT" ? (action === "AMBIL" ? "AMBIL" : "TARUH")
    : action === "MASUK" || (isNew && isPlss) ? "MASUK" : "PAKAI";
  const needsLocation = effAction !== "AMBIL";
  const location = locations.find((l) => l.id === locationId) ?? null;
  const currentStock = kind === "HABIS_PAKAI" && match && locationId
    ? stock.find((s) => s.item_id === match.id && s.location_id === locationId)?.qty ?? 0
    : null;

  function requestGps() {
    if (!("geolocation" in navigator)) return setGps({ state: "off" });
    setGps({ state: "loading" });
    navigator.geolocation.getCurrentPosition(
      (p) => setGps({ state: "ok", lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
      () => setGps({ state: "off" }),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  function onPhoto(f: File | undefined) {
    if (!f) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    // Waktu otomatis: saat foto diambil. File dari galeri yang lebih lama dari 7 hari ditolak server.
    const lm = f.lastModified;
    setTakenAt(lm && Date.now() - lm < 6 * 86_400_000 && lm <= Date.now() ? new Date(lm) : new Date());
    openForm();
  }

  function openForm() {
    setError(null);
    setDone(null);
    setStep("form");
    if (gps.state === "idle") requestGps();
  }

  function reset() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setName("");
    setQty(1);
    setNote("");
    setAction("TARUH");
    setStep("start");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError("Isi nama barang.");
    if (needsLocation && !locationId) return setError("Pilih lokasi.");
    if (kind === "ALAT" && effAction === "TARUH" && !file) return setError("Barang yang ditaruh wajib difoto.");
    if (kind === "HABIS_PAKAI" && (!Number.isInteger(qty) || qty < 1)) return setError("Jumlah minimal 1.");

    setBusy(true);
    const supabase = createClient();
    try {
      let photoPath: string | null = null;
      if (file) {
        const blob = await compressPhoto(file);
        photoPath = `${uid}/${crypto.randomUUID()}.${photoExt(blob)}`;
        const up = await supabase.storage.from("photos").upload(photoPath, blob, { contentType: blob.type });
        if (up.error) throw up.error;
      }
      const common = { p_item_name: name, p_photo_path: photoPath, p_taken_at: takenAt.toISOString(), p_note: note || null };
      if (kind === "ALAT") {
        const { error } = await supabase.rpc("report_item", {
          ...common, p_kind: effAction, p_location_id: effAction === "TARUH" ? locationId : null,
          p_lat: gps.lat ?? null, p_lng: gps.lng ?? null, p_accuracy_m: gps.acc ?? null,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc("move_stock", {
          ...common, p_kind: effAction, p_location_id: locationId, p_qty: qty, p_unit: isNew ? unit : null,
        });
        if (error) throw error;
      }
      if (locationId && needsLocation) saveLastLocation(locationId);
      const where = effAction === "AMBIL" ? "kamu bawa" : location?.code;
      setDone(`${name.trim()}: ${labelOf(effAction).toLowerCase()} (${where}).`);
      reset();
      router.replace("/", { scroll: false });
      router.refresh();
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const fileInput = (
    <input ref={fileRef} id={`${ids}-photo`} type="file" accept="image/*" capture="environment"
      className="photo-input sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} />
  );

  if (step === "start") {
    return (
      <>
        {header}
        {fileInput}
        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-10">
          <div className="flex flex-col gap-4">
            {prefill && (
              <Alert>
                <AlertDescription>
                  <p>{labelOf(prefill.action)}: <span className="font-semibold text-primary">{prefill.item}</span></p>
                </AlertDescription>
              </Alert>
            )}
            {done && (
              <Alert variant="success" role="status">
                <AlertDescription><p className="text-foreground">Tersimpan. {done}</p></AlertDescription>
              </Alert>
            )}
            {/* Aksi utama: satu-satunya bidang hijau besar di layar */}
            <label htmlFor={`${ids}-photo`}
              className="photo-cta flex min-h-56 cursor-pointer flex-col justify-between gap-10 rounded-2xl bg-primary p-6 text-primary-foreground transition-[filter] hover:brightness-105 md:min-h-72 md:p-8 lg:min-h-80">
              <Camera aria-hidden className="size-10 md:size-12" strokeWidth={1.75} />
              <span className="flex flex-col gap-2">
                <span className="text-[34px] font-black leading-none tracking-tight md:text-5xl">Foto barang</span>
                <span className="text-[15px] font-medium opacity-75">
                  <span className="lg:hidden">Kamera langsung terbuka. Waktu dan rak terisi sendiri.</span>
                  <span className="hidden lg:inline">Pilih foto dari laptop atau pakai webcam. Waktu dan rak terisi sendiri.</span>
                </span>
              </span>
            </label>
            {/* Rak aktif: label, kode, dan nama dalam satu kartu; kode bisa diganti 1 ketukan */}
            <div className="flex flex-wrap items-end gap-x-4 gap-y-3 rounded-xl bg-card p-4">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <label htmlFor={`${ids}-rack`} className="text-sm text-muted-foreground">Ditaruh di rak</label>
                <div className="relative w-fit">
                  <select id={`${ids}-rack`} value={locationId ?? ""} disabled={locations.length === 0}
                    onChange={(e) => { const v = Number(e.target.value); setLocationId(v); saveLastLocation(v); }}
                    className="cursor-pointer appearance-none rounded-lg border-[1.5px] border-primary bg-transparent py-1.5 pr-10 pl-3 font-mono text-xl font-medium text-foreground">
                    {locations.length === 0 && <option value="">Belum ada rak</option>}
                    {locations.map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}
                  </select>
                  <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-primary" />
                </div>
                {location && <p className="text-sm text-muted-foreground">{location.name}</p>}
              </div>
              <Button type="button" variant="outline" onClick={openForm} className="w-full sm:w-auto">Lapor tanpa foto</Button>
            </div>
          </div>
          {aside}
        </div>
      </>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5 lg:grid lg:grid-cols-[480px_minmax(0,1fr)] lg:items-start lg:gap-x-8 lg:gap-y-6">
      {fileInput}
      <div className="flex items-center gap-2 lg:col-span-2">
        <Button type="button" variant="ghost" size="icon" onClick={reset} aria-label="Batal" className="-ml-2">
          <ChevronLeft />
        </Button>
        <h1 className="flex-1 text-2xl font-black tracking-tight">Laporan baru</h1>
        <Button asChild variant="outline" size="sm" className="lg:hidden">
          <label htmlFor={`${ids}-photo`}>{file ? "Foto ulang" : "Tambah foto"}</label>
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="relative grid aspect-video place-items-center overflow-hidden rounded-[14px] bg-muted text-muted-foreground lg:aspect-[4/3]">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- preview blob lokal
            <img src={preview} alt="Foto barang yang akan dilaporkan" className="absolute inset-0 size-full object-cover" />
          ) : (
            <span className="text-sm">{kind === "ALAT" && effAction === "TARUH" ? "Foto wajib untuk Taruh" : "Foto opsional"}</span>
          )}
        </div>
        <Button asChild variant="outline" size="sm" className="hidden w-fit lg:inline-flex">
          <label htmlFor={`${ids}-photo`}>{file ? "Foto ulang" : "Tambah foto"}</label>
        </Button>
      </div>

      <FieldGroup className="gap-5">
        <Field>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor={`${ids}-name`}>Nama barang</FieldLabel>
            {name.trim().length >= 2 && <Badge variant="ok">{isNew ? "Barang baru" : kind === "ALAT" ? "Alat" : "Habis pakai"}</Badge>}
          </div>
          <Input id={`${ids}-name`} list={`${ids}-items`} value={name}
            onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80}
            autoComplete="off" autoCapitalize="sentences" enterKeyHint="done" placeholder="mis. kunci ring 10 mm" />
          <datalist id={`${ids}-items`}>
            {items.map((i) => <option key={i.name_key} value={i.name} />)}
          </datalist>
          {isNew && !isPlss && (
            <FieldDescription>Nama belum ada. Cek daftar dulu supaya tidak dobel. Barang baru dicatat sebagai alat.</FieldDescription>
          )}
        </Field>

        {isNew && isPlss && (
          <Segmented label="Jenis barang baru" value={newKind} onChange={(v) => setNewKind(v as ItemKind)} options={[
            { value: "ALAT", title: "Alat", sub: "dilacak per unit" },
            { value: "HABIS_PAKAI", title: "Habis pakai", sub: "dilacak jumlahnya" },
          ]} />
        )}

        {kind === "ALAT" ? (
          <Segmented label="Aksi" value={effAction} onChange={(v) => setAction(v as Action)} options={[
            { value: "TARUH", title: "Taruh", sub: "disimpan di rak" },
            { value: "AMBIL", title: "Ambil", sub: "saya bawa" },
          ]} />
        ) : (
          <>
            <Segmented label="Aksi stok" value={effAction} onChange={(v) => setAction(v as Action)} options={[
              { value: "PAKAI", title: "Pakai", sub: "ambil dari stok", disabled: isNew },
              { value: "MASUK", title: "Tambah", sub: "khusus PLSS", disabled: !isPlss },
            ]} />
            <Field>
              <FieldLabel htmlFor={`${ids}-qty`}>Jumlah</FieldLabel>
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" size="icon" className="size-13" aria-label="Kurangi" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                  <Minus />
                </Button>
                <Input id={`${ids}-qty`} className="text-center font-mono" inputMode="numeric" pattern="[0-9]*" value={qty}
                  onChange={(e) => setQty(Math.min(99999, Number(e.target.value.replace(/\D/g, "")) || 0))} />
                <Button type="button" variant="outline" size="icon" className="size-13" aria-label="Tambah" onClick={() => setQty((q) => q + 1)}>
                  <Plus />
                </Button>
              </div>
            </Field>
            {isNew && (
              <Field>
                <FieldLabel htmlFor={`${ids}-unit`}>Satuan</FieldLabel>
                <Input id={`${ids}-unit`} value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={12} />
              </Field>
            )}
            {currentStock !== null && (
              <Card className="flex-row items-center justify-between px-3.5 py-3">
                <span className="text-sm text-muted-foreground">Sisa di {location?.code}</span>
                <span className="font-mono text-sm">
                  {currentStock} → {currentStock + (effAction === "PAKAI" ? -qty : qty)} {match?.unit ?? ""}
                </span>
              </Card>
            )}
          </>
        )}

        <FieldSet className="gap-3.5 rounded-xl border p-3.5">
          <FieldLegend className="sr-only">Data otomatis</FieldLegend>
          {needsLocation && (
            <Field>
              <FieldLabel htmlFor={`${ids}-loc`}><MapPin aria-hidden className="size-4" /> Lokasi</FieldLabel>
              <NativeSelect id={`${ids}-loc`} value={locationId ?? ""} onChange={(e) => setLocationId(Number(e.target.value))} required>
                {locations.length === 0 && <NativeSelectOption value="">Belum ada lokasi. Minta PLSS menambahkan.</NativeSelectOption>}
                {locations.map((l) => <NativeSelectOption key={l.id} value={l.id}>{l.code} ({l.name})</NativeSelectOption>)}
              </NativeSelect>
            </Field>
          )}
          <AutoRow icon={Clock} label="Waktu, otomatis" value={fmtDateTime(takenAt)} />
          {kind === "ALAT" && (
            <AutoRow icon={LocateFixed} label="GPS, otomatis" value={
              gps.state === "ok" ? `${gps.lat!.toFixed(4)}, ${gps.lng!.toFixed(4)} ±${Math.round(gps.acc!)} m`
              : gps.state === "loading" ? "mencari..." : "tidak tersedia"} />
          )}
        </FieldSet>

        <Field>
          <FieldLabel htmlFor={`${ids}-note`}>Catatan (opsional)</FieldLabel>
          <Input id={`${ids}-note`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={280}
            placeholder={effAction === "TARUH" ? "mis. laci kedua" : ""} enterKeyHint="done" />
        </Field>

        <div aria-live="assertive">
          {error && (
            <Alert variant="destructive"><AlertDescription><p>{error}</p></AlertDescription></Alert>
          )}
        </div>

        {/* Mobile: tombol menempel di atas tab bar. Tablet/desktop: baris aksi biasa */}
        <div className="sticky bottom-[calc(var(--tabbar-h)+0.75rem+env(safe-area-inset-bottom))] z-10 md:static md:flex md:justify-end md:gap-3">
          <Button type="button" onClick={reset} variant="outline" className="hidden md:inline-flex md:w-40">Batal</Button>
          <Button type="submit" disabled={busy} className="w-full md:w-[220px]">
            {busy && <Spinner data-icon="inline-start" />}
            {busy ? "Mengirim..." : "Kirim laporan"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}

function labelOf(a: Action) {
  return { TARUH: "Taruh", AMBIL: "Ambil", PAKAI: "Pakai", MASUK: "Tambah stok" }[a];
}

// Pilihan 2 opsi memakai ToggleGroup (aturan shadcn), tampil sebagai segmented control Figma
function Segmented({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; title: string; sub: string; disabled?: boolean }[];
}) {
  return (
    <ToggleGroup type="single" variant="segmented" spacing={1} aria-label={label} value={value}
      onValueChange={(v) => v && onChange(v)}>
      {options.map((o) => (
        <ToggleGroupItem key={o.value} value={o.value} disabled={o.disabled}>
          <span className="text-[15px] font-semibold">{o.title}</span>
          <span className="text-[11px] opacity-75">{o.sub}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function AutoRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon aria-hidden className="size-[18px] text-muted-foreground" />
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-mono text-[15px] font-medium">{value}</p>
      </div>
    </div>
  );
}
