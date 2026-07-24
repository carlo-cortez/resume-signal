import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Tab,
  TabStopType,
  TextRun,
  convertInchesToTwip,
} from "docx";
import type { Resume, ResumeRole } from "@/types/resume";

const paragraphSpacing = { after: 20, line: 240 };

function heading(text: string) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 60 },
    children: [new TextRun({ text, bold: true, size: 22, font: "Calibri" })],
  });
}

function line(left: string, right: string, bold = false) {
  return new Paragraph({
    tabStops: [{
      type: TabStopType.RIGHT,
      position: convertInchesToTwip(7.35),
    }],
    spacing: paragraphSpacing,
    children: [
      new TextRun({ text: left, bold, size: 22, font: "Calibri" }),
      new TextRun({ children: [new Tab()] }),
      new TextRun({ text: right, size: 22, font: "Calibri" }),
    ],
  });
}

function roleParagraphs(role: ResumeRole) {
  return [
    line(role.organization, role.location, true),
    line(role.title, [role.startDate, role.endDate].filter(Boolean).join(" - "), true),
    ...role.bullets.map((bullet) => new Paragraph({
      bullet: { level: 0 },
      spacing: { after: 20, line: 260 },
      children: [new TextRun({ text: bullet, size: 22, font: "Calibri" })],
    })),
  ];
}

export async function createResumeDocx(resume: Resume) {
  const contact = [
    resume.contact.location,
    resume.contact.phone,
    resume.contact.email,
    resume.contact.linkedin || resume.contact.website,
  ].filter(Boolean).join(" | ");
  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "111111" } },
      spacing: { after: 80 },
      children: [new TextRun({ text: resume.contact.name || "Your Name", bold: true, size: 22, font: "Calibri" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [new TextRun({ text: contact, size: 22, font: "Calibri" })],
    }),
  ];

  if (resume.summary) children.push(heading("Professional Summary"), new Paragraph({ spacing: paragraphSpacing, children: [new TextRun({ text: resume.summary, size: 22, font: "Calibri" })] }));
  if (resume.education.length) {
    children.push(heading("Education"));
    for (const item of resume.education) {
      children.push(
        line(item.school, item.location, true),
        line(`${item.degree}${item.gpa ? ` | GPA: ${item.gpa}` : ""}`, item.graduationDate),
      );
      if (item.awards.length) children.push(new Paragraph({ spacing: paragraphSpacing, children: [new TextRun({ text: "Awards: ", bold: true, size: 22, font: "Calibri" }), new TextRun({ text: item.awards.join("; "), size: 22, font: "Calibri" })] }));
    }
  }
  if (resume.experience.length) children.push(heading("Experience"), ...resume.experience.flatMap(roleParagraphs));
  if (resume.leadership.length) children.push(heading("Leadership & Activities"), ...resume.leadership.flatMap(roleParagraphs));
  if (resume.skills.length) {
    children.push(heading("Skills & Interests"));
    for (const group of resume.skills) children.push(new Paragraph({ spacing: paragraphSpacing, children: [new TextRun({ text: `${group.label}: `, bold: true, size: 22, font: "Calibri" }), new TextRun({ text: group.items.join(", "), size: 22, font: "Calibri" })] }));
  }
  if (resume.projects.length) {
    children.push(heading("Projects"));
    for (const project of resume.projects) {
      children.push(line(project.name, project.date, true));
      children.push(...project.bullets.map((bullet) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 20, line: 260 }, children: [new TextRun({ text: bullet, size: 22, font: "Calibri" })] })));
    }
  }

  const document = new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 22 }, paragraph: { spacing: paragraphSpacing } } } },
    sections: [{
      properties: {
        page: {
          size: { width: convertInchesToTwip(8.5), height: convertInchesToTwip(11) },
          margin: {
            top: convertInchesToTwip(0.65),
            right: convertInchesToTwip(0.55),
            bottom: convertInchesToTwip(0.4),
            left: convertInchesToTwip(0.55),
          },
        },
      },
      children,
    }],
  });
  return Packer.toBuffer(document);
}
