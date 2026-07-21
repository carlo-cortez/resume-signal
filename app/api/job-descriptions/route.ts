import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/db/supabase";

type StoredJobDescription = {
  id: string;
  company: string | null;
  title: string;
  role_category: string;
  keywords_json: string[];
  match_score: number | null;
  outcome: string;
  created_at: string;
};

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("job_descriptions")
      .select("id, company, title, role_category, keywords_json, match_score, outcome, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    return NextResponse.json({ items: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load saved job descriptions." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const rawText = typeof body.rawText === "string" ? body.rawText.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const roleCategory = typeof body.roleCategory === "string" ? body.roleCategory.trim() : "";
    const company = typeof body.company === "string" ? body.company.trim() : "";
    const keywords = Array.isArray(body.keywords)
      ? body.keywords.filter((value): value is string => typeof value === "string")
      : [];
    const matchScore = typeof body.matchScore === "number" ? Math.round(body.matchScore) : null;

    if (!rawText || !title || !roleCategory) {
      return NextResponse.json(
        { error: "Job description, title, and role category are required." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("job_descriptions")
      .insert({
        company: company || null,
        title,
        role_category: roleCategory,
        raw_text: rawText,
        keywords_json: keywords,
        match_score: matchScore,
        outcome: "applied",
      })
      .select("id, company, title, role_category, keywords_json, match_score, outcome, created_at")
      .single<StoredJobDescription>();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save this job description." },
      { status: 503 },
    );
  }
}
