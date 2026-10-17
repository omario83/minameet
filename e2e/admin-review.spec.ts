import { expect, test, type Page } from "@playwright/test";
import { sentTo, startMailSink, stopMailSink, waitForSent } from "./mail-sink";
import {
  PASSWORD,
  admin,
  anonClient,
  cleanup,
  createAdminUser,
  createListingWithPhotos,
  createVendor,
  insertDetails,
  login,
  loginAdmin,
  loginToWizard,
  skipWithoutSupabase,
  usersWithEmail,
  vendorIdFor,
} from "./support";

// Stap 6: beoordeling door de beheerder. De dev-server heeft SUPABASE_SERVICE_ROLE_KEY nodig om het adres van de partner op te zoeken.
skipWithoutSupabase();
test.afterEach(cleanup);
test.beforeAll(startMailSink);
test.afterAll(stopMailSink);

const unique = () => Math.random().toString(36).slice(2, 8);

async function submittedVendor(status: "pending" | "approved" = "pending") {
  const company = `Zaal ${unique()}`;
  const email = await createVendor(status, company);
  await insertDetails(email, { kvk: String(10_000_000 + Math.floor(Math.random() * 89_999_999)) });
  const listingId = await createListingWithPhotos(email, 5);
  if (status === "approved") await admin().from("listings").update({ is_published: true }).eq("id", listingId);
  return { company, email, listingId, vendorId: await vendorIdFor(email) };
}

async function openReview(page: Page, company: string) {
  await page.locator("li", { hasText: company }).getByRole("link", { name: "Beoordelen" }).click();
  await expect(page.getByRole("heading", { name: company })).toBeVisible();
}

const vendorRow = async (vendorId: string) =>
  (await admin().from("vendors").select("status, reviewed_at, rejection_reason").eq("id", vendorId).single()).data!;

const publicListing = async (listingId: string) =>
  (await anonClient().from("listings").select("id").eq("id", listingId)).data ?? [];

