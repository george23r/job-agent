import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import PDFDocument from "pdfkit";
import { getJobs } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const format = req.nextUrl.searchParams.get("format") ?? "xlsx";
  const jobs = await getJobs();

  if (format === "pdf") {
    return exportPDF(jobs);
  }
  return exportXLSX(jobs);
}

// ── Excel ──────────────────────────────────────────────────────────────────

function exportXLSX(jobs: Awaited<ReturnType<typeof getJobs>>) {
  const rows = jobs.map((job) => ({
    "Match %": job.matchScore != null ? job.matchScore : "",
    Cargo: job.title,
    Empresa: job.company,
    Ciudad: job.location,
    Modalidad: job.modality ?? "",
    Fuente: job.source.charAt(0).toUpperCase() + job.source.slice(1),
    "Publicado": job.postedAt ? new Date(job.postedAt).toLocaleDateString("es-CO") : "",
    URL: job.url,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Column widths
  worksheet["!cols"] = [
    { wch: 9 },   // Match %
    { wch: 42 },  // Cargo
    { wch: 30 },  // Empresa
    { wch: 22 },  // Ciudad
    { wch: 14 },  // Modalidad
    { wch: 14 },  // Fuente
    { wch: 13 },  // Publicado
    { wch: 65 },  // URL
  ];

  // Freeze header row
  worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };

  const workbook = XLSX.utils.book_new();
  workbook.Props = {
    Title: "Job Agent — Resultados",
    Author: "Job Agent",
    CreatedDate: new Date(),
  };
  XLSX.utils.book_append_sheet(workbook, worksheet, "Vacantes");

  // Summary sheet
  const sourceCount: Record<string, number> = {};
  let remote = 0;
  let scoreSum = 0;
  let scoreCount = 0;
  for (const job of jobs) {
    sourceCount[job.source] = (sourceCount[job.source] ?? 0) + 1;
    if (`${job.location} ${job.modality ?? ""}`.toLowerCase().match(/remot/)) remote++;
    if (job.matchScore != null) { scoreSum += job.matchScore; scoreCount++; }
  }
  const summaryRows = [
    { Métrica: "Total vacantes", Valor: jobs.length },
    { Métrica: "Remotas", Valor: remote },
    { Métrica: "Score promedio", Valor: scoreCount > 0 ? `${Math.round(scoreSum / scoreCount)}%` : "N/A" },
    { Métrica: "LinkedIn", Valor: sourceCount["linkedin"] ?? 0 },
    { Métrica: "Indeed", Valor: sourceCount["indeed"] ?? 0 },
    { Métrica: "Computrabajo", Valor: sourceCount["computrabajo"] ?? 0 },
    { Métrica: "Magneto", Valor: sourceCount["magneto"] ?? 0 },
    { Métrica: "Generado el", Valor: new Date().toLocaleString("es-CO") },
  ];
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  summarySheet["!cols"] = [{ wch: 20 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumen");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="job-agent-${datestamp()}.xlsx"`,
    },
  });
}

// ── PDF ────────────────────────────────────────────────────────────────────

async function exportPDF(jobs: Awaited<ReturnType<typeof getJobs>>) {
  const buf = await buildPDF(jobs);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="job-agent-${datestamp()}.pdf"`,
    },
  });
}

function buildPDF(jobs: Awaited<ReturnType<typeof getJobs>>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4", bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width;
    const MARGIN = 40;
    const COL = W - MARGIN * 2;

    // ── Header bar ──────────────────────────────────────────────────────
    doc.rect(0, 0, W, 60).fill("#0f172a");

    // Logo circle
    doc.circle(MARGIN + 14, 30, 14).fill("#22d3ee");
    doc.fontSize(11).fillColor("#0f172a").font("Helvetica-Bold")
      .text("JA", MARGIN + 7, 24);

    doc.fontSize(16).fillColor("#ffffff").font("Helvetica-Bold")
      .text("Job Agent", MARGIN + 34, 20);
    doc.fontSize(8).fillColor("#94a3b8").font("Helvetica")
      .text("Resultados de búsqueda de vacantes", MARGIN + 34, 38);

    const dateStr = new Date().toLocaleString("es-CO", {
      day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
    doc.fontSize(7).fillColor("#64748b").font("Helvetica")
      .text(dateStr, W - MARGIN - 130, 26, { width: 130, align: "right" });

    // ── Stats strip ─────────────────────────────────────────────────────
    const y1 = 72;
    let remote = 0;
    let scoreSum = 0, scoreCount = 0;
    const sourceSet = new Set<string>();
    for (const j of jobs) {
      if (`${j.location} ${j.modality ?? ""}`.toLowerCase().match(/remot/)) remote++;
      if (j.matchScore != null) { scoreSum += j.matchScore; scoreCount++; }
      sourceSet.add(j.source);
    }
    const avgScore = scoreCount > 0 ? Math.round(scoreSum / scoreCount) : null;

    const stats = [
      { label: "Vacantes", value: String(jobs.length) },
      { label: "Remotas", value: String(remote) },
      { label: "Score prom.", value: avgScore != null ? `${avgScore}%` : "N/A" },
      { label: "Fuentes", value: String(sourceSet.size) },
    ];

    const boxW = COL / stats.length;
    stats.forEach((s, i) => {
      const bx = MARGIN + i * boxW;
      doc.rect(bx, y1, boxW - 4, 42).fillAndStroke("#f8fafc", "#e2e8f0");
      doc.fontSize(18).fillColor("#0f172a").font("Helvetica-Bold")
        .text(s.value, bx + 8, y1 + 6, { width: boxW - 20, align: "center" });
      doc.fontSize(7.5).fillColor("#64748b").font("Helvetica")
        .text(s.label, bx + 8, y1 + 26, { width: boxW - 20, align: "center" });
    });

    // ── Table ────────────────────────────────────────────────────────────
    const tableTop = y1 + 56;
    const colWidths = [38, 160, 110, 90, 65, 62]; // Match, Cargo, Empresa, Ciudad, Modalidad, Fuente
    const colX: number[] = [MARGIN];
    for (let i = 0; i < colWidths.length - 1; i++) {
      colX.push(colX[i] + colWidths[i]);
    }
    const headers = ["Match", "Cargo", "Empresa", "Ciudad", "Modalidad", "Fuente"];
    const ROW_H = 22;

    // Header row
    doc.rect(MARGIN, tableTop, COL, ROW_H).fill("#1e293b");
    headers.forEach((h, i) => {
      doc.fontSize(8).fillColor("#94a3b8").font("Helvetica-Bold")
        .text(h, colX[i] + 3, tableTop + 7, { width: colWidths[i] - 6, align: i === 0 ? "center" : "left" });
    });

    let curY = tableTop + ROW_H;
    const PAGE_BOTTOM = doc.page.height - MARGIN - 20;

    jobs.forEach((job, idx) => {
      if (curY + ROW_H > PAGE_BOTTOM) {
        doc.addPage();
        curY = MARGIN;
        // Re-draw header
        doc.rect(MARGIN, curY, COL, ROW_H).fill("#1e293b");
        headers.forEach((h, i) => {
          doc.fontSize(8).fillColor("#94a3b8").font("Helvetica-Bold")
            .text(h, colX[i] + 3, curY + 7, { width: colWidths[i] - 6, align: i === 0 ? "center" : "left" });
        });
        curY += ROW_H;
      }

      const rowBg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
      doc.rect(MARGIN, curY, COL, ROW_H).fill(rowBg);

      // Subtle row border
      doc.rect(MARGIN, curY, COL, ROW_H).stroke("#e2e8f0");

      // Match score badge
      if (job.matchScore != null) {
        const score = job.matchScore;
        const badgeFill = score >= 80 ? "#dcfce7" : score >= 60 ? "#fef9c3" : "#fee2e2";
        const textColor = score >= 80 ? "#15803d" : score >= 60 ? "#854d0e" : "#b91c1c";
        const bW = 32, bH = 14;
        const bX = colX[0] + (colWidths[0] - bW) / 2;
        const bY = curY + (ROW_H - bH) / 2;
        doc.roundedRect(bX, bY, bW, bH, 3).fill(badgeFill);
        doc.fontSize(7.5).fillColor(textColor).font("Helvetica-Bold")
          .text(`${score}%`, bX, bY + 3.5, { width: bW, align: "center" });
      } else {
        doc.fontSize(7.5).fillColor("#94a3b8").font("Helvetica")
          .text("—", colX[0] + 3, curY + 7, { width: colWidths[0] - 6, align: "center" });
      }

      const textY = curY + 7;
      const textColor = "#0f172a";

      // Cargo (truncate)
      doc.fontSize(8).fillColor(textColor).font("Helvetica-Bold")
        .text(truncate(job.title, 32), colX[1] + 3, textY, { width: colWidths[1] - 6, lineBreak: false });

      // Empresa
      doc.fontSize(8).fillColor("#475569").font("Helvetica")
        .text(truncate(job.company, 22), colX[2] + 3, textY, { width: colWidths[2] - 6, lineBreak: false });

      // Ciudad
      doc.fontSize(8).fillColor("#475569").font("Helvetica")
        .text(truncate(job.location, 18), colX[3] + 3, textY, { width: colWidths[3] - 6, lineBreak: false });

      // Modalidad
      doc.fontSize(8).fillColor("#475569").font("Helvetica")
        .text(truncate(job.modality ?? "—", 14), colX[4] + 3, textY, { width: colWidths[4] - 6, lineBreak: false });

      // Fuente badge
      const src = job.source;
      const srcColor = sourceColor(src);
      doc.fontSize(7).fillColor(srcColor).font("Helvetica-Bold")
        .text(src.charAt(0).toUpperCase() + src.slice(1), colX[5] + 3, textY, { width: colWidths[5] - 6, lineBreak: false });

      curY += ROW_H;
    });

    // ── Footer ──────────────────────────────────────────────────────────
    const totalPages = (doc.bufferedPageRange().count);
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      const footerY = doc.page.height - 25;
      doc.moveTo(MARGIN, footerY).lineTo(W - MARGIN, footerY).stroke("#e2e8f0");
      doc.fontSize(7).fillColor("#94a3b8").font("Helvetica")
        .text("Generado por Job Agent · github.com/george23r/job-agent", MARGIN, footerY + 5, {
          width: COL - 60, align: "left",
        })
        .text(`Página ${i + 1} de ${totalPages}`, MARGIN, footerY + 5, {
          width: COL, align: "right",
        });
    }

    doc.end();
  });
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

function sourceColor(source: string): string {
  const map: Record<string, string> = {
    linkedin: "#0a66c2",
    indeed: "#003a9b",
    computrabajo: "#e55b13",
    magneto: "#7c3aed",
  };
  return map[source] ?? "#475569";
}

function datestamp(): string {
  return new Date().toISOString().slice(0, 10);
}
