import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { requireRole } from "@/lib/auth";
import { signOut } from "@/lib/auth-actions";
import Link from "next/link";

export default function AccountLayout({ children }: LayoutProps<"/account">) {
  return (
    <Suspense fallback={<p className="p-6 text-ink/60">Laden…</p>}>
      <AccountShell>{children}</AccountShell>
    </Suspense>
  );
}

async function AccountShell({ children }: { children: React.ReactNode }) {
  const profile = await requireRole("customer");

  return (
    <>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" aria-label="MinaMeet, naar de homepage">
          <Logo />
        </Link>
        <form action={signOut} className="flex items-center gap-4 text-sm">
          <span className="text-ink/60">{profile.full_name}</span>
          <button className="rounded-full border border-ink/15 px-4 py-2 font-medium hover:border-brand hover:text-brand">
            Uitloggen
          </button>
        </form>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </>
  );
}
