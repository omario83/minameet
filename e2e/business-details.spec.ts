import { expect, test, type Page } from "@playwright/test";
import { PDOK_FOUND, PDOK_HANGS, PDOK_NOT_FOUND, startPdokMock, stopPdokMock } from "./pdok-mock";
import { PASSWORD, admin, anonClient, cleanup, createVendor, insertDetails, login, loginToWizard, skipWithoutSupabase, vendorIdFor } from "./support";

// Stap 3: bedrijfsgegevens. De PDOK-opzoeking gaat naar een nepserver (PDOK_URL in playwright.config.ts).
skipWithoutSupabase();
test.afterEach(cleanup);
test.beforeAll(startPdokMock);
test.afterAll(stopPdokMock);

const FOUND = /Straat en plaats zijn ingevuld/;
const NOT_FOUND = /Adres niet gevonden/;
const STEP3 = /\/leverancier\/aanmelden\/bedrijfsgegevens$/;
const STEP4 = /\/leverancier\/aanmelden\/aanbod$/;

async function openForm(page: Page) {
  const email = await createVendor();
  await loginToWizard(page, email);
  await expect(page).toHaveURL(STEP3);
  return email;
}

async function fillAddress(page: Page, postcode: string, number: string) {
  await page.getByLabel("Postcode").fill(postcode);
  await page.getByLabel("Huisnummer").fill(number);
}

async function fillAll(page: Page, { kvk = "12 345.678" }: { kvk?: string } = {}) {
  await page.getByLabel("KvK-nummer").fill(kvk);
  await page.getByLabel(/Btw-nummer/).fill("nl 123456789 b01");
  await fillAddress(page, "1012js", "1");
  await page.getByLabel("Toevoeging").fill("A");
  await expect(page.getByText(FOUND)).toBeVisible();
  await page.getByLabel("Telefoonnummer").fill("0612345678");
  await page.getByLabel("Contact e-mailadres").fill("Info@Voorbeeld.NL");
  await page.getByLabel(/Website/).fill("minameet.nl");
}

test("de stappenbalk staat in de layout en toont de huidige stap", async ({ page }) => {
  await openForm(page);
  const steps = page.getByRole("list", { name: "Voortgang aanmelding" });
  await expect(steps.getByRole("listitem")).toHaveText(["Account", "Bedrijfsgegevens", "Aanbod", "Insturen"]);
  await expect(steps.locator('[aria-current="step"]')).toHaveText("Bedrijfsgegevens");
});

test("het contact-e-mailadres is standaard het login-adres", async ({ page }) => {
  const email = await openForm(page);
  await expect(page.getByLabel("Contact e-mailadres")).toHaveValue(email);
});

test("een leeg formulier toont inline fouten en zet de focus op het eerste veld", async ({ page }) => {
  await openForm(page);
  await page.getByRole("button", { name: "Opslaan en verder" }).click();

  await expect(page.getByLabel("KvK-nummer")).toBeFocused();
  await expect(page.getByLabel("KvK-nummer")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#kvk-error")).toBeVisible();
  await expect(page.locator("#postal_code-error")).toBeVisible();
  await expect(page.locator("#phone-error")).toBeVisible();
  await expect(page).toHaveURL(STEP3);
});

test("ongeldige KvK, postcode, telefoon en website worden afgewezen", async ({ page }) => {
  await openForm(page);
  await fillAll(page, { kvk: "1234567" });
  await page.getByLabel("Postcode").fill("1234 SS");
  await page.getByLabel("Telefoonnummer").fill("12345");
  await page.getByLabel(/Website/).fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Opslaan en verder" }).click();

  await expect(page.locator("#kvk-error")).toContainText("8 cijfers");
  await expect(page.locator("#postal_code-error")).toContainText("geldige postcode");
  await expect(page.locator("#phone-error")).toContainText("geldig telefoonnummer");
  await expect(page.locator("#website-error")).toContainText("geldig webadres");
});

test.describe("PDOK-opzoeking", () => {
  test("vult straat en plaats in na postcode en huisnummer, en handmatig aanpassen blijft mogelijk", async ({ page }) => {
    await openForm(page);
    await fillAddress(page, PDOK_FOUND, "1");

    await expect(page.getByText(FOUND)).toBeVisible();
    await expect(page.getByLabel("Straat")).toHaveValue("Dam");
    await expect(page.getByLabel("Plaats")).toHaveValue("Amsterdam");

    // Een handmatige aanpassing wordt bij een nieuw huisnummer niet overschreven.
    await page.getByLabel("Straat").fill("Eigen straatnaam");
    await page.getByLabel("Huisnummer").fill("2");
    await expect(page.getByText(FOUND)).toBeVisible();
    await expect(page.getByLabel("Straat")).toHaveValue("Eigen straatnaam");
  });

  test("zoekt pas na een korte pauze in het typen (debounce)", async ({ page }) => {
    await openForm(page);
    let lookups = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" && request.headers()["next-action"]) lookups++;
    });

    await page.getByLabel("Postcode").pressSequentially(PDOK_FOUND, { delay: 30 });
    await page.getByLabel("Huisnummer").pressSequentially("12", { delay: 30 });
    await expect(page.getByText(FOUND)).toBeVisible();
    expect(lookups).toBe(1);
  });

  test("geen resultaat: melding, en straat en plaats blijven invulbaar", async ({ page }) => {
    await openForm(page);
    await fillAddress(page, PDOK_NOT_FOUND, "999");
    await expect(page.getByText(NOT_FOUND)).toBeVisible();

    await page.getByLabel("Straat").fill("Handmatig");
    await page.getByLabel("Plaats").fill("Nergens");
    await expect(page.getByLabel("Straat")).toHaveValue("Handmatig");
  });

  test("time-out: na 5 seconden een melding en het formulier blokkeert nooit", async ({ page }) => {
    await openForm(page);
    await fillAddress(page, PDOK_HANGS, "1");

    await expect(page.getByText("Adres opzoeken…")).toBeVisible();
    // Tijdens het wachten kan de partner gewoon verder invullen.
    await expect(page.getByLabel("Straat")).toBeEnabled();
    await page.getByLabel("Straat").fill("Zelf ingevuld");
    await expect(page.getByLabel("Straat")).toHaveValue("Zelf ingevuld");
    await expect(page.getByRole("button", { name: "Opslaan en verder" })).toBeEnabled();

    await expect(page.getByText(NOT_FOUND)).toBeVisible({ timeout: 12_000 });
    await expect(page.getByLabel("Straat")).toHaveValue("Zelf ingevuld");
  });
});

