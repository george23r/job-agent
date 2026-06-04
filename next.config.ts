import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "playwright",
    "pdf-parse",
    "pdfkit",
    "pino",
    "pino-pretty",
    "openai",
    "p-limit",
    "p-retry",
    "nanoid",
    "mammoth",
    "xlsx",
  ],
};

export default nextConfig;
