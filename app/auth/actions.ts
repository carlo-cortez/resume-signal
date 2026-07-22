"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function formValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

async function requestOrigin() {
  const requestHeaders = await headers();
  return requestHeaders.get("origin") ?? "http://localhost:3000";
}

export async function signInWithGoogle(formData: FormData) {
  const requestedNext = formValue(formData, "next");
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "/";
  const supabase = await createSupabaseServerClient();
  const origin = await requestOrigin();
  const callbackUrl = new URL("/auth/callback", origin);
  callbackUrl.searchParams.set("next", next);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl.toString(),
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    redirect("/login?error=Google%20sign-in%20is%20temporarily%20unavailable.");
  }

  redirect(data.url);
}
