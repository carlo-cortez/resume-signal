import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/errors";
import { createResumeDocx } from "@/lib/resume/export-docx";
import { resumeSchema } from "@/lib/resume/schema";
import { authenticatedSupabase } from "@/lib/supabase/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { userId } = await authenticatedSupabase();
  if (!userId) return apiError("UNAUTHORIZED", "Please sign in to continue.", 401);
  const parsed = resumeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_REQUEST", "The resume data is incomplete.", 400);
  const buffer = await createResumeDocx(parsed.data);
  const safeName = (parsed.data.contact.name || "resume").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": `attachment; filename="${safeName || "resume"}.docx"`,
      "cache-control": "no-store",
    },
  });
}
