import mammoth from "mammoth";
import type { Resume, ResumeRole } from "@/types/resume";

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const sectionNames = /^(?:(?:professional )?summary|education|experience|work experience|employment|leadership(?: & activities)?|activities|skills(?: & interests)?|projects?)$/i;

function cleanLines(text: string) {
  return text
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").replace(/^[•●▪◦*-]\s*/, "").trim())
    .filter(Boolean);
}

async function extractPdf(buffer: Buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableFontFace: true,
    useSystemFonts: true,
  }).promise;
  const pages: string[] = [];
  for (let index = 1; index <= document.numPages; index += 1) {
    const page = await document.getPage(index);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => (
      "str" in item ? `${item.str}${item.hasEOL ? "\n" : " "}` : ""
    )).join(""));
  }
  return pages.join("\n");
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
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}

function sectionMap(lines: string[]) {
  const sections: Record<string, string[]> = { header: [] };
  let active = "header";
  for (const line of lines) {
    const headingCandidate = line.replace(/\s*\[.*\]\s*$/, "").replace(/:$/, "").trim();
    if (sectionNames.test(headingCandidate)) {
      active = headingCandidate.toLowerCase().replace(/[^a-z]+/g, " ").trim();
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
  const bullets = lines.filter((line) => line.length > 35);
  const headings = lines.filter((line) => line.length <= 35);
  return [{
    organization: headings[0] ?? "",
    title: headings[1] ?? "",
    location: "",
    startDate: "",
    endDate: "",
    bullets: bullets.length ? bullets : lines.slice(2),
  }];
}

export function parseResumeHeuristically(text: string): Resume {
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
  return {
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
    projects: projectLines.length ? [{
      name: projectLines[0] ?? "",
      date: projectLines.find((line) => /\b(19|20)\d{2}\b/.test(line))?.match(/\b(19|20)\d{2}\b/)?.[0] ?? "",
      bullets: projectLines.slice(1).filter((line) => line.length > 25),
    }] : [],
  };
}
