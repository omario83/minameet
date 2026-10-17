import { expect, test, type Page } from "@playwright/test";
import { PASSWORD, admin, anonClient, cleanup, createVendor, login, skipWithoutSupabase, vendorIdFor } from "./support";

skipWithoutSupabase();
test.afterEach(cleanup);
test.use({ viewport: { width: 1400, height: 1400 } });

// 2026-10-14 is een woensdag (open), 2026-10-18 een zondag (standaard gesloten).
const OPEN_DAY = "2026-10-14";
const CLOSED_DAY = "2026-10-18";
const SLOT = 28;

async function dragSlots(page: Page, date: string, firstSlot: number, lastSlot: number) {
  const box = await page.locator(`[data-day="${date}"]`).boundingBox();
  if (!box) throw new Error("dagkolom niet gevonden");
  const x = box.x + box.width / 2;
  await page.mouse.move(x, box.y + firstSlot * SLOT + SLOT / 2);
  await page.mouse.down();
  await page.mouse.move(x, box.y + lastSlot * SLOT + SLOT / 2, { steps: 5 });
  await page.mouse.up();
}

test.describe("instelassistent", () => {
  test("een nieuwe partner doorloopt de stappen en landt op het dashboard", async ({ page }) => {
    const email = await createVendor("draft", "E2E Zaal", { setup: false });
    await login(page, email);
    await expect(page).toHaveURL(/\/leverancier\/start$/);

    // De portal is pas bereikbaar na de assistent.
    await page.goto("/leverancier/agenda");
    await expect(page).toHaveURL(/\/leverancier\/start$/);

    await page.getByRole("link", { name: "Aan de slag" }).click();
    await page.getByRole("checkbox", { name: /Feestzalen/ }).check({ force: true });
    await page.getByLabel(/Prijs in €/).fill("1500");
    await page.getByRole("button", { name: "Opslaan en verder" }).click();
    await expect(page).toHaveURL(/\/start\/kalender$/);

    await page.getByRole("button", { name: "Opslaan en verder" }).click();
    await expect(page).toHaveURL(/\/start\/bedrijf$/);
    await page.getByRole("link", { name: "Overslaan" }).click();
    await expect(page).toHaveURL(/\/start\/fotos$/);
    await page.getByRole("link", { name: "Verder" }).click();
    await expect(page).toHaveURL(/\/start\/klaar$/);
    await page.getByRole("button", { name: "Naar mijn dashboard" }).click();
    await expect(page).toHaveURL(/\/leverancier\/dashboard$/);
    await expect(page.getByText("Ga live voor klanten")).toBeVisible();

    const vendorId = await vendorIdFor(email);
    const { data: listings } = await admin().from("listings").select("category, base_price_cents, is_published").eq("vendor_id", vendorId);
    expect(listings).toEqual([{ category: "venue", base_price_cents: 150000, is_published: false }]);
    const { data: vendor } = await admin().from("vendors").select("setup_completed_at").eq("id", vendorId).single();
    expect(vendor?.setup_completed_at).not.toBeNull();

    // Daarna is de assistent niet meer te openen.
    await page.goto("/leverancier/start");
    await expect(page).toHaveURL(/\/leverancier\/dashboard$/);
  });

  test("alles overslaan kan: 'Later afmaken' gaat naar het dashboard", async ({ page }) => {
    const email = await createVendor("draft", "E2E Zaal", { setup: false });
    await login(page, email);
    await page.getByRole("button", { name: "Later afmaken" }).click();
    await expect(page).toHaveURL(/\/leverancier\/dashboard$/);
    expect((await admin().from("listings").select("id").eq("vendor_id", await vendorIdFor(email))).data).toEqual([]);
  });

  test("een prijs die geen bedrag is wordt bij het veld gemeld", async ({ page }) => {
    const email = await createVendor("draft", "E2E Zaal", { setup: false });
    await login(page, email);
    await page.goto("/leverancier/start/diensten");
    await page.getByRole("checkbox", { name: /Catering/ }).check({ force: true });
    await page.getByLabel(/Prijs in €/).fill("veel");
    await page.getByRole("button", { name: "Opslaan en verder" }).click();
    await expect(page.locator("#price_catering-error")).toBeVisible();
    await expect(page).toHaveURL(/\/start\/diensten$/);
  });
});

