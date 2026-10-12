import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { getSupabaseAdmin } from "@/db/supabase";
import { consumeGlobalRateLimit } from "@/lib/api/rate-limit";
import { findJobEvidence } from "@/lib/resume/analysis";
import { resumeSchema, suggestionSchema } from "@/lib/resume/schema";
import { getResumePathLabel, getResumeValue, resumeToText } from "@/lib/resume/text";
import type { Resume, ResumeSuggestion } from "@/types/resume";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";
const MAX_AI_RESUME_CHARACTERS = 30_000;
const MAX_AI_JOB_DESCRIPTION_CHARACTERS = 20_000;

function client() {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  return apiKey ? new OpenAI({ apiKey, baseURL: GROQ_BASE_URL }) : null;
}

function model() {
  return process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
}

// Shared daily budget across all users, so this app cannot exhaust the Groq
// account's quota for other projects. When it is spent, callers return null
// and the routes fall back to deterministic analysis.
async function hasGroqBudget() {
  try {
    const { allowed } = await consumeGlobalRateLimit(getSupabaseAdmin(), "groq_requests");
    return allowed;
  } catch (error) {
    console.error("Groq budget check unavailable:", error);
    return false;
  }
}

export async function structureResumeWithAI(text: string) {
  const openai = client();
  if (!openai || !(await hasGroqBudget())) return null;
  const response = await openai.responses.parse({
    model: model(),
    reasoning: { effort: "low" },
    input: [
      {
        role: "system",
        content: "Extract only facts explicitly present in the resume. Use empty strings and empty arrays for missing values. Do not rewrite, improve, infer, or invent content.",
      },
      { role: "user", content: text.slice(0, MAX_AI_RESUME_CHARACTERS) },
    ],
    text: { format: zodTextFormat(resumeSchema, "resume") },
  });
  return response.output_parsed;
}

export async function createGroundedSuggestions(resume: Resume, jobDescription: string, missingKeywords: string[]) {
  const openai = client();
  if (!openai || !missingKeywords.length || !(await hasGroqBudget())) return null;
  const response = await openai.responses.parse({
    model: model(),
    reasoning: { effort: "low" },
    input: [
      {
        role: "system",
        content: [
          "Suggest at most four grounded resume edits.",
          "Never invent experience, metrics, tools, or qualifications.",
          "Every original value must exactly match the supplied resume.",
          "targetPath must be summary or experience.N.bullets.N or leadership.N.bullets.N or projects.N.bullets.N.",
          "If a keyword is unsupported, explain what evidence the user should verify instead of asserting it.",
        ].join(" "),
      },
      {
        role: "user",
        content: `RESUME:\n${resumeToText(resume)}\n\nJOB DESCRIPTION:\n${jobDescription.slice(0, MAX_AI_JOB_DESCRIPTION_CHARACTERS)}\n\nMISSING KEYWORDS:\n${missingKeywords.join(", ")}`,
      },
    ],
    text: { format: zodTextFormat(suggestionSchema, "resume_suggestions") },
  });
  const suggestions = response.output_parsed?.suggestions ?? [];
  return suggestions
    .filter((suggestion) =>
      Boolean(suggestion.targetPath) &&
      Boolean(suggestion.revised.trim()) &&
      suggestion.revised !== suggestion.original &&
      getResumeValue(resume, suggestion.targetPath) === suggestion.original
    )
    .map((suggestion): ResumeSuggestion => ({
      ...suggestion,
      kind: "grounded_edit",
      source: "openai",
      jobEvidence: findJobEvidence(jobDescription, suggestion.keyword),
      targetLabel: getResumePathLabel(resume, suggestion.targetPath),
      requiresVerification: true,
    }));
}
