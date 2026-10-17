import { createServer, type Server } from "node:http";

// Nepserver voor de PDOK Locatieserver (PDOK_URL in playwright.config.ts). De opzoeking draait op de server van de app,
// dus de browser kan hem niet onderscheppen.
export const PDOK_MOCK_PORT = Number(process.env.E2E_PDOK_PORT ?? 4011);

/** Postcodes waarmee de tests een bepaald antwoord afdwingen. */
export const PDOK_FOUND = "1012 JS"; // Dam, Amsterdam
export const PDOK_NOT_FOUND = "9999 ZZ"; // geen resultaat
export const PDOK_HANGS = "1111 AA"; // antwoordt niet (time-out na 5 s)

let server: Server | undefined;

export async function startPdokMock() {
  server = createServer((req, res) => {
    const q = new URL(req.url ?? "", "http://localhost").searchParams.get("q") ?? "";

    if (q.includes(`postcode:${PDOK_HANGS.replace(" ", "")}`)) {
      // Geen antwoord; de verbinding sluit na 15 s zodat de server netjes afsluit.
      setTimeout(() => res.destroy(), 15_000).unref();
      return;
    }

    const docs = q.includes(`postcode:${PDOK_FOUND.replace(" ", "")}`) ? [{ straatnaam: "Dam", woonplaatsnaam: "Amsterdam" }] : [];
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ response: { numFound: docs.length, docs } }));
  });
  await new Promise<void>((resolve) => server!.listen(PDOK_MOCK_PORT, "127.0.0.1", resolve));
}

export async function stopPdokMock() {
  server?.closeAllConnections();
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
}
