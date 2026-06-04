import { type BrowserContext } from "playwright";
import { withPage, type JobScraper } from "@/playwright/base";
import { logger } from "@/lib/logger";

export const computrabajoScraper: JobScraper = {
  async search(keywords: string, location: string, context: BrowserContext) {
    return withPage(context, async (page) => {
      // Use separate q / l params instead of concatenating to avoid "city city" duplication
      // when the search term already contains the city.
      const params = new URLSearchParams({ q: keywords });
      if (location) params.set("l", location);
      const url = `https://co.computrabajo.com/ofertas-de-trabajo/?${params.toString()}`;

      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
      await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(800);

      // Wait for job cards
      await page.waitForSelector(
        "article.box_offer, [class*='box_offer'], article[class*='offer']",
        { timeout: 6000 }
      ).catch(() => {});

      // Scroll to reveal more cards
      await page.evaluate(() => window.scrollBy(0, 600));
      await page.waitForTimeout(600);
      await page.evaluate(() => window.scrollBy(0, 600));
      await page.waitForTimeout(400);
      await page.evaluate(() => window.scrollTo(0, 0));

      const cardCount = await page.locator("article.box_offer, article[class*='offer']").count();
      logger.info({ finalUrl: page.url(), cardCount }, "computrabajo page debug");

      return page.evaluate((fallbackUrl) => {
        const results: Array<{
          title: string; company: string; location: string; url: string; postedAt?: string;
        }> = [];

        // Primary selector
        let cards = Array.from(document.querySelectorAll("article.box_offer"));

        // Fallback: any article that looks like a job card
        if (cards.length === 0) {
          cards = Array.from(document.querySelectorAll("article")).filter(
            (a) => a.querySelector("a.js-o-link, a[href*='/trabajo-de-'], h2")
          );
        }

        // Second fallback: div-based cards
        if (cards.length === 0) {
          cards = Array.from(
            document.querySelectorAll("div.box_offer, div[class*='offer'], li[class*='offer']")
          );
        }

        cards.slice(0, 30).forEach((card) => {
          // Title link
          const titleEl = (
            card.querySelector("a.js-o-link") ||
            card.querySelector("a[href*='/trabajo-de-']") ||
            card.querySelector("h2 a") ||
            card.querySelector("h3 a")
          ) as HTMLAnchorElement | null;
          const title = titleEl?.textContent?.trim() || "";
          if (!title) return;

          // Company
          const companyEl =
            card.querySelector("a[href*='/empresas/'], a.it-blank") ||
            card.querySelector("[class*='company'], [class*='Company'], [class*='empresa']");
          const company = companyEl?.textContent?.trim() || "—";

          // Location: prefer span.fs12 (Computrabajo classic), then broader fallbacks
          const locEl =
            card.querySelector("span.fs12, p.fs12") ||
            card.querySelector("[class*='location'], [class*='Location'], [class*='ciudad']") ||
            card.querySelector("span[class*='loc'], p[class*='loc']");
          const loc = locEl?.textContent?.trim() || "";

          const dateEl = card.querySelector("span.date, time, [class*='date']");
          const postedAt = dateEl?.textContent?.trim() || undefined;

          const href = (titleEl?.getAttribute("href") ?? "").split("#")[0];

          results.push({
            title,
            company,
            location: loc,
            url: href ? `https://co.computrabajo.com${href}` : fallbackUrl,
            postedAt: postedAt || undefined,
          });
        });

        return results;
      }, url);
    });
  },
};
