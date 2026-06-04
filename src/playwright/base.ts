import { chromium, type BrowserContext, type Page } from "playwright";
import { existsSync } from "fs";

export interface JobScraper {
  search(keywords: string, location: string, context: BrowserContext): Promise<ScrapedJob[]>;
}

export interface ScrapedJob {
  title: string;
  company: string;
  location: string;
  url: string;
  postedAt?: string;
  modality?: string;
}

const SYSTEM_CHROME_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  process.env.CHROME_EXECUTABLE_PATH ?? "",
].filter(Boolean);

function systemChromePath(): string | undefined {
  return SYSTEM_CHROME_PATHS.find((p) => p && existsSync(p));
}

export async function launchChromeContext(): Promise<BrowserContext> {
  const userDataDir = process.env.CHROME_USER_DATA_DIR;
  if (!userDataDir) {
    throw new Error("CHROME_USER_DATA_DIR is required to reuse logged-in sessions.");
  }

  const executablePath = systemChromePath();

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath,
    viewport: { width: 1280, height: 720 },
    // Disables the 'AutomationControlled' feature flag that sets navigator.webdriver=true
    args: ["--disable-blink-features=AutomationControlled"],
  });

  // Patch remaining automation fingerprints on every page opened in this context
  await context.addInitScript(() => {
    // Remove the primary bot-detection signal
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });

    // Inject chrome runtime object (absent in Playwright-launched Chromium)
    if (!(window as unknown as Record<string, unknown>)["chrome"]) {
      (window as unknown as Record<string, unknown>)["chrome"] = {
        app: { isInstalled: false, InstallState: {}, RunningState: {} },
        runtime: {
          OnInstalledReason: {},
          OnRestartRequiredReason: {},
          PlatformArch: {},
          PlatformNaclArch: {},
          PlatformOs: {},
          RequestUpdateCheckStatus: {},
        },
      };
    }

    // Fake plugin list (empty in headless/automation; real browsers have 2+)
    if (navigator.plugins.length === 0) {
      Object.defineProperty(navigator, "plugins", {
        get: () => {
          const arr = [
            { name: "Chrome PDF Plugin", filename: "internal-pdf-viewer" },
            { name: "Chrome PDF Viewer", filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai" },
            { name: "Native Client", filename: "internal-nacl-plugin" },
          ];
          Object.defineProperty(arr, "length", { value: arr.length });
          return arr;
        },
      });
    }

    // Match languages to Accept-Language header sent to Indeed
    Object.defineProperty(navigator, "languages", {
      get: () => ["es-CO", "es", "en-US", "en"],
    });

    // Prevent permission query from revealing automation (returns 'denied' in Playwright by default)
    const originalQuery = window.navigator.permissions.query.bind(navigator.permissions);
    window.navigator.permissions.query = (parameters) =>
      parameters.name === "notifications"
        ? Promise.resolve({ state: "default" } as unknown as PermissionStatus)
        : originalQuery(parameters);
  });

  return context;
}

export async function withPage<T>(
  context: BrowserContext,
  fn: (page: Page) => Promise<T>
) {
  const page = await context.newPage();
  try {
    return await fn(page);
  } finally {
    await page.close();
  }
}
