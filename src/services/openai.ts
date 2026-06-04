import OpenAI from "openai";
import { z } from "zod";
import type { CVProfile } from "@/types/cv";
import type { JobPosting } from "@/types/job";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const profileSchema = z.object({
  name: z.string().default(""),
  targetRoles: z.array(z.string()).default([]),
  location: z.string().default(""),
  experienceYears: z.number().default(0),
  skills: z.array(z.string()).default([]),
  technologies: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  seniority: z.string().default(""),
});

const searchTermsSchema = z.object({
  terms: z.array(z.string()).default([]),
});

const scoreSchema = z.object({
  matchScore: z.number().min(0).max(100),
  reason: z.string(),
});

const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

async function parseJson<T>(content: string, schema: z.ZodSchema<T>): Promise<T> {
  const cleaned = content.trim();
  const parsed = JSON.parse(cleaned);
  return schema.parse(parsed);
}

export async function analyzeCvText(text: string): Promise<CVProfile> {
  const response = await client.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "You are a CV analyzer. Return ONLY valid JSON with the required schema.",
      },
      {
        role: "user",
        content: `Analyze this CV and return JSON only with shape: {"name":"","targetRoles":[],"location":"","experienceYears":0,"skills":[],"technologies":[],"languages":[],"seniority":""}\n\nCV:\n${text}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content || "{}";
  return parseJson(content, profileSchema) as Promise<CVProfile>;
}

export async function generateSearchTerms(profile: CVProfile) {
  const response = await client.chat.completions.create({
    model,
    temperature: 0.6,
    messages: [
      {
        role: "system",
        content:
          "You generate job search queries. Return ONLY valid JSON with key terms: string[].",
      },
      {
        role: "user",
        content: `Generate 12 concise search queries in Spanish and English from this profile. Focus on target roles and location. JSON only: {"terms":[]}.\n\nProfile:\n${JSON.stringify(
          profile
        )}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content || "{}";
  const parsed = await parseJson(content, searchTermsSchema);
  return parsed.terms;
}

export async function scoreJobMatch(profile: CVProfile, job: JobPosting) {
  const response = await client.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "Score how well the job matches the CV. Return ONLY JSON with matchScore 0-100 and reason.",
      },
      {
        role: "user",
        content: `Return JSON only: {"matchScore":92,"reason":"..."}.\n\nCV:\n${JSON.stringify(
          profile
        )}\n\nJob:\n${JSON.stringify(job)}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content || "{}";
  return parseJson(content, scoreSchema);
}
