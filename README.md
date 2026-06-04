# Job Agent

AI-powered job search platform for the Colombian market. Scrapes LinkedIn, Indeed, Computrabajo and Magneto simultaneously, matches results against your CV profile, and lets you export everything to **Excel** or **PDF** in one click.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Playwright](https://img.shields.io/badge/Playwright-1.52-green?logo=playwright)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o--mini-orange?logo=openai)

---

## Features

- **Con IA** — Upload your CV and GPT-4o-mini analyzes your profile, extracts search terms, and scores every job posting against your skills (0–100%).
- **Sin IA** — Upload your CV and the system extracts your role and city via regex — no API key needed. Search starts automatically.
- **4 sources scraped in parallel** — LinkedIn, Indeed (Cloudflare bypass), Computrabajo, Magneto.
- **Smart filters** — Filter by source, modality (remote / hybrid / on-site) and city.
- **Export to Excel** — Two sheets: full job list with column widths + summary statistics.
- **Export to PDF** — Branded PDF with match score badges, source color coding and pagination.
- **Search history** — Last 5 Sin-IA searches persisted in localStorage.
- **Auto-search** — 3-second debounce after typing in Sin IA mode; triggers search automatically on CV upload.
- **Scheduled searches** — Background scheduler runs every N hours (configurable).

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Animations | Framer Motion |
| Scraping | Playwright (persistent Chrome context) |
| AI | OpenAI GPT-4o-mini via official SDK |
| Excel export | SheetJS (xlsx) |
| PDF export | PDFKit |
| CV parsing | pdf-parse + mammoth (DOCX) |
| Logging | Pino |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Google Chrome installed (system Chrome, not Chromium)
- OpenAI API key (only required for **Con IA** mode)

### 1. Clone and install

```bash
git clone https://github.com/george23r/job-agent.git
cd job-agent
npm install
```

### 2. Configure environment

Create `.env.local` with the following variables:

```env
# Required for Con IA mode
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Path to Chrome user data (must have active sessions for job sites)
CHROME_USER_DATA_DIR=C:\Users\YourName\AppData\Local\Google\Chrome\User Data

# Path to Chrome executable (avoids Cloudflare bot detection)
CHROME_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe

# Scheduler (optional)
ENABLE_SCHEDULER=true
SEARCH_INTERVAL_HOURS=6
LOG_LEVEL=info
```

### 3. Log in to job sites

Open Chrome with the profile configured in `CHROME_USER_DATA_DIR` and log in to:

- [linkedin.com](https://www.linkedin.com)
- [co.indeed.com](https://co.indeed.com)
- [computrabajo.com.co](https://www.computrabajo.com.co)
- [magneto365.com](https://magneto365.com)

> Close Chrome before starting the app — Playwright needs exclusive access to the profile.

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Usage

### Con IA (with AI)

1. Switch to **Con IA** in the top bar.
2. Upload your CV (PDF or DOCX, max 10 MB).
3. GPT-4o-mini extracts your profile and generates search terms.
4. Click **Buscar vacantes** — results appear from all 4 sources.
5. Filter by source, modality or city.
6. Click **Excel** or **PDF** to export.

### Sin IA (without AI)

1. Switch to **Sin IA** in the top bar.
2. Upload your CV — role and city are extracted automatically via regex, no API key needed.
3. Search starts automatically within 1 second of upload.
4. Or type the role manually — auto-search fires after 3 seconds.
5. Use quick-pick role chips for common Colombian IT roles.

### Exporting results

Once results are loaded, two buttons appear in the top-right:

| Button | Output |
| --- | --- |
| **Excel** | `.xlsx` with two sheets: full job list + summary statistics |
| **PDF** | Branded `.pdf` with match score badges, source colors and page numbers |

---

## Environment Variables

| Variable | Description | Required |
| --- | --- | --- |
| `OPENAI_API_KEY` | OpenAI API key | Con IA only |
| `OPENAI_MODEL` | Model (default: `gpt-4o-mini`) | No |
| `CHROME_USER_DATA_DIR` | Chrome profile path with active sessions | Yes |
| `CHROME_EXECUTABLE_PATH` | Chrome executable path | Recommended |
| `ENABLE_SCHEDULER` | Auto-search scheduler (`true`/`false`) | No |
| `SEARCH_INTERVAL_HOURS` | Scheduler interval in hours (default: `6`) | No |
| `LOG_LEVEL` | Log level: `trace`, `debug`, `info`, `warn`, `error` | No |

---

## Project Structure

```text
src/
├── app/
│   ├── api/
│   │   ├── cv/          # CV upload & parse endpoints
│   │   ├── jobs/
│   │   │   └── export/  # Excel + PDF export (GET ?format=xlsx|pdf)
│   │   └── search/      # Search orchestration endpoint
│   ├── layout.tsx
│   └── page.tsx         # Main UI
├── components/          # CVUploadZone, JobCard, NoAISearchForm, etc.
├── playwright/          # Scrapers: linkedin, indeed, computrabajo, magneto
├── services/            # cv.ts (AI), cv-noai.ts (regex), openai.ts
├── lib/                 # store, scheduler, logger, rate-limit
├── types/               # job.ts, cv.ts
└── utils/               # normalize, dedupe
```

---

## Cloudflare / Indeed Notes

Indeed uses Cloudflare bot detection. The scraper bypasses it by using:

- **System Chrome** (real TLS fingerprint) instead of Playwright's bundled Chromium — set `CHROME_EXECUTABLE_PATH`.
- `--disable-blink-features=AutomationControlled` Chrome flag.
- `navigator.webdriver` patch and fake plugin list injected via `addInitScript`.

---

## License

MIT — see [LICENSE](LICENSE).

---

*Built with Next.js, Playwright, and OpenAI. Designed for the Colombian job market.*
