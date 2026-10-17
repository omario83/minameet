import { expect, test, type Page } from "@playwright/test";
import { admin, anonClient, PASSWORD, cleanup, createListingWithPhotos, createVendor, insertDetails, loginToWizard, skipWithoutSupabase, vendorIdFor } from "./support";

// Stap 4: eerste aanbod met foto's en beschikbaarheid. Vereist de bucket uit 0003 en 0007 en de triggers uit 0010.
skipWithoutSupabase();
test.afterEach(cleanup);

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const MB = 1024 * 1024;

const photoFiles = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ name: `foto-${i + 1}.png`, mimeType: "image/png", buffer: PNG }));

/** Een partner met bedrijfsgegevens, ingelogd op de aanbodstap van de wizard. */
async function openListingStep(page: Page) {
  const email = await createVendor();
  await insertDetails(email);
  await loginToWizard(page, email);
  await expect(page).toHaveURL(/\/leverancier\/aanmelden\/aanbod$/);
  return email;
}

async function createListing(page: Page) {
  await page.getByLabel("Titel").fill("Feestzaal De Oase");
  await page.getByLabel("Omschrijving").fill("Ruime zaal met podium.");
  await page.getByLabel("Prijs (€)").fill("1250");
  await page.getByLabel("Min. gasten").fill("50");
  await page.getByLabel("Max. gasten").fill("300");
  await page.getByRole("button", { name: "Opslaan en foto's toevoegen" }).click();
  await expect(page.getByLabel("Foto's kiezen")).toBeVisible();
}

async function listingOf(email: string) {
  const { data } = await admin().from("listings").select("*").eq("vendor_id", await vendorIdFor(email)).single();
  return data!;
}

test("aanbod maken en vijf foto's tegelijk uploaden", async ({ page }) => {
  const email = await openListingStep(page);
  await createListing(page);

  const listing = await listingOf(email);
  expect(listing).toMatchObject({ category: "venue", title: "Feestzaal De Oase", base_price_cents: 125000, min_guests: 50, max_guests: 300, is_published: false });

  await page.getByLabel("Foto's kiezen").setInputFiles(photoFiles(5));
  await expect(page.getByRole("img", { name: /^Foto \d$/ })).toHaveCount(5, { timeout: 30_000 });
  await expect(page.getByText("Hoofdfoto")).toHaveCount(1);

  const prefix = `${await vendorIdFor(email)}/${listing.id}/`;
  const { photos } = await listingOf(email);
  expect(photos).toHaveLength(5);
  for (const path of photos as string[]) expect(path.startsWith(prefix)).toBe(true);

  await page.getByRole("link", { name: "Verder naar insturen" }).click();
  await expect(page).toHaveURL(/\/insturen$/);
  await expect(page.getByRole("button", { name: "Aanmelding insturen" })).toBeEnabled();
});

