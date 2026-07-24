import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { resumeSchema, suggestionSchema } from "@/lib/resume/schema";
import { getResumeValue, resumeToText } from "@/lib/resume/text";
import type { Resume, ResumeSuggestion } from "@/types/resume";

function client() {
  return process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
}

export async function structureResumeWithAI(text: string) {
  const openai = client();
  if (!openai) return null;
  const response = await openai.responses.parse({
    model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
    reasoning: { effort: "none" },
    input: [
      {
        role: "system",
        content: "Extract only facts explicitly present in the resume. Use empty strings and empty arrays for missing values. Do not rewrite, improve, infer, or invent content.",
      },
      { role: "user", content: text.slice(0, 80_000) },
    ],
    text: { format: zodTextFormat(resumeSchema, "resume") },
  });
  return response.output_parsed;
}

export async function createGroundedSuggestions(resume: Resume, jobDescription: string, missingKeywords: string[]) {
  const openai = client();
  if (!openai || !missingKeywords.length) return null;
  const response = await openai.responses.parse({
    model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
    reasoning: { effort: "none" },
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
        content: `RESUME:\n${resumeToText(resume)}\n\nJOB DESCRIPTION:\n${jobDescription.slice(0, 40_000)}\n\nMISSING KEYWORDS:\n${missingKeywords.join(", ")}`,
      },
    ],
    text: { format: zodTextFormat(suggestionSchema, "resume_suggestions") },
  });
  const suggestions = response.output_parsed?.suggestions ?? [];
  return suggestions.filter((suggestion: ResumeSuggestion) =>
    Boolean(suggestion.targetPath) && getResumeValue(resume, suggestion.targetPath) === suggestion.original
  );
}
