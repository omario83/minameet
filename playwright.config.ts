import { defineConfig } from "@playwright/test";
import { E2E_ADMIN_EMAIL, MAIL_SINK_PORT } from "./e2e/mail-sink";
import { PDOK_MOCK_PORT } from "./e2e/pdok-mock";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const cooldown = process.env.E2E_RESEND_COOLDOWN ?? "4";

// Eenmalig: `npx playwright install chromium`. De tests schrijven echte accounts: gebruik een test- of lokale Supabase
// (`supabase start`, mails in Inbucket/Mailpit op poort 54324). Draait de dev-server al, start hem dan met dezelfde
// variabelen als hieronder bij `env`: de mails van de app gaan naar een nepserver van de tests (RESEND_API_URL).
export default defineConfig({
  testDir: "e2e",
  workers: 1,
  use: { baseURL },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
        env: {
          AUTH_RESEND_COOLDOWN_SECONDS: cooldown,
          AUTH_COOKIE_SECRET: "e2e-cookie-secret",
          RESEND_API_URL: `http://127.0.0.1:${MAIL_SINK_PORT}/emails`,
          RESEND_API_KEY: "e2e",
          RESEND_FROM: "MinaMeet <test@example.com>",
          ADMIN_NOTIFY_EMAIL: E2E_ADMIN_EMAIL,
          PDOK_URL: `http://127.0.0.1:${PDOK_MOCK_PORT}/free`,
        },
      },
});
