import { z } from "zod";
import { isCategory } from "@/lib/listing-fields";

// Dit bestand wordt ook in de browser gebruikt: geen server-only imports.

export const PASSWORD_MIN = 10;
// bcrypt (Supabase) kapt wachtwoorden af na 72 bytes.
export const PASSWORD_MAX = 72;

export const vendorSignUpSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Vul de naam van de contactpersoon in (minimaal 2 tekens)")
    .max(80, "Gebruik maximaal 80 tekens"),
  company_name: z
    .string()
    .trim()
    .min(2, "Vul je bedrijfsnaam in (minimaal 2 tekens)")
    .max(100, "Gebruik maximaal 100 tekens"),
  category: z.string().refine(isCategory, "Kies een categorie"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Vul een geldig e-mailadres in")),
  password: z
    .string()
    .min(PASSWORD_MIN, `Je wachtwoord moet minimaal ${PASSWORD_MIN} tekens hebben`)
    .max(PASSWORD_MAX, `Gebruik maximaal ${PASSWORD_MAX} tekens`),
  terms: z.literal("on", "Ga akkoord met de partnervoorwaarden en het privacybeleid"),
});

export type VendorSignUpInput = z.input<typeof vendorSignUpSchema>;
