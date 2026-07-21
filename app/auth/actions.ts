"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function formValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function authRedirect(path: string, kind: "error" | "message", text: string): never {
  redirect(`${path}?${kind}=${encodeURIComponent(text)}`);
}

async function requestOrigin() {
  const requestHeaders = await headers();
  return requestHeaders.get("origin") ?? "http://localhost:3000";
}

export async function login(formData: FormData) {
  const email = formValue(formData, "email");
  const password = formValue(formData, "password");

  if (!email || !password) {
    authRedirect("/login", "error", "Enter your email address and password.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    authRedirect("/login", "error", "The email or password is incorrect.");
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function register(formData: FormData) {
  const email = formValue(formData, "email");
  const password = formValue(formData, "password");
  const confirmation = formValue(formData, "confirmPassword");

  if (!email || !password) {
    authRedirect("/register", "error", "Enter an email address and password.");
  }
  if (password.length < 8) {
    authRedirect("/register", "error", "Use a password with at least 8 characters.");
  }
  if (password !== confirmation) {
    authRedirect("/register", "error", "The passwords do not match.");
  }

  const supabase = await createSupabaseServerClient();
  const origin = await requestOrigin();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    authRedirect("/register", "error", "Registration could not be completed. Try again shortly.");
  }

  authRedirect("/register", "message", "Check your email to confirm your account, then sign in.");
}

export async function requestPasswordReset(formData: FormData) {
  const email = formValue(formData, "email");

  if (!email) {
    authRedirect("/forgot-password", "error", "Enter your email address.");
  }

  const supabase = await createSupabaseServerClient();
  const origin = await requestOrigin();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/update-password`,
  });

  authRedirect(
    "/forgot-password",
    "message",
    "If an account exists for that email, a password-reset link is on its way.",
  );
}

export async function updatePassword(formData: FormData) {
  const password = formValue(formData, "password");
  const confirmation = formValue(formData, "confirmPassword");

  if (password.length < 8) {
    authRedirect("/update-password", "error", "Use a password with at least 8 characters.");
  }
  if (password !== confirmation) {
    authRedirect("/update-password", "error", "The passwords do not match.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    authRedirect("/update-password", "error", "The password could not be updated. Request a new reset link.");
  }

  authRedirect("/login", "message", "Password updated. Sign in with your new password.");
}
