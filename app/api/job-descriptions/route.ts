import { NextResponse } from "next/server";
import { ensureJobDescriptionSchema, requireDatabase } from "@/db/d1";

type StoredJobDescription = {
  id: string;
  company: string | null;
  title: string;
  role_category: string;
  keywords_json: string;
  match_score: number | null;
  outcome: string;
  created_at: string;
};

export async function GET() {
  try {
    const database = requireDatabase();
    await ensureJobDescriptionSchema(database);
    const result = await database
      .prepare(
        `SELECT id, company, title, role_category, keywords_json, match_score, outcome, created_at
         FROM job_descriptions
         ORDER BY created_at DESC
         LIMIT 100`,
      )
      .all<StoredJobDescription>();

    return NextResponse.json({ items: result.results ?? [] });
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
    const keywords = Array.isArray(body.keywords) ? body.keywords.filter((value): value is string => typeof value === "string") : [];
    const matchScore = typeof body.matchScore === "number" ? Math.round(body.matchScore) : null;

    if (!rawText || !title || !roleCategory) {
      return NextResponse.json({ error: "Job description, title, and role category are required." }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const database = requireDatabase();
    await ensureJobDescriptionSchema(database);
    await database
      .prepare(
        `INSERT INTO job_descriptions
         (id, company, title, role_category, raw_text, keywords_json, match_score, outcome, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, company || null, title, roleCategory, rawText, JSON.stringify(keywords), matchScore, "applied", createdAt)
      .run();

    return NextResponse.json(
      { id, company: company || null, title, role_category: roleCategory, keywords_json: JSON.stringify(keywords), match_score: matchScore, outcome: "applied", created_at: createdAt },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save this job description." },
      { status: 503 },
    );
  }
}
