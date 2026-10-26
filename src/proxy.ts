import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Keeps the dashboard's Supabase session fresh.
 *
 * Supabase sign-ins use short-lived access tokens. Server Components cannot
 * write cookies, so a token that expires mid-visit has to be refreshed here,
 * before the page renders, and the new cookies written onto the response.
 * The storefront has no session and is not routed through this at all.
 *
 * With the local backend this does nothing: its session cookie does not
 * expire mid-visit.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.SUPABASE_URL?.trim();
  const key = (process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY)?.trim();
  if (!url || !key || process.env.STORE_BACKEND === "local") return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [header, value] of Object.entries(headers ?? {})) response.headers.set(header, value);
      },
    },
  });

  // Validates the session and refreshes it when it is close to expiry.
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
