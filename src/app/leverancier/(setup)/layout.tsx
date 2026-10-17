import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { SetupProgress } from "@/components/setup/setup-progress";
import { requireRole } from "@/lib/auth";
import { completeSetup } from "@/lib/setup-actions";
import { getVendor } from "@/lib/vendor";

export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="p-6 text-ink/60">Laden…</p>}>
      <SetupShell>{children}</SetupShell>
    </Suspense>
  );
}

async function SetupShell({ children }: { children: React.ReactNode }) {
  await requireRole("vendor");
  const { vendor } = await getVendor();
  // De assistent is voor de eerste keer; daarna of voor bestaande partners gaat alles naar het dashboard.
  if (vendor.setup_completed_at || vendor.status !== "draft") redirect("/leverancier/dashboard");

  return (
    <div className="flex flex-1 flex-col bg-brand-soft">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-5">
        <Logo />
        <form action={completeSetup}>
          <button className="text-sm font-semibold text-ink/60 underline hover:text-brand">Later afmaken</button>
        </form>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 pb-12">
        <SetupProgress />
        <div className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8">{children}</div>
      </main>
    </div>
  );
}
