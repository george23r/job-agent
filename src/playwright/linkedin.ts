import { type BrowserContext } from "playwright";
import { withPage, type JobScraper } from "@/playwright/base";
import { logger } from "@/lib/logger";

function isAuthWall(url: string, title: string): boolean {
  return (
    url.includes("/login") ||
    url.includes("/checkpoint") ||
    url.includes("/authwall") ||
    url.includes("/signup") ||
    title.toLowerCase().includes("sign in") ||
    title.toLowerCase().includes("iniciar sesión") ||
    title.toLowerCase().includes("join linkedin")
  );
}

const CARD_SELECTOR =
  "li.scaffold-layout__list-item, ul.jobs-search__results-list > li, div.base-card, li.result-card";

export const linkedInScraper: JobScraper = {
  async search(keywords: string, location: string, context: BrowserContext) {
    return withPage(context, async (page) => {
      const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keywords)}&location=${encodeURIComponent(location)}&f_TPR=r604800`;

      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
      await page.waitForTimeout(2000);

      const pageTitle = await page.title();
      const finalUrl = page.url();

      // Auth wall — pause and let user log in (up to 3 minutes)
      if (isAuthWall(finalUrl, pageTitle)) {
        logger.warn(
          { finalUrl, pageTitle },
          "LinkedIn requiere inicio de sesión — inicia sesión en el navegador (3 min máx)"
        );

        await page
          .waitForFunction(
            () =>
              !window.location.href.includes("/login") &&
              !window.location.href.includes("/authwall") &&
              !window.location.href.includes("/checkpoint") &&
              !window.location.href.includes("/signup") &&
              !document.title.toLowerCase().includes("sign in") &&
              !document.title.toLowerCase().includes("iniciar sesión"),
            { timeout: 180_000, polling: 2000 }
          )
          .catch(() => {
            logger.warn({}, "LinkedIn login no completado a tiempo — saltando");
          });

        const afterUrl = page.url();
        if (!afterUrl.includes("/jobs")) {
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
          await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
          await page.waitForTimeout(2000);
        }
      }

      const currentUrl = page.url();
      if (isAuthWall(currentUrl, await page.title())) {
        logger.warn({ currentUrl }, "LinkedIn sigue en auth wall — saltando");
        return [];
      }

      // Wait for job cards to appear before extracting
      await page.waitForSelector(CARD_SELECTOR, { timeout: 8000 }).catch(() => {});

      // Scroll to trigger lazy-loaded cards
      await page.evaluate(() => window.scrollBy(0, 500));
      await page.waitForTimeout(800);
      await page.evaluate(() => window.scrollBy(0, 500));
      await page.waitForTimeout(600);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(400);

      const cardCount = await page.locator(CARD_SELECTOR).count();
      logger.info({ finalUrl: page.url(), cardCount }, "linkedin page debug");

      return page.evaluate(
        ({ fallbackUrl }) => {
          const results: Array<{
            title: string; company: string; location: string;
            url: string; postedAt?: string; modality?: string;
          }> = [];

          // Logged-in layout
          let cards = Array.from(document.querySelectorAll("li.scaffold-layout__list-item"));

          // Guest / public layout
          if (cards.length === 0) {
            cards = Array.from(
              document.querySelectorAll("ul.jobs-search__results-list > li, div.base-card, li.result-card")
            );
          }

          // Broader fallback: any li that contains a job card container
          if (cards.length === 0) {
            cards = Array.from(document.querySelectorAll("li")).filter(
              (li) => li.querySelector("[class*='job-card']") !== null
            );
          }

          cards.slice(0, 30).forEach((card) => {
            // URL — find the job anchor first (it's reliable and needed anyway)
            const anchor = card.querySelector(
              "a.job-card-list__title--link, a.job-card-list__title, " +
              "a.base-card__full-link, a[href*='/jobs/view/'], " +
              "a[data-control-name='jobcard_title']"
            ) as HTMLAnchorElement | null;
            const href = anchor?.getAttribute("href") ?? "";
            const fullUrl = href
              ? href.startsWith("http") ? href.split("?")[0] : `https://www.linkedin.com${href.split("?")[0]}`
              : fallbackUrl;

            // Title — try dedicated selectors first, then the anchor itself, then any h2/h3/strong
            const titleEl = card.querySelector(
              ".job-card-list__title--link, .job-card-list__title, " +
              ".base-search-card__title, h3.base-search-card__title, " +
              "a[data-control-name='jobcard_title'], " +
              "[class*='job-card-list__title']"
            );
            const title = (
              anchor?.getAttribute("aria-label")?.trim() ||
              titleEl?.textContent?.trim() ||
              anchor?.textContent?.trim() ||
              card.querySelector("strong, h3, h2")?.textContent?.trim() ||
              ""
            ).replace(/\n/g, " ").replace(/\s+/g, " ").trim();

            // Company — optional, fall back to "—" so we never discard a card just for missing company
            const companyEl = card.querySelector(
              ".job-card-container__company-name, .job-card-container__primary-description, " +
              ".base-search-card__subtitle, h4.base-search-card__subtitle, " +
              "[class*='company-name'], [class*='primary-description'], h4"
            );
            const company = companyEl?.textContent?.trim().replace(/\s+/g, " ") || "—";

            // Location
            const locEl = card.querySelector(
              ".job-search-card__location, .job-card-container__metadata-item:first-of-type, " +
              ".base-search-card__metadata span, [class*='job-search-card__location'], " +
              "[class*='metadata-item']:not([class*='workplace-type'])"
            );
            const loc = locEl?.textContent?.trim() ?? "";

            // Modality (remote/hybrid/onsite)
            const modalityEl = card.querySelector(
              ".job-card-container__metadata-item--workplace-type, [class*='workplace-type']"
            );
            const modality = modalityEl?.textContent?.trim() || undefined;

            const timeEl = card.querySelector("time");
            const postedAt = timeEl?.getAttribute("datetime") || timeEl?.textContent?.trim() || undefined;

            // Only require title — company is optional
            if (title && fullUrl !== fallbackUrl) {
              results.push({ title, company, location: loc, url: fullUrl, postedAt, modality });
            }
          });

          return results;
        },
        { fallbackUrl: url }
      );
    });
  },
};
