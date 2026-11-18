export type Division = "TEKNIKAL" | "PLSS";
export type ItemKind = "ALAT" | "HABIS_PAKAI";
export type ReportKind = "TARUH" | "AMBIL";
export type StockKind = "MASUK" | "PAKAI" | "OPNAME";

export type Profile = { id: string; full_name: string; division: Division };
export type Location = { id: number; code: string; name: string; archived_at: string | null };

export type ItemOverview = {
  id: number;
  name: string;
  name_key: string;
  kind: ItemKind;
  unit: string | null;
  last_kind: ReportKind | null;
  location_code: string | null;
  location_name: string | null;
  user_name: string | null;
  photo_path: string | null;
  reported_at: string | null;
  qty_total: number | null;
  location_count: number | null;
};

export type HeldItem = {
  item_id: number;
  name: string;
  user_id: string;
  user_name: string;
  photo_path: string | null;
  reported_at: string;
  overdue: boolean;
};

export type StockLevel = {
  item_id: number;
  name: string;
  unit: string | null;
  location_id: number;
  location_code: string;
  location_name: string;
  qty: number;
  last_move_at: string;
};

// Data ringan untuk form lapor (autocomplete + sisa stok)
export type ItemOption = { id: number; name: string; name_key: string; kind: ItemKind; unit: string | null };
