"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";

type Tab = "scan" | "library";
type Resolution = "accepted" | "rejected";

type SavedPosting = {
  id: string;
  company: string | null;
  title: string;
  role_category: string;
  match_score: number | null;
  outcome: string;
  created_at: string;
};

type Suggestion = {
  keyword: string;
  original: string;
  revised: string;
  reason: string;
  flag?: "verify claim" | "high JD overlap";
};

type RoleProfile = {
  name: string;
  subtitle: string;
  core: { term: string; frequency: number }[];
  variable: { term: string; frequency: number }[];
  postings: { company: string; role: string; date: string; outcome: string }[];
};

const resumeKeywords = [
  "requirements",
  "stakeholder management",
  "uat",
  "power bi",
  "sql",
  "workflow automation",
  "data analysis",
];

const keywordCandidates = [
  "requirements",
  "stakeholder management",
  "uat",
  "power bi",
  "sql",
  "workflow automation",
  "data analysis",
  "agile",
  "jira",
  "bpmn",
  "process improvement",
  "product backlog",
  "user stories",
  "scrum",
  "confluence",
];

const sampleJobDescription = `We are looking for a Business Analyst to partner with cross-functional stakeholders and translate business requirements into clear user stories. The role will facilitate Agile ceremonies, maintain delivery documentation in Jira and Confluence, support UAT, and use SQL and Power BI to validate findings. Experience with process improvement and BPMN is preferred.`;

const suggestionBank: Record<string, Suggestion> = {
  agile: {
    keyword: "Agile",
    original: "Gathered and documented requirements from cross-functional stakeholders.",
    revised: "Facilitated requirements refinement within Agile delivery cycles, aligning cross-functional stakeholders on scope and acceptance criteria.",
    reason: "Names the delivery context already implied by your requirements work.",
    flag: "verify claim",
  },
  jira: {
    keyword: "Jira",
    original: "Led UAT cycles and coordinated defect resolution before release.",
    revised: "Led UAT cycles, tracking defects and release decisions in Jira through closure.",
    reason: "Makes the tool visible to ATS scanners without changing the core achievement.",
    flag: "verify claim",
  },
  bpmn: {
    keyword: "BPMN",
    original: "Documented system workflows and proposed process enhancements.",
    revised: "Mapped current and future-state workflows in BPMN to clarify process gaps and proposed enhancements.",
    reason: "Adds a specific method where your existing workflow work may support it.",
    flag: "verify claim",
  },
  "process improvement": {
    keyword: "Process improvement",
    original: "Automated recurring manual processes, reducing turnaround time.",
    revised: "Delivered process improvements through workflow automation, reducing recurring manual effort and turnaround time.",
    reason: "Uses the employer's concept, but keeps the claim grounded in your original bullet.",
  },
  "user stories": {
    keyword: "User stories",
    original: "Gathered and documented requirements from cross-functional stakeholders.",
    revised: "Translated stakeholder requirements into user stories with testable acceptance criteria.",
    reason: "Makes the output of your requirements work explicit.",
    flag: "verify claim",
  },
  confluence: {
    keyword: "Confluence",
    original: "Maintained project documentation for system enhancements.",
    revised: "Maintained decision logs and system documentation in Confluence for cross-functional delivery teams.",
    reason: "Adds the requested documentation tool only if it reflects your actual work.",
    flag: "verify claim",
  },
};

const roleProfiles: RoleProfile[] = [
  {
    name: "Business Analyst",
    subtitle: "4 postings saved",
    core: [
      { term: "Stakeholders", frequency: 100 },
      { term: "Requirements", frequency: 100 },
      { term: "Agile", frequency: 75 },
      { term: "UAT", frequency: 75 },
    ],
    variable: [
      { term: "BPMN", frequency: 50 },
      { term: "Power BI", frequency: 25 },
      { term: "SQL", frequency: 25 },
    ],
    postings: [
      { company: "Northstar Bank", role: "Reporting & Analytics BA", date: "Jul 12", outcome: "interview" },
      { company: "Brightpath Consulting", role: "Business Technology Analyst", date: "Jul 08", outcome: "applied" },
      { company: "Atlas Systems", role: "Process Transformation Analyst", date: "Jun 28", outcome: "applied" },
      { company: "Harbor Finance", role: "Business Analyst", date: "Jun 18", outcome: "closed" },
    ],
  },
  {
    name: "Product Owner",
    subtitle: "2 postings saved",
    core: [
      { term: "Backlog", frequency: 100 },
      { term: "User stories", frequency: 100 },
      { term: "Roadmap", frequency: 50 },
    ],
    variable: [
      { term: "Analytics", frequency: 50 },
      { term: "Fintech", frequency: 50 },
    ],
    postings: [
      { company: "PocketPay", role: "Associate Product Owner", date: "Jul 02", outcome: "applied" },
      { company: "Nova Wallet", role: "Product Owner", date: "Jun 20", outcome: "closed" },
    ],
  },
  {
    name: "Data / Reporting",
    subtitle: "1 posting saved",
    core: [
      { term: "SQL", frequency: 100 },
      { term: "Power BI", frequency: 100 },
      { term: "Dashboards", frequency: 100 },
    ],
    variable: [
      { term: "Python", frequency: 100 },
      { term: "DAX", frequency: 100 },
    ],
    postings: [
      { company: "Summit Financial", role: "Reporting Analyst", date: "Jun 10", outcome: "applied" },
    ],
  },
];

