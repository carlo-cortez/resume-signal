import assert from "node:assert/strict";
import test from "node:test";
import { analyzeResume, findJobEvidence, normalizeStoredSuggestion } from "@/lib/resume/analysis";
import { sampleResume } from "@/lib/resume/sample";
import { applyResumeSuggestion, getResumeValue } from "@/lib/resume/text";

test("deterministic gaps expose job evidence without an auto-applicable rewrite", () => {
  const jobDescription = [
    "The analyst will create acceptance criteria and facilitate requirements gathering.",
    "The role requires BPMN process models for complex operational workflows.",
    "BPMN experience is required for this position.",
  ].join(" ");
  const result = analyzeResume(sampleResume, jobDescription);
  const suggestion = result.suggestions.find((item) => item.keyword === "bpmn");

  assert.ok(suggestion);
  assert.equal(suggestion.kind, "evidence_prompt");
  assert.equal(suggestion.source, "deterministic");
  assert.equal(suggestion.revised, "");
  assert.equal(suggestion.requiresVerification, true);
  assert.match(suggestion.jobEvidence, /BPMN process models/i);
  assert.match(suggestion.targetLabel, /Experience/);
});

test("job evidence returns the sentence containing the detected requirement", () => {
  const evidence = findJobEvidence(
    "General communication is important. Candidates must have SQL reporting experience. Collaboration is expected.",
    "sql",
  );
  assert.equal(evidence, "Candidates must have SQL reporting experience.");
});

test("resume edit targets resolve exactly and legacy local rewrites become non-actionable prompts", () => {
  const path = "experience.0.bullets.0";
  const original = getResumeValue(sampleResume, path);
  assert.ok(original);
  const updated = applyResumeSuggestion(sampleResume, path, `${original} Updated.`);
  assert.equal(getResumeValue(updated, path), `${original} Updated.`);
  assert.equal(getResumeValue(sampleResume, path), original);

  const normalized = normalizeStoredSuggestion({
    keyword: "bpmn",
    targetPath: path,
    original,
    revised: `${original} [If accurate, add BPMN.]`,
    reason: "Legacy local suggestion",
    flag: "verify claim",
  }, "The role requires BPMN.", "deterministic");
  assert.ok(normalized);
  assert.equal(normalized.kind, "evidence_prompt");
  assert.equal(normalized.source, "deterministic");
  assert.equal(normalized.revised, "");
});
