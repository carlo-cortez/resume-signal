import type { Resume } from "@/types/resume";

export function resumeToText(resume: Resume) {
  return [
    Object.values(resume.contact).join(" "),
    resume.summary,
    ...resume.education.flatMap((item) => [item.school, item.degree, item.gpa, ...item.awards]),
    ...resume.experience.flatMap((item) => [item.organization, item.title, ...item.bullets]),
    ...resume.leadership.flatMap((item) => [item.organization, item.title, ...item.bullets]),
    ...resume.skills.flatMap((group) => [group.label, ...group.items]),
    ...resume.projects.flatMap((item) => [item.name, ...item.bullets]),
  ].join("\n");
}

export function getResumeValue(resume: Resume, path: string): string | undefined {
  if (path === "summary") return resume.summary;
  const match = /^(experience|leadership|projects)\.(\d+)\.bullets\.(\d+)$/.exec(path);
  if (!match) return undefined;
  const [, section, itemIndex, bulletIndex] = match;
  const items = resume[section as "experience" | "leadership" | "projects"];
  return items[Number(itemIndex)]?.bullets[Number(bulletIndex)];
}

export function getResumePathLabel(resume: Resume, path: string) {
  if (path === "summary") return "Professional Summary";
  const match = /^(experience|leadership|projects)\.(\d+)\.bullets\.(\d+)$/.exec(path);
  if (!match) return "Resume review";
  const [, section, itemIndex, bulletIndex] = match;
  const index = Number(itemIndex);
  const item = resume[section as "experience" | "leadership" | "projects"][index];
  const sectionLabel = section === "experience"
    ? "Experience"
    : section === "leadership"
      ? "Leadership & Activities"
      : "Projects";
  const itemLabel = item && "title" in item
    ? item.title || item.organization
    : item?.name;
  return `${sectionLabel}${itemLabel ? ` · ${itemLabel}` : ""} · bullet ${Number(bulletIndex) + 1}`;
}

export function applyResumeSuggestion(resume: Resume, path: string, revised: string): Resume {
  const copy = structuredClone(resume);
  if (path === "summary") {
    copy.summary = revised;
    return copy;
  }
  const match = /^(experience|leadership|projects)\.(\d+)\.bullets\.(\d+)$/.exec(path);
  if (!match) return resume;
  const [, section, itemIndex, bulletIndex] = match;
  const items = copy[section as "experience" | "leadership" | "projects"];
  const item = items[Number(itemIndex)];
  if (!item?.bullets[Number(bulletIndex)]) return resume;
  item.bullets[Number(bulletIndex)] = revised;
  return copy;
}
