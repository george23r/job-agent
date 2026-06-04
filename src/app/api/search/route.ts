import { NextResponse } from "next/server";
import { getCvAnalysis, getSearchTerms, setJobs } from "@/lib/store";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { runJobSearch, rankJobs } from "@/services/jobs";
import type { JobMatch } from "@/types/job";
import type { CVProfile } from "@/types/cv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") || "local";
  const limit = rateLimit(`search:${ip}`, 3, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const noAI: boolean = body?.mode === "noai";

    const analysis = await getCvAnalysis();

    // Build the profile to use for scraping
    let profileForSearch: CVProfile;

    if (analysis) {
      // CV was uploaded — use it, but allow caller to override the location
      profileForSearch =
        body?.location && typeof body.location === "string"
          ? { ...analysis.profile, location: body.location.trim() }
          : analysis.profile;
    } else if (noAI) {
      // No-AI mode without a CV upload: build a minimal profile from jobTitle + location
      const jobTitle = typeof body?.jobTitle === "string" ? body.jobTitle.trim() : "";
      const location = typeof body?.location === "string" ? body.location.trim() : "";
      if (!jobTitle) {
        return NextResponse.json(
          { error: "Escribe el cargo que buscas para continuar." },
          { status: 400 }
        );
      }
      profileForSearch = {
        name: "",
        targetRoles: [jobTitle],
        location,
        experienceYears: 0,
        skills: [],
        technologies: [],
        languages: [],
        seniority: "",
      };
    } else {
      return NextResponse.json(
        { error: "Sube y analiza un CV primero." },
        { status: 400 }
      );
    }

    const storedTerms = await getSearchTerms();
    const terms: string[] = Array.isArray(body?.terms) && body.terms.length
      ? body.terms
      : storedTerms;

    if (!terms.length) {
      return NextResponse.json({ error: "No hay términos de búsqueda." }, { status: 400 });
    }

    const jobs = await runJobSearch(profileForSearch, terms);

    let ranked: JobMatch[];
    if (noAI || !process.env.OPENAI_API_KEY) {
      ranked = jobs.map((job) => ({ ...job, matchScore: undefined, matchReason: undefined }));
    } else {
      ranked = await rankJobs(analysis!.profile, jobs);
    }

    await setJobs(ranked);
    return NextResponse.json({ jobs: ranked });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg === "SEARCH_IN_PROGRESS") {
      return NextResponse.json(
        { error: "Ya hay una búsqueda en curso. Espera a que termine." },
        { status: 409 }
      );
    }
    const stack = error instanceof Error ? error.stack : undefined;
    logger.error({ errMsg, stack }, "Search failed");
    return NextResponse.json({ error: `Search failed: ${errMsg}` }, { status: 500 });
  }
}