function titleCase(value: string) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("scan");
  const [jobDescription, setJobDescription] = useState("");
  const [resumeFile, setResumeFile] = useState("");
  const [company, setCompany] = useState("");
  const [roleCategory, setRoleCategory] = useState("Business Analyst");
  const [hasScanned, setHasScanned] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>({});
  const [profileIndex, setProfileIndex] = useState(0);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [hostedPostings, setHostedPostings] = useState<SavedPosting[]>([]);
  const [libraryStatus, setLibraryStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const detectedKeywords = useMemo(() => {
    const normalized = jobDescription.toLowerCase();
    return keywordCandidates.filter((keyword) => normalized.includes(keyword));
  }, [jobDescription]);

  const matchedKeywords = detectedKeywords.filter((keyword) =>
    resumeKeywords.some(
      (resumeKeyword) =>
        keyword.includes(resumeKeyword) || resumeKeyword.includes(keyword),
    ),
  );
  const missingKeywords = detectedKeywords.filter(
    (keyword) => !matchedKeywords.includes(keyword),
  );
  const matchScore = detectedKeywords.length
    ? Math.round((matchedKeywords.length / detectedKeywords.length) * 100)
    : 0;
  const suggestions = missingKeywords
    .map((keyword) => suggestionBank[keyword])
    .filter(Boolean)
    .slice(0, 4);
  const activeProfile = roleProfiles[profileIndex];

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

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setResumeFile(file?.name ?? "");
    setHasScanned(false);
  }

  function runScan() {
    if (!jobDescription.trim()) return;
    setIsScanning(true);
    setResolutions({});
    window.setTimeout(() => {
      setHasScanned(true);
      setIsScanning(false);
    }, 650);
  }

  async function saveJobDescription() {
    setSaveStatus("saving");
    try {
      const response = await fetch("/api/job-descriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          company,
          title: roleCategory,
          roleCategory,
          rawText: jobDescription,
          keywords: detectedKeywords,
          matchScore,
        }),
      });
      if (!response.ok) throw new Error("Save failed");
      const saved = await response.json() as SavedPosting;
      setHostedPostings((current) => [saved, ...current]);
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
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
        <div className="header-meta">
          <span className="status-dot" aria-hidden="true" />
          <span>{hasScanned ? "Scan ready" : "Private workspace"}</span>
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
          JD library <span>7</span>
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
                <input type="file" accept=".pdf,.doc,.docx" onChange={handleFile} />
                <span className="upload-icon" aria-hidden="true">↑</span>
                <span>
                  <strong>{resumeFile || "Choose a resume"}</strong>
                  <small>{resumeFile ? "Ready for the demo scan" : "PDF or DOCX · stays in this browser demo"}</small>
                </span>
              </label>

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
                  <span>Role category</span>
                  <select value={roleCategory} onChange={(event) => setRoleCategory(event.target.value)}>
                    <option>Business Analyst</option>
                    <option>Product Owner</option>
                    <option>Data / Reporting</option>
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
              <button className="primary-button" onClick={runScan} disabled={!jobDescription.trim() || isScanning}>
                {isScanning ? "Comparing language…" : "Run ATS scan"}
                <span aria-hidden="true">→</span>
              </button>
              <p className="demo-note">
                Prototype mode uses keyword matching. File parsing and semantic scoring
                connect later through a server-side API.
              </p>
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
                    <strong>94</strong><span>/100</span>
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
                  {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved to Supabase" : "Save this scan to Supabase"}
                </button>
                {saveStatus === "error" && <p className="save-error">The Supabase database is unavailable. Check the server settings in .env.local.</p>}

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
                          {suggestion.flag && <span className="flag">{suggestion.flag}</span>}
                        </div>
                        <p className="original">− {suggestion.original}</p>
                        <p className="revision">+ {suggestion.revised}</p>
                        <p className="reason">{suggestion.reason}</p>
                        {resolution ? (
                          <p className="resolution">Marked {resolution}. You can revisit this decision anytime.</p>
                        ) : (
                          <div className="suggestion-actions">
                            <button onClick={() => setResolutions((current) => ({ ...current, [suggestion.keyword]: "accepted" }))}>Accept</button>
                            <button onClick={() => setResolutions((current) => ({ ...current, [suggestion.keyword]: "rejected" }))}>Reject</button>
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
                <p className="eyebrow">Live document preview</p>
                <h2>Harvard-style resume</h2>
              </div>
              <button className="secondary-button" onClick={() => window.print()}>
                Print preview
              </button>
            </div>
            <div className="paper">
              <div className="resume-name">Taylor Rivera</div>
              <p className="contact">Metro Manila, Philippines • sample.candidate@example.com • linkedin.com/in/sample-profile</p>

              <ResumeSection title="Education">
                <div className="resume-entry">
                  <div className="resume-line"><strong>Sample State University</strong><span>Metro Manila, Philippines</span></div>
                  <div className="resume-line"><span>BS Information Technology</span><span>2020</span></div>
                  <p className="resume-detail"><strong>Relevant Coursework:</strong> Systems Analysis, Database Management, Project Management</p>
                </div>
              </ResumeSection>

              <ResumeSection title="Experience">
                <ResumeRole organization="Sample Technology Company" location="Metro Manila, Philippines" title="Business Systems Analyst" date="Jan 2022 – Present">
                  <li>Documented <mark>requirements</mark> with cross-functional <mark>stakeholders</mark> for a sample internal platform.</li>
                  <li>Coordinated <mark>UAT</mark>, test evidence, and issue resolution before demonstration releases.</li>
                  <li>Created example <mark>Power BI</mark> dashboards for operational reporting exercises.</li>
                  <li>Mapped a fictional approval workflow and proposed process improvements.</li>
                  <li>Used <mark>SQL</mark> to validate sample datasets and reconcile reporting outputs.</li>
                </ResumeRole>
              </ResumeSection>

              <ResumeSection title="Leadership & Activities">
                <ResumeRole organization="Community Innovation Project" location="Remote" title="Project Coordinator" date="Jun 2020 – Dec 2021">
                  <li>Maintained schedules, meeting notes, and action logs for a fictional project team.</li>
                  <li>Prepared sample status reports and coordinated demonstration workshops.</li>
                </ResumeRole>
              </ResumeSection>

              <ResumeSection title="Skills & Interests">
                <p className="skill-line"><strong>Technical:</strong> Requirements Analysis, SQL, Data Visualization, UAT, Process Mapping</p>
                <p className="skill-line"><strong>Tools:</strong> Power BI, Jira, Confluence, Spreadsheet Applications</p>
                <p className="skill-line"><strong>Interests:</strong> Workflow Design, Community Technology, Visual Communication</p>
              </ResumeSection>
            </div>
            <div className="preview-legend">
              <span><i className="legend-hit" /> Language already supported by your resume</span>
              <span><i className="legend-gap" /> Suggested language needs your verification</span>
            </div>
          </section>
        </section>
      ) : (
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
              <button className="new-role">+ Add role category</button>
            </aside>
            <div className="profile-panel">
              <section className="hosted-saves">
                <div className="section-label"><span>Your cloud saves</span><span>{hostedPostings.length}</span></div>
                {libraryStatus === "loading" && <p>Loading your Supabase library…</p>}
                {libraryStatus === "error" && <p>Could not reach Supabase. Check the server settings in .env.local.</p>}
                {libraryStatus === "ready" && !hostedPostings.length && <p>No saved scans yet. Save a result from the Scan & build tab.</p>}
                {hostedPostings.slice(0, 5).map((posting) => (
                  <article key={posting.id}>
                    <div><strong>{posting.company || "Company not set"}</strong><p>{posting.title} · {new Date(posting.created_at).toLocaleDateString()}</p></div>
                    <span>{posting.match_score ?? 0}% match</span>
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
              <button className="profile-action">Compare this role profile with my resume <span>→</span></button>
            </div>
          </div>
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

function FrequencyList({ title, subtitle, values, tone }: { title: string; subtitle: string; values: { term: string; frequency: number }[]; tone: "core" | "variable" }) {
  return (
    <section className="frequency-list">
      <h4>{title}</h4><p>{subtitle}</p>
      {values.map((value) => (
        <div className="frequency-row" key={value.term}>
          <div><span>{value.term}</span><span>{value.frequency}%</span></div>
          <i><b className={tone} style={{ width: `${value.frequency}%` }} /></i>
        </div>
      ))}
    </section>
  );
}
