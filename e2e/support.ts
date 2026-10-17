import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

// Vereist een test- of lokale Supabase (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in de omgeving).
// Met Turnstile aan: gebruik Cloudflare's testsleutels (site key 1x00000000000000000000AA).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function skipWithoutSupabase() {
  test.skip(!url || !serviceKey, "NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY ontbreken");
}

export const PASSWORD = "E2e-wachtwoord-123";
export const admin = () => createClient(url!, serviceKey!, { auth: { persistSession: false } });
export const anonClient = () => createClient(url!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

export async function vendorIdFor(email: string) {
  const [user] = await usersWithEmail(email);
  const { data } = await admin().from("vendors").select("id").eq("owner_id", user.id).single();
  return data!.id as string;
}

/** Bedrijfsgegevens rechtstreeks in de database, voor tests die een bestaande situatie nodig hebben. */
export async function insertDetails(email: string, overrides: Record<string, unknown> = {}) {
  const { error } = await admin()
    .from("vendor_details")
    .insert({
      vendor_id: await vendorIdFor(email),
      kvk: "87654321",
      street: "Dam",
      house_number: 1,
      postal_code: "1012 JS",
      city: "Amsterdam",
      phone: "+31201234567",
      contact_email: email,
      ...overrides,
    });
  if (error) throw error;
}

export const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

/** Een aanbod met `photoCount` echte foto's in Storage, rechtstreeks aangemaakt met de servicesleutel. */
export async function createListingWithPhotos(email: string, photoCount = 5, title = "Feestzaal De Oase") {
  const vendorId = await vendorIdFor(email);
  const listingId = crypto.randomUUID();
  const paths = Array.from({ length: photoCount }, (_, i) => `${vendorId}/${listingId}/seed${i}.png`);
  for (const path of paths) {
    const { error } = await admin().storage.from("listing-photos").upload(path, PNG, { contentType: "image/png" });
    if (error) throw error;
  }
  const { error } = await admin()
    .from("listings")
    .insert({ id: listingId, vendor_id: vendorId, category: "venue", title, base_price_cents: 125000, min_guests: 50, max_guests: 300, photos: paths });
  if (error) throw error;
  return listingId;
}

const created = new Set<string>();

export function uniqueEmail() {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  created.add(email);
  return email;
}

export async function usersWithEmail(email: string) {
  const { data, error } = await admin().auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.filter((u) => u.email === email);
}

export async function cleanup() {
  for (const email of created) {
    for (const user of await usersWithEmail(email)) await admin().auth.admin.deleteUser(user.id);
  }
  created.clear();
}

/** Een bevestigd partneraccount, optioneel met een andere status dan draft. `setup: false` laat de instelassistent nog open staan. */
export async function createVendor(status?: "draft" | "pending" | "approved" | "rejected", company = "E2E Zaal", { setup = true } = {}) {
  const email = uniqueEmail();
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { role: "vendor", full_name: "E2E Tester", company_name: company, category: "venue", terms_version: "e2e" },
  });
  if (error) throw error;
  if (status && status !== "draft") await admin().from("vendors").update({ status }).eq("owner_id", data.user.id);
  if (setup) await admin().from("vendors").update({ setup_completed_at: new Date().toISOString() }).eq("owner_id", data.user.id);
  return email;
}

/** Wacht tot Turnstile zijn token heeft gezet (alleen als er een sitesleutel is). */
export async function captchaReady(page: Page) {
  if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) return;
  await expect(page.locator('input[name="cf-turnstile-response"]').first()).not.toHaveValue("", { timeout: 20_000 });
}

export async function fillSignup(page: Page, email: string) {
  await page.goto("/leverancier/registreren");
  await page.getByLabel("Contactpersoon").fill("E2E Tester");
  await page.getByLabel("Bedrijfsnaam").fill("E2E Zaal");
  await page.getByLabel("Categorie").selectOption("venue");
  await page.getByLabel("Zakelijk e-mailadres").fill(email);
  await page.getByLabel("Wachtwoord", { exact: true }).fill(PASSWORD);
  await page.getByLabel(/Ik ga akkoord/).check();
  await captchaReady(page);
}

export async function signUp(page: Page, email: string) {
  await fillSignup(page, email);
  await page.getByRole("button", { name: "Account aanmaken" }).click();
  await expect(page).toHaveURL(/\/leverancier\/registreren\/controleer-mail/);
}

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto("/leverancier/inloggen");
  await page.getByLabel("E-mailadres").fill(email);
  await page.getByLabel("Wachtwoord", { exact: true }).fill(password);
  await captchaReady(page);
  await page.getByRole("button", { name: "Inloggen", exact: true }).click();
}

/** Inloggen en daarna de aanmeldwizard openen, die naar de juiste stap doorstuurt. */
export async function loginToWizard(page: Page, email: string) {
  await login(page, email);
  await expect(page).toHaveURL(/\/leverancier\/dashboard$/);
  await page.goto("/leverancier/aanmelden");
}

/** Een beheerder: een gewone gebruiker waarvan de rol met de servicesleutel op admin is gezet. */
export async function createAdminUser() {
  const email = uniqueEmail();
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { role: "customer", full_name: "E2E Beheerder" },
  });
  if (error) throw error;
  const update = await admin().from("profiles").update({ role: "admin" }).eq("id", data.user.id);
  if (update.error) throw update.error;
  return email;
}

export async function loginAdmin(page: Page, email: string) {
  await page.goto("/admin/inloggen");
  await page.getByLabel("E-mailadres").fill(email);
  await page.getByLabel("Wachtwoord", { exact: true }).fill(PASSWORD);
  await captchaReady(page);
  await page.getByRole("button", { name: "Inloggen", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
}
