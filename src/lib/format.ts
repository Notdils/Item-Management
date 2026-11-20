const TZ = "Asia/Jakarta";

const dateTime = new Intl.DateTimeFormat("id-ID", {
  day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ,
});
const shortDateTime = new Intl.DateTimeFormat("id-ID", {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ,
});
const rtf = new Intl.RelativeTimeFormat("id-ID", { numeric: "auto" });

/** "19 Nov 2026, 04.12 WIB" */
export function fmtDateTime(d: string | Date) {
  return `${dateTime.format(new Date(d))} WIB`;
}
/** "19 Nov, 04.12" */
export function fmtShort(d: string | Date) {
  return shortDateTime.format(new Date(d));
}
/** "12 menit yang lalu", "kemarin", ... */
export function fmtAgo(d: string | Date, now = Date.now()) {
  const s = Math.round((new Date(d).getTime() - now) / 1000);
  const abs = Math.abs(s);
  if (abs < 60) return "baru saja";
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
  return rtf.format(Math.round(s / 86400), "day");
}
/** durasi singkat: "26 jam", "3 hari" */
export function fmtDuration(from: string | Date, now = Date.now()) {
  const h = Math.max(0, Math.floor((now - new Date(from).getTime()) / 3_600_000));
  if (h < 1) return "< 1 jam";
  if (h < 48) return `${h} jam`;
  return `${Math.floor(h / 24)} hari`;
}

export const HELD_LIMIT_HOURS = 12;

/** Pesan error Postgres/Supabase yang ramah. Pesan RPC kita sudah berbahasa Indonesia. */
export function errMessage(e: unknown) {
  if (e && typeof e === "object" && "message" in e && typeof e.message === "string") {
    if (e.message.includes("Failed to fetch")) return "Tidak ada koneksi. Coba lagi.";
    return e.message;
  }
  return "Terjadi kesalahan. Coba lagi.";
}

// Nama rak hanya ditampilkan kalau menambah informasi: "RAK-A" + "Rak A" cukup "RAK-A"
export function rackExtra(code: string | null | undefined, name: string | null | undefined): string | null {
  if (!name) return null;
  return name.trim().toUpperCase().replace(/\s+/g, "-") === code ? null : name;
}
export const rackLabel = (code: string, name?: string | null) => {
  const extra = rackExtra(code, name);
  return extra ? `${code} (${extra})` : code;
};
