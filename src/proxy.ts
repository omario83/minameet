import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = [
  "/leverancier/inloggen",
  "/leverancier/registreren",
  "/leverancier/registreren/controleer-mail",
  "/leverancier/wachtwoord-vergeten",
  "/admin/inloggen",
];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  if (!user && !PUBLIC_PATHS.includes(pathname)) {
    const login = pathname.startsWith("/leverancier")
      ? "/leverancier/inloggen"
      : pathname.startsWith("/admin")
        ? "/admin/inloggen"
        : "/inloggen";
    const loginUrl = new URL(login, request.url);
    loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  // De rol zelf wordt per layout server-side gecontroleerd (requireRole).
  return response;
}

export const config = {
  matcher: ["/account/:path*", "/leverancier/:path*", "/admin/:path*"],
};
