import { z } from "zod";

const requiredText = z.string().max(5_000);
const textList = z.array(requiredText).max(100);

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
    awards: textList,
  })).max(25),
  experience: z.array(z.object({
    organization: requiredText,
    title: requiredText,
    location: requiredText,
    startDate: requiredText,
    endDate: requiredText,
    bullets: textList,
  })).max(50),
  leadership: z.array(z.object({
    organization: requiredText,
    title: requiredText,
    location: requiredText,
    startDate: requiredText,
    endDate: requiredText,
    bullets: textList,
  })).max(50),
  skills: z.array(z.object({
    label: requiredText,
    items: textList,
  })).max(50),
  projects: z.array(z.object({
    name: requiredText,
    date: requiredText,
    bullets: textList,
  })).max(50),
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
