import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Reveal } from "@/components/reveal";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Slideshow } from "@/components/slideshow";
import { CATEGORIES } from "@/lib/categories";
import { MEDIA } from "@/lib/media";

export const metadata = { title: "Diensten vergelijken | MinaMeet" };

export default function ServicesPage() {
  const services = CATEGORIES.filter((c) => c.db !== "venue");

  return (
    <>
      <SiteHeader overlay />
      <main className="flex-1">
        <section className="relative flex min-h-[60vh] items-end overflow-hidden bg-gradient-to-br from-[#8e5a0b] via-[#a8330a] to-gold text-white">
          <Slideshow slides={MEDIA.services} interval={6000} priority />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/45 to-ink/30" />
          <div className="relative mx-auto w-full max-w-7xl px-6 pb-14 pt-40">
            <Reveal>
              <h1 className="font-display text-5xl font-bold sm:text-6xl">Vergelijk diensten</h1>
            </Reveal>
            <Reveal delay={150}>
              <p className="mt-4 max-w-xl text-lg text-white/85">Kies wat je nodig hebt en vergelijk op prijs en beschikbaarheid.</p>
            </Reveal>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-16">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map(({ slug, label, blurb, gradient, icon: Icon }) => (
              <li key={slug}>
                <Link
                  href={`/zoeken?categorie=${slug}`}
                  className={`group relative flex aspect-[4/3] flex-col justify-end overflow-hidden rounded-[2rem] bg-gradient-to-br ${gradient} p-7 text-white transition hover:-translate-y-1 hover:shadow-xl`}
                >
                  <Icon aria-hidden className="absolute -right-4 -top-4 size-32 rotate-12 opacity-20 transition group-hover:rotate-0" />
                  <span className="font-display text-3xl font-bold">{label}</span>
                  <span className="mt-1 flex items-center gap-1 text-white/80">
                    {blurb} <ArrowUpRight className="size-4" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
