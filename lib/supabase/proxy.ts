import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

const publicPages = new Set(["/login", "/register"]);
const retiredAuthPages = new Set(["/forgot-password", "/update-password", "/auth/confirm"]);

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabasePublicConfig();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims?.sub);
  const pathname = request.nextUrl.pathname;
  const isAuthEndpoint = pathname === "/auth/callback" || pathname === "/auth/signout";
  const isApiRoute = pathname.startsWith("/api/");

  if (retiredAuthPages.has(pathname)) {
    const destination = request.nextUrl.clone();
    destination.pathname = isSignedIn ? "/" : "/login";
    destination.search = "";
    return NextResponse.redirect(destination);
  }

  if (!isSignedIn && !publicPages.has(pathname) && !isAuthEndpoint && !isApiRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isSignedIn && publicPages.has(pathname)) {
    const workspaceUrl = request.nextUrl.clone();
    workspaceUrl.pathname = "/";
    workspaceUrl.search = "";
    return NextResponse.redirect(workspaceUrl);
  }

  return response;
}
