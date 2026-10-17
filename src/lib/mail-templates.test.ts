import { describe, expect, it, vi } from "vitest";
import { mails } from "@/lib/mail-templates";

vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://minameet.nl");

describe("mails", () => {
  it("bevestigt de aanmelding aan de partner met een link naar het portaal", () => {
    const mail = mails.applicationReceived("Zaal Het Oosten");
    expect(mail.subject).toBe("We hebben je aanmelding ontvangen");
    expect(mail.text).toContain("Zaal Het Oosten");
    expect(mail.text).toContain("https://minameet.nl/leverancier/inloggen");
  });

  it("meldt de admin een nieuwe aanmelding met een link naar de beoordeling", () => {
    const mail = mails.newApplication("Zaal Het Oosten", "11111111-2222-3333-4444-555555555555");
    expect(mail.subject).toBe("Nieuwe aanmelding: Zaal Het Oosten");
    expect(mail.text).toContain("https://minameet.nl/admin/partners/11111111-2222-3333-4444-555555555555");
  });

  it("houdt het onderwerp op één regel, ook als de bedrijfsnaam regeleinden bevat", () => {
    const mail = mails.newApplication("Evil\r\nBcc: iemand@voorbeeld.nl", "id");
    expect(mail.subject).not.toMatch(/[\r\n]/);
    expect(mails.applicationReceived("A\nB").text).toContain("van A B bij MinaMeet");
  });

  it("noemt bij afkeuring de reden en bij goedkeuring het portaal", () => {
    expect(mails.rejected("Zaal", "  KvK-nummer klopt niet  ").text).toContain("Reden: KvK-nummer klopt niet");
    expect(mails.approved("Zaal").text).toContain("https://minameet.nl/leverancier/inloggen");
  });
});
