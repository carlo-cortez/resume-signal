import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const jobDescriptions = sqliteTable(
  "job_descriptions",
  {
    id: text("id").primaryKey(),
    company: text("company"),
    title: text("title").notNull(),
    roleCategory: text("role_category").notNull(),
    rawText: text("raw_text").notNull(),
    keywordsJson: text("keywords_json").notNull().default("[]"),
    matchScore: integer("match_score"),
    outcome: text("outcome").notNull().default("applied"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("job_descriptions_role_category_idx").on(table.roleCategory),
    index("job_descriptions_created_at_idx").on(table.createdAt),
  ],
);
