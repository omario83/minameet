import { expect, test } from "@playwright/test";
import { E2E_ADMIN_EMAIL, sentTo, startMailSink, stopMailSink, waitForSent } from "./mail-sink";
import { PASSWORD, admin, anonClient, cleanup, createListingWithPhotos, createVendor, insertDetails, login, loginToWizard, skipWithoutSupabase, vendorIdFor } from "./support";

// Stap 5: insturen ter controle. Mails worden opgevangen door een nepserver (RESEND_API_URL in playwright.config.ts).
skipWithoutSupabase();
test.afterEach(cleanup);
test.beforeAll(startMailSink);
test.afterAll(stopMailSink);

async function readyVendor(status?: "rejected") {
  const email = await createVendor(status);
  await insertDetails(email);
  const listingId = await createListingWithPhotos(email, 5);
  return { email, listingId, vendorId: await vendorIdFor(email) };
}

async function vendorRow(vendorId: string) {
  const { data } = await admin().from("vendors").select("status, submitted_at, reviewed_at, rejection_reason").eq("id", vendorId).single();
  return data!;
}

test("insturen zet de status op pending en stuurt een mail naar de partner en de admin", async ({ page }) => {
  const { email, vendorId } = await readyVendor();
  await loginToWizard(page, email);
  await expect(page).toHaveURL(/\/leverancier\/aanmelden\/insturen$/);
  await expect(page.getByText("Dit sturen we in")).toBeVisible();
  await expect(page.getByText("Feestzaal De Oase")).toBeVisible();

  await page.getByRole("button", { name: "Aanmelding insturen" }).click();
  await expect(page).toHaveURL(/\/leverancier\/dashboard$/);
  await expect(page.getByText(/wordt beoordeeld/)).toBeVisible();

  const row = await vendorRow(vendorId);
  expect(row.status).toBe("pending");
  expect(row.submitted_at).not.toBeNull();

  const received = await waitForSent(email, /We hebben je aanmelding ontvangen/);
  expect(received.text).toContain("E2E Zaal");
  const notice = await waitForSent(E2E_ADMIN_EMAIL, new RegExp(`Nieuwe aanmelding: E2E Zaal`));
  expect(notice.text).toContain(`/admin/partners/${vendorId}`);
});

test("een dubbele klik stuurt één keer in en één mail per ontvanger", async ({ page }) => {
  const { email, vendorId } = await readyVendor();
  await loginToWizard(page, email);
  await expect(page).toHaveURL(/insturen$/);

  await page.getByRole("button", { name: "Aanmelding insturen" }).dblclick();
  await expect(page).toHaveURL(/\/leverancier\/dashboard$/);
  await waitForSent(email, /We hebben je aanmelding ontvangen/);
  await new Promise((resolve) => setTimeout(resolve, 1500));

  expect(sentTo(email).filter((m) => /aanmelding ontvangen/.test(m.subject))).toHaveLength(1);
  expect((await vendorRow(vendorId)).status).toBe("pending");
});

test("zonder vijf foto's is insturen uitgeschakeld", async ({ page }) => {
  const email = await createVendor();
  await insertDetails(email);
  await createListingWithPhotos(email, 4);

  await login(page, email);
  await page.goto("/leverancier/aanmelden/insturen");
  await expect(page.getByRole("button", { name: "Aanmelding insturen" })).toBeDisabled();
  await expect(page.getByText("Minimaal 5 foto's bij elk aanbod")).toBeVisible();
});

test("tijdens de beoordeling is het aanbod vergrendeld, ook via de API", async ({ page }) => {
  const { email, listingId, vendorId } = await readyVendor();
  await loginToWizard(page, email);
  await page.getByRole("button", { name: "Aanmelding insturen" }).click();
  await expect(page).toHaveURL(/dashboard$/);

  const client = anonClient();
  await client.auth.signInWithPassword({ email, password: PASSWORD });
  expect((await client.from("listings").update({ title: "Aangepast" }).eq("id", listingId)).error?.message).toContain("tijdens de beoordeling");
  expect((await client.from("listings").insert({ vendor_id: vendorId, category: "dj", title: "Extra" })).error?.message).toContain("tijdens de beoordeling");
  expect((await client.from("listings").delete().eq("id", listingId)).error?.message).toContain("tijdens de beoordeling");

  // In de portal krijgt de partner de uitleg te zien en de wizard stuurt door naar het dashboard.
  await page.goto(`/leverancier/aanbod/${listingId}`);
  await page.getByRole("button", { name: "Wijzigingen opslaan" }).click();
  await expect(page.getByText("tijdens de beoordeling")).toBeVisible();
  await page.goto("/leverancier/aanmelden/insturen");
  await expect(page).toHaveURL(/dashboard$/);
});

