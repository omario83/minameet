import Link from "next/link";
import { Logo } from "@/components/logo";

const LINKS = [
  { href: "/feest-plannen", label: "Feest plannen" },
  { href: "/zoeken?categorie=zalen", label: "Locaties" },
  { href: "/diensten", label: "Diensten" },
  { href: "/#hoe-het-werkt", label: "Hoe het werkt" },
];

/** `overlay` plaatst de header doorzichtig over een foto of video. */
export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  return (
    <header className={overlay ? "absolute inset-x-0 top-0 z-30 text-white" : "relative text-ink"}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link href="/" aria-label="MinaMeet, naar de homepage">
          <Logo onDark={overlay} />
        </Link>

        <nav className="hidden items-center gap-1 text-sm font-medium lg:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-full px-4 py-2 opacity-90 transition hover:opacity-100 hover:underline hover:underline-offset-8">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 text-sm font-semibold lg:flex">
          <Link href="/leverancier/registreren" className="rounded-full border border-current/40 px-4 py-2 transition hover:border-current">
            Word partner
          </Link>
          <Link href="/inloggen" className="rounded-full px-4 py-2 transition hover:underline hover:underline-offset-8">
            Inloggen
          </Link>
          <Link href="/registreren" className="rounded-full bg-orange px-5 py-2.5 text-ink transition hover:bg-gold">
            Account maken
          </Link>
        </div>

        <details className="relative lg:hidden">
          <summary className="flex h-11 cursor-pointer list-none items-center rounded-full border border-current/40 px-5 text-sm font-semibold [&::-webkit-details-marker]:hidden">
            Menu
          </summary>
          <div className="absolute right-0 mt-3 w-64 space-y-1 rounded-2xl bg-white p-3 text-ink shadow-2xl">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="block rounded-xl px-4 py-3 font-medium hover:bg-sand">
                {l.label}
              </Link>
            ))}
            <hr className="border-sand" />
            <Link href="/inloggen" className="block rounded-xl px-4 py-3 font-medium hover:bg-sand">Inloggen</Link>
            <Link href="/registreren" className="block rounded-xl bg-orange px-4 py-3 text-center font-semibold">Account maken</Link>
            <Link href="/leverancier/registreren" className="block rounded-xl px-4 py-3 text-center text-sm font-medium text-stone hover:bg-sand">Word partner</Link>
          </div>
        </details>
      </div>
    </header>
  );
}
