"use client";

import { CSSProperties, ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { sampleResume } from "@/lib/resume/sample";
import { applyResumeSuggestion } from "@/lib/resume/text";
import type { ParseQuality, Resume, ResumeSuggestion, ScoreResult } from "@/types/resume";

type Tab = "resume" | "keywords" | "review" | "draft" | "history";
type Resolution = "accepted" | "rejected";
type PreviewMode = "readable" | "page";

type SavedPosting = {
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

type SavedResume = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type ResumeVersion = {
  id: string;
  resume_id: string;
  version_number: number;
  data_json: Resume;
  created_at: string;
};

type StoredScan = {
  id: string;
  resume_version_id: string | null;
  company: string | null;
  role_category: string;
  job_description: string;
  formatting_score: number;
  match_score: number;
  matched_keywords: string[];
  missing_keywords: string[];
  suggestions_json: ResumeSuggestion[];
  analysis_mode: "deterministic" | "hybrid";
  created_at: string;
};

type ApiErrorPayload = {
  error?: string | { code?: string; message?: string };
};

type RoleProfile = {
  name: string;
  subtitle: string;
  core: { term: string; frequency: number }[];
  variable: { term: string; frequency: number }[];
  postings: { company: string; role: string; date: string; outcome: string }[];
};

const sampleJobDescription = `We are looking for a Business Analyst to partner with cross-functional stakeholders and translate business requirements into clear user stories. The role will facilitate Agile ceremonies, maintain delivery documentation in Jira and Confluence, support UAT, and use SQL and Power BI to validate findings. Experience with process improvement and BPMN is preferred.`;

const letterPageWidth = 816;
const letterPageHeight = 1056;
const previewChromeHeight = 180;

const roleCategoryOptions = [
  "Business Analyst",
  "Systems Analyst",
  "Product Owner",
  "Project Coordinator",
  "Operations Analyst",
  "Data / Reporting",
  "QA / UAT Analyst",
];

function titleCase(value: string) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

function apiMessage(payload: ApiErrorPayload, fallback: string) {
  if (typeof payload.error === "string") return payload.error;
  return payload.error?.message || fallback;
}

function hasResumeBody(resume: Resume) {
  return Boolean(
    resume.summary.trim() ||
    resume.education.length ||
    resume.experience.length ||
    resume.leadership.length ||
    resume.skills.length ||
    resume.projects.length
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightedText({ text, keywords, enabled }: { text: string; keywords: string[]; enabled: boolean }) {
  const terms = [...new Set(keywords.map((keyword) => keyword.trim()).filter(Boolean))]
    .sort((left, right) => right.length - left.length);
  if (!enabled || !terms.length || !text) return <>{text}</>;

  const normalized = new Set(terms.map((term) => term.toLowerCase()));
  const parts = text.split(new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi"));
  return <>{parts.map((part, index) => normalized.has(part.toLowerCase())
    ? <mark className="match-highlight" key={`${part}-${index}`}>{part}</mark>
    : part)}</>;
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("resume");
  const [jobDescription, setJobDescription] = useState("");
  const [resumeFile, setResumeFile] = useState("");
  const [resume, setResume] = useState<Resume>(sampleResume);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [resumeVersionId, setResumeVersionId] = useState<string | null>(null);
  const [versionStatus, setVersionStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [parseStatus, setParseStatus] = useState<"idle" | "parsing" | "ready" | "error">("idle");
  const [parseMessage, setParseMessage] = useState("");
  const [parseQuality, setParseQuality] = useState<ParseQuality | null>(null);
  const [analysis, setAnalysis] = useState<ScoreResult | null>(null);
  const [scanError, setScanError] = useState("");
  const [company, setCompany] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [roleCategory, setRoleCategory] = useState("Business Analyst");
  const [hasScanned, setHasScanned] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>({});
  const [profileIndex, setProfileIndex] = useState(0);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [hostedPostings, setHostedPostings] = useState<SavedPosting[]>([]);
  const [libraryStatus, setLibraryStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [expandedPostingId, setExpandedPostingId] = useState<string | null>(null);
  const [deletingPostingId, setDeletingPostingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [keywordTitle, setKeywordTitle] = useState("");
  const [keywordCompany, setKeywordCompany] = useState("");
  const [keywordDescription, setKeywordDescription] = useState("");
  const [keywordSaveStatus, setKeywordSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedResumes, setSavedResumes] = useState<SavedResume[]>([]);
  const [resumeVersions, setResumeVersions] = useState<ResumeVersion[]>([]);
  const [scanHistory, setScanHistory] = useState<StoredScan[]>([]);
  const [scanNextCursor, setScanNextCursor] = useState<string | null>(null);
  const [selectedHistoryResumeId, setSelectedHistoryResumeId] = useState("");
  const [historyStatus, setHistoryStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [historyError, setHistoryError] = useState("");
  const [deletingScanId, setDeletingScanId] = useState<string | null>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("readable");
  const [showEditor, setShowEditor] = useState(false);
  const [isTailoredDraft, setIsTailoredDraft] = useState(false);
  const [scoreIsStale, setScoreIsStale] = useState(false);
  const previewFrameRef = useRef<HTMLDivElement>(null);

  const matchedKeywords = analysis?.matchedKeywords ?? [];
  const missingKeywords = analysis?.missingKeywords ?? [];
  const matchScore = analysis?.matchScore ?? 0;
  const suggestions = analysis?.suggestions ?? [];
  const scanVisible = hasScanned && tab !== "resume";
  const previewStage = parseStatus !== "ready"
    ? "Sample resume"
    : isTailoredDraft
      ? "Tailored draft"
      : hasScanned
        ? "Analyzed resume"
        : "Original resume";
  const previewStageDescription = previewStage === "Original resume"
    ? `${resumeFile} · This is your uploaded baseline. Run an ATS scan to compare it with the job description.`
    : previewStage === "Analyzed resume"
      ? `Compared with ${company.trim() || roleTitle.trim() || roleCategory}. Matching language is highlighted in green.`
      : previewStage === "Tailored draft"
        ? !hasScanned
          ? "This draft differs from the uploaded baseline. Run an ATS scan to compare it with the job description."
          : scoreIsStale
          ? "This draft has changed since the last scan. Run the scan again to refresh its score and highlights."
          : `Tailored for ${company.trim() || roleTitle.trim() || roleCategory}. The score and highlights reflect this draft.`
        : "Upload a resume to replace this sample.";
  const roleProfiles = useMemo<RoleProfile[]>(() => {
    const titles = [...new Map(hostedPostings.map((posting) => [posting.title.trim().toLowerCase(), posting.title.trim()])).values()]
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right));
    return titles.map((name) => {
    const postings = hostedPostings.filter((posting) => posting.title.trim().toLowerCase() === name.toLowerCase());
    const counts = new Map<string, number>();
    for (const posting of postings) {
      for (const keyword of new Set(posting.keywords_json ?? [])) {
        const normalized = keyword.toLowerCase();
        counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
      }
    }
    const frequencies = [...counts.entries()]
      .map(([term, count]) => ({ term: titleCase(term), frequency: Math.round((count / postings.length) * 100) }))
      .sort((a, b) => b.frequency - a.frequency || a.term.localeCompare(b.term));
    return {
      name,
      subtitle: postings.length ? `${postings.length} posting${postings.length === 1 ? "" : "s"} saved` : "No postings saved",
      core: frequencies.filter((item) => item.frequency >= 50),
      variable: frequencies.filter((item) => item.frequency < 50),
      postings: postings.map((posting) => ({
        company: posting.company || "Company not set",
        role: posting.title,
        date: new Date(posting.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        outcome: posting.outcome,
      })),
    };
    });
  }, [hostedPostings]);
  const activeProfile = roleProfiles[profileIndex] ?? roleProfiles[0] ?? {
    name: "No job title selected",
    subtitle: "Save a job description to begin",
    core: [],
    variable: [],
    postings: [],
  };
  const contactLine = [
    resume.contact.location,
    resume.contact.phone,
    resume.contact.email,
    resume.contact.linkedin || resume.contact.website,
  ].filter(Boolean).join(" • ");

  useEffect(() => {
    if (tab !== "keywords") return;
    fetch("/api/job-descriptions")
      .then(async (response) => {
        if (!response.ok) throw new Error("Database unavailable");
        return response.json() as Promise<{ items: SavedPosting[] }>;
      })
      .then((data) => {
        setHostedPostings(data.items);
        setLibraryStatus("ready");
      })
      .catch(() => setLibraryStatus("error"));
  }, [tab]);

  useEffect(() => {
    if (tab !== "history") return;
    let cancelled = false;

    Promise.all([
      fetch("/api/resumes").then(async (response) => {
        const data = await response.json() as { items?: SavedResume[] } & ApiErrorPayload;
        if (!response.ok) throw new Error(apiMessage(data, "Unable to load saved resumes."));
        return data.items ?? [];
      }),
      fetch("/api/scans?limit=20").then(async (response) => {
        const data = await response.json() as { items?: StoredScan[]; nextCursor?: string | null } & ApiErrorPayload;
        if (!response.ok) throw new Error(apiMessage(data, "Unable to load scan history."));
        return { items: data.items ?? [], nextCursor: data.nextCursor ?? null };
      }),
    ]).then(async ([resumes, scans]) => {
      if (cancelled) return;
      setSavedResumes(resumes);
      setScanHistory(scans.items);
      setScanNextCursor(scans.nextCursor);
      const selected = resumes.some((item) => item.id === resumeId) ? resumeId ?? "" : resumes[0]?.id ?? "";
      setSelectedHistoryResumeId(selected);
      if (selected) {
        const response = await fetch(`/api/resumes/versions?resumeId=${encodeURIComponent(selected)}`);
        const data = await response.json() as { items?: ResumeVersion[] } & ApiErrorPayload;
        if (!response.ok) throw new Error(apiMessage(data, "Unable to load resume versions."));
        if (!cancelled) setResumeVersions(data.items ?? []);
      } else {
        setResumeVersions([]);
      }
      if (!cancelled) setHistoryStatus("ready");
    }).catch((error) => {
      if (cancelled) return;
      setHistoryStatus("error");
      setHistoryError(error instanceof Error ? error.message : "Unable to load history.");
    });

    return () => {
      cancelled = true;
    };
  }, [tab, resumeId]);

  useEffect(() => {
    const frame = previewFrameRef.current;
    if (!frame) return;

    const updatePreviewScale = () => {
      const widthScale = frame.clientWidth / letterPageWidth;
      const availableHeight = Math.max(420, window.innerHeight - previewChromeHeight);
      const heightScale = availableHeight / letterPageHeight;
      setPreviewScale(previewMode === "page" ? Math.min(widthScale, heightScale) : widthScale);
    };
    const observer = new ResizeObserver(updatePreviewScale);

    observer.observe(frame);
    window.addEventListener("resize", updatePreviewScale);
    updatePreviewScale();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updatePreviewScale);
    };
  }, [previewMode]);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setResumeFile(file?.name ?? "");
    setHasScanned(false);
    setAnalysis(null);
    setParseMessage("");
    setParseQuality(null);
    setIsTailoredDraft(false);
    setScoreIsStale(false);
    if (!file) {
      setParseStatus("idle");
      return;
    }
    setParseStatus("parsing");
    const form = new FormData();
    form.set("resume", file);
    try {
      const response = await fetch("/api/resumes/parse", { method: "POST", body: form });
      const data = await response.json().catch(() => ({})) as ApiErrorPayload & {
        resume?: Resume;
        quality?: ParseQuality;
        versionId?: string | null;
        resumeId?: string | null;
        analysisMode?: "local" | "semantic";
        persistence?: "saved" | "migration_required";
      };
      if (!response.ok || !data.resume || !data.quality) throw new Error(apiMessage(data, "Unable to parse this resume."));
      if (!hasResumeBody(data.resume)) {
        throw new Error("Text was extracted, but we could not identify enough resume sections to build the preview. Try a DOCX version or a text-based PDF.");
      }
      setResume(data.resume);
      setResumeId(data.resumeId ?? null);
      setResumeVersionId(data.versionId ?? null);
      setParseQuality(data.quality);
      setPreviewMode("readable");
      setShowEditor(false);
      setParseStatus("ready");
      setParseMessage(
        `${data.analysisMode === "semantic" ? "Structured analysis" : "Local extraction"} complete. Preview updated` +
        (data.persistence === "saved" ? " and saved." : ". Version history could not be saved yet.") +
        (data.quality.status === "partial" ? " Review the detected sections before scanning." : ""),
      );
    } catch (error) {
      setParseStatus("error");
      setParseMessage(error instanceof Error ? error.message : "Unable to parse this resume.");
    }
  }

  async function runScan() {
    if (!jobDescription.trim()) return;
    setIsScanning(true);
    setScanError("");
    setResolutions({});
    try {
      const response = await fetch("/api/scans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          resume,
          versionId: resumeVersionId,
          jobDescription,
          company,
          roleCategory,
        }),
      });
      const data = await response.json() as ScoreResult & ApiErrorPayload;
      if (!response.ok) throw new Error(apiMessage(data, "Scan failed."));
      setAnalysis(data);
      setHasScanned(true);
      setScoreIsStale(false);
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "Unable to run this scan.");
      setHasScanned(false);
    } finally {
      setIsScanning(false);
    }
  }

  async function saveJobDescription() {
    setSaveStatus("saving");
    try {
      const response = await fetch("/api/job-descriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          company,
          title: roleTitle.trim() || roleCategory,
          roleCategory,
          rawText: jobDescription,
          keywords: [...matchedKeywords, ...missingKeywords],
          matchScore,
        }),
      });
      const saved = await response.json() as SavedPosting & ApiErrorPayload;
      if (!response.ok) throw new Error(apiMessage(saved, "Save failed"));
      setHostedPostings((current) => [saved, ...current]);
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  }

  async function saveKeywordPosting() {
    if (!keywordTitle.trim() || !keywordDescription.trim()) return;
    setKeywordSaveStatus("saving");
    try {
      const response = await fetch("/api/job-descriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          company: keywordCompany,
          title: keywordTitle,
          roleCategory: keywordTitle,
          rawText: keywordDescription,
          keywords: [],
          matchScore: null,
        }),
      });
      const saved = await response.json() as SavedPosting & ApiErrorPayload;
      if (!response.ok) throw new Error(apiMessage(saved, "Save failed"));
      setHostedPostings((current) => [saved, ...current]);
      setKeywordDescription("");
      setKeywordCompany("");
      setKeywordSaveStatus("saved");
    } catch {
      setKeywordSaveStatus("error");
    }
  }

  async function deleteSavedPosting(posting: SavedPosting) {
    const label = posting.company ? `${posting.title} at ${posting.company}` : posting.title;
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;

    setDeletingPostingId(posting.id);
    setDeleteError("");

    try {
      const response = await fetch(`/api/job-descriptions?id=${encodeURIComponent(posting.id)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as ApiErrorPayload;
        throw new Error(apiMessage(data, "Delete failed"));
      }
      setHostedPostings((current) => current.filter((item) => item.id !== posting.id));
      setExpandedPostingId((current) => current === posting.id ? null : current);
    } catch {
      setDeleteError("We couldn’t delete that posting. Please try again.");
    } finally {
      setDeletingPostingId(null);
    }
  }

  async function selectHistoryResume(id: string) {
    setSelectedHistoryResumeId(id);
    setHistoryError("");
    const response = await fetch(`/api/resumes/versions?resumeId=${encodeURIComponent(id)}`);
    const data = await response.json() as { items?: ResumeVersion[] } & ApiErrorPayload;
    if (!response.ok) {
      setHistoryError(apiMessage(data, "Unable to load resume versions."));
      return;
    }
    setResumeVersions(data.items ?? []);
  }

  function restoreResumeVersion(version: ResumeVersion) {
    setResume(version.data_json);
    setResumeId(version.resume_id);
    setResumeVersionId(version.id);
    setResumeFile(`Saved version ${version.version_number}`);
    setParseQuality(null);
    setParseStatus("ready");
    setParseMessage(`Version ${version.version_number} restored for review. Saving creates a new version.`);
    setAnalysis(null);
    setHasScanned(false);
    setIsTailoredDraft(false);
    setScoreIsStale(false);
    setShowEditor(false);
    setPreviewMode("readable");
    setTab("resume");
  }

  function reopenScan(scan: StoredScan) {
    setCompany(scan.company ?? "");
    setRoleCategory(scan.role_category);
    setJobDescription(scan.job_description);
    setAnalysis({
      formattingScore: scan.formatting_score,
      formattingIssues: [],
      matchScore: scan.match_score,
      matchedKeywords: scan.matched_keywords,
      missingKeywords: scan.missing_keywords,
      suggestions: scan.suggestions_json,
      analysisMode: scan.analysis_mode,
    });
    setHasScanned(true);
    setResolutions({});
    setIsTailoredDraft(false);
    setScoreIsStale(false);
    setTab("review");
  }

  async function deleteStoredScan(scan: StoredScan) {
    if (!window.confirm("Delete this saved scan? This cannot be undone.")) return;
    setDeletingScanId(scan.id);
    setHistoryError("");
    const response = await fetch(`/api/scans?id=${encodeURIComponent(scan.id)}`, { method: "DELETE" });
    if (response.ok) {
      setScanHistory((current) => current.filter((item) => item.id !== scan.id));
    } else {
      const data = await response.json().catch(() => ({})) as ApiErrorPayload;
      setHistoryError(apiMessage(data, "Unable to delete this scan."));
    }
    setDeletingScanId(null);
  }

  async function loadMoreScans() {
    if (!scanNextCursor) return;
    const response = await fetch(`/api/scans?limit=20&cursor=${encodeURIComponent(scanNextCursor)}`);
    const data = await response.json() as { items?: StoredScan[]; nextCursor?: string | null } & ApiErrorPayload;
    if (!response.ok) {
      setHistoryError(apiMessage(data, "Unable to load more scans."));
      return;
    }
    setScanHistory((current) => [...current, ...(data.items ?? [])]);
    setScanNextCursor(data.nextCursor ?? null);
  }

  function acceptSuggestion(suggestion: ResumeSuggestion) {
    if (suggestion.kind !== "grounded_edit" || suggestion.source !== "openai") return;
    setResume((current) => applyResumeSuggestion(current, suggestion.targetPath, suggestion.revised));
    setResolutions((current) => ({ ...current, [suggestion.keyword]: "accepted" }));
    setIsTailoredDraft(true);
    setScoreIsStale(true);
    setVersionStatus("idle");
  }

  function markResumeEdited() {
    setIsTailoredDraft(true);
    setScoreIsStale(hasScanned);
    setVersionStatus("idle");
  }

  async function downloadDocx() {
    const response = await fetch("/api/exports/docx", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(resume),
    });
    if (!response.ok) {
      setScanError("We couldn’t create the DOCX export. Please try again.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${resume.contact.name || "resume"}.docx`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function saveResumeVersion() {
    if (!resumeId) {
      setVersionStatus("error");
      return;
    }
    setVersionStatus("saving");
    const response = await fetch("/api/resumes/versions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resumeId, resume }),
    });
    if (!response.ok) {
      setVersionStatus("error");
      return;
    }
    const data = await response.json() as { id: string };
    setResumeVersionId(data.id);
    setVersionStatus("saved");
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Resume Signal home">
          <span className="brand-mark">RS</span>
          <span>
            <strong>Resume Signal</strong>
            <small>ATS fit, without the guesswork</small>
          </span>
        </a>
        <div className="header-actions">
          <div className="header-meta">
            <span className="status-dot" aria-hidden="true" />
            <span>{hasScanned ? "Scan ready" : "Secure workspace"}</span>
          </div>
          <form action="/auth/signout" method="post">
            <button className="signout-button" type="submit">Sign out</button>
          </form>
        </div>
      </header>

      <section className="hero" id="top">
        <div>
          <p className="eyebrow">Personal resume workspace</p>
          <h1>Build a credible base resume, then tailor only when it helps.</h1>
          <p className="hero-copy">
            Learn the language that repeats across the roles you want, strengthen your base resume,
            and use job-specific reviews without inventing experience.
          </p>
        </div>
        <div className="hero-principle">
          <span className="principle-number">01</span>
          <p>
            Suggestions never auto-apply. Verify every claim, then accept, edit,
            or reject it yourself.
          </p>
        </div>
      </section>

      <nav className="tabs" aria-label="Workspace views">
        <button className={tab === "resume" ? "active" : ""} onClick={() => setTab("resume")}>
          My resume
        </button>
        <button className={tab === "keywords" ? "active" : ""} onClick={() => { setLibraryStatus("loading"); setTab("keywords"); }}>
          Keywords <span>{hostedPostings.length}</span>
        </button>
        <button className={tab === "review" ? "active" : ""} onClick={() => setTab("review")}>
          Review
        </button>
        <button className={tab === "draft" ? "active" : ""} onClick={() => setTab("draft")}>
          Tailored draft
        </button>
        <button
          className={tab === "history" ? "active" : ""}
          onClick={() => {
            setHistoryStatus("loading");
            setHistoryError("");
            setTab("history");
          }}
        >
          History <span>{scanHistory.length || ""}</span>
        </button>
        <button disabled title="Planned for a later phase">
          Interview prep <span>soon</span>
        </button>
      </nav>

      {tab === "resume" || tab === "review" || tab === "draft" ? (
        <section className={`workspace workspace-${tab}`} aria-label="Resume workspace">
          <aside className="controls-column">
            <div className="panel input-panel">
              <div className="panel-heading">
                <span>01</span>
                <div>
                  <p>Source material</p>
                  <h2>{tab === "resume" ? "Your reusable base resume" : tab === "review" ? "Review it against an opportunity" : "Optional, job-specific tailoring"}</h2>
                </div>
              </div>

              <label className={`upload-zone ${resumeFile ? "has-file" : ""}`}>
                <input type="file" accept=".pdf,.docx" onChange={handleFile} disabled={parseStatus === "parsing"} />
                <span className="upload-icon" aria-hidden="true">↑</span>
                <span>
                  <strong>{resumeFile || "Choose a resume"}</strong>
                  <small>{parseStatus === "parsing" ? "Reading your resume…" : "PDF or DOCX · original file is not retained"}</small>
                </span>
              </label>
              {parseMessage && <p className={`parse-status ${parseStatus}`} role="status">{parseMessage}</p>}
              {parseQuality?.warnings.length ? (
                <details className="parse-warnings">
                  <summary>{parseQuality.warnings.length} import warning{parseQuality.warnings.length === 1 ? "" : "s"}</summary>
                  <ul>{parseQuality.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
                </details>
              ) : null}

              {tab === "resume" ? (
                <p className="base-resume-note">This is your source of truth. Keep it broad, accurate, and ready for the roles you are targeting. Use Keywords to decide what belongs here.</p>
              ) : (
              <div className="role-review-controls">
              <div className="field-label-row">
                <label htmlFor="job-description">Job description</label>
                <button className="text-button" onClick={() => { setJobDescription(sampleJobDescription); setHasScanned(false); setSaveStatus("idle"); }}>
                  Use sample
                </button>
              </div>
              <div className="metadata-row">
                <label>
                  <span>Company</span>
                  <input value={company} onChange={(event) => setCompany(event.target.value)} placeholder="e.g. Northstar Bank" />
                </label>
                <label>
                  <span>Role title</span>
                  <input value={roleTitle} onChange={(event) => setRoleTitle(event.target.value)} placeholder="e.g. Business Systems Analyst" />
                </label>
                <label>
                  <span>Role category</span>
                  <select value={roleCategory} onChange={(event) => setRoleCategory(event.target.value)}>
                    {roleCategoryOptions.map((category) => <option key={category}>{category}</option>)}
                  </select>
                </label>
              </div>
              <textarea
                id="job-description"
                value={jobDescription}
                onChange={(event) => {
                  setJobDescription(event.target.value);
                  setHasScanned(false);
                  setSaveStatus("idle");
                }}
                placeholder="Paste the full job description here…"
              />
              <button className="primary-button" onClick={runScan} disabled={!jobDescription.trim() || isScanning || parseStatus !== "ready"}>
                {isScanning ? "Reviewing evidence…" : parseStatus === "ready" ? tab === "draft" ? "Refresh tailored draft" : "Review this opportunity" : "Upload resume to review"}
                <span aria-hidden="true">→</span>
              </button>
              <p className="demo-note">
                Your score reflects the last completed scan. After changing the resume,
                scan again to refresh the score and highlighted evidence.
              </p>
              {scanError && <p className="save-error" role="alert">{scanError}</p>}
              </div>
              )}
            </div>

            {tab !== "resume" && hasScanned ? (
              <div className="panel results-panel" aria-live="polite">
                <div className="panel-heading compact">
                  <span>02</span>
                  <div>
                    <p>{tab === "draft" ? "Tailored draft" : "Review results"}</p>
                    <h2>{tab === "draft" ? "Changes to verify" : "Evidence, not guesswork"}</h2>
                  </div>
                </div>
                <div className="score-grid">
                  <div className="score-card good">
                    <strong>{analysis?.formattingScore ?? 0}</strong><span>/100</span>
                    <p>Format health</p>
                  </div>
                  <div className="score-card gap">
                    <strong>{matchScore}</strong><span>/100</span>
                    <p>Role match</p>
                  </div>
                </div>

                <KeywordGroup title="Evidence found" keywords={matchedKeywords} tone="matched" />
                <KeywordGroup title="Worth reviewing" keywords={missingKeywords} tone="missing" />

                <button className="save-button" onClick={saveJobDescription} disabled={saveStatus === "saving" || saveStatus === "saved"}>
                  {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved to your library" : "Save this scan"}
                </button>
                {saveStatus === "error" && <p className="save-error">We couldn’t save this scan. Please try again.</p>}

                <div className="suggestion-list">
                  <div className="section-label">
                    <span>AI review suggestions</span>
                    <span>{suggestions.length}</span>
                  </div>
                  {suggestions.length ? suggestions.map((suggestion) => {
                    const resolution = resolutions[suggestion.keyword];
                    return (
                      <article className={`suggestion-card ${resolution ? "resolved" : ""}`} key={suggestion.keyword}>
                        <div className="suggestion-topline">
                          <strong>{suggestion.keyword}</strong>
                          <div className="suggestion-badges">
                            <span className={`source-badge ${suggestion.source}`}>
                              {suggestion.source === "openai" ? "AI-assisted" : "Keyword comparison"}
                            </span>
                            {suggestion.flag && <span className="flag">{suggestion.flag}</span>}
                          </div>
                        </div>
                        <div className="suggestion-evidence">
                          <strong>Job-description evidence</strong>
                          <p>“{suggestion.jobEvidence}”</p>
                        </div>
                        <p className="suggestion-target"><strong>Review in:</strong> {suggestion.targetLabel}</p>
                        {suggestion.original && <p className="original">Current: {suggestion.original}</p>}
                        {suggestion.kind === "grounded_edit" && suggestion.revised && (
                          <p className="revision">Suggested: {suggestion.revised}</p>
                        )}
                        <p className="reason">{suggestion.reason}</p>
                        {resolution ? (
                          <p className="resolution">Marked {resolution}. You can revisit this decision anytime.</p>
                        ) : suggestion.kind === "grounded_edit" && suggestion.source === "openai" ? (
                          <div className="suggestion-actions">
                            <button onClick={() => acceptSuggestion(suggestion)} disabled={!suggestion.targetPath}>Accept</button>
                            <button onClick={() => setResolutions((current) => ({ ...current, [suggestion.keyword]: "rejected" }))}>Reject</button>
                          </div>
                        ) : (
                          <div className="evidence-prompt-action">
                            <p>Verify this experience yourself, then use Edit content to add accurate wording.</p>
                            <button onClick={() => setResolutions((current) => ({ ...current, [suggestion.keyword]: "rejected" }))}>Dismiss</button>
                          </div>
                        )}
                      </article>
                    );
                  }) : <p className="empty-state">No ready-made suggestions for these gaps yet.</p>}
                </div>
              </div>
            ) : tab !== "resume" ? (
              <div className="panel waiting-panel">
                <span className="waiting-orbit" aria-hidden="true" />
                <p>Paste a job description to reveal keyword evidence, credible gaps, and grounded edit suggestions.</p>
              </div>
            ) : null}
          </aside>

          <section className="preview-column">
            <div className="preview-header">
              <div>
                <p className="eyebrow">{previewStage}</p>
                <h2>Harvard-style resume</h2>
              </div>
              <div className="preview-actions">
                <button className="secondary-button" onClick={() => setShowEditor((current) => !current)} disabled={parseStatus !== "ready"}>
                  {showEditor ? "Close editor" : "Edit content"}
                </button>
                <label className="preview-view-control">
                  <span>View</span>
                  <select
                    value={previewMode}
                    onChange={(event) => setPreviewMode(event.target.value as PreviewMode)}
                  >
                    <option value="readable">Fit width</option>
                    <option value="page">Fit page</option>
                  </select>
                </label>
                <button className="secondary-button" onClick={() => window.print()}>
                  Print / Save PDF
                </button>
                <button className="secondary-button" onClick={downloadDocx} disabled={parseStatus !== "ready"}>Download DOCX</button>
                <button className="secondary-button" onClick={saveResumeVersion} disabled={!resumeId || versionStatus === "saving"}>
                  {versionStatus === "saving" ? "Saving…" : versionStatus === "saved" ? "Version saved" : "Save version"}
                </button>
              </div>
            </div>
            {parseStatus === "parsing" && (
              <div className="preview-notice loading" role="status">
                <strong>Reading your resume…</strong>
                <span>The sample remains visible until the new preview is ready.</span>
              </div>
            )}
            {parseStatus === "error" && (
              <div className="preview-notice error" role="alert">
                <strong>Preview not updated</strong>
                <span>{parseMessage || "We couldn’t read that file. Please try again."}</span>
              </div>
            )}
            {parseStatus === "ready" && (
              <div className={`preview-notice ready ${scoreIsStale ? "stale" : ""}`} role="status">
                <strong>{previewStage}</strong>
                <span>{previewStageDescription}</span>
                {scoreIsStale && (
                  <button type="button" onClick={runScan} disabled={!jobDescription.trim() || isScanning}>
                    {isScanning ? "Scanning…" : "Refresh score"}
                  </button>
                )}
              </div>
            )}
            {showEditor && (
              <section className="resume-editor" aria-label="Resume content editor">
                <div className="editor-grid">
                  {(["name", "email", "phone", "location", "website"] as const).map((field) => (
                    <label key={field}>
                      <span>{titleCase(field)}</span>
                      <input
                        value={resume.contact[field]}
                        onChange={(event) => {
                          setResume((current) => ({
                            ...current,
                            contact: { ...current.contact, [field]: event.target.value },
                          }));
                          markResumeEdited();
                        }}
                      />
                    </label>
                  ))}
                </div>
                <label>
                  <span>Professional summary</span>
                  <textarea
                    value={resume.summary}
                    onChange={(event) => {
                      setResume((current) => ({ ...current, summary: event.target.value }));
                      markResumeEdited();
                    }}
                  />
                </label>
                {resume.experience.map((role, roleIndex) => (
                  <fieldset key={`${role.organization}-${roleIndex}`}>
                    <legend>{role.title || role.organization || `Experience ${roleIndex + 1}`}</legend>
                    {role.bullets.map((bullet, bulletIndex) => (
                      <textarea
                        key={bulletIndex}
                        value={bullet}
                        aria-label={`Experience ${roleIndex + 1} bullet ${bulletIndex + 1}`}
                        onChange={(event) => {
                          setResume((current) => {
                            const next = structuredClone(current);
                            next.experience[roleIndex].bullets[bulletIndex] = event.target.value;
                            return next;
                          });
                          markResumeEdited();
                        }}
                      />
                    ))}
                  </fieldset>
                ))}
              </section>
            )}
            <div
              className="paper-frame"
              ref={previewFrameRef}
              style={{ "--preview-scale": previewScale } as CSSProperties}
            >
              <div className="paper-stage">
                <div className="paper">
                  <div className="resume-name">{resume.contact.name || "Your Name"}</div>
                  <p className="contact">{contactLine || "Add your contact details"}</p>

                  {resume.summary && (
                    <ResumeSection title="Professional Summary">
                      <p className="summary-copy"><HighlightedText text={resume.summary} keywords={matchedKeywords} enabled={scanVisible} /></p>
                    </ResumeSection>
                  )}

                  {resume.education.length > 0 && (
                    <ResumeSection title="Education">
                      {resume.education.map((item, index) => (
                        <div className="resume-entry" key={`${item.school}-${index}`}>
                          <div className="resume-line"><strong><HighlightedText text={item.school} keywords={matchedKeywords} enabled={scanVisible} /></strong><span>{item.location}</span></div>
                          <div className="resume-line">
                            <span><HighlightedText text={item.degree} keywords={matchedKeywords} enabled={scanVisible} />{item.gpa && <> · <strong>GPA:</strong> {item.gpa}</>}</span>
                            <span>{item.graduationDate}</span>
                          </div>
                          {item.awards.length > 0 && <div className="education-details"><p><strong>Awards:</strong> {item.awards.join("; ")}</p></div>}
                        </div>
                      ))}
                    </ResumeSection>
                  )}

                  {resume.experience.length > 0 && (
                    <ResumeSection title="Experience">
                      {resume.experience.map((role, index) => (
                        <ResumeRole
                          key={`${role.organization}-${role.title}-${index}`}
                          organization={<HighlightedText text={role.organization} keywords={matchedKeywords} enabled={scanVisible} />}
                          location={role.location}
                          title={<HighlightedText text={role.title} keywords={matchedKeywords} enabled={scanVisible} />}
                          date={[role.startDate, role.endDate].filter(Boolean).join(" - ")}
                        >
                          {role.bullets.map((bullet, bulletIndex) => <li key={bulletIndex}><HighlightedText text={bullet} keywords={matchedKeywords} enabled={scanVisible} /></li>)}
                        </ResumeRole>
                      ))}
                    </ResumeSection>
                  )}

                  {resume.leadership.length > 0 && (
                    <ResumeSection title="Leadership & Activities">
                      {resume.leadership.map((role, index) => (
                        <ResumeRole
                          key={`${role.organization}-${role.title}-${index}`}
                          organization={<HighlightedText text={role.organization} keywords={matchedKeywords} enabled={scanVisible} />}
                          location={role.location}
                          title={<HighlightedText text={role.title} keywords={matchedKeywords} enabled={scanVisible} />}
                          date={[role.startDate, role.endDate].filter(Boolean).join(" - ")}
                        >
                          {role.bullets.map((bullet, bulletIndex) => <li key={bulletIndex}><HighlightedText text={bullet} keywords={matchedKeywords} enabled={scanVisible} /></li>)}
                        </ResumeRole>
                      ))}
                    </ResumeSection>
                  )}

                  {resume.skills.length > 0 && (
                    <ResumeSection title="Skills & Interests">
                      {resume.skills.map((group) => (
                        <p className="skill-line" key={group.label}><strong>{group.label}:</strong> <HighlightedText text={group.items.join(", ")} keywords={matchedKeywords} enabled={scanVisible} /></p>
                      ))}
                    </ResumeSection>
                  )}

                  {resume.projects.length > 0 && (
                    <ResumeSection title="Projects">
                      {resume.projects.map((project, index) => (
                        <ResumeProject key={`${project.name}-${index}`} name={<HighlightedText text={project.name} keywords={matchedKeywords} enabled={scanVisible} />} date={project.date}>
                          {project.bullets.map((bullet, bulletIndex) => <li key={bulletIndex}><HighlightedText text={bullet} keywords={matchedKeywords} enabled={scanVisible} /></li>)}
                        </ResumeProject>
                      ))}
                    </ResumeSection>
                  )}
                </div>
              </div>
            </div>
            {scanVisible && (
              <div className="preview-legend">
                <span><i className="legend-hit" /> Green highlights show language already supported by your resume</span>
                <span><i className="legend-gap" /> Orange suggestion cards require your verification</span>
              </div>
            )}
          </section>
        </section>
      ) : tab === "keywords" ? (
        <section className="library-view">
          <div className="library-intro">
            <p className="eyebrow">Career keyword library</p>
            <h2>Learn the top language for each exact job title.</h2>
            <p>Paste postings before you apply. Repeated terms help you decide what truthful evidence belongs in your reusable base resume.</p>
          </div>
          <section className="keyword-capture" aria-label="Save a job description for keyword research">
            <div>
              <p className="eyebrow">Add a source</p>
              <h3>Build a job-title keyword profile</h3>
              <p>This does not review or change your resume. It extracts recurring language from the posting you save.</p>
            </div>
            <div className="keyword-capture-fields">
              <input value={keywordTitle} onChange={(event) => { setKeywordTitle(event.target.value); setKeywordSaveStatus("idle"); }} placeholder="Exact job title, e.g. Business Systems Analyst" />
              <input value={keywordCompany} onChange={(event) => { setKeywordCompany(event.target.value); setKeywordSaveStatus("idle"); }} placeholder="Company (optional)" />
              <textarea value={keywordDescription} onChange={(event) => { setKeywordDescription(event.target.value); setKeywordSaveStatus("idle"); }} placeholder="Paste a complete job description (at least a few sentences)…" />
              <button className="primary-button" type="button" onClick={saveKeywordPosting} disabled={!keywordTitle.trim() || keywordDescription.trim().length < 40 || keywordSaveStatus === "saving"}>
                {keywordSaveStatus === "saving" ? "Extracting keywords…" : "Save keyword source"}<span aria-hidden="true">→</span>
              </button>
              {keywordSaveStatus === "saved" && <p className="keyword-save-status">Saved. Its keywords now count toward this exact title.</p>}
              {keywordSaveStatus === "error" && <p className="save-error">We couldn’t save this source. Please try again.</p>}
            </div>
          </section>
          <div className="library-grid">
            <aside className="role-list" aria-label="Saved job titles">
              {roleProfiles.map((profile, index) => (
                <button className={index === profileIndex ? "active" : ""} key={profile.name} onClick={() => setProfileIndex(index)}>
                  <strong>{profile.name}</strong><span>{profile.subtitle}</span>
                </button>
              ))}
            </aside>
            <div className="profile-panel">
              <section className="hosted-saves">
                <div className="section-label"><span>Your cloud saves</span><span>{hostedPostings.length}</span></div>
                {libraryStatus === "loading" && <p>Loading your saved scans…</p>}
                {libraryStatus === "error" && <p>We couldn’t load your saved scans. Please try again.</p>}
                {libraryStatus === "ready" && !hostedPostings.length && <p>No keyword sources yet. Add a job description above to start learning patterns.</p>}
                {deleteError && <p className="delete-error" role="status">{deleteError}</p>}
                {hostedPostings.slice(0, 5).map((posting) => (
                  <article key={posting.id}>
                    <div className="hosted-save-summary"><strong>{posting.company || "Company not set"}</strong><p>{posting.title} · {new Date(posting.created_at).toLocaleDateString()}</p></div>
                    <div className="hosted-save-actions">
                      <span>{posting.match_score === null ? "Keyword source" : `${posting.match_score}% match`}</span>
                      <button
                        className="view-posting-button"
                        type="button"
                        aria-expanded={expandedPostingId === posting.id}
                        aria-controls={`posting-description-${posting.id}`}
                        onClick={() => setExpandedPostingId((current) => current === posting.id ? null : posting.id)}
                      >
                        {expandedPostingId === posting.id ? "Hide JD" : "View JD"}
                      </button>
                      <button
                        className="delete-posting-button"
                        type="button"
                        disabled={deletingPostingId === posting.id}
                        aria-label={`Delete ${posting.title} saved posting`}
                        onClick={() => deleteSavedPosting(posting)}
                      >
                        {deletingPostingId === posting.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                    {expandedPostingId === posting.id && (
                      <div className="hosted-save-description" id={`posting-description-${posting.id}`}>
                        <h4>Full job description</h4>
                        <p>{posting.raw_text}</p>
                      </div>
                    )}
                  </article>
                ))}
              </section>
              <div className="profile-heading">
                <div><p>Role profile</p><h3>{activeProfile.name}</h3></div>
                <span>{activeProfile.postings.length < 5 ? "Building confidence" : "High confidence"}</span>
              </div>
              <div className="frequency-columns">
                <FrequencyList title="Core language" subtitle="Appears in 50%+ of postings" values={activeProfile.core} tone="core" />
                <FrequencyList title="Variable language" subtitle="Company or role-specific" values={activeProfile.variable} tone="variable" />
              </div>
              <div className="posting-list">
                <div className="section-label"><span>Saved postings</span><span>{activeProfile.postings.length}</span></div>
                {activeProfile.postings.map((posting) => (
                  <article key={`${posting.company}-${posting.role}`}>
                    <div><strong>{posting.company}</strong><p>{posting.role} · saved {posting.date}</p></div>
                    <span className={`outcome ${posting.outcome}`}>{posting.outcome}</span>
                  </article>
                ))}
              </div>
              <button className="profile-action" onClick={() => { setRoleTitle(activeProfile.name); setTab("review"); }} disabled={!roleProfiles.length}>
                Review my resume for this title <span>→</span>
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="history-view">
          <div className="history-intro">
            <p className="eyebrow">Saved work</p>
            <h2>Revisit a resume version or reopen a previous scan.</h2>
            <p>History is read-only until you deliberately save a new version. Restoring never overwrites the original record.</p>
          </div>
          {historyStatus === "loading" && <div className="history-state">Loading your history…</div>}
          {historyStatus === "error" && <div className="history-state error" role="alert">{historyError}</div>}
          {historyStatus === "ready" && (
            <div className="history-grid">
              <section className="history-panel">
                <div className="history-panel-heading">
                  <div><span>Resume versions</span><strong>{resumeVersions.length}</strong></div>
                  <select
                    aria-label="Saved resume"
                    value={selectedHistoryResumeId}
                    onChange={(event) => selectHistoryResume(event.target.value)}
                    disabled={!savedResumes.length}
                  >
                    {savedResumes.length
                      ? savedResumes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)
                      : <option value="">No saved resumes</option>}
                  </select>
                </div>
                {!resumeVersions.length && <p className="history-empty">Upload a resume to create its first saved version.</p>}
                <div className="history-list">
                  {resumeVersions.map((version) => (
                    <article key={version.id}>
                      <div>
                        <strong>Version {version.version_number}</strong>
                        <span>{new Date(version.created_at).toLocaleString()}</span>
                      </div>
                      <button type="button" onClick={() => restoreResumeVersion(version)}>Restore for review</button>
                    </article>
                  ))}
                </div>
              </section>
              <section className="history-panel">
                <div className="history-panel-heading">
                  <div><span>ATS scans</span><strong>{scanHistory.length}</strong></div>
                </div>
                {!scanHistory.length && <p className="history-empty">Run an ATS scan to build your history.</p>}
                <div className="history-list scans">
                  {scanHistory.map((scan) => (
                    <article key={scan.id}>
                      <div>
                        <strong>{scan.company || scan.role_category}</strong>
                        <span>{scan.role_category} · {scan.match_score}% match · {new Date(scan.created_at).toLocaleString()}</span>
                        <small>{scan.analysis_mode === "hybrid" ? "AI-assisted evidence" : "Keyword comparison"}</small>
                      </div>
                      <div className="history-actions">
                        <button type="button" onClick={() => reopenScan(scan)}>Reopen</button>
                        <button
                          className="danger"
                          type="button"
                          disabled={deletingScanId === scan.id}
                          onClick={() => deleteStoredScan(scan)}
                        >
                          {deletingScanId === scan.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                {scanNextCursor && <button className="history-load-more" type="button" onClick={loadMoreScans}>Load more scans</button>}
                {historyError && <p className="history-inline-error" role="alert">{historyError}</p>}
              </section>
            </div>
          )}
        </section>
      )}

      <footer>
        <p><strong>Resume Signal</strong> · Built for credible base resumes, careful reviews, and optional tailoring.</p>
        <p>Your source stays portable and GitHub-ready.</p>
      </footer>
    </main>
  );
}

function KeywordGroup({ title, keywords, tone }: { title: string; keywords: string[]; tone: "matched" | "missing" }) {
  return (
    <div className="keyword-group">
      <p>{title}</p>
      <div>{keywords.length ? keywords.map((keyword) => <span className={tone} key={keyword}>{titleCase(keyword)}</span>) : <small>None detected</small>}</div>
    </div>
  );
}

function ResumeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="resume-section"><h3>{title}</h3>{children}</section>;
}

function ResumeRole({ organization, location, title, date, children }: { organization: React.ReactNode; location: string; title: React.ReactNode; date: string; children: React.ReactNode }) {
  return (
    <div className="resume-role">
      <div className="resume-line"><strong>{organization}</strong><span>{location}</span></div>
      <div className="resume-line"><strong>{title}</strong><span>{date}</span></div>
      <ul>{children}</ul>
    </div>
  );
}

function ResumeProject({ name, date, children }: { name: React.ReactNode; date: string; children: React.ReactNode }) {
  return (
    <div className="resume-role">
      <div className="resume-line"><strong>{name}</strong><span>{date}</span></div>
      <ul>{children}</ul>
    </div>
  );
}

function FrequencyList({ title, subtitle, values, tone }: { title: string; subtitle: string; values: { term: string; frequency: number }[]; tone: "core" | "variable" }) {
  return (
    <section className="frequency-list">
      <h4>{title}</h4><p>{subtitle}</p>
      {!values.length && <p className="empty-state">Save postings in this category to build a keyword profile.</p>}
      {values.map((value) => (
        <div className="frequency-row" key={value.term}>
          <div><span>{value.term}</span><span>{value.frequency}%</span></div>
          <i><b className={tone} style={{ width: `${value.frequency}%` }} /></i>
        </div>
      ))}
    </section>
  );
}