test("goedkeuren publiceert het aanbod en informeert de partner", async ({ page, request }) => {
  const { company, email, listingId, vendorId } = await submittedVendor();
  expect(await publicListing(listingId)).toEqual([]);
  expect((await request.get(`/aanbod/${listingId}`)).status()).toBe(404);

  await loginAdmin(page, await createAdminUser());
  await expect(page.locator("li", { hasText: company })).toContainText("Wacht op beoordeling");
  await openReview(page, company);
  await expect(page.getByText(/KvK-nummer/)).toBeVisible();
  await expect(page.getByText("Feestzaal De Oase")).toBeVisible();
  await expect(page.getByRole("img", { name: /Feestzaal De Oase, foto/ })).toHaveCount(5);

  await page.getByRole("button", { name: "Goedkeuren" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Partner goedgekeurd" })).toContainText("per e-mail op de hoogte gebracht");
  await expect(page.getByRole("button", { name: "Goedkeuren" })).toHaveCount(0);

  const row = await vendorRow(vendorId);
  expect(row.status).toBe("approved");
  expect(row.reviewed_at).not.toBeNull();
  expect((await admin().from("listings").select("is_published").eq("id", listingId).single()).data?.is_published).toBe(true);

  const mail = await waitForSent(email, /is goedgekeurd/);
  expect(mail.text).toContain(company);
  expect(mail.text).toContain("/leverancier/inloggen");

  const [owner] = await usersWithEmail(email);
  const { data: notes } = await admin().from("notifications").select("title").eq("user_id", owner.id);
  expect(notes?.map((n) => n.title)).toContain("Je aanmelding is goedgekeurd");

  expect(await publicListing(listingId)).toHaveLength(1);
  expect((await request.get(`/aanbod/${listingId}`)).status()).toBe(200);
});

test("afkeuren vraagt een reden, mailt die en laat de partner opnieuw insturen", async ({ page }) => {
  const { company, email, listingId, vendorId } = await submittedVendor();
  await loginAdmin(page, await createAdminUser());
  await openReview(page, company);

  await page.getByLabel(/Reden/).fill("     ");
  await page.getByRole("button", { name: "Afkeuren" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Geef een reden op" })).toBeVisible();
  expect((await vendorRow(vendorId)).status).toBe("pending");

  await page.getByLabel(/Reden/).fill("KvK-nummer klopt niet");
  await page.getByRole("button", { name: "Afkeuren" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Partner afgekeurd" })).toBeVisible();

  expect(await vendorRow(vendorId)).toMatchObject({ status: "rejected", rejection_reason: "KvK-nummer klopt niet" });
  expect(await publicListing(listingId)).toEqual([]);
  const mail = await waitForSent(email, /niet goedgekeurd/);
  expect(mail.text).toContain("Reden: KvK-nummer klopt niet");

  await page.context().clearCookies();
  await loginToWizard(page, email);
  await expect(page).toHaveURL(/\/leverancier\/aanmelden\/insturen$/);
  await expect(page.getByText("Reden: KvK-nummer klopt niet")).toBeVisible();
});

test("een dubbele klik op goedkeuren stuurt één mail", async ({ page }) => {
  const { company, email, vendorId } = await submittedVendor();
  await loginAdmin(page, await createAdminUser());
  await openReview(page, company);

  await page.getByRole("button", { name: "Goedkeuren" }).dblclick();
  await expect(page.getByRole("status").filter({ hasText: "Partner goedgekeurd" })).toBeVisible();
  await waitForSent(email, /is goedgekeurd/);
  await new Promise((resolve) => setTimeout(resolve, 1500));

  expect(sentTo(email).filter((m) => /is goedgekeurd/.test(m.subject))).toHaveLength(1);
  expect((await vendorRow(vendorId)).status).toBe("approved");
});

test("als de mail niet verstuurd kan worden, blijft de beoordeling staan en ziet de beheerder een waarschuwing", async ({ page }) => {
  const { company, vendorId } = await submittedVendor();
  await loginAdmin(page, await createAdminUser());
  await openReview(page, company);

  await stopMailSink();
  try {
    await page.getByRole("button", { name: "Goedkeuren" }).click();
    await expect(page.getByRole("status")).toContainText("e-mail kon niet worden verstuurd");
    expect((await vendorRow(vendorId)).status).toBe("approved");
  } finally {
    await startMailSink();
  }
});

test("blokkeren verbergt het aanbod, deblokkeren toont het weer en de commissie is aan te passen", async ({ page, request }) => {
  const { company, listingId, vendorId } = await submittedVendor("approved");
  expect(await publicListing(listingId)).toHaveLength(1);

  await loginAdmin(page, await createAdminUser());
  const rowEl = page.locator("li", { hasText: company });

  await rowEl.getByRole("combobox").selectOption("suspended");
  await rowEl.getByLabel(/Commissie/).fill("15");
  await rowEl.getByRole("button", { name: "Opslaan" }).click();
  await expect.poll(async () => (await vendorRow(vendorId)).status).toBe("suspended");
  expect((await admin().from("vendors").select("commission_pct").eq("id", vendorId).single()).data?.commission_pct).toBe(15);
  expect(await publicListing(listingId)).toEqual([]);
  expect((await request.get(`/aanbod/${listingId}`)).status()).toBe(404);

  await rowEl.getByRole("combobox").selectOption("approved");
  await rowEl.getByRole("button", { name: "Opslaan" }).click();
  await expect.poll(async () => (await vendorRow(vendorId)).status).toBe("approved");
  expect(await publicListing(listingId)).toHaveLength(1);
});

test.describe("rechten", () => {
  test("alleen een beheerder kan beoordelen, en alleen ingestuurde aanmeldingen", async () => {
    const { vendorId } = await submittedVendor();

    const partnerEmail = await createVendor();
    const partner = anonClient();
    await partner.auth.signInWithPassword({ email: partnerEmail, password: PASSWORD });
    expect((await partner.rpc("approve_vendor", { p_vendor_id: vendorId })).error?.message).toContain("Geen toegang");
    expect((await partner.rpc("reject_vendor", { p_vendor_id: vendorId, p_reason: "nee" })).error?.message).toContain("Geen toegang");
    expect((await anonClient().rpc("approve_vendor", { p_vendor_id: vendorId })).error).not.toBeNull();

    const adminClient = anonClient();
    await adminClient.auth.signInWithPassword({ email: await createAdminUser(), password: PASSWORD });
    const draftVendorId = await vendorIdFor(partnerEmail);
    expect((await adminClient.rpc("approve_vendor", { p_vendor_id: draftVendorId })).error?.message).toContain("Alleen ingestuurde");
    expect((await adminClient.rpc("reject_vendor", { p_vendor_id: vendorId, p_reason: "  " })).error?.message).toContain("Geef een reden op");
    expect((await adminClient.rpc("approve_vendor", { p_vendor_id: crypto.randomUUID() })).error?.message).toContain("niet gevonden");
    expect((await vendorRow(vendorId)).status).toBe("pending");
  });

  test("de beheerpagina's zijn niet voor anonieme bezoekers en partners", async ({ page }) => {
    const { vendorId, email } = await submittedVendor();

    await page.goto(`/admin/partners/${vendorId}`);
    await expect(page).toHaveURL(/\/admin\/inloggen/);

    await login(page, email);
    await page.goto(`/admin/partners/${vendorId}`);
    await expect(page).toHaveURL(/\/leverancier\/dashboard$/);
  });
});
