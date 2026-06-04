import { NextResponse } from "next/server";
import { analyzeCvText, generateSearchTerms } from "@/services/openai";
import { extractTextFromDocx, extractTextFromPdf } from "@/services/cv";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { setCvAnalysis, setSearchTerms } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") || "local";
  const limit = rateLimit(`cv:${ip}`, 5, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded." },
      { status: 429 }
    );
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
      return NextResponse.json(
        { error: "Unsupported file type. Use PDF or DOCX." },
        { status: 400 }
      );
    }

    if (!text.trim()) {
      return NextResponse.json(
        { error: "No text extracted from CV." },
        { status: 422 }
      );
    }

    const profile = await analyzeCvText(text);
    const terms = await generateSearchTerms(profile);

    await setCvAnalysis({
      profile,
      rawText: text,
      analyzedAt: new Date().toISOString(),
    });
    await setSearchTerms(terms ?? []);

    return NextResponse.json({ profile, terms });
  } catch (error) {
    logger.error({ error }, "CV upload failed");
    return NextResponse.json(
      { error: "Failed to analyze CV." },
      { status: 500 }
    );
  }
}
