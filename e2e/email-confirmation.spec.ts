import { expect, test } from "@playwright/test";
import { linkFrom, mailsFor, waitForMail } from "./mail";
import { PASSWORD, captchaReady, cleanup, createVendor, login, signUp, skipWithoutSupabase, uniqueEmail, usersWithEmail } from "./support";

// Vereist `supabase start` met supabase/config.toml (Inbucket/Mailpit op poort 54324) en de dev-server uit playwright.config.ts.
skipWithoutSupabase();
test.afterEach(cleanup);

const COOLDOWN = Number(process.env.E2E_RESEND_COOLDOWN ?? 4);
const CONFIRM = /Bevestig je e-mailadres/;

test.describe("bevestigingslink", () => {
  test("eindigt in de instelassistent en de mail heeft de huisstijl", async ({ page }) => {
    const email = uniqueEmail();
    await signUp(page, email);
    await expect(page.getByText(email)).toBeVisible();

    const mail = await waitForMail(email, { subject: CONFIRM });
    expect(mail.html).toContain("#ff8a00");
    expect(mail.html).toContain("<table");

    await page.goto(linkFrom(mail));
    await expect(page).toHaveURL(/\/leverancier\/start$/);
    await expect(page.getByRole("heading", { name: /Welkom/ })).toBeVisible();
    expect((await usersWithEmail(email))[0].email_confirmed_at).toBeTruthy();
  });

  test("een hergebruikte link geeft de uitleg en een knop voor een nieuwe mail", async ({ page }) => {
    const email = uniqueEmail();
    await signUp(page, email);
    const link = linkFrom(await waitForMail(email, { subject: CONFIRM }));

    await page.goto(link);
    await expect(page).toHaveURL(/\/leverancier\/start$/);

    await page.goto(link);
    await expect(page).toHaveURL(/\/leverancier\/inloggen\?melding=link-verlopen$/);
    await expect(page.getByText("Deze link werkt niet (meer)")).toBeVisible();
    await page.getByRole("link", { name: "Nieuwe bevestigingsmail" }).click();
    await expect(page).toHaveURL(/controleer-mail$/);
  });

  test("een link in een andere browser geeft dezelfde uitleg, en inloggen werkt daarna", async ({ page, browser }) => {
    const email = uniqueEmail();
    await signUp(page, email);
    const link = linkFrom(await waitForMail(email, { subject: CONFIRM }));

    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await otherPage.goto(link);
    await expect(otherPage).toHaveURL(/\/leverancier\/inloggen\?melding=link-verlopen$/);
    await other.close();

    await login(page, email);
    await expect(page).toHaveURL(/\/leverancier\/start$/);
  });

  test("een ongeldige code stuurt een partner naar de partnerlogin en een klant naar de klantlogin", async ({ page }) => {
    await page.goto("/auth/callback?code=bestaat-niet&next=%2Fleverancier%2Faanmelden");
    await expect(page).toHaveURL(/\/leverancier\/inloggen\?melding=link-verlopen$/);

    await page.goto("/auth/callback?code=bestaat-niet&next=%2Faccount");
    await expect(page).toHaveURL(/\/inloggen\?melding=link-verlopen$/);
    await expect(page.getByText("Deze link werkt niet (meer)")).toBeVisible();
    await expect(page.getByRole("link", { name: "Nieuwe bevestigingsmail" })).toHaveCount(0);
  });
});

test.describe("open redirect", () => {
  for (const next of ["https://evil.com", "//evil.com", "/\\evil.com", "http://evil.com/leverancier/aanmelden", "/leverancier/aanbod", "/admin"]) {
    test(`next=${next} wordt genegeerd`, async ({ request, baseURL }) => {
      const res = await request.get(`/auth/callback?code=bestaat-niet&next=${encodeURIComponent(next)}`, { maxRedirects: 0 });
      expect(res.status()).toBe(307);

      const location = res.headers()["location"];
      expect(location).not.toMatch(/evil/);
      expect(new URL(location, baseURL).origin).toBe(new URL(baseURL!).origin);
    });
  }
});