test("opslaan normaliseert de gegevens en gaat door naar het aanbod", async ({ page }) => {
  const email = await openForm(page);
  await fillAll(page);
  await page.getByRole("button", { name: "Opslaan en verder" }).click();
  await expect(page).toHaveURL(STEP4);

  const { data } = await admin().from("vendor_details").select("*").eq("vendor_id", await vendorIdFor(email)).single();
  expect(data).toMatchObject({
    kvk: "12345678",
    vat_number: "NL123456789B01",
    postal_code: "1012 JS",
    house_number: 1,
    house_number_addition: "A",
    street: "Dam",
    city: "Amsterdam",
    phone: "+31612345678",
    website: "https://minameet.nl",
    contact_email: "info@voorbeeld.nl",
  });
  expect((await admin().from("vendors").select("status").eq("id", await vendorIdFor(email)).single()).data?.status).toBe("draft");
});

test("ververs de pagina en log opnieuw in: de ingevulde gegevens zijn er nog, de wizard hervat bij de eerste open stap", async ({ page }) => {
  const email = await openForm(page);

  // Nog niets opgeslagen: uitloggen en inloggen brengt de partner terug op stap 3.
  await page.getByRole("button", { name: "Uitloggen" }).click();
  await loginToWizard(page, email);
  await expect(page).toHaveURL(STEP3);
  await fillAll(page);
  await page.getByRole("button", { name: "Opslaan en verder" }).click();
  await expect(page).toHaveURL(STEP4);

  // Terug naar stap 3: alles staat er nog, ook na verversen en in de weergave van het telefoonnummer.
  await page.goto("/leverancier/aanmelden/bedrijfsgegevens");
  for (const reload of [false, true]) {
    if (reload) await page.reload();
    await expect(page.getByLabel("KvK-nummer")).toHaveValue("12345678");
    await expect(page.getByLabel(/Btw-nummer/)).toHaveValue("NL123456789B01");
    await expect(page.getByLabel("Postcode")).toHaveValue("1012 JS");
    await expect(page.getByLabel("Huisnummer")).toHaveValue("1");
    await expect(page.getByLabel("Toevoeging")).toHaveValue("A");
    await expect(page.getByLabel("Straat")).toHaveValue("Dam");
    await expect(page.getByLabel("Plaats")).toHaveValue("Amsterdam");
    await expect(page.getByLabel("Telefoonnummer")).toHaveValue("06 12345678");
    await expect(page.getByLabel("Contact e-mailadres")).toHaveValue("info@voorbeeld.nl");
    await expect(page.getByLabel(/Website/)).toHaveValue("https://minameet.nl");
  }
  // De opzoeking draait niet opnieuw over de opgeslagen gegevens.
  await expect(page.getByText(FOUND)).toHaveCount(0);

  // Uitloggen en inloggen: de gegevens zijn klaar, dus de wizard gaat naar de volgende open stap.
  await page.getByRole("button", { name: "Uitloggen" }).click();
  await loginToWizard(page, email);
  await expect(page).toHaveURL(STEP4);
});

