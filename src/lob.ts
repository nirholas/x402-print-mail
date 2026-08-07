// Live Lob adapter — used when LOB_API_KEY is set.
// Docs: https://docs.lob.com/  (free account; test keys start `test_`)
//
// Lob's test environment prints nothing and mails nothing: it validates the
// address, renders the real proof PDF, and returns an expected delivery date.
// That is exactly the artifact this service sells, which is why test mode is a
// first-class path here rather than a degraded one.

import type { MailAddress } from "./fixtures.js";

const LOB_BASE = process.env.LOB_BASE_URL ?? "https://api.lob.com/v1";

export function lobConfigured(): boolean {
  return Boolean(process.env.LOB_API_KEY);
}

/** Lob test keys start `test_`; live keys start `live_`. */
export function lobIsTestKey(): boolean {
  return (process.env.LOB_API_KEY ?? "").startsWith("test_");
}

export class LobError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 502, code = "upstream_error") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function authHeader(): string {
  return `Basic ${Buffer.from(`${process.env.LOB_API_KEY}:`).toString("base64")}`;
}

interface LobAddressPayload {
  name: string;
  company?: string;
  address_line1: string;
  address_line2?: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  address_country?: string;
}

function lobAddress(a: MailAddress): LobAddressPayload {
  return {
    name: a.name,
    company: a.company,
    address_line1: a.addressLine1,
    address_line2: a.addressLine2,
    address_city: a.addressCity,
    address_state: a.addressState,
    address_zip: a.addressZip,
    address_country: a.addressCountry ?? "US",
  };
}

export interface LobMailPiece {
  id: string;
  url: string | null;
  expectedDeliveryDate: string | null;
  carrier: string | null;
  mailType: string | null;
  thumbnails: string[];
}

async function post(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${LOB_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
  });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new LobError(`Lob ${path} returned non-JSON (status ${res.status})`);
    }
  }
  if (!res.ok) {
    const err = data.error as { message?: string; status_code?: number } | undefined;
    const message = err?.message ?? `status ${res.status}`;
    // 422 is Lob telling us the address or the HTML is bad — a caller problem.
    throw new LobError(
      `Lob ${path} rejected the request: ${message}`,
      res.status === 422 || res.status === 400 ? 400 : 502,
      res.status === 422 || res.status === 400 ? "invalid_mail_piece" : "upstream_error",
    );
  }
  return data;
}

function mapPiece(data: Record<string, unknown>): LobMailPiece {
  const thumbs = (data.thumbnails as Array<Record<string, string>> | undefined) ?? [];
  return {
    id: String(data.id ?? ""),
    url: (data.url as string | undefined) ?? null,
    expectedDeliveryDate: (data.expected_delivery_date as string | undefined) ?? null,
    carrier: (data.carrier as string | undefined) ?? null,
    mailType: (data.mail_type as string | undefined) ?? null,
    thumbnails: thumbs.map((t) => t.large ?? t.medium ?? t.small).filter(Boolean),
  };
}

/** Fetch the rendered proof so it can be returned base64 in our own response. */
export async function fetchPdfBase64(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, {
      headers: { Authorization: authHeader() },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer()).toString("base64");
  } catch {
    return null;
  }
}

export async function lobCreateLetter(args: {
  to: MailAddress;
  from: MailAddress;
  html: string;
  color: boolean;
  doubleSided: boolean;
  description?: string;
  mailType: string;
}): Promise<LobMailPiece> {
  return mapPiece(
    await post("/letters", {
      description: args.description ?? "x402-print-mail letter",
      to: lobAddress(args.to),
      from: lobAddress(args.from),
      file: args.html,
      color: args.color,
      double_sided: args.doubleSided,
      address_placement: "top_first_page",
      mail_type: args.mailType,
    }),
  );
}

export async function lobCreatePostcard(args: {
  to: MailAddress;
  from: MailAddress;
  frontHtml: string;
  backHtml: string;
  size: string;
  description?: string;
}): Promise<LobMailPiece> {
  return mapPiece(
    await post("/postcards", {
      description: args.description ?? "x402-print-mail postcard",
      to: lobAddress(args.to),
      from: lobAddress(args.from),
      front: args.frontHtml,
      back: args.backHtml,
      size: args.size,
    }),
  );
}
