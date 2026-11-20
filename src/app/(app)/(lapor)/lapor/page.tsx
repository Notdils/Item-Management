import type { Metadata } from "next";
import { LaporScreen } from "../LaporScreen";

export const metadata: Metadata = { title: "Lapor barang" };

export default async function LaporPage({ searchParams }: { searchParams: Promise<{ item?: string; aksi?: string }> }) {
  return <LaporScreen sp={await searchParams} />;
}