test("een afgekeurde partner ziet de reden en kan opnieuw insturen", async ({ page }) => {
  const { email, vendorId } = await readyVendor("rejected");
  await admin().from("vendors").update({ rejection_reason: "KvK-nummer klopt niet", reviewed_at: new Date().toISOString() }).eq("id", vendorId);

  await loginToWizard(page, email);
  await expect(page).toHaveURL(/\/leverancier\/aanmelden\/insturen$/);
  await expect(page.getByText("Reden: KvK-nummer klopt niet")).toBeVisible();

  await page.getByRole("button", { name: "Aanmelding insturen" }).click();
  await expect(page).toHaveURL(/dashboard$/);

  const row = await vendorRow(vendorId);
  expect(row).toMatchObject({ status: "pending", rejection_reason: null, reviewed_at: null });
  await waitForSent(email, /We hebben je aanmelding ontvangen/);
});

test("een partner zonder vastgelegd akkoord geeft dat alsnog bij het insturen", async ({ page }) => {
  const { email, vendorId } = await readyVendor();
  await admin().from("vendors").update({ terms_accepted_at: null, terms_version: null }).eq("id", vendorId);

  const client = anonClient();
  await client.auth.signInWithPassword({ email, password: PASSWORD });
  expect((await client.rpc("submit_vendor_for_review")).error?.message).toContain("partnervoorwaarden");

  await loginToWizard(page, email);
  await expect(page).toHaveURL(/insturen$/);
  const button = page.getByRole("button", { name: "Aanmelding insturen" });
  await expect(button).toBeDisabled();
  await page.getByLabel(/Ik ga akkoord/).check();
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page).toHaveURL(/dashboard$/);

  const { data } = await admin().from("vendors").select("status, terms_version, terms_accepted_at").eq("id", vendorId).single();
  expect(data?.status).toBe("pending");
  expect(data?.terms_version).toBeTruthy();
  expect(data?.terms_accepted_at).not.toBeNull();
});

test("een vastgelegd akkoord kan niet worden overschreven en het vinkje verschijnt dan niet meer", async ({ page }) => {
  const { email, vendorId } = await readyVendor();
  const client = anonClient();
  await client.auth.signInWithPassword({ email, password: PASSWORD });
  await client.rpc("accept_partner_terms", { p_version: "nep-versie" });
  expect((await admin().from("vendors").select("terms_version").eq("id", vendorId).single()).data?.terms_version).toBe("e2e");

  await loginToWizard(page, email);
  await expect(page).toHaveURL(/insturen$/);
  await expect(page.getByLabel(/Ik ga akkoord/)).toHaveCount(0);
});

test.describe("rechten", () => {
  test("een partner kan zijn eigen status, commissie of beoordeling niet wijzigen", async () => {
    const email = await createVendor();
    const vendorId = await vendorIdFor(email);
    const client = anonClient();
    await client.auth.signInWithPassword({ email, password: PASSWORD });

    for (const change of [{ status: "approved" }, { status: "pending" }, { commission_pct: 0 }, { rejection_reason: "x" }, { terms_version: "andere" }, { submitted_at: new Date().toISOString() }]) {
      const result = await client.from("vendors").update(change).eq("id", vendorId).select();
      expect(result.error?.message, JSON.stringify(change)).toContain("Alleen een admin");
    }
    expect((await vendorRow(vendorId)).status).toBe("draft");
  });

  test("anoniem en klanten kunnen niet insturen", async () => {
    const anonymous = await anonClient().rpc("submit_vendor_for_review");
    expect(anonymous.error).not.toBeNull();

    const customer = `e2e-klant-${Date.now()}@example.com`;
    await admin().auth.admin.createUser({ email: customer, password: PASSWORD, email_confirm: true, user_metadata: { role: "customer", full_name: "Klant" } });
    const client = anonClient();
    await client.auth.signInWithPassword({ email: customer, password: PASSWORD });
    expect((await client.rpc("submit_vendor_for_review")).error?.message).toContain("Geen leveranciersaccount");

    const { data } = await admin().auth.admin.listUsers({ perPage: 1000 });
    for (const user of data.users.filter((u) => u.email === customer)) await admin().auth.admin.deleteUser(user.id);
  });
});
