import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/errors";
import { authenticatedSupabase } from "@/lib/supabase/auth";

export async function GET() {
  const { supabase, userId } = await authenticatedSupabase();
  if (!userId) return apiError("UNAUTHORIZED", "Please sign in to continue.", 401);

  const { data, error } = await supabase
    .from("resumes")
    .select("id, name, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) return apiError("PERSISTENCE_FAILED", "Unable to load saved resumes.", 503);
  return NextResponse.json({ items: data ?? [] });
}
