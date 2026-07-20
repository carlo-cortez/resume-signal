export interface Resume {
  contact: {
    name: string;
    email: string;
    phone?: string;
    location?: string;
    linkedin?: string;
  };
  summary?: string;
  experience: {
    title: string;
    company: string;
    location?: string;
    startDate: string;
    endDate: string | "Present";
    bullets: string[];
  }[];
  education: {
    school: string;
    degree: string;
    location?: string;
    graduationDate: string;
    honors?: string;
  }[];
  skills: string[];
  projects?: {
    name: string;
    description: string;
    bullets?: string[];
  }[];
}

export interface JobDescription {
  title: string;
  seniority: "entry" | "mid" | "senior" | "lead" | "unclear";
  requiredSkills: string[];
  niceToHaveSkills: string[];
  keywords: string[];
  rawText: string;
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
  suggestions: {
    section: string;
    original?: string;
    suggestion: string;
    reason: string;
    similarityToJd: number;
    flag?: "high_jd_overlap" | "keyword_stuffing" | "unverified_claim";
  }[];
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
