export function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

// Bedrijfsnamen komen van gebruikers: één regel, zodat ze het onderwerp niet kunnen opbreken.
const oneLine = (value: string) => value.replace(/\s+/g, " ").trim();

export const mails = {
  applicationReceived: (company: string) => ({
    subject: "We hebben je aanmelding ontvangen",
    text: `Bedankt voor je aanmelding van ${oneLine(company)} bij MinaMeet.\n\nWe controleren je gegevens en laten je per e-mail weten of je wordt goedgekeurd. Je kunt in de tussentijd inloggen in het partnerportaal: ${siteUrl()}/leverancier/inloggen\n\nTeam MinaMeet`,
  }),
  newApplication: (company: string, vendorId: string) => ({
    subject: `Nieuwe aanmelding: ${oneLine(company)}`,
    text: `${oneLine(company)} heeft een aanmelding ingestuurd en wacht op beoordeling.\n\nBeoordeel de aanmelding: ${siteUrl()}/admin/partners/${vendorId}`,
  }),
  approved: (company: string) => ({
    subject: "Je aanmelding bij MinaMeet is goedgekeurd",
    text: `Goed nieuws: ${oneLine(company)} is goedgekeurd als partner van MinaMeet. Je aanbod is nu zichtbaar voor klanten en je ontvangt offerteaanvragen in je portaal.\n\nLog in: ${siteUrl()}/leverancier/inloggen\n\nTeam MinaMeet`,
  }),
  rejected: (company: string, reason: string) => ({
    subject: "Je aanmelding bij MinaMeet is niet goedgekeurd",
    text: `Helaas hebben we de aanmelding van ${oneLine(company)} niet kunnen goedkeuren.\n\nReden: ${reason.trim()}\n\nJe kunt je gegevens aanpassen en opnieuw insturen via ${siteUrl()}/leverancier/inloggen\n\nTeam MinaMeet`,
  }),
};
