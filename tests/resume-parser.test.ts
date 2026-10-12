import assert from "node:assert/strict";
import test from "node:test";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { extractResumeText, parseResumeWithQuality } from "@/lib/resume/parser";

const structuredResumeText = `Taylor Rivera
taylor@example.com | +63 900 000 0000

PROFESSIONAL SUMMARY
Business analyst focused on practical operations and reliable delivery.

EDUCATION
Sample State University
BS Information Technology
2022

PROFESSIONAL EXPERIENCE
Northstar Services
Business Analyst
Jan 2023 - Present
• Documented requirements and acceptance criteria for internal workflows.
• Coordinated user acceptance testing with operational stakeholders.
Harbor Analytics
Data Intern
Jun 2022 - Dec 2022
• Built weekly reporting views and validated source data.

LEADERSHIP & ACTIVITIES
Technology Society
Programs Lead
Aug 2021 - May 2022
• Coordinated peer workshops and volunteer schedules.

TECHNICAL SKILLS
Tools: SQL, Power BI, Jira

SELECTED PROJECTS
Service Workflow Review
2023 - 2024
• Mapped handoffs and documented improvement opportunities.`;

function sanitizedPdf(text: string) {
  const escaped = text.replace(/([\\()])/g, "\\$1");
  const stream = `BT /F1 12 Tf 72 720 Td (${escaped}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

test("parser detects common heading variants and multiple roles", () => {
  const { resume, quality } = parseResumeWithQuality(structuredResumeText);

  assert.equal(resume.contact.name, "Taylor Rivera");
  assert.equal(resume.experience.length, 2);
  assert.equal(resume.experience[0].organization, "Northstar Services");
  assert.equal(resume.experience[1].title, "Data Intern");
  assert.equal(resume.leadership.length, 1);
  assert.equal(resume.skills[0].label, "Tools");
  assert.equal(resume.projects.length, 1);
  assert.equal(quality.status, "complete");
  assert.deepEqual(
    quality.detectedSections,
    ["summary", "education", "experience", "leadership", "skills", "projects"],
  );
});

test("parser reports a partial result instead of silently claiming success", () => {
  const { quality } = parseResumeWithQuality("Taylor Rivera\nsample@example.com\nA short unstructured profile.");
  assert.equal(quality.status, "partial");
  assert.ok(quality.warnings.length >= 3);
  assert.match(quality.warnings.join(" "), /experience section/i);
});

test("extracts text from sanitized PDF and DOCX files", async () => {
  const pdfText = await extractResumeText(new File(
    [sanitizedPdf("Taylor Rivera - Business Analyst")],
    "sanitized-resume.pdf",
    { type: "application/pdf" },
  ));
  assert.match(pdfText, /Taylor Rivera/);

  const docx = new Document({
    sections: [{
      children: [new Paragraph({ children: [new TextRun("Taylor Rivera - Business Analyst")] })],
    }],
  });
  const docxBytes = await Packer.toBuffer(docx);
  const docxText = await extractResumeText(new File(
    [new Uint8Array(docxBytes)],
    "sanitized-resume.docx",
    { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  ));
  assert.match(docxText, /Taylor Rivera/);
});

function multiPagePdf(pageCount: number) {
  const pageIds = Array.from({ length: pageCount }, (_, index) => 4 + index * 2);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  pageIds.forEach((id, index) => {
    const stream = `BT /F1 12 Tf 72 720 Td (Page ${index + 1}) Tj ET`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${id + 1} 0 R >>`);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

test("rejects PDFs with more pages than the resume limit", async () => {
  await assert.rejects(
    extractResumeText(new File([multiPagePdf(21)], "long.pdf", { type: "application/pdf" })),
    /20 pages or fewer/,
  );
});

test("rejects DOCX files that declare an oversized uncompressed payload", async () => {
  const docx = new Document({
    sections: [{ children: [new Paragraph({ children: [new TextRun("Taylor Rivera")] })] }],
  });
  const bytes = Buffer.from(await Packer.toBuffer(docx));
  const endOfDirectory = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const firstEntry = bytes.readUInt32LE(endOfDirectory + 16);
  bytes.writeUInt32LE(60 * 1024 * 1024, firstEntry + 24);
  await assert.rejects(
    extractResumeText(new File([new Uint8Array(bytes)], "bomb.docx")),
    /too large to analyze/,
  );
});
