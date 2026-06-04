import { type BrowserContext } from "playwright";
import { withPage, type JobScraper } from "@/playwright/base";
import { logger } from "@/lib/logger";

export const magnetoScraper: JobScraper = {
  async search(keywords: string, location: string, context: BrowserContext) {
    return withPage(context, async (page) => {
      const params = new URLSearchParams({ q: keywords });
      if (location) params.set("city", location);
      const url = `https://www.magneto365.com/co/empleos?${params.toString()}`;

      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(1500);

      // Wait for job cards
      await page.waitForSelector(
        "a[href*='/co/empleos/'], [class*='jobCard'], [class*='job-card'], article",
        { timeout: 7000 }
      ).catch(() => {});

      // Scroll to trigger lazy loading
      await page.evaluate(() => window.scrollBy(0, 600));
      await page.waitForTimeout(700);
      await page.evaluate(() => window.scrollBy(0, 600));
      await page.waitForTimeout(500);
      await page.evaluate(() => window.scrollTo(0, 0));

      const jobLinkCount = await page.locator("a[href*='/co/empleos/']").count();
      logger.info({ finalUrl: page.url(), jobLinkCount }, "magneto page debug");

      return page.evaluate((fallbackUrl) => {
        const results: Array<{
          title: string; company: string; location: string; url: string;
        }> = [];

        // Strategy 1: card-level containers that hold a job link
        const cardSelectors = [
          "[class*='jobCard']",
          "[class*='job-card']",
          "[class*='JobCard']",
          "article",
          "[class*='offer']",
          "[class*='Offer']",
        ];

        let cards: Element[] = [];
        for (const sel of cardSelectors) {
          const found = Array.from(document.querySelectorAll(sel)).filter(
            (el) => el.querySelector("a[href*='/co/empleos/']")
          );
          if (found.length > 0) {
            cards = found;
            break;
          }
        }

        if (cards.length > 0) {
          cards.slice(0, 30).forEach((card) => {
            const anchor = card.querySelector("a[href*='/co/empleos/']") as HTMLAnchorElement | null;
            const href = anchor?.getAttribute("href") ?? "";
            if (!href || !href.includes("-")) return;

            // Title: prefer a dedicated title element, fall back to anchor text
            const titleEl = card.querySelector(
              "h2, h3, [class*='title'], [class*='Title'], [class*='name'], [class*='Name']"
            );
            const title = titleEl?.textContent?.trim() || anchor?.textContent?.trim() || "";
            if (!title || title.length < 3) return;

            // Company
            const companyEl = card.querySelector(
              "[class*='company'], [class*='Company'], [class*='empresa'], [class*='Empresa']"
            );
            const company = companyEl?.textContent?.trim() || "Empresa confidencial";

            // Location
            const locEl = card.querySelector(
              "[class*='location'], [class*='Location'], [class*='ciudad'], [class*='Ciudad'], " +
              "[class*='city'], [class*='City']"
            );
            const loc = locEl?.textContent?.trim() || "";

            const fullUrl = href.startsWith("http")
              ? href
              : `https://www.magneto365.com${href}`;

            results.push({ title, company, location: loc, url: fullUrl });
          });
        }

        // Strategy 2: fallback — iterate all job links directly
        if (results.length === 0) {
          const links = Array.from(document.querySelectorAll("a[href*='/co/empleos/']")) as HTMLAnchorElement[];
          links.slice(0, 30).forEach((a) => {
            const href = a.getAttribute("href") || "";
            if (!href.includes("-")) return;
            const title = a.textContent?.trim() || "";
            if (!title || title.length < 4) return;
            const fullUrl = href.startsWith("http")
              ? href
              : `https://www.magneto365.com${href}`;
            results.push({ title, company: "Empresa confidencial", location: "", url: fullUrl });
          });
        }

        return results;
      }, url);
    });
  },
};
