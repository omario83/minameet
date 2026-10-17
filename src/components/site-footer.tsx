import Link from "next/link";
import { Logo } from "@/components/logo";

export function SiteFooter() {
  return (
    <footer className="bg-forest text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <div>
          <Logo onDark />
          <p className="mt-4 max-w-xs text-sm text-white/70">Vergelijk locaties en diensten en organiseer je hele feest op één plek.</p>
        </div>
        <FooterColumn title="Ontdek" links={[["/feest-plannen", "Feest plannen"], ["/zoeken?categorie=zalen", "Locaties"], ["/diensten", "Diensten"]]} />
        <FooterColumn title="Account" links={[["/inloggen", "Inloggen"], ["/registreren", "Account maken"]]} />
        <FooterColumn title="Partners" links={[["/leverancier/registreren", "Word partner"], ["/leverancier/inloggen", "Inloggen voor partners"]]} />
      </div>
      <div className="border-t border-white/10 py-5 text-center text-sm text-white/60">
        © MinaMeet · <Link href="/privacy" className="underline hover:text-white">Privacy</Link>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-widest text-gold">{title}</h3>
      <ul className="mt-4 space-y-2 text-sm">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="text-white/80 hover:text-white hover:underline">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
