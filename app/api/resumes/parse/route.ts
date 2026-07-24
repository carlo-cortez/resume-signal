import { NextResponse } from "next/server";
import { authenticatedSupabase } from "@/lib/supabase/auth";
import { extractResumeText, parseResumeHeuristically } from "@/lib/resume/parser";
import { structureResumeWithAI } from "@/lib/resume/openai";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { supabase, userId } = await authenticatedSupabase();
  if (!userId) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });

  try {
    const form = await request.formData();
    const file = form.get("resume");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a PDF or DOCX resume." }, { status: 400 });
    }
    const extractedText = await extractResumeText(file);
    if (extractedText.length < 40) {
      return NextResponse.json({ error: "We could not find enough readable text in that file." }, { status: 422 });
    }
    let resume = parseResumeHeuristically(extractedText);
    let analysisMode: "local" | "semantic" = "local";
    try {
      const structured = await structureResumeWithAI(extractedText);
      if (structured) {
        resume = structured;
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
      const { data: version } = await supabase
        .from("resume_versions")
        .insert({
          user_id: userId,
          resume_id: resumeId,
          version_number: 1,
          data_json: resume,
          source_text: extractedText,
        })
        .select("id")
        .maybeSingle();
      versionId = version?.id ?? null;
    }

    return NextResponse.json({
      resume,
      extractedText,
      analysisMode,
      persistence: resumeId && versionId ? "saved" : "migration_required",
      resumeId,
      versionId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read this resume.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
