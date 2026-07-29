import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/errors";
import { authenticatedSupabase } from "@/lib/supabase/auth";
import { assessResumeQuality, extractResumeText, parseResumeWithQuality } from "@/lib/resume/parser";
import { structureResumeWithAI } from "@/lib/resume/openai";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { supabase, userId } = await authenticatedSupabase();
  if (!userId) return apiError("UNAUTHORIZED", "Please sign in to continue.", 401);

  try {
    const form = await request.formData();
    const file = form.get("resume");
    if (!(file instanceof File)) {
      return apiError("INVALID_REQUEST", "Choose a PDF or DOCX resume.", 400);
    }
    const extractedText = await extractResumeText(file);
    if (extractedText.length < 40) {
      return apiError("PARSE_FAILED", "We could not find enough readable text in that file.", 422);
    }
    let { resume, quality } = parseResumeWithQuality(extractedText);
    let analysisMode: "local" | "semantic" = "local";
    try {
      const structured = await structureResumeWithAI(extractedText);
      if (structured) {
        resume = structured;
        const semanticSections = [
          structured.summary && "summary",
          structured.education.length && "education",
          structured.experience.length && "experience",
          structured.leadership.length && "leadership",
          structured.skills.length && "skills",
          structured.projects.length && "projects",
        ].filter((value): value is string => Boolean(value));
        quality = assessResumeQuality(structured, extractedText.length, semanticSections);
        analysisMode = "semantic";
      }
    } catch {
      // Local extraction remains available if the optional model API is unavailable.
    }

    let resumeId: string | null = null;
    let versionId: string | null = null;
    const { data: storedResume } = await supabase
      .from("resumes")
      .insert({ user_id: userId, name: resume.contact.name || file.name.replace(/\.[^.]+$/, "") })
      .select("id")
      .maybeSingle();
    if (storedResume?.id) {
      resumeId = storedResume.id;
      let { data: version, error: versionError } = await supabase
        .from("resume_versions")
        .insert({
          user_id: userId,
          resume_id: resumeId,
          version_number: 1,
          data_json: resume,
        })
        .select("id")
        .maybeSingle();
      if (versionError?.message.includes("source_text")) {
        const fallback = await supabase
          .from("resume_versions")
          .insert({
            user_id: userId,
            resume_id: resumeId,
            version_number: 1,
            data_json: resume,
            source_text: "",
          })
          .select("id")
          .maybeSingle();
        version = fallback.data;
        versionError = fallback.error;
      }
      versionId = version?.id ?? null;
      if (versionError) {
        await supabase.from("resumes").delete().eq("id", resumeId).eq("user_id", userId);
        resumeId = null;
      }
    }

    return NextResponse.json({
      resume,
      quality,
      analysisMode,
      persistence: resumeId && versionId ? "saved" : "migration_required",
      resumeId,
      versionId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read this resume.";
    return apiError("PARSE_FAILED", message, 422);
  }
}
