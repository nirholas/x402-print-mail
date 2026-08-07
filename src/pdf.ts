// A tiny, dependency-free PDF writer.
//
// The whole point of this service is that the preview arrives IN the response,
// so the fixture path has to produce a real document — not a placeholder blob.
// This builds a valid multi-page PDF with Helvetica text, which is enough for a
// letter proof and small enough to base64 into a JSON body.

export interface PdfPage {
  /** Page size in PostScript points. US Letter is 612 x 792. */
  width: number;
  height: number;
  /** Text runs, positioned from the bottom-left origin. */
  text: Array<{ x: number; y: number; size: number; bold?: boolean; value: string }>;
  /** Stroked rectangles: [x, y, width, height]. */
  rects?: Array<[number, number, number, number]>;
}

export const LETTER: { width: number; height: number } = { width: 612, height: 792 };
export const POSTCARD_6X4: { width: number; height: number } = { width: 432, height: 288 };

/**
 * Base-14 Helvetica has no glyph for smart quotes, dashes or ellipses, so a
 * naive write silently drops them and the proof no longer matches the copy the
 * caller sent. Transliterate to ASCII instead — visibly faithful beats silently
 * lossy — and drop anything else outside the printable ASCII range.
 */
const TRANSLITERATE: Array<[RegExp, string]> = [
  [/[‘’‚′]/g, "'"],
  [/[“”„″]/g, '"'],
  [/[–]/g, "-"],
  [/[—―]/g, "--"],
  [/[…]/g, "..."],
  [/[   ]/g, " "],
  [/[•]/g, "*"],
  [/[·‧]/g, "."],
  [/[€]/g, "EUR"],
  [/[£]/g, "GBP"],
];

export function toAscii(s: string): string {
  let out = s;
  for (const [pattern, replacement] of TRANSLITERATE) out = out.replace(pattern, replacement);
  // eslint-disable-next-line no-control-regex
  return out.replace(/[^\x20-\x7E]/g, "");
}

const escapeText = (s: string): string =>
  toAscii(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

/** Approximate Helvetica advance width, good enough to wrap a letter body. */
function textWidth(value: string, size: number): number {
  return value.length * size * 0.5;
}

/** Greedy word wrap to a pixel width, preserving explicit blank lines. */
export function wrap(text: string, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  // Transliterate before measuring, so an em dash that becomes "--" is wrapped
  // at the width it will actually be drawn at.
  for (const paragraph of toAscii(text).split(/\r?\n/)) {
    if (!paragraph.trim()) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (textWidth(candidate, size) > maxWidth && line) {
        out.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

/** Render pages to a PDF and return it base64. */
export function renderPdf(pages: PdfPage[]): string {
  // Object layout: 1 catalog, 2 pages tree, then per page a Page + Contents,
  // then the two fonts.
  const pageCount = pages.length;
  const firstPageObj = 3;
  const fontRegularObj = firstPageObj + pageCount * 2;
  const fontBoldObj = fontRegularObj + 1;

  const objects: string[] = [];
  const kids = pages.map((_, i) => `${firstPageObj + i * 2} 0 R`).join(" ");

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`);

  pages.forEach((page, i) => {
    const contentObj = firstPageObj + i * 2 + 1;
    const rects = (page.rects ?? [])
      .map(([x, y, w, h]) => `q 0.7 w 0.35 G ${x} ${y} ${w} ${h} re S Q`)
      .join("\n");
    const text = page.text
      .map(
        (t) =>
          `BT /${t.bold ? "FB" : "FR"} ${t.size} Tf ${t.x} ${t.y} Td (${escapeText(t.value)}) Tj ET`,
      )
      .join("\n");
    const content = [rects, text].filter(Boolean).join("\n");

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] ` +
        `/Resources << /Font << /FR ${fontRegularObj} 0 R /FB ${fontBoldObj} 0 R >> >> ` +
        `/Contents ${contentObj} 0 R >>`,
    );
    objects.push(`<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`);
  });

  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1").toString("base64");
}
