import { describe, expect, it } from "vitest";
import { isPrivateAddress, normalizeFeedUrl } from "@/lib/agenda/feed-url";

describe("normalizeFeedUrl", () => {
  it("accepteert een https-adres en maakt van webcal:// https://", () => {
    expect(normalizeFeedUrl("https://calendar.google.com/calendar/ical/abc/private-xyz/basic.ics")).toEqual({
      ok: true,
      url: "https://calendar.google.com/calendar/ical/abc/private-xyz/basic.ics",
    });
    expect(normalizeFeedUrl("  webcal://p01-caldav.icloud.com/published/2/abc  ")).toEqual({ ok: true, url: "https://p01-caldav.icloud.com/published/2/abc" });
    expect(normalizeFeedUrl("WEBCALS://example.com/a.ics")).toEqual({ ok: true, url: "https://example.com/a.ics" });
  });

  it.each([
    "",
    "   ",
    "geen adres",
    "http://example.com/a.ics",
    "ftp://example.com/a.ics",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "https://user:pass@example.com/a.ics",
    "https://example.com:8443/a.ics",
    "https://localhost/a.ics",
    "https://127.0.0.1/a.ics",
    "https://10.0.0.5/a.ics",
    "https://[::1]/a.ics",
    "https://printer.local/a.ics",
    "https://metadata.internal/a.ics",
    `https://example.com/${"a".repeat(2000)}`,
  ])("weigert %j", (value) => {
    expect(normalizeFeedUrl(value).ok).toBe(false);
  });
});

describe("isPrivateAddress", () => {
  it.each([
    "127.0.0.1",
    "127.1.2.3",
    "10.0.0.1",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
    "::1",
    "::",
    "fe80::1",
    "fc00::1",
    "fd12:3456::1",
    "ff02::1",
    "::ffff:127.0.0.1",
    "::ffff:10.1.2.3",
    "geen-ip",
  ])("%s is niet toegestaan", (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each(["8.8.8.8", "142.250.80.46", "172.15.0.1", "172.32.0.1", "193.0.0.1", "2a00:1450:4001:81b::200e", "::ffff:8.8.8.8"])("%s is toegestaan", (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });
});
