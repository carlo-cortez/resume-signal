import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/errors";
import { consumeUserRateLimit, rateLimitMessage } from "@/lib/api/rate-limit";
import { historyQuerySchema, scanRequestSchema, uuidQuerySchema } from "@/lib/api/schemas";
import { analyzeResume, normalizeStoredSuggestion } from "@/lib/resume/analysis";
import { createGroundedSuggestions } from "@/lib/resume/openai";
import { authenticatedSupabase } from "@/lib/supabase/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { supabase, userId } = await authenticatedSupabase();
  if (!userId) return apiError("UNAUTHORIZED", "Please sign in to continue.", 401);
  const url = new URL(request.url);
  const parsed = historyQuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
  });
  if (!parsed.success) return apiError("INVALID_REQUEST", "Invalid scan history query.", 400);

  let query = supabase
    .from("resume_scans")
    .select("id, resume_version_id, company, role_category, job_description, formatting_score, match_score, matched_keywords, missing_keywords, suggestions_json, analysis_mode, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(parsed.data.limit);
  if (parsed.data.cursor) query = query.lt("created_at", parsed.data.cursor);
  const { data, error } = await query;
  if (error) return apiError("PERSISTENCE_FAILED", "Unable to load scan history.", 503);
  const items = (data ?? []).map((item) => ({
    ...item,
    suggestions_json: Array.isArray(item.suggestions_json)
      ? item.suggestions_json
        .map((suggestion) => normalizeStoredSuggestion(suggestion, item.job_description, item.analysis_mode))
        .filter(Boolean)
      : [],
  }));
  return NextResponse.json({
    items,
    nextCursor: items.length === parsed.data.limit ? items.at(-1)?.created_at ?? null : null,
  });
}

export async function POST(request: Request) {
  const { supabase, userId } = await authenticatedSupabase();
  if (!userId) return apiError("UNAUTHORIZED", "Please sign in to continue.", 401);

  const rateLimit = await consumeUserRateLimit(supabase, "resume_scan");
  if (!rateLimit.allowed) {
    return apiError("RATE_LIMITED", rateLimitMessage("resume_scan", rateLimit.retryAfterSeconds), 429, {
      "retry-after": String(rateLimit.retryAfterSeconds),
    });
  }

  try {
    const parsed = scanRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError("INVALID_REQUEST", "A parsed resume and complete job description are required.", 400);
    const { resume, versionId = null, jobDescription, company, roleCategory } = parsed.data;
    if (versionId) {
      const { data: ownedVersion } = await supabase
        .from("resume_versions")
        .select("id")
        .eq("id", versionId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!ownedVersion) return apiError("NOT_FOUND", "Resume version not found.", 404);
    }

    const result = analyzeResume(resume, jobDescription);
    try {
      const suggestions = await createGroundedSuggestions(resume, jobDescription, result.missingKeywords);
      if (suggestions) {
        result.suggestions = suggestions;
        result.analysisMode = "hybrid";
      }
    } catch {
      // Deterministic scores and verification-first suggestions remain valid.
    }

    const { data: stored } = await supabase
      .from("resume_scans")
      .insert({
        user_id: userId,
        resume_version_id: versionId,
        company: company || null,
        role_category: roleCategory,
        job_description: jobDescription,
        formatting_score: result.formattingScore,
        match_score: result.matchScore,
        matched_keywords: result.matchedKeywords,
        missing_keywords: result.missingKeywords,
        suggestions_json: result.suggestions,
        analysis_mode: result.analysisMode,
      })
      .select("id")
      .maybeSingle();

    return NextResponse.json({
      ...result,
      scanId: stored?.id ?? null,
      persistence: stored?.id ? "saved" : "migration_required",
    });
  } catch {
    return apiError("INTERNAL_ERROR", "Unable to analyze this resume right now.", 503);
  }
}

export async function DELETE(request: Request) {
  const { supabase, userId } = await authenticatedSupabase();
  if (!userId) return apiError("UNAUTHORIZED", "Please sign in to continue.", 401);
  const id = uuidQuerySchema.safeParse(new URL(request.url).searchParams.get("id"));
  if (!id.success) return apiError("INVALID_REQUEST", "A valid scan ID is required.", 400);
  const { error } = await supabase
    .from("resume_scans")
    .delete()
    .eq("id", id.data)
    .eq("user_id", userId);
  if (error) return apiError("PERSISTENCE_FAILED", "Unable to delete this scan.", 503);
  return new NextResponse(null, { status: 204 });
}
