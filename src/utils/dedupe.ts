import type { JobPosting } from "@/types/job";
import { normalizeText } from "@/utils/normalize";

export function dedupeJobs(jobs: JobPosting[]) {
  const seen = new Set<string>();
  const results: JobPosting[] = [];

  for (const job of jobs) {
    const key = [job.title, job.company, job.location]
      .map((value) => normalizeText(value || ""))
      .join("|");

    if (!seen.has(key)) {
      seen.add(key);
      results.push(job);
    }
  }

  return results;
}
