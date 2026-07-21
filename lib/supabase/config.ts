export function getSupabasePublicConfig() {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Supabase Auth is not configured. Add SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY to .env.local.",
    );
  }

  return { url, publishableKey };
}
