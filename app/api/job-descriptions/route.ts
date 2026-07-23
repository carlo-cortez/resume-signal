import { NextResponse } from "next/server";
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
      return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
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
    return NextResponse.json(
      { error: "Unable to load saved job descriptions." },
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
    const matchScore = typeof body.matchScore === "number"
      ? Math.min(100, Math.max(0, Math.round(body.matchScore)))
      : null;

    if (!rawText || !title || !roleCategory) {
      return NextResponse.json(
        { error: "Job description, title, and role category are required." },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data: identity, error: authError } = await supabase.auth.getClaims();
    const userId = identity?.claims?.sub;

    if (authError || !userId) {
      return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("job_descriptions")
      .insert({
        user_id: userId,
        company: company || null,
        title,
        role_category: roleCategory,
        raw_text: rawText,
        keywords_json: keywords,
        match_score: matchScore,
        outcome: "applied",
      })
      .select("id, company, title, role_category, raw_text, keywords_json, match_score, outcome, created_at")
      .single<StoredJobDescription>();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Unable to save this job description." },
      { status: 503 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: identity, error: authError } = await supabase.auth.getClaims();
    const userId = identity?.claims?.sub;

    if (authError || !userId) {
      return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    }

    const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

    if (!isUuid) {
      return NextResponse.json({ error: "A valid saved posting ID is required." }, { status: 400 });
    }

    const { error } = await supabase
      .from("job_descriptions")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json(
      { error: "Unable to delete this saved posting." },
      { status: 503 },
    );
  }
}
