import { Reveal } from "@/components/reveal";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Slideshow } from "@/components/slideshow";
import { MEDIA } from "@/lib/media";

export const metadata = { title: "Feest plannen | MinaMeet" };

const field = "h-12 w-full rounded-xl border border-ink/15 bg-white px-4 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export default function PlanPage() {
  return (
    <>
      <SiteHeader overlay />
      <main className="flex-1">
        <section className="relative flex min-h-[90vh] items-center overflow-hidden bg-gradient-to-br from-[#7a2e12] via-[#a8330a] to-tangerine text-white">
          <Slideshow slides={MEDIA.plan} interval={6000} priority />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/50 to-ink/30" />

          <div className="relative mx-auto w-full max-w-3xl px-6 pb-20 pt-36">
            <Reveal>
              <h1 className="font-display text-5xl font-bold leading-[1.05] sm:text-6xl">Vertel ons wat je wilt vieren</h1>
            </Reveal>
            <Reveal delay={150}>
              <p className="mt-5 text-lg text-white/85">
                Schrijf in je eigen woorden wat je voor ogen hebt. Wij tonen de locaties en diensten die erbij passen en op jouw dag beschikbaar zijn.
              </p>
            </Reveal>

            <Reveal delay={300}>
              <form action="/zoeken" className="mt-8 space-y-3 rounded-[2rem] bg-white p-5 text-ink shadow-2xl">
                <label htmlFor="q" className="sr-only">Beschrijf je feest</label>
                <textarea
                  id="q"
                  name="q"
                  required
                  minLength={3}
                  rows={3}
                  placeholder="Bijvoorbeeld: een Turkse bruiloft voor 250 gasten in Rotterdam, met halal catering en een DJ"
                  className="w-full rounded-xl border border-ink/15 bg-white p-4 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
                <div className="grid gap-3 sm:grid-cols-3">
                  <input name="datum" type="date" aria-label="Datum" className={field} />
                  <input name="gasten" type="number" min="1" placeholder="Aantal gasten" className={field} />
                  <input name="plaats" placeholder="Plaats" className={field} />
                </div>
                <button className="h-12 w-full rounded-full bg-orange px-8 font-semibold text-ink transition hover:bg-gold sm:w-auto">
                  Toon passende aanbieders
                </button>
              </form>
            </Reveal>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
