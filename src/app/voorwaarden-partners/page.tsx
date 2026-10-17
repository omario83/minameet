import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PARTNER_TERMS_VERSION } from "@/lib/legal";

export const metadata = { title: "Partnervoorwaarden | MinaMeet" };

const H2 = "pt-4 font-display text-xl font-bold text-ink";

export default function PartnerTermsPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-3 px-6 pb-16 text-ink/80">
        <h1 className="pt-6 font-display text-3xl font-bold text-ink">Partnervoorwaarden</h1>
        <p className="text-sm text-stone">Versie {PARTNER_TERMS_VERSION}</p>
        {/* TODO: laat deze tekst juridisch controleren en vul de [tussen haakjes] in voordat partners worden uitgenodigd. */}
        <p className="rounded-2xl bg-brand-soft px-4 py-3 text-sm font-medium text-ink">
          Conceptversie. Deze voorwaarden worden nog juridisch gecontroleerd en kunnen nog wijzigen.
        </p>

        <h2 className={H2}>1. Wie is wie</h2>
        <p>
          MinaMeet is een platform waarop klanten feestzalen en diensten zoals catering, DJ&apos;s, fotografie en decoratie vergelijken en offertes aanvragen. Jij bent de partner: het
          bedrijf dat aanbod op MinaMeet plaatst. De klant is de persoon die via MinaMeet een offerte aanvraagt of boekt.
        </p>

        <h2 className={H2}>2. Aanmelden en goedkeuring</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Je meldt je aan namens een bedrijf dat is ingeschreven bij de Kamer van Koophandel. Je gegevens zijn juist en volledig.</li>
          <li>MinaMeet beoordeelt elke aanmelding. Bij een afkeuring laten we weten waarom, zodat je je gegevens kunt aanpassen en opnieuw kunt insturen.</li>
          <li>Je aanbod is pas zichtbaar voor klanten nadat je bent goedgekeurd.</li>
          <li>Na het insturen kun je je bedrijfsgegevens niet meer zelf wijzigen. Neem daarvoor contact op met MinaMeet.</li>
        </ul>

        <h2 className={H2}>3. Je aanbod</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Beschrijvingen, prijzen, capaciteit en beschikbaarheid zijn juist en actueel. Je houdt je kalender bij.</li>
          <li>Je plaatst alleen foto&apos;s en teksten waarvoor je de rechten hebt. Je geeft MinaMeet toestemming om ze op het platform te tonen zolang je aanbod daar staat.</li>
          <li>Misleidende, onwettige of aanstootgevende inhoud is niet toegestaan.</li>
        </ul>

        <h2 className={H2}>4. Offertes en boekingen</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Je reageert binnen redelijke tijd op offerteaanvragen. MinaMeet geeft je daarvoor een taak met een richttermijn.</li>
          <li>Een verstuurde offerte geldt tot de geldigheidsdatum. Accepteert de klant, dan ontstaat een boeking en wordt de datum voor dat aanbod geblokkeerd.</li>
          <li>De overeenkomst voor de dienst sluit je met de klant. MinaMeet is daarbij geen partij en niet verantwoordelijk voor de uitvoering.</li>
        </ul>

        <h2 className={H2}>5. Commissie en betaling</h2>
        <p>
          Voor elke boeking via MinaMeet betaal je commissie over het bedrag van de geaccepteerde offerte. Het percentage wordt per partner vastgesteld [standaard: 10%]. Wijzigingen daarin
          kondigen we vooraf aan. [Invullen: wijze van factureren en betaaltermijn.]
        </p>

        <h2 className={H2}>6. Gegevens van klanten</h2>
        <p>
          Gegevens uit een offerteaanvraag gebruik je alleen om de offerte te maken en de dienst uit te voeren. Je verkoopt ze niet door en gebruikt ze niet voor andere doelen. Je houdt je
          aan de AVG. Lees ook ons{" "}
          <Link href="/privacy" className="font-semibold text-brand underline">
            privacybeleid
          </Link>
          .
        </p>

        <h2 className={H2}>7. Opschorten en beëindigen</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Je kunt je account altijd laten beëindigen. Lopende boekingen kom je na.</li>
          <li>MinaMeet kan je account blokkeren of beëindigen bij schending van deze voorwaarden, bij klachten of bij onjuiste gegevens. Je aanbod is dan niet meer zichtbaar.</li>
        </ul>

        <h2 className={H2}>8. Aansprakelijkheid</h2>
        <p>
          Je bent zelf verantwoordelijk voor je diensten en voor schade die daaruit voortvloeit. MinaMeet is niet aansprakelijk voor gemiste boekingen door storingen of onderhoud van het
          platform. [Juridisch te bepalen: omvang en beperking van de aansprakelijkheid van MinaMeet.]
        </p>

        <h2 className={H2}>9. Wijzigingen</h2>
        <p>
          MinaMeet kan deze voorwaarden wijzigen. Bij een inhoudelijke wijziging laten we het je vooraf weten. We leggen vast welke versie je bij je aanmelding hebt geaccepteerd.
        </p>

        <h2 className={H2}>10. Toepasselijk recht</h2>
        <p>Op deze voorwaarden is Nederlands recht van toepassing. [Invullen: bevoegde rechter.]</p>
      </main>
      <SiteFooter />
    </>
  );
}
