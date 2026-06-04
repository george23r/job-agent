import { logger } from "@/lib/logger";
import { getCvAnalysis, getSearchTerms, setJobs } from "@/lib/store";
import { runJobSearch, rankJobs } from "@/services/jobs";

const DEFAULT_INTERVAL_HOURS = 6;

type SchedulerState = {
  started: boolean;
  timer?: NodeJS.Timeout;
};

const globalState = globalThis as typeof globalThis & {
  jobAgentScheduler?: SchedulerState;
};

export function startScheduler() {
  const state = globalState.jobAgentScheduler || { started: false };
  globalState.jobAgentScheduler = state;

  if (state.started) return;
  if (process.env.ENABLE_SCHEDULER === "false") return;

  const intervalHours = Number(process.env.SEARCH_INTERVAL_HOURS) || DEFAULT_INTERVAL_HOURS;
  const intervalMs = intervalHours * 60 * 60 * 1000;

  const tick = async () => {
    try {
      const analysis = await getCvAnalysis();
      if (!analysis) return;

      const terms = await getSearchTerms();
      if (!terms.length) return;

      logger.info({ intervalHours }, "Running scheduled job search");
      const jobs = await runJobSearch(analysis.profile, terms);
      const ranked = await rankJobs(analysis.profile, jobs);
      await setJobs(ranked);
    } catch (error) {
      logger.error({ error }, "Scheduled search failed");
    }
  };

  state.timer = setInterval(tick, intervalMs);
  state.started = true;
  logger.info({ intervalHours }, "Job scheduler started — first run in scheduled interval");
}
