import { NextResponse } from "next/server";
import { resumeSchema } from "@/lib/resume/schema";
import { resumeToText } from "@/lib/resume/text";
import { authenticatedSupabase } from "@/lib/supabase/auth";

export async function POST(request: Request) {
  const { supabase, userId } = await authenticatedSupabase();
  if (!userId) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const resumeId = typeof body.resumeId === "string" ? body.resumeId : "";
  const parsed = resumeSchema.safeParse(body.resume);
  if (!resumeId || !parsed.success) return NextResponse.json({ error: "A saved resume and valid content are required." }, { status: 400 });

  const { data: owned } = await supabase.from("resumes").select("id").eq("id", resumeId).eq("user_id", userId).maybeSingle();
  if (!owned) return NextResponse.json({ error: "Resume not found." }, { status: 404 });
  const { data: latest } = await supabase
    .from("resume_versions")
    .select("version_number")
    .eq("resume_id", resumeId)
    .eq("user_id", userId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const versionNumber = (latest?.version_number ?? 0) + 1;
  const { data, error } = await supabase
    .from("resume_versions")
    .insert({
      resume_id: resumeId,
      user_id: userId,
      version_number: versionNumber,
      data_json: parsed.data,
      source_text: resumeToText(parsed.data),
    })
    .select("id, version_number")
    .single();
  if (error) return NextResponse.json({ error: "Unable to save this version." }, { status: 503 });
  await supabase.from("resumes").update({ name: parsed.data.contact.name || "Resume", updated_at: new Date().toISOString() }).eq("id", resumeId).eq("user_id", userId);
  return NextResponse.json(data, { status: 201 });
}
