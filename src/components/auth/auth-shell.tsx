import Link from "next/link";
import { Logo } from "@/components/logo";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  tone = "customer",
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
  tone?: "customer" | "vendor";
}) {
  return (
    <main className={`flex flex-1 items-center justify-center px-6 py-12 ${tone === "vendor" ? "bg-brand-soft" : ""}`}>
      <div className="w-full max-w-md rounded-[2rem] bg-white p-8 shadow-xl shadow-brand/10">
        <Link href="/" aria-label="MinaMeet, naar de homepage">
          <Logo />
        </Link>
        <h1 className="mt-6 font-display text-3xl font-bold">{title}</h1>
        <p className="mb-6 mt-1 text-ink/60">{subtitle}</p>
        {children}
        <div className="mt-6 text-center text-sm text-ink/60">{footer}</div>
      </div>
    </main>
  );
}
