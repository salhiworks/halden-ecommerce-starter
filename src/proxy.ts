import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { backendKind, supabaseConfig } from "@/server/env";

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
  // Same settings, same rules as the rest of the app (src/server/env.ts).
  const config = backendKind() === "supabase" ? supabaseConfig() : null;
  if (!config) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.publishableKey, {
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
