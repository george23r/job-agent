import { type BrowserContext } from "playwright";
import { withPage, type JobScraper } from "@/playwright/base";
import { logger } from "@/lib/logger";

const CARD_SELECTORS = [
  "div.job_seen_beacon",
  "div[data-jk]",
  "li[data-jk]",
  "td.resultContent",
  "div.slider_item",
  "div.tapItem",
] as const;

function buildSearchUrl(keywords: string, location: string): string {
  const params = new URLSearchParams({ q: keywords });
  if (location) params.set("l", location);
  return `https://co.indeed.com/jobs?${params.toString()}`;
}

function isBlocked(title: string, url: string): boolean {
  const t = title.toLowerCase();
  const isChallengeTitle =
    t.includes("security") ||
    t.includes("captcha") ||
    t.includes("verify") ||
    t.includes("verificaci") ||
    t.includes("just a moment") ||
    t.includes("un momento") ||      // Spanish Cloudflare challenge
    t.includes("attention required") ||
    t.includes("acceso denegado") ||
    t.includes("checking your browser") ||
    t.includes("security check");
  // Cloudflare sometimes redirects entirely to www.indeed.com instead of showing challenge
  const isRedirectedAway = url.startsWith("https://www.indeed.com") && !url.includes("/jobs");
  return isChallengeTitle || isRedirectedAway;
}

export const indeedScraper: JobScraper = {
  async search(keywords: string, location: string, context: BrowserContext) {
    return withPage(context, async (page) => {
      const searchUrl = buildSearchUrl(keywords, location);

      await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(1500);

      // Handle Cloudflare challenge — wait for user to solve (up to 3 min)
      let attempts = 0;
      while (attempts < 2) {
        const pageTitle = await page.title();
        const pageUrl = page.url();
        if (!isBlocked(pageTitle, pageUrl)) break;

        logger.warn(
          { pageTitle, pageUrl, attempt: attempts + 1 },
          "Indeed/Cloudflare bloqueado — resuelve el desafío en el navegador (3 min máx)"
        );

        // If Cloudflare redirected to www.indeed.com, go back to the Colombian search URL
        if (pageUrl.startsWith("https://www.indeed.com") && !pageUrl.includes("/jobs")) {
          await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
          await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
          await page.waitForTimeout(2000);
        }

        // Wait up to 3 minutes for the challenge to clear (user solves CAPTCHA manually)
        await page
          .waitForFunction(
            () => {
              const t = document.title.toLowerCase();
              const u = window.location.href;
              const badTitle =
                t.includes("security") ||
                t.includes("captcha") ||
                t.includes("verify") ||
                t.includes("verificaci") ||
                t.includes("just a moment") ||
                t.includes("un momento") ||
                t.includes("attention required") ||
                t.includes("checking your browser") ||
                t.includes("security check");
              const badUrl = u.startsWith("https://www.indeed.com") && !u.includes("/jobs");
              return !badTitle && !badUrl;
            },
            { timeout: 180_000, polling: 1500 }
          )
          .catch(() => {
            logger.warn({}, "Indeed CAPTCHA no resuelto a tiempo — saltando");
          });

        await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(2000);

        // If still not on job results after solving, navigate there explicitly
        const afterUrl = page.url();
        if (!afterUrl.includes("/jobs") && !afterUrl.includes("q=")) {
          logger.info({ afterUrl }, "Indeed: navegando de vuelta a resultados");
          await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
          await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
          await page.waitForTimeout(1500);
        }

        attempts++;
      }

      // Wait for any known card selector to appear
      const waitPromises = CARD_SELECTORS.map((sel) =>
        page.waitForSelector(sel, { timeout: 6000 }).catch(() => null)
      );
      await Promise.race(waitPromises);

      // Scroll to trigger lazy-loaded cards
      await page.evaluate(() => window.scrollBy(0, 600));
      await page.waitForTimeout(700);
      await page.evaluate(() => window.scrollBy(0, 600));
      await page.waitForTimeout(500);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);

      // Determine which selector actually has results
      let activeSelector = "";
      let cardCount = 0;
      for (const sel of CARD_SELECTORS) {
        const count = await page.locator(sel).count();
        if (count > 0) {
          activeSelector = sel;
          cardCount = count;
          break;
        }
      }

      const finalUrl = page.url();
      const finalTitle = await page.title();
      logger.info({ finalUrl, finalTitle, cardCount, activeSelector }, "indeed page debug");

      return page.evaluate(
        ({ fallbackUrl, sel }) => {
          const results: Array<{
            title: string; company: string; location: string; url: string;
          }> = [];

          const selectors = sel
            ? [sel, "div.job_seen_beacon", "div[data-jk]", "li[data-jk]", "td.resultContent", "div.slider_item"]
            : ["div.job_seen_beacon", "div[data-jk]", "li[data-jk]", "td.resultContent", "div.slider_item"];

          let cards: Element[] = [];
          for (const s of selectors) {
            const found = Array.from(document.querySelectorAll(s));
            if (found.length > 0) { cards = found; break; }
          }

          if (cards.length === 0) {
            const h2s = Array.from(document.querySelectorAll("h2.jobTitle, h2[class*='jobTitle']"));
            cards = h2s.map((h) => h.closest("div, li, td") ?? h);
          }

          cards.slice(0, 30).forEach((card) => {
            const titleSpan = card.querySelector("h2.jobTitle span[title], h2 span[title]");
            const titleGeneric = card.querySelector(
              "h2.jobTitle span:not([class*='ScreenReader']), h2 span, " +
              "[data-testid='jobTitle'], [class*='jobTitle'] span, a[data-jk] span"
            );
            const title =
              titleSpan?.getAttribute("title")?.trim() ||
              titleSpan?.textContent?.trim() ||
              titleGeneric?.textContent?.trim() ||
              "";

            const company = (
              card.querySelector(
                "span.companyName, [data-testid='company-name'], [class*='companyName'], " +
                "[class*='company_name'], span[class*='company']"
              )?.textContent ?? ""
            ).trim();

            const loc = (
              card.querySelector(
                "div.companyLocation, [data-testid='text-location'], " +
                "[class*='companyLocation'], [class*='location'], div[class*='location']"
              )?.textContent ?? ""
            ).trim();

            const anchor =
              (card.querySelector("h2.jobTitle a, h2 a") as HTMLAnchorElement | null) ||
              (card.querySelector(
                "a[data-jk], a[href*='/rc/clk'], a[href*='/viewjob'], a[href*='/pagead']"
              ) as HTMLAnchorElement | null);
            const href = anchor?.getAttribute("href") ?? "";
            const fullUrl = href
              ? href.startsWith("http") ? href : `https://co.indeed.com${href}`
              : fallbackUrl;

            if (title) {
              results.push({ title, company: company || "—", location: loc, url: fullUrl });
            }
          });

          return results;
        },
        { fallbackUrl: searchUrl, sel: activeSelector }
      );
    });
  },
};
