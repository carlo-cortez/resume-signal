import type { Resume, ResumeSuggestion, ScoreResult } from "@/types/resume";
import { getResumePathLabel, resumeToText } from "@/lib/resume/text";

const phrases = [
  "stakeholder management", "requirements gathering", "business analysis", "data analysis",
  "process improvement", "project management", "quality assurance", "user stories",
  "acceptance criteria", "workflow automation", "power bi", "microsoft excel",
  "agile", "scrum", "kanban", "jira", "confluence", "sql", "python", "tableau",
  "bpmn", "uat", "testing", "dashboards", "reporting", "communication", "leadership",
];
const stopWords = new Set(["about", "after", "also", "and", "are", "because", "been", "being", "from", "have", "into", "more", "must", "that", "their", "the", "this", "through", "using", "will", "with", "work", "you", "your"]);

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9+#. ]+/g, " ").replace(/\s+/g, " ").trim();
}

export function extractJobKeywords(jobDescription: string) {
  const normalized = normalize(jobDescription);
  const found = phrases.filter((phrase) => normalized.includes(phrase));
  const frequencies = new Map<string, number>();
  for (const word of normalized.split(" ")) {
    if (word.length < 4 || stopWords.has(word) || /^\d+$/.test(word)) continue;
    frequencies.set(word, (frequencies.get(word) ?? 0) + 1);
  }
  const frequent = [...frequencies.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);
  return [...new Set([...found, ...frequent])].slice(0, 20);
}

export function findJobEvidence(jobDescription: string, keyword: string) {
  const candidates = jobDescription
    .replace(/\r/g, "\n")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const normalizedKeyword = normalize(keyword);
  const evidence = candidates.find((candidate) => normalize(candidate).includes(normalizedKeyword));
  if (!evidence) return `The job description repeatedly uses “${keyword}”.`;
  return evidence.length > 280 ? `${evidence.slice(0, 277).trimEnd()}…` : evidence;
}

export function normalizeStoredSuggestion(
  value: unknown,
  jobDescription: string,
  analysisMode: "deterministic" | "hybrid",
): ResumeSuggestion | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ResumeSuggestion>;
  if (typeof candidate.keyword !== "string" || typeof candidate.reason !== "string") return null;
  const grounded = analysisMode === "hybrid" && typeof candidate.revised === "string" && Boolean(candidate.revised.trim());
  const targetPath = typeof candidate.targetPath === "string" ? candidate.targetPath : "";
  return {
    keyword: candidate.keyword,
    kind: candidate.kind === "grounded_edit" && grounded ? "grounded_edit" : "evidence_prompt",
    source: candidate.source === "openai" && grounded ? "openai" : "deterministic",
    jobEvidence: candidate.jobEvidence || findJobEvidence(jobDescription, candidate.keyword),
    targetPath,
    targetLabel: candidate.targetLabel || (targetPath ? targetPath.replace(/\.(\d+)\./g, " #$1 · ").replace(/bullets\./, "bullet ") : "Resume review"),
    original: typeof candidate.original === "string" ? candidate.original : "",
    revised: grounded && typeof candidate.revised === "string" ? candidate.revised : "",
    reason: candidate.reason,
    requiresVerification: true,
    flag: candidate.flag === "high JD overlap" ? "high JD overlap" : "verify claim",
  };
}

function reviewTarget(resume: Resume) {
  if (resume.experience[0]?.bullets[0]) return "experience.0.bullets.0";
  if (resume.summary) return "summary";
  if (resume.leadership[0]?.bullets[0]) return "leadership.0.bullets.0";
  if (resume.projects[0]?.bullets[0]) return "projects.0.bullets.0";
  return "";
}

function formatHealth(resume: Resume) {
  const issues: ScoreResult["formattingIssues"] = [];
  let score = 100;
  const deduct = (issue: string, severity: "high" | "medium" | "low", points: number) => {
    score -= points;
    issues.push({ issue, severity });
  };
  if (!resume.contact.name) deduct("Add your full name.", "high", 15);
  if (!resume.contact.email && !resume.contact.phone) deduct("Add an email address or phone number.", "high", 15);
  if (!resume.summary) deduct("Add a concise professional summary.", "low", 5);
  if (!resume.experience.length) deduct("Add at least one experience entry.", "high", 25);
  if (!resume.education.length) deduct("Add your education.", "medium", 10);
  if (!resume.skills.some((group) => group.items.length)) deduct("Add a skills section.", "medium", 10);
  const bullets = [...resume.experience, ...resume.leadership].flatMap((role) => role.bullets);
  if (bullets.some((bullet) => bullet.length > 220)) deduct("Shorten long bullets for faster scanning.", "low", 5);
  return { score: Math.max(0, score), issues };
}

export function analyzeResume(resume: Resume, jobDescription: string): ScoreResult {
  const resumeText = normalize(resumeToText(resume));
  const keywords = extractJobKeywords(jobDescription);
  const matchedKeywords = keywords.filter((keyword) => resumeText.includes(keyword));
  const missingKeywords = keywords.filter((keyword) => !resumeText.includes(keyword));
  const matchScore = keywords.length ? Math.round((matchedKeywords.length / keywords.length) * 100) : 0;
  const formatting = formatHealth(resume);
  const targetPath = reviewTarget(resume);
  const original = targetPath === "summary"
    ? resume.summary
    : targetPath
      ? resume[targetPath.split(".")[0] as "experience" | "leadership" | "projects"][0]?.bullets[0] ?? ""
      : "";
  const suggestions: ResumeSuggestion[] = missingKeywords.slice(0, 4).map((keyword) => ({
    keyword,
    kind: "evidence_prompt",
    source: "deterministic",
    jobEvidence: findJobEvidence(jobDescription, keyword),
    targetPath,
    targetLabel: targetPath ? getResumePathLabel(resume, targetPath) : "Resume review",
    original,
    revised: "",
    reason: `The job description emphasizes ${keyword}, but the resume does not currently show matching evidence. Verify whether you have relevant experience before editing.`,
    requiresVerification: true,
    flag: "verify claim",
  }));
  return {
    formattingScore: formatting.score,
    formattingIssues: formatting.issues,
    matchScore,
    matchedKeywords,
    missingKeywords,
    suggestions,
    analysisMode: "deterministic",
  };
}