test("met minder dan vijf foto's kan de partner niet verder", async ({ page }) => {
  await openListingStep(page);
  await createListing(page);
  await page.getByLabel("Foto's kiezen").setInputFiles(photoFiles(3));
  await expect(page.getByRole("img", { name: /^Foto \d$/ })).toHaveCount(3, { timeout: 30_000 });

  await expect(page.getByText(/Voeg minimaal 5 foto's toe/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Verder naar insturen" })).toHaveCount(0);

  await page.goto("/leverancier/aanmelden/insturen");
  await expect(page.getByRole("button", { name: "Aanmelding insturen" })).toBeDisabled();
});

test("verkeerde bestandstypen en te grote bestanden worden geweigerd, goede foto's gaan door", async ({ page }) => {
  await openListingStep(page);
  await createListing(page);

  await page.getByLabel("Foto's kiezen").setInputFiles([
    { name: "document.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") },
    { name: "nep.jpg", mimeType: "image/jpeg", buffer: Buffer.from("dit is geen afbeelding") },
    { name: "groot.png", mimeType: "image/png", buffer: Buffer.concat([PNG, Buffer.alloc(10 * MB)]) },
    { name: "goed.png", mimeType: "image/png", buffer: PNG },
  ]);

  const alert = page.getByRole("alert").filter({ hasText: "document.pdf" });
  await expect(alert).toContainText("alleen JPG, PNG of WebP");
  await expect(alert).toContainText("groot.png: groter dan 10 MB");
  await expect(alert).toContainText("nep.jpg: Alleen JPG, PNG of WebP is toegestaan");
  await expect(page.getByRole("img", { name: /^Foto \d$/ })).toHaveCount(1, { timeout: 30_000 });
});

test("met meer dan één aanbod opent de wizard het aanbod dat nog foto's mist en kan de partner wisselen", async ({ page }) => {
  const email = await createVendor();
  await insertDetails(email);
  await createListingWithPhotos(email, 5, "Zaal compleet");
  await createListingWithPhotos(email, 3, "Zaal onvolledig");

  await loginToWizard(page, email);
  await expect(page).toHaveURL(/\/leverancier\/aanmelden\/aanbod$/);
  await expect(page.getByLabel("Titel")).toHaveValue("Zaal onvolledig");

  const nav = page.getByRole("navigation", { name: "Jouw aanbod" });
  await expect(nav.getByRole("link")).toHaveText([/Zaal compleet · 5\/5 foto's/, /Zaal onvolledig · 3\/5 foto's/]);
  await expect(page.getByRole("link", { name: "Verder naar insturen" })).toHaveCount(0);

  await nav.getByRole("link", { name: /Zaal compleet/ }).click();
  await expect(page.getByLabel("Titel")).toHaveValue("Zaal compleet");

  await nav.getByRole("link", { name: /Zaal onvolledig/ }).click();
  await expect(page.getByLabel("Titel")).toHaveValue("Zaal onvolledig");
  await page.getByLabel("Foto's kiezen").setInputFiles(photoFiles(2));
  await expect(page.getByRole("img", { name: /^Foto \d$/ })).toHaveCount(5, { timeout: 30_000 });
  await expect(page.getByRole("link", { name: "Verder naar insturen" })).toBeVisible();
});

test("een foto verwijderen", async ({ page }) => {
  await openListingStep(page);
  await createListing(page);
  await page.getByLabel("Foto's kiezen").setInputFiles(photoFiles(2));
  await expect(page.getByRole("img", { name: /^Foto \d$/ })).toHaveCount(2, { timeout: 30_000 });

  await page.getByRole("button", { name: "Verwijder" }).first().click();
  await expect(page.getByRole("img", { name: /^Foto \d$/ })).toHaveCount(1);
});

test("beschikbaarheid: een dag op optie zetten wordt opgeslagen", async ({ page }) => {
  const email = await openListingStep(page);
  await createListing(page);
  const listing = await listingOf(email);

  await page.getByRole("button", { name: "Volgende maand" }).click();
  await page.getByRole("button", { name: "15", exact: true }).click();

  await expect
    .poll(async () => (await admin().from("availability").select("status").eq("listing_id", listing.id)).data?.[0]?.status, { timeout: 10_000 })
    .toBe("option");
});

test.describe("Storage-regels via de API", () => {
  async function ownerClient() {
    const email = await createVendor();
    await insertDetails(email);
    const client = anonClient();
    await client.auth.signInWithPassword({ email, password: PASSWORD });
    const vendorId = await vendorIdFor(email);
    const { data } = await admin().from("listings").insert({ vendor_id: vendorId, category: "venue", title: "API" }).select("id").single();
    return { email, client, vendorId, listingId: data!.id as string };
  }

  test("uploaden mag alleen in de eigen map, als jpeg/png/webp en tot 10 MB", async () => {
    const { client, vendorId, listingId } = await ownerClient();
    const other = await createVendor();
    const otherVendorId = await vendorIdFor(other);
    const bucket = client.storage.from("listing-photos");

    expect((await bucket.upload(`${vendorId}/${listingId}/ok.png`, PNG, { contentType: "image/png" })).error).toBeNull();

    // In de map van een ander
    expect((await bucket.upload(`${otherVendorId}/${listingId}/x.png`, PNG, { contentType: "image/png" })).error).not.toBeNull();
    // Pad zonder geldige vendor-uuid en te diep pad
    expect((await bucket.upload(`geen-uuid/${listingId}/x.png`, PNG, { contentType: "image/png" })).error).not.toBeNull();
    expect((await bucket.upload(`${vendorId}/${listingId}/map/x.png`, PNG, { contentType: "image/png" })).error).not.toBeNull();
    // Verkeerd bestandstype
    expect((await bucket.upload(`${vendorId}/${listingId}/tekst.txt`, Buffer.from("hallo"), { contentType: "text/plain" })).error).not.toBeNull();
    expect((await bucket.upload(`${vendorId}/${listingId}/script.svg`, Buffer.from("<svg/>"), { contentType: "image/svg+xml" })).error).not.toBeNull();
    // Te groot
    const tooBig = Buffer.concat([PNG, Buffer.alloc(10 * MB)]);
    expect((await bucket.upload(`${vendorId}/${listingId}/groot.png`, tooBig, { contentType: "image/png" })).error).not.toBeNull();
    // Anoniem
    expect((await anonClient().storage.from("listing-photos").upload(`${vendorId}/${listingId}/anoniem.png`, PNG, { contentType: "image/png" })).error).not.toBeNull();
  });

  test("een andere partner kan geen foto's verwijderen", async () => {
    const { client, vendorId, listingId } = await ownerClient();
    const path = `${vendorId}/${listingId}/eigen.png`;
    await client.storage.from("listing-photos").upload(path, PNG, { contentType: "image/png" });

    const intruderEmail = await createVendor();
    const intruder = anonClient();
    await intruder.auth.signInWithPassword({ email: intruderEmail, password: PASSWORD });
    const removed = await intruder.storage.from("listing-photos").remove([path]);
    expect(removed.data ?? []).toHaveLength(0);

    const { data } = await admin().storage.from("listing-photos").list(`${vendorId}/${listingId}`);
    expect(data?.map((f) => f.name)).toContain("eigen.png");
  });

  test("verzonnen fotopaden tellen niet mee voor de minimale vijf foto's", async () => {
    const { client, vendorId, listingId } = await ownerClient();
    const prefix = `${vendorId}/${listingId}/`;

    const fake = await client.from("listings").update({ photos: Array.from({ length: 5 }, (_, i) => `${prefix}nep${i}.png`) }).eq("id", listingId);
    expect(fake.error).toBeNull();
    const submitFake = await client.rpc("submit_vendor_for_review");
    expect(submitFake.error?.message).toContain("5 foto");

    // Paden buiten het eigen aanbod, met padtrucs of te veel foto's worden direct geweigerd.
    expect((await client.from("listings").update({ photos: ["andere-vendor/ander-aanbod/x.png"] }).eq("id", listingId)).error?.message).toContain("Ongeldig fotopad");
    expect((await client.from("listings").update({ photos: [`${prefix}../../x.png`] }).eq("id", listingId)).error?.message).toContain("Ongeldig fotopad");
    const nine = Array.from({ length: 9 }, (_, i) => `${prefix}${i}.png`);
    expect((await client.from("listings").update({ photos: nine }).eq("id", listingId)).error?.message).toContain("Maximaal 8");
  });

  test("met vijf echte foto's lukt insturen", async () => {
    const { client, vendorId, listingId } = await ownerClient();
    const paths = Array.from({ length: 5 }, (_, i) => `${vendorId}/${listingId}/echt${i}.png`);
    for (const path of paths) {
      expect((await client.storage.from("listing-photos").upload(path, PNG, { contentType: "image/png" })).error).toBeNull();
    }
    expect((await client.from("listings").update({ photos: paths }).eq("id", listingId)).error).toBeNull();

    expect((await client.rpc("submit_vendor_for_review")).error).toBeNull();
    const { data } = await admin().from("vendors").select("status").eq("id", vendorId).single();
    expect(data?.status).toBe("pending");
  });
});
