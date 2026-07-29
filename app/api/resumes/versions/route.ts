import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/errors";
import { resumeVersionRequestSchema, uuidQuerySchema } from "@/lib/api/schemas";
import { resumeSchema } from "@/lib/resume/schema";
import { authenticatedSupabase } from "@/lib/supabase/auth";

export async function GET(request: Request) {
  const { supabase, userId } = await authenticatedSupabase();
  if (!userId) return apiError("UNAUTHORIZED", "Please sign in to continue.", 401);
  const resumeId = uuidQuerySchema.safeParse(new URL(request.url).searchParams.get("resumeId"));
  if (!resumeId.success) return apiError("INVALID_REQUEST", "A valid resume ID is required.", 400);

  const { data: owned } = await supabase
    .from("resumes")
    .select("id")
    .eq("id", resumeId.data)
    .eq("user_id", userId)
    .maybeSingle();
  if (!owned) return apiError("NOT_FOUND", "Resume not found.", 404);

  const { data, error } = await supabase
    .from("resume_versions")
    .select("id, resume_id, version_number, data_json, created_at")
    .eq("resume_id", resumeId.data)
    .eq("user_id", userId)
    .order("version_number", { ascending: false })
    .limit(50);
  if (error) return apiError("PERSISTENCE_FAILED", "Unable to load resume history.", 503);
  const items = (data ?? []).flatMap((version) => {
    const parsedResume = resumeSchema.safeParse(version.data_json);
    return parsedResume.success ? [{ ...version, data_json: parsedResume.data }] : [];
  });
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const { supabase, userId } = await authenticatedSupabase();
  if (!userId) return apiError("UNAUTHORIZED", "Please sign in to continue.", 401);
  const parsed = resumeVersionRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_REQUEST", "A saved resume and valid content are required.", 400);
  const { resumeId, resume } = parsed.data;

  const { data: owned } = await supabase.from("resumes").select("id").eq("id", resumeId).eq("user_id", userId).maybeSingle();
  if (!owned) return apiError("NOT_FOUND", "Resume not found.", 404);
  const { data: latest } = await supabase
    .from("resume_versions")
    .select("version_number")
    .eq("resume_id", resumeId)
    .eq("user_id", userId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const versionNumber = (latest?.version_number ?? 0) + 1;
  let { data, error } = await supabase
    .from("resume_versions")
    .insert({
      resume_id: resumeId,
      user_id: userId,
      version_number: versionNumber,
      data_json: resume,
    })
    .select("id, version_number")
    .single();
  if (error?.message.includes("source_text")) {
    const fallback = await supabase
      .from("resume_versions")
      .insert({
        resume_id: resumeId,
        user_id: userId,
        version_number: versionNumber,
        data_json: resume,
        source_text: "",
      })
      .select("id, version_number")
      .single();
    data = fallback.data;
    error = fallback.error;
  }
  if (error) return apiError("PERSISTENCE_FAILED", "Unable to save this version.", 503);
  await supabase.from("resumes").update({ name: resume.contact.name || "Resume", updated_at: new Date().toISOString() }).eq("id", resumeId).eq("user_id", userId);
  return NextResponse.json(data, { status: 201 });
}
