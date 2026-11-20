import { requireProfile } from "@/lib/session";
import { LaporScreen } from "./LaporScreen";
import { PlssBoard } from "./PlssBoard";

// Beranda: PLSS melihat papan barang yang perlu ditindaklanjuti, teknikal langsung ke layar lapor.
export default async function Home({ searchParams }: { searchParams: Promise<{ item?: string; aksi?: string }> }) {
  const sp = await searchParams;
  const profile = await requireProfile();
  if (profile.division === "PLSS" && !sp.item) return <PlssBoard />;
  return <LaporScreen sp={sp} />;
}
