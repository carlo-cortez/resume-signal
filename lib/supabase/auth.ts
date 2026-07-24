import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function authenticatedSupabase() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  return { supabase, userId: error ? undefined : userId };
}
