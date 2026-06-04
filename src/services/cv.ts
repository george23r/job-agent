import pdfParse from "pdf-parse";
import mammoth from "mammoth";

export async function extractTextFromPdf(buffer: Buffer) {
  const data = await pdfParse(buffer);
  return data.text || "";
}

export async function extractTextFromDocx(buffer: Buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result.value || "";
}
