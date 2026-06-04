import { NextResponse } from "next/server";
import { extractTextFromDocx, extractTextFromPdf } from "@/services/cv";
import { parseCvNoAI } from "@/services/cv-noai";
import { setCvAnalysis, setSearchTerms } from "@/lib/store";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") || "local";
  const limit = rateLimit(`cv-noai:${ip}`, 10, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing CV file." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name.toLowerCase();

    let text = "";
    if (filename.endsWith(".pdf")) {
      text = await extractTextFromPdf(buffer);
    } else if (filename.endsWith(".docx")) {
      text = await extractTextFromDocx(buffer);
    } else {
      return NextResponse.json({ error: "Use PDF o DOCX." }, { status: 400 });
    }

    if (!text.trim()) {
      return NextResponse.json({ error: "No se pudo extraer texto del CV." }, { status: 422 });
    }

    const { profile, terms } = parseCvNoAI(text);

    // Store on server so /api/search uses the correct profile (not a stale one from a previous session)
    await setCvAnalysis({ profile, rawText: text, analyzedAt: new Date().toISOString() });
    await setSearchTerms(terms);

    logger.info({ name: profile.name, techCount: profile.technologies.length, termsCount: terms.length }, "CV parsed without AI");

    return NextResponse.json({ profile, terms, rawText: text });
  } catch (error) {
    logger.error({ error }, "CV no-AI parse failed");
    return NextResponse.json({ error: "Error al procesar el CV." }, { status: 500 });
  }
}
