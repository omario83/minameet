import { expect, test } from "@playwright/test";
import { admin, cleanup, fillSignup, signUp, skipWithoutSupabase, uniqueEmail, usersWithEmail } from "./support";

skipWithoutSupabase();
test.afterEach(cleanup);

test("volledige registratie maakt een concept-partner aan", async ({ page }) => {
  const email = uniqueEmail();
  await signUp(page, email);

  const users = await usersWithEmail(email);
  expect(users).toHaveLength(1);

  const { data: vendor } = await admin()
    .from("vendors")
    .select("status, primary_category, terms_version, terms_accepted_at, company_name")
    .eq("owner_id", users[0].id)
    .single();
  expect(vendor).toMatchObject({ status: "draft", primary_category: "venue", company_name: "E2E Zaal" });
  expect(vendor?.terms_version).toBeTruthy();
  expect(vendor?.terms_accepted_at).toBeTruthy();
});

test("een bestaand e-mailadres geeft dezelfde uitkomst en verraadt niets", async ({ page }) => {
  const email = uniqueEmail();
  await signUp(page, email);

  await signUp(page, email);
  await expect(page.locator("body")).not.toContainText(/bestaat al|al in gebruik|already/i);
  expect(await usersWithEmail(email)).toHaveLength(1);
});

test("een dubbele klik maakt één account en één verzending", async ({ page }) => {
  const email = uniqueEmail();
  const submissions: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.headers()["next-action"]) submissions.push(request.url());
  });

  await fillSignup(page, email);
  await page.getByRole("button", { name: "Account aanmaken" }).dblclick();
  await expect(page).toHaveURL(/controleer-mail/);

  expect(submissions).toHaveLength(1);
  expect(await usersWithEmail(email)).toHaveLength(1);
});

test("validatie: inline fouten, aria-attributen en focus op het eerste foute veld", async ({ page }) => {
  await page.goto("/leverancier/registreren");

  const email = page.getByLabel("Zakelijk e-mailadres");
  await email.fill("geen-email");
  await email.blur();
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#email-error")).toHaveText("Vul een geldig e-mailadres in");
  await expect(email).toHaveAttribute("aria-describedby", /email-error/);

  await email.fill("info@voorbeeld.nl");
  await expect(email).not.toHaveAttribute("aria-invalid", "true");

  await page.getByRole("button", { name: "Account aanmaken" }).click();
  await expect(page.getByLabel("Contactpersoon")).toBeFocused();
  await expect(page).toHaveURL(/\/leverancier\/registreren$/);
});

test("wachtwoord: minimaal 10 tekens, tonen en verbergen", async ({ page }) => {
  await page.goto("/leverancier/registreren");
  const password = page.getByLabel("Wachtwoord", { exact: true });

  await password.fill("123456789");
  await password.blur();
  await expect(page.locator("#password-error")).toContainText("minimaal 10");

  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Toon wachtwoord" }).click();
  await expect(password).toHaveAttribute("type", "text");
});
