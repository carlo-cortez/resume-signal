import type { Resume, ResumeSuggestion, ScoreResult } from "@/types/resume";
import { resumeToText } from "@/lib/resume/text";

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
  const firstBullet = resume.experience[0]?.bullets[0] ?? resume.summary;
  const suggestions: ResumeSuggestion[] = missingKeywords.slice(0, 4).map((keyword) => ({
    keyword,
    targetPath: firstBullet ? (resume.experience[0]?.bullets[0] ? "experience.0.bullets.0" : "summary") : "",
    original: firstBullet ?? "",
    revised: firstBullet ? `${firstBullet} [If accurate, add specific evidence of ${keyword}.]` : "",
    reason: `The job description emphasizes ${keyword}, but the résumé does not currently show evidence of it.`,
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
