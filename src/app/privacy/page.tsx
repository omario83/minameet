import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata = { title: "Privacy | MinaMeet" };

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-6 pb-16 text-ink/80">
        <h1 className="pt-6 font-display text-3xl font-bold text-ink">Privacy</h1>
        <p>MinaMeet verwerkt alleen de gegevens die nodig zijn om feesten te vergelijken, offertes aan te vragen en te boeken.</p>
        <h2 className="pt-2 font-display text-xl font-bold text-ink">Welke gegevens</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Accountgegevens: naam, e-mailadres en wachtwoord (versleuteld opgeslagen).</li>
          <li>Bij een offerteaanvraag: naam, optioneel telefoonnummer, datum, aantal gasten, budget en je bericht. Deze gegevens worden gedeeld met de aanbieders die je kiest.</li>
          <li>Zoekopdrachten kunnen voor het begrijpen van je zoektekst naar een AI-dienst worden gestuurd. Vul daarin geen persoonsgegevens in.</li>
          <li>Partners: contactpersoon, bedrijfsnaam, KvK- en btw-nummer, vestigingsadres, telefoonnummer, e-mailadres, website en de foto&apos;s en teksten van het aanbod. Alleen naam, plaats en aanbod zijn zichtbaar voor klanten; de overige bedrijfsgegevens gebruiken we om aanmeldingen te controleren.</li>
        </ul>
        <h2 className="pt-2 font-display text-xl font-bold text-ink">Delen</h2>
        <p>Gegevens worden niet verkocht. Ze worden alleen gedeeld met de aanbieders die je een offerte laat maken en met onze technische dienstverleners voor hosting, e-mail en AI.</p>
      </main>
      <SiteFooter />
    </>
  );
}
