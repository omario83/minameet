import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { FeaturePanel } from "@/components/feature-panel";
import { HeroVideo } from "@/components/hero-video";
import { Reveal } from "@/components/reveal";
import { RotatingWords } from "@/components/rotating-words";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Slideshow } from "@/components/slideshow";
import { MEDIA } from "@/lib/media";

const EXAMPLES = [
  "Turkse bruiloft voor 250 gasten in Rotterdam",
  "Henna-avond met catering, 80 personen",
  "Verjaardag, 50 personen, DJ en zaal in Utrecht",
];

const STEPS = [
  { title: "Vertel wat je wilt vieren", text: "Beschrijf je feest in je eigen woorden. Wij laten alleen zien wat erbij past." },
  { title: "Vergelijk op prijs en datum", text: "Locaties en diensten naast elkaar, alleen met aanbieders die op jouw dag vrij zijn." },
  { title: "Vraag offertes aan, in één keer", text: "Eén aanvraag naar meerdere aanbieders. Alle reacties vind je terug op één plek." },
];

const EVENT_TYPES = [
  { label: "Turkse bruiloft", q: "Turkse bruiloft", gradient: "from-[#7a2e12] to-[#f26b1d]" },
  { label: "Henna-avond", q: "Henna-avond", gradient: "from-[#8e5a0b] to-[#e0a010]" },
  { label: "Marokkaanse bruiloft", q: "Marokkaanse bruiloft", gradient: "from-[#a8330a] to-[#ff8a00]" },
  { label: "Verjaardag", q: "Verjaardag", gradient: "from-forest to-[#3f7d5c]" },
  { label: "Jubileum", q: "Jubileum", gradient: "from-[#6b4a12] to-[#c98a0a]" },
  { label: "Babyshower", q: "Babyshower", gradient: "from-[#5a4638] to-[#d9560b]" },
];

