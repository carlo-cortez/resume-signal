import { writeFile } from "node:fs/promises";
import { createResumeDocx } from "../lib/resume/export-docx.ts";
import { sampleResume } from "../lib/resume/sample.ts";

const output = process.argv[2];
if (!output) throw new Error("Pass an output DOCX path.");
await writeFile(output, await createResumeDocx(sampleResume));
