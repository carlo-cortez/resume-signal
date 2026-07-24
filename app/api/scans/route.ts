import { NextResponse } from "next/server";
import { analyzeResume } from "@/lib/resume/analysis";
import { createGroundedSuggestions } from "@/lib/resume/openai";
import { resumeSchema } from "@/lib/resume/schema";
import { authenticatedSupabase } from "@/lib/supabase/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { supabase, userId } = await authenticatedSupabase();
  if (!userId) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });

  try {
    const body = await request.json() as Record<string, unknown>;
    const parsedResume = resumeSchema.safeParse(body.resume);
    const jobDescription = typeof body.jobDescription === "string" ? body.jobDescription.trim() : "";
    if (!parsedResume.success || jobDescription.length < 40) {
      return NextResponse.json({ error: "A parsed resume and complete job description are required." }, { status: 400 });
    }
    const result = analyzeResume(parsedResume.data, jobDescription);
    try {
      const suggestions = await createGroundedSuggestions(parsedResume.data, jobDescription, result.missingKeywords);
      if (suggestions) {
        result.suggestions = suggestions;
        result.analysisMode = "hybrid";
      }
    } catch {
      // Deterministic scores and verification-first suggestions remain valid.
    }

    const versionId = typeof body.versionId === "string" ? body.versionId : null;
    const { data: stored } = await supabase
      .from("resume_scans")
      .insert({
        user_id: userId,
        resume_version_id: versionId,
        company: typeof body.company === "string" ? body.company.trim() || null : null,
        role_category: typeof body.roleCategory === "string" ? body.roleCategory : "Uncategorized",
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
    return NextResponse.json({ error: "Unable to analyze this resume right now." }, { status: 503 });
  }
}