test("een KvK-nummer dat al bestaat geeft een nette melding bij het veld", async ({ page }) => {
  const other = await createVendor();
  await insertDetails(other, { kvk: "12345678" });

  await openForm(page);
  await fillAll(page);
  await page.getByRole("button", { name: "Opslaan en verder" }).click();

  await expect(page.locator("#kvk-error")).toHaveText("Dit KvK-nummer is al aangemeld. Neem contact op als dit niet klopt.");
  await expect(page.getByLabel("KvK-nummer")).toBeFocused();
  await expect(page).toHaveURL(STEP3);

  // De melding verdwijnt zodra het veld wordt aangepast.
  await page.getByLabel("KvK-nummer").fill("12345679");
  await expect(page.locator("#kvk-error")).toHaveCount(0);
});

test.describe("later wijzigen op het profiel", () => {
  test("een goedgekeurde partner kan de bedrijfsgegevens met dezelfde validatie wijzigen", async ({ page }) => {
    const email = await createVendor("approved");
    await insertDetails(email, { phone: "+31612345678" });
    await login(page, email);
    await expect(page).toHaveURL(/\/leverancier\/dashboard$/);

    await page.goto("/leverancier/profiel");
    // Het profiel heeft twee formulieren; de bedrijfsgegevens zijn het formulier met het KvK-nummer.
    const form = page.locator("form", { has: page.getByLabel("KvK-nummer") });
    await expect(form.getByLabel("Telefoonnummer")).toHaveValue("06 12345678");

    await form.getByLabel("KvK-nummer").fill("123");
    await form.getByRole("button", { name: "Opslaan" }).click();
    await expect(page.locator("#kvk-error")).toContainText("8 cijfers");

    await form.getByLabel("KvK-nummer").fill("87654321");
    await form.getByLabel("Plaats").fill("Rotterdam");
    await form.getByLabel("Telefoonnummer").fill("+32 470 12 34 56");
    await form.getByRole("button", { name: "Opslaan" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Bedrijfsgegevens opgeslagen" })).toBeVisible();

    const { data } = await admin().from("vendor_details").select("kvk, city, phone").eq("vendor_id", await vendorIdFor(email)).single();
    expect(data).toEqual({ kvk: "87654321", city: "Rotterdam", phone: "+32470123456" });
  });

  test("tijdens de beoordeling zijn de gegevens vergrendeld, ook via de API", async ({ page }) => {
    const email = await createVendor("pending");
    await insertDetails(email);

    const client = anonClient();
    await client.auth.signInWithPassword({ email, password: PASSWORD });
    const update = await client.from("vendor_details").update({ city: "Rotterdam" }).eq("vendor_id", await vendorIdFor(email)).select();
    expect(update.data ?? []).toEqual([]);

    await login(page, email);
    await page.goto("/leverancier/profiel");
    await expect(page.getByText(/tijdelijk vergrendeld/)).toBeVisible();
    await expect(page.getByLabel("KvK-nummer")).toHaveCount(0);
  });
});

test("bedrijfsgegevens zijn niet leesbaar voor een andere partner of anoniem", async () => {
  const owner = await createVendor();
  await insertDetails(owner);
  const ownerVendorId = await vendorIdFor(owner);
  const stranger = await createVendor();

  const asStranger = anonClient();
  await asStranger.auth.signInWithPassword({ email: stranger, password: PASSWORD });
  expect((await asStranger.from("vendor_details").select("*").eq("vendor_id", ownerVendorId)).data).toEqual([]);
  expect((await asStranger.from("vendor_details").update({ city: "Gehackt" }).eq("vendor_id", ownerVendorId).select()).data ?? []).toEqual([]);

  expect((await anonClient().from("vendor_details").select("*").eq("vendor_id", ownerVendorId)).data ?? []).toEqual([]);

  const asOwner = anonClient();
  await asOwner.auth.signInWithPassword({ email: owner, password: PASSWORD });
  expect((await asOwner.from("vendor_details").select("*").eq("vendor_id", ownerVendorId)).data).toHaveLength(1);
});

test("een andere partner kan geen gegevens voor deze partner aanmaken", async () => {
  const victim = await createVendor();
  const victimVendorId = await vendorIdFor(victim);
  const attacker = await createVendor();

  const client = anonClient();
  await client.auth.signInWithPassword({ email: attacker, password: PASSWORD });
  const insert = await client.from("vendor_details").insert({
    vendor_id: victimVendorId,
    kvk: "11111111",
    street: "Dam",
    house_number: 1,
    postal_code: "1012 JS",
    city: "Amsterdam",
    phone: "+31201234567",
    contact_email: "aanvaller@example.com",
  });
  expect(insert.error).not.toBeNull();
});