test.describe("opnieuw versturen", () => {
  test("toont het adres, telt af, verstuurt een tweede mail en blijft na herladen wachten", async ({ page }) => {
    const email = uniqueEmail();
    await signUp(page, email);
    await expect(page.getByText(email)).toBeVisible();
    await expect(page.getByRole("link", { name: "Ga terug om het te wijzigen" })).toBeVisible();

    const button = page.getByRole("button", { name: /Mail opnieuw versturen/ });
    await expect(button).toBeDisabled();
    await expect(button).toContainText(/\(\d+ s\)/);

    await expect(button).toBeEnabled({ timeout: (COOLDOWN + 10) * 1000 });
    await expect(button).toHaveText("Mail opnieuw versturen");

    await captchaReady(page);
    await button.click();
    await expect(page.getByRole("status")).toContainText("nieuwe e-mail onderweg");
    await expect(button).toBeDisabled();
    await expect.poll(async () => (await mailsFor(email)).length, { timeout: 15_000 }).toBe(2);

    // De wachttijd komt van de server en overleeft een herlaadslag.
    await page.reload();
    await expect(page.getByRole("button", { name: /Mail opnieuw versturen/ })).toBeDisabled();
  });

  test("zonder bekend adres vraagt de pagina om het e-mailadres", async ({ page }) => {
    await page.goto("/leverancier/registreren/controleer-mail");
    await expect(page.getByLabel("E-mailadres")).toBeVisible();
    await expect(page.getByRole("button", { name: "Mail opnieuw versturen" })).toBeEnabled();
  });
});

test("inloggen vóór bevestigen toont een melding en een knop voor een nieuwe mail", async ({ page }) => {
  const email = uniqueEmail();
  await signUp(page, email);

  await login(page, email);
  await expect(page.getByRole("alert").filter({ hasText: "Bevestig eerst je e-mailadres" })).toBeVisible();

  await page.getByRole("button", { name: "Mail opnieuw versturen" }).click();
  await expect(page.getByRole("status")).toContainText("nieuwe e-mail onderweg");
  await expect.poll(async () => (await mailsFor(email)).length, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
});

test("wachtwoord vergeten: van aanvraag tot inloggen met het nieuwe wachtwoord", async ({ page }) => {
  const email = await createVendor();
  const NEW_PASSWORD = "Nieuw-wachtwoord-456";

  await page.goto("/leverancier/inloggen");
  await page.getByRole("link", { name: "Wachtwoord vergeten?" }).click();
  await expect(page).toHaveURL(/wachtwoord-vergeten$/);
  await page.getByLabel("E-mailadres").fill(email);
  await captchaReady(page);
  await page.getByRole("button", { name: "Stuur link" }).click();
  await expect(page.getByRole("status")).toContainText("Is dit e-mailadres bij ons bekend");

  const mail = await waitForMail(email, { subject: /nieuw wachtwoord/i });
  expect(mail.html).toContain("#ff8a00");
  await page.goto(linkFrom(mail));
  await expect(page).toHaveURL(/\/leverancier\/wachtwoord-resetten$/);

  await page.getByLabel(/Nieuw wachtwoord/).fill("kort123");
  await page.getByRole("button", { name: "Wachtwoord opslaan" }).click();
  await expect(page.getByRole("alert")).toContainText("minimaal 10");

  await page.getByLabel(/Nieuw wachtwoord/).fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Wachtwoord opslaan" }).click();
  await expect(page).toHaveURL(/\/leverancier\/dashboard$/);

  await page.getByRole("button", { name: "Uitloggen" }).click();
  await login(page, email, PASSWORD);
  await expect(page.getByRole("alert")).toContainText("klopt niet");
  await login(page, email, NEW_PASSWORD);
  await expect(page).toHaveURL(/\/leverancier\/dashboard$/);
});

test.describe("bestemming na inloggen", () => {
  const cases = [
    { status: "draft", setup: false, url: /\/leverancier\/start$/ },
    { status: "draft", setup: true, url: /\/leverancier\/dashboard$/ },
    { status: "rejected", setup: true, url: /\/leverancier\/dashboard$/ },
    { status: "pending", setup: true, url: /\/leverancier\/dashboard$/, banner: true },
    { status: "approved", setup: true, url: /\/leverancier\/dashboard$/, banner: false },
  ] as const;

  for (const { status, setup, url, ...rest } of cases) {
    test(`status ${status}${setup ? "" : " zonder instelassistent"}`, async ({ page }) => {
      const email = await createVendor(status, undefined, { setup });
      await login(page, email);
      await expect(page).toHaveURL(url);

      if ("banner" in rest) {
        const banner = page.getByText(/wordt beoordeeld/);
        if (rest.banner) await expect(banner).toBeVisible();
        else await expect(banner).toHaveCount(0);
      }
    });
  }
});
