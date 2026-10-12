import mammoth from "mammoth";
import type { ParseQuality, Resume, ResumeProject, ResumeRole } from "@/types/resume";

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
export const MAX_RESUME_PAGES = 20;
export const MAX_RESUME_CHARACTERS = 100_000;
export const MAX_DOCX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
const sectionAliases: Array<{ canonical: string; pattern: RegExp }> = [
  { canonical: "summary", pattern: /^(?:(?:professional|career|executive) )?(?:summary|profile|objective)$/i },
  { canonical: "education", pattern: /^(?:education|academic background|academic history|qualifications)$/i },
  { canonical: "experience", pattern: /^(?:(?:professional|relevant|work) )?(?:experience|employment|employment history|work history)$/i },
  { canonical: "leadership", pattern: /^(?:leadership(?: & activities)?|activities|volunteer(?:ing| experience)?|community involvement|extracurricular activities)$/i },
  { canonical: "skills", pattern: /^(?:skills(?: & interests)?|technical skills|core competencies|competencies|tools & technologies|technologies)$/i },
  { canonical: "projects", pattern: /^(?:projects?|selected projects?|academic projects?|personal projects?)$/i },
];
const dateToken = String.raw`(?:present|current|now|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+)?(?:19|20)\d{2}`;
const dateRangePattern = new RegExp(`(${dateToken})\\s*(?:-|–|—|to)\\s*(${dateToken})`, "i");

function cleanLines(text: string) {
  return text
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => {
      const trimmed = line.replace(/\s+/g, " ").trim();
      return /^[•●▪◦*-]\s*/.test(trimmed)
        ? `• ${trimmed.replace(/^[•●▪◦*-]\s*/, "")}`
        : trimmed;
    })
    .filter(Boolean);
}

async function extractPdf(buffer: Buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableFontFace: true,
    useSystemFonts: true,
  });
  try {
    const document = await loadingTask.promise;
    if (document.numPages > MAX_RESUME_PAGES) {
      throw new Error(`Resume PDFs must be ${MAX_RESUME_PAGES} pages or fewer.`);
    }
    const pages: string[] = [];
    let characterCount = 0;
    for (let index = 1; index <= document.numPages; index += 1) {
      const page = await document.getPage(index);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => (
        "str" in item ? `${item.str}${item.hasEOL ? "\n" : " "}` : ""
      )).join("");
      characterCount += pageText.length;
      if (characterCount > MAX_RESUME_CHARACTERS) {
        throw new Error("This resume contains more text than we can analyze.");
      }
      pages.push(pageText);
    }
    return pages.join("\n");
  } finally {
    await loadingTask.destroy();
  }
}

// Sums the uncompressed sizes declared in a ZIP central directory so a DOCX
// zip bomb is rejected before mammoth inflates it.
function declaredZipUncompressedBytes(buffer: Buffer) {
  const endOfDirectory = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (endOfDirectory < 0 || endOfDirectory + 22 > buffer.length) return Infinity;
  const entryCount = buffer.readUInt16LE(endOfDirectory + 10);
  let offset = buffer.readUInt32LE(endOfDirectory + 16);
  let total = 0;
  for (let entry = 0; entry < entryCount; entry += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) return Infinity;
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    if (uncompressedSize === 0xffffffff) return Infinity;
    total += uncompressedSize;
    offset += 46
      + buffer.readUInt16LE(offset + 28)
      + buffer.readUInt16LE(offset + 30)
      + buffer.readUInt16LE(offset + 32);
  }
  return total;
}

export async function extractResumeText(file: File) {
  if (file.size > MAX_RESUME_BYTES) throw new Error("Resume files must be 5 MB or smaller.");
  const extension = file.name.toLowerCase().split(".").pop();
  if (!["pdf", "docx"].includes(extension ?? "")) throw new Error("Upload a PDF or DOCX file.");
  const buffer = Buffer.from(await file.arrayBuffer());
  if (extension === "pdf") {
    if (buffer.subarray(0, 5).toString() !== "%PDF-") throw new Error("This file is not a valid PDF.");
    return (await extractPdf(buffer)).trim();
  }
  if (buffer.subarray(0, 2).toString() !== "PK") throw new Error("This file is not a valid DOCX.");
  if (declaredZipUncompressedBytes(buffer) > MAX_DOCX_UNCOMPRESSED_BYTES) {
    throw new Error("This DOCX file is too large to analyze.");
  }
  const result = await mammoth.extractRawText({ buffer });
  if (result.value.length > MAX_RESUME_CHARACTERS) {
    throw new Error("This resume contains more text than we can analyze.");
  }
  return result.value.trim();
}

function sectionMap(lines: string[]) {
  const sections: Record<string, string[]> = { header: [] };
  let active = "header";
  for (const line of lines) {
    const headingCandidate = line.replace(/^•\s*/, "").replace(/\s*\[.*\]\s*$/, "").replace(/:$/, "").trim();
    const match = sectionAliases.find(({ pattern }) => pattern.test(headingCandidate));
    if (match) {
      active = match.canonical;
      sections[active] = [];
    } else {
      sections[active] ??= [];
      sections[active].push(line);
    }
  }
  return sections;
}

function section(sections: Record<string, string[]>, names: string[]) {
  const key = Object.keys(sections).find((candidate) => names.some((name) => candidate.includes(name)));
  return key ? sections[key] : [];
}

