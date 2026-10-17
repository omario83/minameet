import { Suspense } from "react";
import { Logo } from "@/components/logo";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { signOut } from "@/lib/auth-actions";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<p className="p-6 text-ink/60">Laden…</p>}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}

async function AdminShell({ children }: { children: React.ReactNode }) {
  const profile = await requireRole("admin");

  return (
    <div className="flex flex-1 flex-col bg-ink/5">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/admin" className="flex items-center gap-3">
          <Logo /> <span className="text-sm font-semibold text-stone">Beheer</span>
        </Link>
        <form action={signOut} className="flex items-center gap-4 text-sm">
          <span className="text-ink/60">{profile.full_name}</span>
          <button className="rounded-full border border-ink/15 bg-white px-4 py-2 font-medium hover:border-brand hover:text-brand">Uitloggen</button>
        </form>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
