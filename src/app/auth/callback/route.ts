import { NextResponse, type NextRequest } from "next/server";
import { ROLE_HOME, getProfile } from "@/lib/auth";
import { callbackFailurePath, callbackNext } from "@/lib/redirects";
import { createClient } from "@/lib/supabase/server";

// Landingspunt van de link in een e-mail (bevestigen, wachtwoord herstellen).
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const next = params.get("next");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const profile = await getProfile();
      if (profile) {
        // Alleen paden van een vaste lijst; alles anders (ook een extern adres) wordt genegeerd.
        return NextResponse.redirect(new URL(callbackNext(next, profile.role) ?? ROLE_HOME[profile.role], request.url));
      }
    }
  }

  // Verlopen, al gebruikt, in een andere browser geopend of ontbrekende code.
  return NextResponse.redirect(new URL(callbackFailurePath(next), request.url));
}
