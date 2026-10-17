import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAddress } from "@/lib/pdok";

const json = (body: unknown, init?: ResponseInit) => new Response(JSON.stringify(body), { status: 200, ...init });
const docs = (...items: object[]) => json({ response: { numFound: items.length, docs: items } });

function mockFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  const fn = vi.fn(impl);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("fetchAddress (PDOK)", () => {
  it("geeft straat en plaats bij een treffer", async () => {
    const fetchMock = mockFetch(async () => docs({ straatnaam: "Dam", woonplaatsnaam: "Amsterdam" }));

    expect(await fetchAddress("1012 JS", 1)).toEqual({ found: true, street: "Dam", city: "Amsterdam" });

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe("https://api.pdok.nl/bzk/locatieserver/search/v3_1/free");
    expect(url.searchParams.get("q")).toBe("postcode:1012JS AND huisnummer:1");
    expect(url.searchParams.get("fq")).toBe("type:adres");
    expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("geeft found: false als er geen resultaat is", async () => {
    mockFetch(async () => docs());
    expect(await fetchAddress("9999 ZZ", 999)).toEqual({ found: false });
  });

  it("geeft found: false bij een onvolledig resultaat, een HTTP-fout of onleesbare JSON", async () => {
    mockFetch(async () => docs({ straatnaam: "Dam" }));
    expect(await fetchAddress("1012 JS", 1)).toEqual({ found: false });

    mockFetch(async () => new Response("fout", { status: 500 }));
    expect(await fetchAddress("1012 JS", 1)).toEqual({ found: false });

    mockFetch(async () => new Response("geen json", { status: 200 }));
    expect(await fetchAddress("1012 JS", 1)).toEqual({ found: false });
  });

  it("geeft found: false bij een netwerkfout", async () => {
    mockFetch(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await fetchAddress("1012 JS", 1)).toEqual({ found: false });
  });

  it("breekt bij een time-out af en blokkeert niet", async () => {
    const fetchMock = mockFetch(
      (_url, init) =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );

    const started = Date.now();
    expect(await fetchAddress("1012 JS", 1, { timeoutMs: 30 })).toEqual({ found: false });
    expect(Date.now() - started).toBeLessThan(1000);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("gebruikt standaard een time-out van 5 seconden", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    mockFetch(async () => docs());
    await fetchAddress("1012 JS", 1);
    expect(timeout).toHaveBeenCalledWith(5000);
    timeout.mockRestore();
  });

  it("belt PDOK niet bij een ongeldige postcode of een ongeldig huisnummer", async () => {
    const fetchMock = mockFetch(async () => docs());
    for (const [postcode, number] of [["1234 SS", 1], ["abc", 1], ["1012 JS", 0], ["1012 JS", -1], ["0123 AB", 1]] as const) {
      expect(await fetchAddress(postcode, number)).toEqual({ found: false });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("kan naar een andere URL wijzen, bijvoorbeeld een nepserver in tests", async () => {
    const fetchMock = mockFetch(async () => docs());
    await fetchAddress("1012 JS", 1, { url: "http://127.0.0.1:4011/free" });
    expect(fetchMock.mock.calls[0][0]).toMatch(/^http:\/\/127\.0\.0\.1:4011\/free\?/);
  });
});
