import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { OnboardingSteps } from "@/components/vendor/onboarding-steps";
import { requireRole } from "@/lib/auth";
import { signOut } from "@/lib/auth-actions";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="p-6 text-ink/60">Laden…</p>}>
      <OnboardingShell>{children}</OnboardingShell>
    </Suspense>
  );
}

async function OnboardingShell({ children }: { children: React.ReactNode }) {
  const profile = await requireRole("vendor");

  return (
    <div className="flex flex-1 flex-col bg-brand-soft">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-5">
        <Link href="/leverancier/aanmelden" className="flex items-center gap-3">
          <Logo /> <span className="text-sm font-semibold text-brand">Aanmelden als partner</span>
        </Link>
        <form action={signOut} className="flex items-center gap-4 text-sm">
          <span className="hidden text-ink/60 sm:inline">{profile.full_name}</span>
          <button className="rounded-full border border-ink/15 bg-white px-4 py-2 font-medium hover:border-brand hover:text-brand">
            Uitloggen
          </button>
        </form>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        <OnboardingSteps />
        {children}
      </main>
    </div>
  );
}