export default function Home() {
  return (
    <>
      <SiteHeader overlay />

      <main className="flex-1">
        {/* Bovenste banner */}
        <section className="relative flex min-h-[88vh] items-center overflow-hidden bg-gradient-to-br from-forest via-[#7a2e12] to-tangerine text-white">
          {MEDIA.heroPoster && <Image src={MEDIA.heroPoster} alt="" fill priority sizes="100vw" className="object-cover" />}
          {MEDIA.heroVideo && <HeroVideo src={MEDIA.heroVideo} poster={MEDIA.heroPoster ?? undefined} />}
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/45 to-ink/30" />
          <div aria-hidden className="absolute inset-0 bg-tangerine/10 mix-blend-multiply" />

          <div className="relative mx-auto w-full max-w-7xl px-6 pb-20 pt-36">
            <Reveal>
              <h1 className="max-w-4xl font-display text-5xl font-bold leading-[1.05] sm:text-7xl">
                Organiseer jouw{" "}
                <span className="text-gold">
                  <RotatingWords words={["bruiloft", "henna-avond", "verjaardag", "jubileum"]} />
                </span>{" "}
                op de mooiste plek
              </h1>
            </Reveal>
            <Reveal delay={150}>
              <p className="mt-6 max-w-2xl text-lg text-white/85 sm:text-xl">
                Vergelijk feestzalen, cateraars, DJ&apos;s en meer. Zie direct wat beschikbaar is en wat het kost.
              </p>
            </Reveal>

            <Reveal delay={300}>
              <form action="/zoeken" className="mt-10 flex max-w-3xl flex-col gap-3 rounded-[2rem] bg-white p-3 text-ink shadow-2xl sm:flex-row sm:items-center">
                <label htmlFor="q" className="sr-only">Beschrijf je feest</label>
                <div className="flex flex-1 items-center gap-3 px-4">
                  <Search className="size-5 shrink-0 text-brand" />
                  <input
                    id="q"
                    name="q"
                    required
                    minLength={3}
                    placeholder="Bijvoorbeeld: Turkse bruiloft voor 250 gasten in Rotterdam"
                    className="h-12 w-full bg-transparent text-base outline-none placeholder:text-stone/70"
                  />
                </div>
                <button className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-orange px-7 font-semibold text-ink transition hover:bg-gold">
                  Plan mijn feest <ArrowRight className="size-4" />
                </button>
              </form>
            </Reveal>

            <Reveal delay={450}>
              <ul className="mt-5 flex max-w-4xl flex-wrap gap-2">
                {EXAMPLES.map((example) => (
                  <li key={example}>
                    <Link
                      href={`/zoeken?q=${encodeURIComponent(example)}`}
                      className="inline-block rounded-full border border-white/40 bg-white/10 px-4 py-2 text-sm backdrop-blur transition hover:bg-white hover:text-ink"
                    >
                      {example}
                    </Link>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        {/* Drie grote panelen */}
        <section className="mx-auto max-w-7xl px-6 py-20">
          <Reveal>
            <h2 className="max-w-2xl font-display text-4xl font-bold sm:text-5xl">Waar wil je mee beginnen?</h2>
          </Reveal>
          <div className="mt-10 flex flex-col gap-4 md:flex-row">
            <FeaturePanel
              href="/feest-plannen"
              title="Vertel ons wat je wilt vieren"
              text="Wij denken met je mee, van het eerste idee tot de boeking."
              cta="Plan je feest"
              slides={MEDIA.plan}
              gradient="from-[#7a2e12] to-[#f26b1d]"
              interval={5200}
            />
            <FeaturePanel
              href="/diensten"
              title="Vergelijk diensten"
              text="Catering, DJ's, fotografen en decoratie, op prijs en beschikbaarheid."
              cta="Bekijk diensten"
              slides={MEDIA.services}
              gradient="from-[#8e5a0b] to-[#e0a010]"
              interval={6100}
            />
            <FeaturePanel
              href="/zoeken?categorie=zalen"
              title="Vergelijk locaties"
              text="Feestzalen en bijzondere plekken midden in de natuur."
              cta="Bekijk locaties"
              slides={MEDIA.locations}
              gradient="from-forest to-[#3f7d5c]"
              interval={5700}
            />
          </div>
        </section>

        {/* Hoe het werkt */}
        <section id="hoe-het-werkt" className="relative overflow-hidden bg-gradient-to-br from-forest to-[#7a2e12] text-white">
          <Slideshow slides={MEDIA.steps} interval={7000} />
          <div aria-hidden className="absolute inset-0 bg-ink/65" />
          <div className="relative mx-auto max-w-7xl px-6 py-24">
            <Reveal>
              <h2 className="font-display text-4xl font-bold sm:text-5xl">Zo werkt MinaMeet</h2>
            </Reveal>
            <ol className="mt-12 grid gap-10 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title}>
                  <Reveal delay={i * 150}>
                    <p className="font-display text-6xl font-bold text-gold">0{i + 1}</p>
                    <h3 className="mt-3 font-display text-2xl font-bold">{step.title}</h3>
                    <p className="mt-2 text-white/80">{step.text}</p>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Feesttypes */}
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-6">
            <Reveal>
              <h2 className="font-display text-4xl font-bold sm:text-5xl">Populaire feesten</h2>
            </Reveal>
          </div>
          <ul className="mt-10 flex snap-x gap-4 overflow-x-auto px-6 pb-4 md:px-[max(1.5rem,calc((100vw-80rem)/2+1.5rem))]">
            {EVENT_TYPES.map((event, i) => (
              <li key={event.label} className="shrink-0 snap-start">
                <Link
                  href={`/zoeken?q=${encodeURIComponent(event.q)}`}
                  className={`group relative flex h-96 w-72 flex-col justify-end overflow-hidden rounded-[2rem] bg-gradient-to-br ${event.gradient} p-6 text-white`}
                >
                  {MEDIA.events[i] && (
                    <Image src={MEDIA.events[i]} alt="" fill sizes="288px" className="object-cover transition duration-700 group-hover:scale-105" />
                  )}
                  <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/80 to-transparent" />
                  <span className="relative font-display text-2xl font-bold">{event.label}</span>
                  <span className="relative mt-1 inline-flex items-center gap-1 text-sm text-white/80">
                    Bekijk aanbieders <ArrowRight className="size-3.5 transition group-hover:translate-x-1" />
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
