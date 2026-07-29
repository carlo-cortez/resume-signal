"use client";

import { CSSProperties, ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { sampleResume } from "@/lib/resume/sample";
import { applyResumeSuggestion } from "@/lib/resume/text";
import type { ParseQuality, Resume, ResumeSuggestion, ScoreResult } from "@/types/resume";

type Tab = "scan" | "library" | "history";
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

export default function Home() {
  const [tab, setTab] = useState<Tab>("scan");
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
  const previewFrameRef = useRef<HTMLDivElement>(null);

  const matchedKeywords = analysis?.matchedKeywords ?? [];
  const missingKeywords = analysis?.missingKeywords ?? [];
  const matchScore = analysis?.matchScore ?? 0;
  const suggestions = analysis?.suggestions ?? [];
  const roleProfiles = useMemo<RoleProfile[]>(() => roleCategoryOptions.map((name) => {
    const postings = hostedPostings.filter((posting) => posting.role_category === name);
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
  }), [hostedPostings]);
  const activeProfile = roleProfiles[profileIndex] ?? roleProfiles[0];
  const contactLine = [
    resume.contact.location,
    resume.contact.phone,
    resume.contact.email,
    resume.contact.linkedin || resume.contact.website,
  ].filter(Boolean).join(" • ");

  useEffect(() => {
    if (tab !== "library") return;
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
    setShowEditor(false);
    setPreviewMode("readable");
    setTab("scan");
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
    setTab("scan");
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
          <h1>Build the version of your resume this role needs.</h1>
          <p className="hero-copy">
            Compare your experience with a job description, find credible gaps,
            and shape a clean, ATS-safe resume while you stay in control of every edit.
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
        <button className={tab === "scan" ? "active" : ""} onClick={() => setTab("scan")}>
          Scan & build
        </button>
        <button className={tab === "library" ? "active" : ""} onClick={() => { setLibraryStatus("loading"); setTab("library"); }}>
          JD library <span>{hostedPostings.length}</span>
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

      {tab === "scan" ? (
        <section className="workspace" aria-label="Resume scan workspace">
          <aside className="controls-column">
            <div className="panel input-panel">
              <div className="panel-heading">
                <span>01</span>
                <div>
                  <p>Source material</p>
                  <h2>Add your resume and target role</h2>
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
                {isScanning ? "Comparing language…" : parseStatus === "ready" ? "Run ATS scan" : "Upload resume to scan"}
                <span aria-hidden="true">→</span>
              </button>
              <p className="demo-note">
                Scores use the resume shown in the preview. Semantic suggestions activate
                when a server-side analysis key is configured.
              </p>
              {scanError && <p className="save-error" role="alert">{scanError}</p>}
            </div>

            {hasScanned ? (
              <div className="panel results-panel" aria-live="polite">
                <div className="panel-heading compact">
                  <span>02</span>
                  <div>
                    <p>Scan results</p>
                    <h2>Where you stand</h2>
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
                    <span>Suggested edits</span>
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
            ) : (
              <div className="panel waiting-panel">
                <span className="waiting-orbit" aria-hidden="true" />
                <p>Paste a job description to reveal keyword evidence, credible gaps, and grounded edit suggestions.</p>
              </div>
            )}
          </aside>

          <section className="preview-column">
            <div className="preview-header">
              <div>
                <p className="eyebrow">{parseStatus === "ready" ? "Your document preview" : "Sample document preview"}</p>
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
              <div className="preview-notice ready" role="status">
                <strong>Preview updated</strong>
                <span>{resumeFile}</span>
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
                        onChange={(event) => setResume((current) => ({
                          ...current,
                          contact: { ...current.contact, [field]: event.target.value },
                        }))}
                      />
                    </label>
                  ))}
                </div>
                <label>
                  <span>Professional summary</span>
                  <textarea value={resume.summary} onChange={(event) => setResume((current) => ({ ...current, summary: event.target.value }))} />
                </label>
                {resume.experience.map((role, roleIndex) => (
                  <fieldset key={`${role.organization}-${roleIndex}`}>
                    <legend>{role.title || role.organization || `Experience ${roleIndex + 1}`}</legend>
                    {role.bullets.map((bullet, bulletIndex) => (
                      <textarea
                        key={bulletIndex}
                        value={bullet}
                        aria-label={`Experience ${roleIndex + 1} bullet ${bulletIndex + 1}`}
                        onChange={(event) => setResume((current) => {
                          const next = structuredClone(current);
                          next.experience[roleIndex].bullets[bulletIndex] = event.target.value;
                          return next;
                        })}
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
                      <p className="summary-copy">{resume.summary}</p>
                    </ResumeSection>
                  )}

                  {resume.education.length > 0 && (
                    <ResumeSection title="Education">
                      {resume.education.map((item, index) => (
                        <div className="resume-entry" key={`${item.school}-${index}`}>
                          <div className="resume-line"><strong>{item.school}</strong><span>{item.location}</span></div>
                          <div className="resume-line">
                            <span>{item.degree}{item.gpa && <> · <strong>GPA:</strong> {item.gpa}</>}</span>
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
                          organization={role.organization}
                          location={role.location}
                          title={role.title}
                          date={[role.startDate, role.endDate].filter(Boolean).join(" - ")}
                        >
                          {role.bullets.map((bullet, bulletIndex) => <li key={bulletIndex}>{bullet}</li>)}
                        </ResumeRole>
                      ))}
                    </ResumeSection>
                  )}

                  {resume.leadership.length > 0 && (
                    <ResumeSection title="Leadership & Activities">
                      {resume.leadership.map((role, index) => (
                        <ResumeRole
                          key={`${role.organization}-${role.title}-${index}`}
                          organization={role.organization}
                          location={role.location}
                          title={role.title}
                          date={[role.startDate, role.endDate].filter(Boolean).join(" - ")}
                        >
                          {role.bullets.map((bullet, bulletIndex) => <li key={bulletIndex}>{bullet}</li>)}
                        </ResumeRole>
                      ))}
                    </ResumeSection>
                  )}

                  {resume.skills.length > 0 && (
                    <ResumeSection title="Skills & Interests">
                      {resume.skills.map((group) => (
                        <p className="skill-line" key={group.label}><strong>{group.label}:</strong> {group.items.join(", ")}</p>
                      ))}
                    </ResumeSection>
                  )}

                  {resume.projects.length > 0 && (
                    <ResumeSection title="Projects">
                      {resume.projects.map((project, index) => (
                        <ResumeProject key={`${project.name}-${index}`} name={project.name} date={project.date}>
                          {project.bullets.map((bullet, bulletIndex) => <li key={bulletIndex}>{bullet}</li>)}
                        </ResumeProject>
                      ))}
                    </ResumeSection>
                  )}
                </div>
              </div>
            </div>
            <div className="preview-legend">
              <span><i className="legend-hit" /> Language already supported by your resume</span>
              <span><i className="legend-gap" /> Suggested language needs your verification</span>
            </div>
          </section>
        </section>
      ) : tab === "library" ? (
        <section className="library-view">
          <div className="library-intro">
            <p className="eyebrow">Pattern finder</p>
            <h2>Learn what your target roles repeatedly ask for.</h2>
            <p>Every saved job description strengthens a reusable role profile, so you can improve your base resume before the next application appears.</p>
          </div>
          <div className="library-grid">
            <aside className="role-list" aria-label="Role categories">
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
                {libraryStatus === "ready" && !hostedPostings.length && <p>No saved scans yet. Save a result from the Scan & build tab.</p>}
                {deleteError && <p className="delete-error" role="status">{deleteError}</p>}
                {hostedPostings.slice(0, 5).map((posting) => (
                  <article key={posting.id}>
                    <div className="hosted-save-summary"><strong>{posting.company || "Company not set"}</strong><p>{posting.title} · {new Date(posting.created_at).toLocaleDateString()}</p></div>
                    <div className="hosted-save-actions">
                      <span>{posting.match_score ?? 0}% match</span>
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
              <button className="profile-action" onClick={() => { setRoleCategory(activeProfile.name); setTab("scan"); }}>
                Compare this role profile with my resume <span>→</span>
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
        <p><strong>Resume Signal</strong> · Built for careful tailoring, not keyword stuffing.</p>
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

function ResumeRole({ organization, location, title, date, children }: { organization: string; location: string; title: string; date: string; children: React.ReactNode }) {
  return (
    <div className="resume-role">
      <div className="resume-line"><strong>{organization}</strong><span>{location}</span></div>
      <div className="resume-line"><strong>{title}</strong><span>{date}</span></div>
      <ul>{children}</ul>
    </div>
  );
}

function ResumeProject({ name, date, children }: { name: string; date: string; children: React.ReactNode }) {
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
