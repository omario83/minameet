"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { ROLE_HOME, getProfile, safeNext, type Role } from "@/lib/auth";
import { PARTNER_TERMS_VERSION } from "@/lib/legal";
import { getPendingEmail, resendCooldownSeconds, setPendingEmail } from "@/lib/pending-email";
import { VENDOR_HOME_PATH, VENDOR_RESET_PATH, callbackFailurePath, callbackNext, vendorLoginDestination } from "@/lib/redirects";
import { vendorSignUpSchema } from "@/lib/schemas/vendor-signup";
import { createClient } from "@/lib/supabase/server";

export type FormState =
  | { error?: string; message?: string; fieldErrors?: Record<string, string>; needsConfirmation?: boolean }
  | undefined;

export type ResendState = { error?: string; message?: string; retryAfter?: number } | undefined;

const credentials = z.object({
  email: z.email("Vul een geldig e-mailadres in"),
  password: z.string().min(8, "Wachtwoord moet minimaal 8 tekens zijn"),
});

const customerSignUp = credentials.extend({ full_name: z.string().trim().min(2, "Vul je naam in") });

// Schema is gedeeld met het formulier; de server voegt het akkoord op de voorwaarden toe.
const vendorSignUp = vendorSignUpSchema.transform(({ email, password, full_name, company_name, category }) => ({
  email,
  password,
  full_name,
  company_name,
  category,
  terms_version: PARTNER_TERMS_VERSION,
  terms_accepted_at: new Date().toISOString(),
}));

const CHECK_MAIL = "Check je e-mail om je account te bevestigen.";
const VENDOR_CHECK_MAIL_PATH = "/leverancier/registreren/controleer-mail";
const CAPTCHA_FAILED = "Verificatie mislukt. Probeer het opnieuw.";

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

function callbackUrl(next: string) {
  return `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`;
}

/** Turnstile zet zijn token zelf als verborgen veld in het formulier. */
function captchaToken(formData: FormData) {
  const token = formData.get("cf-turnstile-response");
  return typeof token === "string" && token ? token : undefined;
}

async function signUp(
  role: "customer" | "vendor",
  schema: z.ZodType<Record<string, string>>,
  formData: FormData,
): Promise<FormState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { email, password, ...profile } = parsed.data;
  const home = role === "vendor" ? VENDOR_HOME_PATH : ROLE_HOME.customer;
  const requested = safeNext(formData.get("next"), role);
  // Partners zien altijd dezelfde pagina, ook bij een bestaand adres. Het adres staat in een ondertekende cookie, niet in de URL.
  const checkMail = async (): Promise<FormState> => {
    if (role !== "vendor") return { message: CHECK_MAIL };
    await setPendingEmail(email);
    redirect(VENDOR_CHECK_MAIL_PATH);
  };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { ...profile, role },
      captchaToken: captchaToken(formData),
      emailRedirectTo: callbackUrl(callbackNext(requested, role) ?? home),
    },
  });
  if (error) {
    // Bestaand adres: dezelfde uitkomst als bij succes, zodat niet te zien is wie al een account heeft.
    if (error.code === "user_already_exists") return checkMail();
    if (error.code === "captcha_failed") return { error: CAPTCHA_FAILED };
    if (error.code === "weak_password") return { error: "Kies een sterker wachtwoord." };
    if (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") {
      return { error: "Er zijn te veel pogingen gedaan. Probeer het over een uur opnieuw." };
    }
    // Zonder deze regel is de oorzaak in de serverlog niet te achterhalen.
    console.error("signUp mislukt", { role, status: error.status, code: error.code, message: error.message });
    return { error: "Registreren is niet gelukt. Controleer je gegevens of probeer het later opnieuw." };
  }

  // Zonder sessie moet het e-mailadres eerst bevestigd worden.
  if (!data.session) return checkMail();
  redirect(requested ?? home);
}

export async function signUpCustomer(_: FormState, formData: FormData) {
  return signUp("customer", customerSignUp, formData);
}

export async function signUpVendor(_: FormState, formData: FormData) {
  return signUp("vendor", vendorSignUp, formData);
}

const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Vul een geldig e-mailadres in"));

