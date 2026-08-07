import {
  expectedDeliveryDate,
  fixtureMailId,
  renderLetterPreview,
  renderPostcardPreview,
  type MailAddress,
} from "./fixtures.js";
import {
  fetchPdfBase64,
  lobConfigured,
  LobError,
  lobCreateLetter,
  lobCreatePostcard,
  lobIsTestKey,
} from "./lob.js";

export type { MailAddress };
export type Source = "lob" | "fixture";

export class ServiceError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export interface MailResult {
  source: Source;
  testMode: boolean;
  mailId: string;
  type: "letter" | "postcard";
  createdAt: string;
  expectedDelivery: string;
  carrier: string;
  mailType: string;
  to: MailAddress;
  from: MailAddress;
  pageCount: number;
  color: boolean;
  doubleSided: boolean;
  previewFormat: "PDF";
  previewPdfBase64: string;
  previewUrl: string | null;
  thumbnails: string[];
}

export function activeSource(): Source {
  return lobConfigured() ? "lob" : "fixture";
}

export function testMode(): boolean {
  return activeSource() === "fixture" || lobIsTestKey();
}

const ADDRESS_FIELDS = ["name", "addressLine1", "addressCity", "addressState", "addressZip"] as const;

function validateAddress(value: unknown, which: string): MailAddress {
  if (!value || typeof value !== "object") {
    throw new ServiceError("invalid_address", `\`${which}\` must be an address object`);
  }
  const a = value as Record<string, unknown>;
  for (const field of ADDRESS_FIELDS) {
    if (typeof a[field] !== "string" || !(a[field] as string).trim()) {
      throw new ServiceError("invalid_address", `\`${which}.${field}\` is required`);
    }
  }
  return a as unknown as MailAddress;
}

function requireText(value: unknown, field: string, max: number): string {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) throw new ServiceError("missing_body", `\`${field}\` is required`);
  if (s.length > max) {
    throw new ServiceError("body_too_long", `\`${field}\` is ${s.length} characters; the maximum is ${max}`);
  }
  return s;
}

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Wrap plain-text body copy in the page HTML Lob's renderer expects. */
function letterHtml(body: string): string {
  const paragraphs = body
    .split(/\r?\n\s*\r?\n/)
    .map((p) => `<p>${escapeHtml(p).replace(/\r?\n/g, "<br>")}</p>`)
    .join("\n");
  return `<html><head><meta charset="utf-8"><style>
  @page { size: letter; margin: 0; }
  body { width: 8.5in; height: 11in; margin: 0; padding: 4.5in 1in 1in 1in;
         font-family: Helvetica, Arial, sans-serif; font-size: 11pt; line-height: 1.5; }
  p { margin: 0 0 12pt 0; }
</style></head><body>
${paragraphs}
</body></html>`;
}

function postcardHtml(text: string, size: "4x6" | "6x9" | "6x11"): string {
  const [w, h] = size.split("x");
  return `<html><head><meta charset="utf-8"><style>
  @page { size: ${w}in ${h}in; margin: 0; }
  body { width: ${w}in; height: ${h}in; margin: 0; padding: 0.35in;
         font-family: Helvetica, Arial, sans-serif; font-size: 12pt; line-height: 1.4; }
</style></head><body>${escapeHtml(text).replace(/\r?\n/g, "<br>")}</body></html>`;
}

function toServiceError(err: unknown): ServiceError {
  if (err instanceof ServiceError) return err;
  if (err instanceof LobError) return new ServiceError(err.code, err.message, err.status);
  return new ServiceError("upstream_error", (err as Error).message, 502);
}

// ─────────────────────────────────────────────────────────────── Letters ─────

export interface LetterRequest {
  to?: unknown;
  from?: unknown;
  body?: unknown;
  color?: unknown;
  doubleSided?: unknown;
  mailType?: unknown;
  description?: unknown;
}

