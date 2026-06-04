import pLimit from "p-limit";
import pRetry from "p-retry";
import { nanoid } from "nanoid";
import type { CVProfile } from "@/types/cv";
import type { JobMatch, JobPosting } from "@/types/job";
import { dedupeJobs } from "@/utils/dedupe";
import { logger } from "@/lib/logger";
import { launchChromeContext } from "@/playwright/base";
import { linkedInScraper } from "@/playwright/linkedin";
import { indeedScraper } from "@/playwright/indeed";
import { computrabajoScraper } from "@/playwright/computrabajo";
import { magnetoScraper } from "@/playwright/magneto";
import { scoreJobMatch } from "@/services/openai";

const scrapers = [
  { source: "linkedin" as const, scraper: linkedInScraper },
  { source: "computrabajo" as const, scraper: computrabajoScraper },
  { source: "indeed" as const, scraper: indeedScraper },
  { source: "magneto" as const, scraper: magnetoScraper },
];

// Prevent two searches from running at the same time — they share one browser profile
const searchState = globalThis as typeof globalThis & { _jobSearchRunning?: boolean };

export async function runJobSearch(profile: CVProfile, terms: string[]) {
  if (searchState._jobSearchRunning) {
    throw new Error("SEARCH_IN_PROGRESS");
  }
  searchState._jobSearchRunning = true;

  const location = profile.location || "";
  const searchTerms = terms.slice(0, 3).filter(Boolean);
  if (!searchTerms.length && profile.targetRoles[0]) {
    searchTerms.push(profile.targetRoles[0]);
  }
  if (!searchTerms.length) {
    searchState._jobSearchRunning = false;
    return [];
  }

  // Wrap everything including launchChromeContext so the flag always resets on any error
  const results: JobPosting[] = [];

  let context;
  try {
    context = await launchChromeContext();
  } catch (err) {
    searchState._jobSearchRunning = false;
    throw err;
  }

  try {
    // 2 concurrent tabs — matches what worked in the 89s successful run
    const limit = pLimit(2);

    const tasks = scrapers.flatMap(({ source, scraper }) =>
      searchTerms.map((term) =>
        limit(async () => {
          if (!(context.browser()?.isConnected() ?? true)) {
            logger.error({ source, term }, "Browser disconnected — skipping remaining tasks");
            return;
          }

          logger.info({ source, term }, "Scraping jobs");
          const jobs = await pRetry(
            () => scraper.search(term, location, context),
            {
              retries: 1,
              onFailedAttempt: (err) => {
                logger.warn(
                  { source, term, attempt: err.attemptNumber, errMsg: err.message },
                  "Scraper attempt failed"
                );
              },
            }
          ).catch((error: Error) => {
            logger.error(
              { source, term, errMsg: error.message },
              "Scraper exhausted retries"
            );
            return [];
          });

          logger.info({ source, term, found: jobs.length }, "Scrape complete");

          jobs.forEach((job) => {
            results.push({
              id: nanoid(),
              title: job.title,
              company: job.company,
              location: job.location,
              modality: job.modality,
              url: job.url,
              postedAt: job.postedAt,
              source,
            });
          });
        })
      )
    );

    await Promise.all(tasks);
  } finally {
    await context.close().catch(() => {});
    searchState._jobSearchRunning = false;
  }

  return dedupeJobs(results);
}

export async function rankJobs(profile: CVProfile, jobs: JobPosting[]) {
  const limit = pLimit(3);

  const scored = await Promise.all(
    jobs.map((job) =>
      limit(async () => {
        const score = await pRetry(() => scoreJobMatch(profile, job), {
          retries: 1,
        }).catch(() => ({ matchScore: 0, reason: "Unable to score." }));

        const match: JobMatch = {
          ...job,
          matchScore: score.matchScore,
          matchReason: score.reason,
        };

        return match;
      })
    )
  );

  return scored.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
}
