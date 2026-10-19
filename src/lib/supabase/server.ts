import { cookies } from "next/headers";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function createClient() {
  // De Supabase-client leest de huidige tijd om de sessie te controleren; dat mag niet tijdens (runtime-)prerendering.
  await connection();
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Aangeroepen vanuit een Server Component; de proxy ververst de sessie.
          }
        },
      },
    },
  );
}
