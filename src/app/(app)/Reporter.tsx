"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressPhoto, photoExt } from "@/lib/image";
import { errMessage, fmtDateTime } from "@/lib/format";
import { Icon } from "@/components/Icon";
import type { ItemKind, ItemOption, Location, StockLevel } from "@/lib/types";

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

export function Reporter({ uid, isPlss, items, locations, stock, prefill }: {
  uid: string; isPlss: boolean; items: ItemOption[]; locations: Location[]; stock: StockLevel[]; prefill?: Prefill;
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
      className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} />
  );

  if (step === "start") {
    return (
      <div className="flex flex-col gap-5">
        {prefill && (
          <p className="card mono px-3.5 py-3 text-sm">
            {labelOf(prefill.action)}: <span className="text-green">{prefill.item}</span>
          </p>
        )}
        <label htmlFor={`${ids}-photo`}
          className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-green bg-surface px-4 py-11 text-center has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-green">
          {fileInput}
          <span className="grid size-[72px] place-items-center rounded-full bg-green text-green-ink">
            <Icon name="camera" size={32} />
          </span>
          <span className="text-lg font-bold">Ketuk untuk foto barang</span>
          <span className="mono text-[13px] text-ink-2">Waktu dan lokasi terisi otomatis</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="flex-1 text-sm text-ink-2">Lokasi aktif</span>
          <LocationChip location={location} />
          <button type="button" onClick={openForm} className="text-sm font-semibold text-green">Tanpa foto</button>
        </div>
        {done && <p role="status" className="card border border-green px-3.5 py-3 text-sm">Tersimpan. {done}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-[18px]">
      <div className="flex items-center gap-2">
        <button type="button" onClick={reset} className="-ml-2 grid size-11 place-items-center" aria-label="Batal">
          <Icon name="back" />
        </button>
        <h2 className="flex-1 text-[17px] font-semibold">Laporan baru</h2>
        <label htmlFor={`${ids}-photo`} className="cursor-pointer text-sm font-semibold text-green">
          {fileInput}
          {file ? "Foto ulang" : "Tambah foto"}
        </label>
      </div>

      <div className="grid aspect-[16/9] place-items-center overflow-hidden rounded-[14px] bg-surface-2 text-ink-2">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- preview blob lokal
          <img src={preview} alt="Foto barang yang akan dilaporkan" className="size-full object-cover" />
        ) : (
          <span className="mono text-xs">{kind === "ALAT" && effAction === "TARUH" ? "foto wajib untuk Taruh" : "foto opsional"}</span>
        )}
      </div>

      <div>
        <div className="mb-1.5 flex justify-between">
          <label htmlFor={`${ids}-name`} className="field-label mb-0">Nama barang</label>
          {name.trim().length >= 2 && (
            <span className="mono text-xs font-medium text-green">
              {isNew ? "BARANG BARU" : kind === "ALAT" ? "ALAT" : "HABIS PAKAI"}
            </span>
          )}
        </div>
        <input id={`${ids}-name`} className="input" list={`${ids}-items`} value={name}
          onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80}
          autoComplete="off" autoCapitalize="sentences" enterKeyHint="done" placeholder="mis. kunci ring 10 mm" />
        <datalist id={`${ids}-items`}>
          {items.map((i) => <option key={i.name_key} value={i.name} />)}
        </datalist>
        {isNew && !isPlss && (
          <p className="mt-1.5 text-xs text-ink-2">Nama belum ada. Cek daftar dulu supaya tidak dobel. Barang baru dicatat sebagai alat.</p>
        )}
      </div>

      {isNew && isPlss && (
        <fieldset className="segmented">
          <legend className="sr-only">Jenis barang baru</legend>
          <Seg name="newkind" value="ALAT" checked={newKind === "ALAT"} onChange={() => setNewKind("ALAT")} title="Alat" sub="dilacak per unit" />
          <Seg name="newkind" value="HABIS_PAKAI" checked={newKind === "HABIS_PAKAI"} onChange={() => setNewKind("HABIS_PAKAI")} title="Habis pakai" sub="dilacak jumlahnya" />
        </fieldset>
      )}

      {kind === "ALAT" ? (
        <fieldset className="segmented">
          <legend className="sr-only">Aksi</legend>
          <Seg name="action" value="TARUH" checked={effAction === "TARUH"} onChange={() => setAction("TARUH")} title="Taruh" sub="disimpan di rak" />
          <Seg name="action" value="AMBIL" checked={effAction === "AMBIL"} onChange={() => setAction("AMBIL")} title="Ambil" sub="saya bawa" />
        </fieldset>
      ) : (
        <>
          <fieldset className="segmented">
            <legend className="sr-only">Aksi stok</legend>
            <Seg name="saction" value="PAKAI" checked={effAction === "PAKAI"} onChange={() => setAction("PAKAI")} title="Pakai" sub="ambil dari stok" disabled={isNew} />
            <Seg name="saction" value="MASUK" checked={effAction === "MASUK"} onChange={() => setAction("MASUK")} title="Tambah" sub="khusus PLSS" disabled={!isPlss} />
          </fieldset>
          <div>
            <label htmlFor={`${ids}-qty`} className="field-label">Jumlah</label>
            <div className="flex items-center gap-3">
              <button type="button" className="btn btn-line w-14 px-0" aria-label="Kurangi" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                <Icon name="minus" size={22} />
              </button>
              <input id={`${ids}-qty`} className="mono w-0 flex-1 bg-transparent text-center text-4xl font-medium" inputMode="numeric"
                pattern="[0-9]*" value={qty} onChange={(e) => setQty(Math.min(99999, Number(e.target.value.replace(/\D/g, "")) || 0))} />
              <button type="button" className="btn btn-line w-14 px-0" aria-label="Tambah" onClick={() => setQty((q) => q + 1)}>
                <Icon name="plus" size={22} />
              </button>
            </div>
          </div>
          {isNew && (
            <div>
              <label htmlFor={`${ids}-unit`} className="field-label">Satuan</label>
              <input id={`${ids}-unit`} className="input" value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={12} />
            </div>
          )}
          {currentStock !== null && (
            <p className="card flex justify-between px-3.5 py-3 text-sm">
              <span className="text-ink-2">Sisa di {location?.code}</span>
              <span className="mono">
                {currentStock} → {currentStock + (effAction === "PAKAI" ? -qty : qty)} {match?.unit ?? ""}
              </span>
            </p>
          )}
        </>
      )}

      <div className="flex flex-col gap-3.5 rounded-xl border border-line p-3.5">
        {needsLocation && (
          <div className="flex items-center gap-2.5">
            <Icon name="pin" size={18} className="text-ink-2" />
            <div className="flex-1">
              <label htmlFor={`${ids}-loc`} className="field-label mb-0.5">Lokasi</label>
              <select id={`${ids}-loc`} value={locationId ?? ""} onChange={(e) => setLocationId(Number(e.target.value))}
                className="mono w-full bg-transparent text-[15px] font-medium" required>
                {locations.length === 0 && <option value="">Belum ada lokasi. Minta PLSS menambahkan.</option>}
                {locations.map((l) => <option key={l.id} value={l.id} className="bg-surface">{l.code} · {l.name}</option>)}
              </select>
            </div>
          </div>
        )}
        <AutoRow icon="clock" label="Waktu · otomatis" value={fmtDateTime(takenAt)} />
        {kind === "ALAT" && (
          <AutoRow icon="gps" label="GPS · otomatis" value={
            gps.state === "ok" ? `${gps.lat!.toFixed(4)}, ${gps.lng!.toFixed(4)} ±${Math.round(gps.acc!)} m`
            : gps.state === "loading" ? "mencari..." : "tidak tersedia"} />
        )}
      </div>

      <div>
        <label htmlFor={`${ids}-note`} className="field-label">Catatan (opsional)</label>
        <input id={`${ids}-note`} className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={280}
          placeholder={effAction === "TARUH" ? "mis. laci kedua" : ""} enterKeyHint="done" />
      </div>

      <p role="alert" aria-live="assertive" className="text-sm text-danger empty:hidden">{error}</p>

      <div className="sticky bottom-[calc(var(--tabbar-h)+0.75rem+env(safe-area-inset-bottom))] z-10">
        <button type="submit" className="btn btn-primary w-full" disabled={busy}>
          {busy ? "Mengirim..." : "Kirim laporan"}
        </button>
      </div>
    </form>
  );
}

function labelOf(a: Action) {
  return { TARUH: "Taruh", AMBIL: "Ambil", PAKAI: "Pakai", MASUK: "Tambah stok" }[a];
}

function Seg({ name, value, checked, onChange, title, sub, disabled }: {
  name: string; value: string; checked: boolean; onChange: () => void; title: string; sub: string; disabled?: boolean;
}) {
  return (
    <label>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} disabled={disabled} />
      <span className="text-[15px] font-semibold">{title}</span>
      <small className="text-[11px]">{sub}</small>
    </label>
  );
}

function AutoRow({ icon, label, value }: { icon: "clock" | "gps"; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon name={icon} size={18} className="text-ink-2" />
      <div>
        <p className="field-label mb-0.5">{label}</p>
        <p className="mono text-[15px] font-medium">{value}</p>
      </div>
    </div>
  );
}

function LocationChip({ location }: { location: Location | null }) {
  return (
    <span className="mono inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 py-2 pl-2.5 pr-3 text-[13px] font-medium">
      <Icon name="pin" size={16} className="text-green" />
      {location ? `${location.code}` : "-"}
    </span>
  );
}
