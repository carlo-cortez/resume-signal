import { z } from "zod";
import { resumeSchema } from "@/lib/resume/schema";

const metadata = z.string().trim().max(200);

export const scanRequestSchema = z.object({
  resume: resumeSchema,
  versionId: z.uuid().nullable().optional(),
  jobDescription: z.string().trim().min(40).max(50_000),
  company: metadata.optional().default(""),
  roleCategory: z.string().trim().min(1).max(100),
});

export const resumeVersionRequestSchema = z.object({
  resumeId: z.uuid(),
  resume: resumeSchema,
});

export const jobDescriptionRequestSchema = z.object({
  rawText: z.string().trim().min(40).max(50_000),
  title: z.string().trim().min(1).max(200),
  roleCategory: z.string().trim().min(1).max(100),
  company: metadata.optional().default(""),
  keywords: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
  matchScore: z.number().min(0).max(100).nullable().optional(),
});

export const uuidQuerySchema = z.uuid();

export const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.iso.datetime().optional(),
});