/** Het adres komt uit de ondertekende cookie; alleen zonder cookie wordt het ingevulde adres gebruikt. */
export async function resendConfirmation(_: ResendState, formData: FormData): Promise<ResendState> {
  const pending = await getPendingEmail();
  const parsed = emailSchema.safeParse(pending?.email ?? formData.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const email = parsed.data;

  const cooldown = resendCooldownSeconds();
  const waitLeft = pending?.sentAt ? Math.ceil(cooldown - (Date.now() - pending.sentAt) / 1000) : 0;
  if (waitLeft > 0) return { error: `Wacht nog ${waitLeft} seconden voordat je opnieuw een mail aanvraagt.`, retryAfter: waitLeft };

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { captchaToken: captchaToken(formData), emailRedirectTo: callbackUrl(VENDOR_HOME_PATH) },
  });
  if (error?.code === "captcha_failed") return { error: CAPTCHA_FAILED };
  if (error && (error.status === 429 || error.code?.startsWith("over_"))) {
    return { error: "Je hebt te vaak een mail aangevraagd. Probeer het over een paar minuten opnieuw.", retryAfter: cooldown };
  }
  if (error) return { error: "Versturen is niet gelukt. Probeer het later opnieuw." };

  await setPendingEmail(email);
  // Dezelfde melding voor elk adres.
  return { message: "Is er een onbevestigd account voor dit adres, dan is er een nieuwe e-mail onderweg.", retryAfter: cooldown };
}

/** Pas bij de klik op de knop wordt de eenmalige code verbruikt, zodat mailscanners hem niet kunnen opmaken. */
export async function confirmEmailLink(formData: FormData) {
  const parsed = z
    .object({ token_hash: z.string().min(1), type: z.enum(["recovery", "signup"]) })
    .safeParse(Object.fromEntries(formData));
  const next = formData.get("next");
  if (!parsed.success) redirect(callbackFailurePath(next));

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp(parsed.data);
  if (error) {
    console.error("verifyOtp mislukt", { type: parsed.data.type, status: error.status, code: error.code, message: error.message });
    redirect(callbackFailurePath(next));
  }

  const profile = await getProfile();
  if (!profile) redirect(callbackFailurePath(next));
  redirect(callbackNext(next, profile.role) ?? ROLE_HOME[profile.role]);
}

export async function requestVendorPasswordReset(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ email: credentials.shape.email }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    captchaToken: captchaToken(formData),
    redirectTo: callbackUrl(VENDOR_RESET_PATH),
  });
  if (error?.code === "captcha_failed") return { error: CAPTCHA_FAILED };

  // Altijd dezelfde melding, ook als het adres onbekend is.
  return { message: "Is dit e-mailadres bij ons bekend, dan ontvang je een e-mail met een link om een nieuw wachtwoord te kiezen." };
}

export async function updateVendorPassword(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ password: vendorSignUpSchema.shape.password }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "Wachtwoord wijzigen is niet gelukt. Vraag een nieuwe link aan." };
  redirect(ROLE_HOME.vendor);
}

async function signIn(role: Role, formData: FormData): Promise<FormState> {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    ...parsed.data,
    options: { captchaToken: captchaToken(formData) },
  });
  // Zonder deze regel is niet te zien waarom een login mislukt (alle fouten tonen dezelfde melding).
  if (error) console.error("signIn mislukt", { role, status: error.status, code: error.code, message: error.message });
  if (error?.code === "captcha_failed") return { error: CAPTCHA_FAILED };
  if (error?.code === "email_not_confirmed") {
    // Supabase meldt dit pas als het wachtwoord klopt, dus het adres is van deze persoon.
    if (role === "vendor") await setPendingEmail(parsed.data.email, 0);
    return {
      error: "Bevestig eerst je e-mailadres met de link in de e-mail die we je stuurden.",
      needsConfirmation: role === "vendor",
    };
  }
  if (error || !data.user) return { error: "E-mailadres of wachtwoord klopt niet." };

  const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
  if (profile?.role !== role) console.error("signIn: profiel/rol klopt niet", { role, found: profile?.role ?? null, code: profileError?.code, message: profileError?.message });

  // Klant- en leveranciersaccounts zijn gescheiden: een verkeerd accounttype logt hier niet in.
  if (profile?.role !== role) {
    await supabase.auth.signOut();
    return {
      error:
        role === "vendor"
          ? "Dit is geen leveranciersaccount. Log in via de klantomgeving."
          : role === "admin"
            ? "Geen toegang."
            : "Dit is geen klantaccount. Log in via de leveranciersomgeving.",
    };
  }
  const requested = safeNext(formData.get("next"), role);
  if (role === "vendor") redirect(vendorLoginDestination(requested));
  redirect(requested ?? ROLE_HOME[role]);
}

export async function signInCustomer(_: FormState, formData: FormData) {
  return signIn("customer", formData);
}

export async function signInVendor(_: FormState, formData: FormData) {
  return signIn("vendor", formData);
}

export async function signInAdmin(_: FormState, formData: FormData) {
  return signIn("admin", formData);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
