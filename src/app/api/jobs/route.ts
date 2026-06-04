import { NextResponse } from "next/server";
import { getJobs } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  const jobs = await getJobs();
  return NextResponse.json({ jobs });
}
