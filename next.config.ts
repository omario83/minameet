import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;

// Zonder deze waarden zou productie zonder captcha draaien, mails met localhost-links sturen of niet-ondertekende cookies gebruiken.
const REQUIRED_IN_PRODUCTION = ["NEXT_PUBLIC_TURNSTILE_SITE_KEY", "NEXT_PUBLIC_SITE_URL", "AUTH_COOKIE_SECRET"];
const missing = REQUIRED_IN_PRODUCTION.filter((name) => !process.env[name]);
if (process.env.NODE_ENV === "production" && missing.length) {
  throw new Error(`Ontbrekende omgevingsvariabelen voor productie: ${missing.join(", ")}`);
}

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Ook de lokale Supabase (http, poort 54321) moet werken; die draait op een lokaal IP, dat alleen buiten productie is toegestaan.
    remotePatterns: supabaseUrl
      ? [
          {
            protocol: supabaseUrl.protocol === "http:" ? "http" : "https",
            hostname: supabaseUrl.hostname,
            ...(supabaseUrl.port ? { port: supabaseUrl.port } : {}),
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
  },
  experimental: {
    // Foto-uploads van leveranciers (max. 10 MB per foto, plus formulier-overhead).
    serverActions: { bodySizeLimit: "11mb" },
  },
  async redirects() {
    return [
      {
        // Staat het callback-adres niet bij de Redirect URLs in Supabase, dan stuurt Supabase de gebruiker naar de Site URL met ?code=.
        // Zo komt die code alsnog bij de callback; de callback bepaalt zelf de veilige bestemming.
        source: "/",
        has: [{ type: "query" as const, key: "code", value: "(?<code>[\\w-]+)" }],
        destination: "/auth/callback?code=:code&next=/leverancier/dashboard",
        permanent: false,
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
