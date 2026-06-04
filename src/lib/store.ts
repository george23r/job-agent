import { promises as fs } from "fs";
import path from "path";
import type { CVAnalysisResult } from "@/types/cv";
import type { JobMatch } from "@/types/job";

const dataDir = path.join(process.cwd(), "data");
const cvFile = path.join(dataDir, "cv.json");
const jobsFile = path.join(dataDir, "jobs.json");
const searchesFile = path.join(dataDir, "searches.json");

async function ensureDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(filePath: string, value: T) {
  await ensureDir();
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

export async function getCvAnalysis(): Promise<CVAnalysisResult | null> {
  return readJson<CVAnalysisResult | null>(cvFile, null);
}

export async function setCvAnalysis(value: CVAnalysisResult) {
  await writeJson(cvFile, value);
}

export async function getJobs(): Promise<JobMatch[]> {
  return readJson<JobMatch[]>(jobsFile, []);
}

export async function setJobs(value: JobMatch[]) {
  await writeJson(jobsFile, value);
}

export async function getSearchTerms(): Promise<string[]> {
  return readJson<string[]>(searchesFile, []);
}

export async function setSearchTerms(value: string[]) {
  await writeJson(searchesFile, value);
}
