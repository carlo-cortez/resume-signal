import assert from "node:assert/strict";
import test from "node:test";
import { historyQuerySchema, jobDescriptionRequestSchema, scanRequestSchema } from "@/lib/api/schemas";
import { sampleResume } from "@/lib/resume/sample";

test("scan requests enforce bounded job descriptions and metadata", () => {
  assert.equal(scanRequestSchema.safeParse({
    resume: sampleResume,
    jobDescription: "short",
    company: "",
    roleCategory: "Business Analyst",
  }).success, false);

  assert.equal(scanRequestSchema.safeParse({
    resume: sampleResume,
    jobDescription: "A".repeat(50_001),
    company: "",
    roleCategory: "Business Analyst",
  }).success, false);
});

test("job-description and history queries reject oversized or unsafe inputs", () => {
  assert.equal(jobDescriptionRequestSchema.safeParse({
    rawText: "A complete role description with enough detail for analysis.",
    title: "T".repeat(201),
    roleCategory: "Business Analyst",
    keywords: [],
  }).success, false);
  assert.equal(historyQuerySchema.safeParse({ limit: "51" }).success, false);
  assert.deepEqual(historyQuerySchema.parse({}), { limit: 20 });
});
