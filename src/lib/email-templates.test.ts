import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "../../supabase");
const config = readFileSync(join(root, "config.toml"), "utf8");
const TEMPLATES = ["confirmation", "recovery", "email_change", "magic_link"] as const;

describe("supabase/config.toml", () => {
  it("zet bevestiging aan en vraagt minimaal 10 tekens", () => {
    expect(config).toMatch(/enable_confirmations\s*=\s*true/);
    expect(config).toMatch(/minimum_password_length\s*=\s*10/);
  });

  it.each(TEMPLATES)("koppelt het template %s met onderwerp en bestand", (type) => {
    const section = new RegExp(`\\[auth\\.email\\.template\\.${type}\\]\\s*\\n([^\\[]*)`).exec(config)?.[1] ?? "";
    expect(section, `sectie voor ${type}`).toMatch(/subject\s*=\s*".+"/);
    expect(section).toContain(`content_path = "./supabase/templates/${type}.html"`);
  });
});

describe.each(TEMPLATES)("template %s", (type) => {
  const html = readFileSync(join(root, "templates", `${type}.html`), "utf8");

  it("heeft een tabel-layout en inline stijlen (werkt in Outlook en Gmail)", () => {
    expect(html).toContain('<table role="presentation"');
    expect(html).not.toMatch(/<style[\s>]/i);
    expect(html).not.toMatch(/display:\s*(flex|grid)/i);
    expect(html).not.toMatch(/<div[\s>]/i);
  });

  it("heeft een oranje knop met de bevestigingslink en een tekstlink als terugval", () => {
    expect(html).toContain("#ff8a00");
    expect(html.match(/\{\{ \.ConfirmationURL \}\}/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain('<a href="{{ .ConfirmationURL }}"');
  });

  it("is Nederlands en in de huisstijl", () => {
    expect(html).toContain('lang="nl"');
    expect(html).toContain("#c8410b");
    expect(html).toContain("MinaMeet");
  });

  it("gebruikt alleen bekende Supabase-variabelen", () => {
    const vars = [...html.matchAll(/\{\{\s*(\.[A-Za-z]+)\s*\}\}/g)].map((m) => m[1]);
    for (const name of vars) expect([".ConfirmationURL", ".SiteURL", ".Email", ".NewEmail"]).toContain(name);
  });
});

describe("email_change", () => {
  it("noemt het oude en het nieuwe adres", () => {
    const html = readFileSync(join(root, "templates", "email_change.html"), "utf8");
    expect(html).toContain("{{ .NewEmail }}");
    expect(html).toContain("{{ .Email }}");
  });
});
