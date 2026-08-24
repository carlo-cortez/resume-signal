import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/errors";
import { jobDescriptionRequestSchema, uuidQuerySchema } from "@/lib/api/schemas";
import { extractJobKeywords } from "@/lib/resume/analysis";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type StoredJobDescription = {
  id: string;
  company: string | null;
  title: string;
  role_category: string;
  raw_text: string;
  keywords_json: string[];
  match_score: number | null;
  outcome: string;
  created_at: string;
};

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: identity, error: authError } = await supabase.auth.getClaims();
    const userId = identity?.claims?.sub;

    if (authError || !userId) {
      return apiError("UNAUTHORIZED", "Please sign in to continue.", 401);
    }

    const { data, error } = await supabase
      .from("job_descriptions")
      .select("id, company, title, role_category, raw_text, keywords_json, match_score, outcome, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    return NextResponse.json({ items: data ?? [] });
  } catch {
    return apiError("PERSISTENCE_FAILED", "Unable to load saved job descriptions.", 503);
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: identity, error: authError } = await supabase.auth.getClaims();
    const userId = identity?.claims?.sub;

    if (authError || !userId) {
      return apiError("UNAUTHORIZED", "Please sign in to continue.", 401);
    }
    const parsed = jobDescriptionRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError("INVALID_REQUEST", "Job description, title, and role category are required.", 400);
    const { rawText, title, roleCategory, company, keywords, matchScore = null } = parsed.data;

    const { data, error } = await supabase
      .from("job_descriptions")
      .insert({
        user_id: userId,
        company: company || null,
        title,
        role_category: roleCategory,
        raw_text: rawText,
        keywords_json: keywords.length ? keywords : extractJobKeywords(rawText),
        match_score: matchScore === null ? null : Math.round(matchScore),
        outcome: "applied",
      })
      .select("id, company, title, role_category, raw_text, keywords_json, match_score, outcome, created_at")
      .single<StoredJobDescription>();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch {
    return apiError("PERSISTENCE_FAILED", "Unable to save this job description.", 503);
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: identity, error: authError } = await supabase.auth.getClaims();
    const userId = identity?.claims?.sub;

    if (authError || !userId) {
      return apiError("UNAUTHORIZED", "Please sign in to continue.", 401);
    }

    const id = uuidQuerySchema.safeParse(new URL(request.url).searchParams.get("id"));
    if (!id.success) return apiError("INVALID_REQUEST", "A valid saved posting ID is required.", 400);

    const { error } = await supabase
      .from("job_descriptions")
      .delete()
      .eq("id", id.data)
      .eq("user_id", userId);

    if (error) throw error;
    return new NextResponse(null, { status: 204 });
  } catch {
    return apiError("PERSISTENCE_FAILED", "Unable to delete this saved posting.", 503);
  }
}
