import { TabBar } from "@/components/TabBar";
import { Sidebar, TopBar } from "@/components/Sidebar";
import { requireProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

// Mobile: tab bar bawah · Tablet (md): top bar + tab bar · Desktop (lg): sidebar kiri
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const p = await requireProfile();
  // Jumlah alat lewat 12 jam: badge navigasi untuk PLSS
  let overdue = 0;
  if (p.division === "PLSS") {
    const supabase = await createClient();
    const { count } = await supabase.from("held_items").select("item_id", { count: "exact", head: true }).eq("overdue", true);
    overdue = count ?? 0;
  }
  return (
    <div className="lg:flex">
      <Sidebar name={p.full_name} division={p.division} overdue={overdue} />
      <div className="min-w-0 flex-1">
        <TopBar name={p.full_name} division={p.division} />
        <main className="mx-auto flex max-w-md flex-col gap-5 px-4 pt-[max(3.5rem,env(safe-area-inset-top))] pb-[calc(var(--tabbar-h)+2rem+env(safe-area-inset-bottom))] md:max-w-[800px] md:gap-6 md:px-12 md:pt-8 lg:max-w-[1120px] lg:pb-16 lg:pt-12">
          {children}
        </main>
      </div>
      <TabBar division={p.division} overdue={overdue} />
    </div>
  );
}
