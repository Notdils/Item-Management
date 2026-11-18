import { TabBar } from "@/components/TabBar";
import { requireProfile } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireProfile();
  return (
    <>
      <main className="mx-auto flex max-w-md flex-col gap-5 px-4 pt-[max(3.5rem,env(safe-area-inset-top))] pb-[calc(var(--tabbar-h)+2rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <TabBar />
    </>
  );
}