function rolesFromLines(lines: string[]): ResumeRole[] {
  if (!lines.length) return [];
  const roles: ResumeRole[] = [];
  let headings: string[] = [];
  let bullets: string[] = [];

  const commit = () => {
    if (!headings.length && !bullets.length) return;
    const dateLine = headings.find((line) => dateRangePattern.test(line));
    const dateMatch = dateLine?.match(dateRangePattern);
    const withoutDate = headings
      .map((line) => line.replace(dateRangePattern, "").replace(/\s*[|•]\s*$/, "").trim())
      .filter(Boolean);
    const locationIndex = withoutDate.findIndex((line, index) =>
      index > 0 && (/^remote$/i.test(line) || /,\s*[A-Za-z .-]+$/.test(line))
    );
    const location = locationIndex >= 0 ? withoutDate.splice(locationIndex, 1)[0] : "";
    const roleBullets = bullets.length
      ? bullets
      : withoutDate.slice(2).filter((line) => line.length > 28);
    roles.push({
      organization: withoutDate[0] ?? "",
      title: withoutDate[1] ?? "",
      location,
      startDate: dateMatch?.[1] ?? "",
      endDate: dateMatch?.[2] ?? "",
      bullets: roleBullets,
    });
    headings = [];
    bullets = [];
  };

  for (const line of lines) {
    if (line.startsWith("• ")) {
      bullets.push(line.slice(2).trim());
      continue;
    }
    if (bullets.length) commit();
    headings.push(line);
  }
  commit();
  return roles.filter((role) => role.organization || role.title || role.bullets.length);
}

function projectsFromLines(lines: string[]): ResumeProject[] {
  return rolesFromLines(lines).map((role) => ({
    name: role.organization || role.title,
    date: role.endDate || role.startDate,
    bullets: role.bullets,
  })).filter((project) => project.name || project.bullets.length);
}

function parseResume(text: string) {
  const lines = cleanLines(text);
  const sections = sectionMap(lines);
  const header = sections.header ?? [];
  const email = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0] ?? "";
  const phone = text.match(/(?:\+?\d[\d ().-]{7,}\d)/)?.[0] ?? "";
  const links = text.match(/\b(?:https?:\/\/|www\.|linkedin\.com\/)\S+/gi) ?? [];
  const firstRawLine = text.replace(/\r/g, "\n").split("\n").map((line) => line.trim()).find(Boolean) ?? "";
  const firstSegment = firstRawLine.split(/\t|\s{2,}|•|\|/)[0]?.trim() ?? "";
  const name = (
    firstSegment && !firstSegment.includes("@") && !/\d{3}/.test(firstSegment) && firstSegment.length < 80
      ? firstSegment
      : header.find((line) => !line.includes("@") && !/\d{3}/.test(line) && line.length < 80)
  ) ?? "";
  const skillLines = section(sections, ["skill"]);
  const skills = skillLines.map((line) => {
    const [label, values] = line.includes(":") ? line.split(/:(.*)/) : ["Skills", line];
    return { label: label.trim(), items: values.split(/[,;|]/).map((item) => item.trim()).filter(Boolean) };
  }).filter((group) => group.items.length);
  const educationLines = section(sections, ["education"]);
  const projectLines = section(sections, ["project"]);
  const resume: Resume = {
    contact: {
      name,
      email,
      phone,
      location: "",
      linkedin: links.find((link) => link.toLowerCase().includes("linkedin")) ?? "",
      website: links.find((link) => !link.toLowerCase().includes("linkedin")) ?? "",
    },
    summary: section(sections, ["summary"]).join(" "),
    education: educationLines.length ? [{
      school: educationLines[0] ?? "",
      degree: educationLines[1] ?? "",
      location: "",
      graduationDate: educationLines.find((line) => /\b(19|20)\d{2}\b/.test(line))?.match(/\b(19|20)\d{2}\b/)?.[0] ?? "",
      gpa: educationLines.find((line) => /gpa/i.test(line))?.replace(/^.*?gpa:?\s*/i, "") ?? "",
      awards: educationLines.filter((line) => /award|honor|dean|scholar/i.test(line)),
    }] : [],
    experience: rolesFromLines(section(sections, ["experience", "employment"])),
    leadership: rolesFromLines(section(sections, ["leadership", "activities"])),
    skills,
    projects: projectsFromLines(projectLines),
  };
  return { resume, sections };
}

export function parseResumeHeuristically(text: string): Resume {
  return parseResume(text).resume;
}

export function assessResumeQuality(
  resume: Resume,
  characterCount: number,
  detectedSections: string[],
): ParseQuality {
  const warnings: string[] = [];
  if (!resume.contact.name) warnings.push("We could not confidently identify the candidate name.");
  if (!resume.experience.length) warnings.push("No experience section was detected.");
  if (!resume.education.length) warnings.push("No education section was detected.");
  if (!resume.skills.length) warnings.push("No skills section was detected.");
  if (detectedSections.length < 2) warnings.push("This layout has few recognizable section headings; review the imported content carefully.");
  const meaningfulSections = [
    resume.summary,
    resume.education.length,
    resume.experience.length,
    resume.leadership.length,
    resume.skills.length,
    resume.projects.length,
  ].filter(Boolean).length;
  return {
    status: resume.contact.name && meaningfulSections >= 2 ? "complete" : "partial",
    characterCount,
    detectedSections,
    warnings,
  };
}

export function parseResumeWithQuality(text: string): { resume: Resume; quality: ParseQuality } {
  const { resume, sections } = parseResume(text);
  const detectedSections = Object.keys(sections).filter((key) => key !== "header" && sections[key]?.length);
  return { resume, quality: assessResumeQuality(resume, text.length, detectedSections) };
}