test.describe("agenda", () => {
  test("een tijdvak slepen maakt een afspraak die je kunt wijzigen en verwijderen", async ({ page }) => {
    const email = await createVendor("approved");
    await login(page, email);
    await page.goto(`/leverancier/agenda?weergave=week&datum=${OPEN_DAY}`);

    // 08:00 is rij 0, dus 10:00 tot 11:00 zijn de rijen 4 en 5.
    await dragSlots(page, OPEN_DAY, 4, 5);
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Van")).toHaveValue("10:00");
    await expect(dialog.getByLabel("Tot")).toHaveValue("11:00");

    await dialog.getByLabel("Titel").fill("Bruiloft bespreken");
    await dialog.getByLabel(/Bedrag/).fill("250");
    await dialog.getByRole("button", { name: "Opslaan" }).click();

    const event = page.getByRole("button", { name: /Bruiloft bespreken/ });
    await expect(event).toBeVisible();
    await expect(page.getByText(/1 afspraak deze week · verwacht €250/)).toBeVisible();

    await event.click();
    await dialog.getByLabel("Titel").fill("Bruiloft intake");
    await dialog.getByRole("button", { name: "Opslaan" }).click();
    await expect(page.getByRole("button", { name: /Bruiloft intake/ })).toBeVisible();

    await page.getByRole("button", { name: /Bruiloft intake/ }).click();
    await dialog.getByRole("button", { name: "Verwijderen" }).click();
    await expect(page.getByRole("button", { name: /Bruiloft intake/ })).toHaveCount(0);
  });

  test("tijd blokkeren toont een gearceerd blok en een gesloten dag is niet te selecteren", async ({ page }) => {
    const email = await createVendor("approved");
    await login(page, email);
    await page.goto(`/leverancier/agenda?weergave=week&datum=${OPEN_DAY}`);
    await expect(page.getByText("Gesloten", { exact: true }).first()).toBeVisible();

    await dragSlots(page, CLOSED_DAY, 2, 3);
    await expect(page.getByRole("dialog")).toBeHidden();

    await dragSlots(page, OPEN_DAY, 6, 9);
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("radio", { name: "Blokkade" }).click();
    await expect(dialog.getByLabel("Titel")).toHaveValue("Geblokkeerd");
    await dialog.getByRole("button", { name: "Opslaan" }).click();
    await expect(page.getByRole("button", { name: /Geblokkeerd/ })).toBeVisible();

    const { data } = await admin().from("agenda_items").select("kind, all_day").eq("vendor_id", await vendorIdFor(email));
    expect(data).toEqual([{ kind: "block", all_day: false }]);
  });

  test("dag, week en maand en vorige/volgende werken via de adresbalk", async ({ page }) => {
    const email = await createVendor("approved");
    await login(page, email);
    await page.goto(`/leverancier/agenda?weergave=week&datum=${OPEN_DAY}`);
    await expect(page.getByRole("heading", { name: "12 okt - 18 oktober 2026" })).toBeVisible();

    await page.getByRole("link", { name: "Volgende" }).click();
    await expect(page.getByRole("heading", { name: "19 okt - 25 oktober 2026" })).toBeVisible();

    await page.getByRole("link", { name: "Maand", exact: true }).click();
    await expect(page.getByRole("heading", { name: "oktober 2026" })).toBeVisible();
    await page.getByRole("link", { name: "Dag", exact: true }).click();
    await expect(page.getByRole("heading", { name: /2026/ })).toBeVisible();
  });

  test("openingstijden in de instellingen bepalen welke dagen gesloten zijn", async ({ page }) => {
    const email = await createVendor("approved");
    await login(page, email);
    await page.goto("/leverancier/profiel");
    await page.getByRole("checkbox", { name: "Gesloten" }).nth(2).check();
    await page.getByRole("button", { name: "Openingstijden opslaan" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Openingstijden opgeslagen" })).toBeVisible();

    await page.goto(`/leverancier/agenda?weergave=week&datum=${OPEN_DAY}`);
    await dragSlots(page, OPEN_DAY, 2, 3);
    await expect(page.getByRole("dialog")).toBeHidden();
  });
});

test.describe("rechten", () => {
  test("een partner ziet en wijzigt de agenda van een ander niet, ook niet via de API", async () => {
    const owner = await createVendor("approved");
    const stranger = await createVendor("approved");
    const ownerId = await vendorIdFor(owner);
    const { data: item } = await admin()
      .from("agenda_items")
      .insert({ vendor_id: ownerId, title: "Privé", starts_at: "2026-10-14T08:00:00Z", ends_at: "2026-10-14T09:00:00Z" })
      .select("id")
      .single();

    const client = anonClient();
    await client.auth.signInWithPassword({ email: stranger, password: PASSWORD });
    expect((await client.from("agenda_items").select("id").eq("id", item!.id)).data).toEqual([]);
    expect((await client.from("agenda_items").update({ title: "Gehackt" }).eq("id", item!.id).select("id")).data).toEqual([]);
    expect((await client.from("agenda_items").delete().eq("id", item!.id).select("id")).data).toEqual([]);
    expect((await client.from("agenda_items").insert({ vendor_id: ownerId, title: "Binnengeslopen", starts_at: "2026-10-14T10:00:00Z", ends_at: "2026-10-14T11:00:00Z" })).error).not.toBeNull();
    expect((await client.from("calendar_feeds").insert({ vendor_id: ownerId, url: "https://example.com/a.ics" })).error).not.toBeNull();

    const { data: still } = await admin().from("agenda_items").select("title").eq("id", item!.id).single();
    expect(still?.title).toBe("Privé");
  });

  test("anoniem is er geen toegang tot de agendatabellen", async () => {
    const anon = anonClient();
    for (const table of ["agenda_items", "calendar_feeds", "vendor_opening_hours"]) {
      const { data, error } = await anon.from(table).select("*");
      expect(error !== null || data?.length === 0).toBe(true);
    }
  });
});
