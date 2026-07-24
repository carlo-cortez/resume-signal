import { z } from "zod";

const requiredText = z.string();

export const resumeSchema = z.object({
  contact: z.object({
    name: requiredText,
    email: requiredText,
    phone: requiredText,
    location: requiredText,
    linkedin: requiredText,
    website: requiredText,
  }),
  summary: requiredText,
  education: z.array(z.object({
    school: requiredText,
    degree: requiredText,
    location: requiredText,
    graduationDate: requiredText,
    gpa: requiredText,
    awards: z.array(requiredText),
  })),
  experience: z.array(z.object({
    organization: requiredText,
    title: requiredText,
    location: requiredText,
    startDate: requiredText,
    endDate: requiredText,
    bullets: z.array(requiredText),
  })),
  leadership: z.array(z.object({
    organization: requiredText,
    title: requiredText,
    location: requiredText,
    startDate: requiredText,
    endDate: requiredText,
    bullets: z.array(requiredText),
  })),
  skills: z.array(z.object({
    label: requiredText,
    items: z.array(requiredText),
  })),
  projects: z.array(z.object({
    name: requiredText,
    date: requiredText,
    bullets: z.array(requiredText),
  })),
});

export const suggestionSchema = z.object({
  suggestions: z.array(z.object({
    keyword: requiredText,
    targetPath: requiredText,
    original: requiredText,
    revised: requiredText,
    reason: requiredText,
    flag: z.enum(["verify claim", "high JD overlap"]).nullable(),
  })).max(4),
});