export async function sendLetter(req: LetterRequest): Promise<MailResult> {
  const to = validateAddress(req.to, "to");
  const from = validateAddress(req.from, "from");
  const body = requireText(req.body, "body", 20_000);
  const color = req.color === true;
  const doubleSided = req.doubleSided !== false;
  const mailType = req.mailType === "usps_standard" ? "usps_standard" : "usps_first_class";
  const description = typeof req.description === "string" ? req.description : undefined;
  const source = activeSource();
  const createdAt = new Date().toISOString();

  if (source === "lob") {
    try {
      const piece = await lobCreateLetter({
        to,
        from,
        html: letterHtml(body),
        color,
        doubleSided,
        description,
        mailType,
      });
      const pdf = await fetchPdfBase64(piece.url);
      if (!pdf) {
        throw new ServiceError(
          "preview_unavailable",
          `Lob created ${piece.id} but the proof PDF could not be fetched. Retrieve it at ${piece.url ?? "the Lob dashboard"}.`,
          502,
        );
      }
      return {
        source,
        testMode: testMode(),
        mailId: piece.id,
        type: "letter",
        createdAt,
        expectedDelivery: piece.expectedDeliveryDate ?? expectedDeliveryDate(mailType),
        carrier: piece.carrier ?? "USPS",
        mailType: piece.mailType ?? mailType,
        to,
        from,
        // Lob doesn't report a page count; the proof PDF is the source of truth.
        pageCount: countPdfPages(pdf),
        color,
        doubleSided,
        previewFormat: "PDF",
        previewPdfBase64: pdf,
        previewUrl: piece.url,
        thumbnails: piece.thumbnails,
      };
    } catch (err) {
      throw toServiceError(err);
    }
  }

  // ── Fixture mode ──────────────────────────────────────────────────────────
  const mailId = fixtureMailId("ltr", { to, from, body, color, doubleSided, mailType });
  const { pdfBase64, pageCount } = renderLetterPreview({ to, from, body, color, doubleSided, mailId });

  return {
    source,
    testMode: true,
    mailId,
    type: "letter",
    createdAt,
    expectedDelivery: expectedDeliveryDate(mailType),
    carrier: "USPS",
    mailType,
    to,
    from,
    pageCount,
    color,
    doubleSided,
    previewFormat: "PDF",
    previewPdfBase64: pdfBase64,
    previewUrl: null,
    thumbnails: [],
  };
}

// ───────────────────────────────────────────────────────────── Postcards ─────

export interface PostcardRequest {
  to?: unknown;
  from?: unknown;
  front?: unknown;
  back?: unknown;
  size?: unknown;
  description?: unknown;
}

const POSTCARD_SIZES = ["4x6", "6x9", "6x11"] as const;

export async function sendPostcard(req: PostcardRequest): Promise<MailResult> {
  const to = validateAddress(req.to, "to");
  const from = validateAddress(req.from, "from");
  const front = requireText(req.front, "front", 1_000);
  const back = requireText(req.back, "back", 1_000);
  const size = (POSTCARD_SIZES as readonly string[]).includes(String(req.size))
    ? (String(req.size) as (typeof POSTCARD_SIZES)[number])
    : "4x6";
  const description = typeof req.description === "string" ? req.description : undefined;
  const source = activeSource();
  const createdAt = new Date().toISOString();

  if (source === "lob") {
    try {
      const piece = await lobCreatePostcard({
        to,
        from,
        frontHtml: postcardHtml(front, size),
        backHtml: postcardHtml(back, size),
        size,
        description,
      });
      const pdf = await fetchPdfBase64(piece.url);
      if (!pdf) {
        throw new ServiceError(
          "preview_unavailable",
          `Lob created ${piece.id} but the proof PDF could not be fetched. Retrieve it at ${piece.url ?? "the Lob dashboard"}.`,
          502,
        );
      }
      return {
        source,
        testMode: testMode(),
        mailId: piece.id,
        type: "postcard",
        createdAt,
        expectedDelivery: piece.expectedDeliveryDate ?? expectedDeliveryDate("usps_first_class"),
        carrier: piece.carrier ?? "USPS",
        mailType: piece.mailType ?? "usps_first_class",
        to,
        from,
        pageCount: countPdfPages(pdf),
        color: true,
        doubleSided: true,
        previewFormat: "PDF",
        previewPdfBase64: pdf,
        previewUrl: piece.url,
        thumbnails: piece.thumbnails,
      };
    } catch (err) {
      throw toServiceError(err);
    }
  }

  const mailId = fixtureMailId("psc", { to, from, front, back, size });
  const { pdfBase64, pageCount } = renderPostcardPreview({ to, from, front, back, mailId });

  return {
    source,
    testMode: true,
    mailId,
    type: "postcard",
    createdAt,
    expectedDelivery: expectedDeliveryDate("usps_first_class"),
    carrier: "USPS",
    mailType: "usps_first_class",
    to,
    from,
    pageCount,
    color: true,
    doubleSided: true,
    previewFormat: "PDF",
    previewPdfBase64: pdfBase64,
    previewUrl: null,
    thumbnails: [],
  };
}

/** Count `/Type /Page` objects in a PDF so the page count is never guessed. */
function countPdfPages(base64: string): number {
  const text = Buffer.from(base64, "base64").toString("latin1");
  const matches = text.match(/\/Type\s*\/Page[^s]/g);
  return matches ? matches.length : 1;
}
