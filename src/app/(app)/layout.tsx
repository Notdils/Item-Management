import { TabBar } from "@/components/TabBar";
import { Sidebar, TopBar } from "@/components/Sidebar";
import { requireProfile } from "@/lib/session";

// Mobile: tab bar bawah · Tablet (md): top bar + tab bar · Desktop (lg): sidebar kiri
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const p = await requireProfile();
  return (
    <div className="lg:flex">
      <Sidebar name={p.full_name} division={p.division} />
      <div className="min-w-0 flex-1">
        <TopBar name={p.full_name} division={p.division} />
        <main className="mx-auto flex max-w-md flex-col gap-5 px-4 pt-[max(3.5rem,env(safe-area-inset-top))] pb-[calc(var(--tabbar-h)+2rem+env(safe-area-inset-bottom))] md:max-w-[800px] md:gap-6 md:px-12 md:pt-8 lg:max-w-[1120px] lg:pb-16 lg:pt-12">
          {children}
        </main>
      </div>
      <TabBar />
    </div>
  );
}
