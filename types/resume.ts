export interface ResumeContact {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  website: string;
}

export interface ResumeRole {
  organization: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  bullets: string[];
}

export interface ResumeEducation {
  school: string;
  degree: string;
  location: string;
  graduationDate: string;
  gpa: string;
  awards: string[];
}

export interface ResumeProject {
  name: string;
  date: string;
  bullets: string[];
}

export interface ResumeSkillGroup {
  label: string;
  items: string[];
}

export interface Resume {
  contact: ResumeContact;
  summary: string;
  education: ResumeEducation[];
  experience: ResumeRole[];
  leadership: ResumeRole[];
  skills: ResumeSkillGroup[];
  projects: ResumeProject[];
}

export interface JobDescription {
  title: string;
  seniority: "entry" | "mid" | "senior" | "lead" | "unclear";
  requiredSkills: string[];
  niceToHaveSkills: string[];
  keywords: string[];
  rawText: string;
}

export interface ResumeSuggestion {
  keyword: string;
  targetPath: string;
  original: string;
  revised: string;
  reason: string;
  flag: "verify claim" | "high JD overlap" | null;
}

export interface ScoreResult {
  formattingScore: number;
  formattingIssues: {
    issue: string;
    severity: "high" | "medium" | "low";
  }[];
  matchScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: ResumeSuggestion[];
  analysisMode: "deterministic" | "hybrid";
}

export interface StoredJD extends JobDescription {
  id: string;
  roleCategory: string;
  company?: string;
  dateAdded: string;
  outcome?: "applied" | "interview" | "rejected" | "offer" | "no_response";
}

export interface RoleKeywordProfile {
  roleCategory: string;
  jdCount: number;
  coreKeywords: { term: string; frequency: number }[];
  variableKeywords: { term: string; frequency: number }[];
  lastUpdated: string;
}
