# x402-print-mail

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![x402](https://img.shields.io/badge/x402-payment%20protocol-0052ff)](https://x402.org)
[![USDC on Base + Solana](https://img.shields.io/badge/USDC-Base%20%2B%20Solana-2775ca)](https://x402.org)

> Give an agent an address and a paragraph and it puts paper in someone's mailbox — the proof PDF comes back in the same response.

`POST /letters` takes a recipient, a return address and body copy, and returns the printed proof — a real PDF, base64, **in the 200 body** — with the mail id and the expected delivery date. `POST /postcards` does the same for a 4x6, 6x9 or 6x11 card. Nothing to poll, nothing to download later: you pay, and the artifact is in the response.

## Why x402 for this

Direct mail is the last thing an autonomous agent can't do, and the reason is procurement rather than technology: print APIs want a company, a signed agreement and a funded account before they'll print one page. x402 turns a letter into a $0.05 HTTP call settled in USDC from the agent's own wallet. The mail id and the settlement receipt come back together, so the spend and the thing it bought are linked in one record.

## Quickstart

```bash
git clone https://github.com/nirholas/x402-print-mail
cd x402-print-mail
npm install
npm run dev          # http://localhost:4024
```

No configuration needed — the server ships with the suite's receive addresses and a built-in typesetter that lays out and renders a real proof PDF, so the demo works before you have a Lob account. Set `PAY_TO_ADDRESS` / `SOLANA_PAY_TO_ADDRESS` to receive funds yourself.

```bash
# 1. Unpaid → 402 listing both rails
curl -i -X POST http://localhost:4024/letters \
  -H 'Content-Type: application/json' \
  -d '{"to":{"name":"Dana Reyes","addressLine1":"1600 Pennsylvania Ave NW","addressCity":"Washington","addressState":"DC","addressZip":"20500"},"from":{"name":"Acme Robotics","addressLine1":"215 Clayton St","addressCity":"San Francisco","addressState":"CA","addressZip":"94117"},"body":"Dear Dana,\n\nYour order shipped today.\n\nSincerely,\nAcme"}'

# 2. Paid, via any x402 client
npm run client
```

## API

| Route | Price | What you get back |
|---|---|---|
| `POST /letters` | **$0.05** | `{mailId, previewPdfBase64, expectedDelivery}` plus page count, carrier, mail class, and the addresses as printed |
| `POST /postcards` | **$0.03** | `{mailId, previewPdfBase64, expectedDelivery}` for a two-page proof: front artwork, then back with address block and postage box |
| `GET /health` | free | Liveness, active data source, configured rails |
| `GET /.well-known/x402` | free | Machine-readable discovery manifest |

Every paid route returns the purchased artifact **in the 200 body**. Nothing is deferred to a webhook or a later fetch.

Full reference: [docs/api.md](docs/api.md) · [openapi.json](openapi.json) · [skill.md](skill.md)

## How x402 works

```
  agent                            x402-print-mail                    facilitator
    │  GET /letters          │                                │
    ├──────────────────────────────▶│                                │
    │  402 + accepts[base, solana]  │                                │
    ◀──────────────────────────────┤                                │
    │  sign USDC authorization      │                                │
    │  retry + X-PAYMENT            │                                │
    ├──────────────────────────────▶│  verify + settle               │
    │                               ├───────────────────────────────▶│
    │  200 + artifact               │                                │
    │  + X-PAYMENT-RESPONSE         │  ◀── tx hash / signature ──────┤
    ◀──────────────────────────────┤                                │
```

**Pay in USDC on Base or Solana — your client picks the rail.** The 402 challenge always lists both:

| Rail | Network | Asset | payTo |
|---|---|---|---|
| EVM | `base-sepolia` (`base` via `NETWORK=base`) | USDC | `0x40252CFDF8B20Ed757D61ff157719F33Ec332402` |
| Solana | `solana` | USDC (SPL) | `WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW` |

The Solana rail's `extra.feePayer` is a public facilitator sponsor account that pays the SOL network fee, so a buyer needs only USDC — no SOL for gas. Wallets that sign serialized transactions (Phantom, most agent SDKs) can use the built-in helpers at `POST /api/x402-checkout?action=prepare|encode`.

## Real backend / API keys

This service prints through [Lob](https://lob.com). An account is free and test keys need no payment method.

| Env var | Unlocks |
|---|---|
| `LOB_API_KEY` | Live Lob rendering, address verification and (with a live key) actual mailing. Test keys start `test_`. |
| `LOB_BASE_URL` | Point at a different API host — rarely needed. |

**Test mode is the default and the safe path.** Lob's test environment validates the address, renders the real proof PDF and returns a real expected-delivery date, but prints and mails nothing. That is exactly the artifact this service sells, so test mode is a first-class path here rather than a degraded one. `testMode` in every response tells you which mode produced it, and the startup banner shouts `LIVE — real mail, real postage` if you configure a `live_` key.

**Without a key, everything still works.** The built-in typesetter lays out the letter — return address, #10-window recipient block, wrapped and paginated body, per-page footer — and renders it to a valid PDF with no third-party dependency. Every response is marked `"source": "fixture"`, in the JSON, in the OpenAPI schema and in `skill.md`.

## Human checkout

For a browser-facing checkout, drop in [`@three-ws/x402-payment-modal`](https://www.npmjs.com/package/@three-ws/x402-payment-modal) — it reads the 402 challenge and drives the whole connect → sign → settle flow for **both** rails (Phantom on Solana, any injected wallet on EVM), with SIWX re-entry so a returning buyer skips the wallet prompt, and client-side spending caps that stop an agent or a mis-click from over-spending. Reference it from npm or the CDN; it is a separate proprietary package and is never vendored here.

## For AI agents

- **[`skill.md`](skill.md)** — the agent-facing contract: every endpoint, its price, its response schema, and how to pay. Point your agent at this file.
- **`GET /.well-known/x402`** — machine-readable discovery ([manifest](public/.well-known/x402)). Lists both rails per resource.
- **[`examples/mcp-tool.md`](examples/mcp-tool.md)** — expose this service as an MCP tool for Claude in about 30 lines.
- **[`examples/agent-client.ts`](examples/agent-client.ts)** — a complete paid call with `x402-fetch`, printing the artifact and the decoded settlement receipt.
- **Discovery/listing** — indexable by [x402scan.com](https://x402scan.com), the [x402 Bazaar](https://x402.org), and [agentic.market](https://agentic.market). Deploy, then submit your public base URL; all three read `/.well-known/x402`.

## Docs

<https://nirholas.github.io/x402-print-mail/> — [tutorial](docs/tutorial.md) · [API reference](docs/api.md) · [for agents](docs/agents.md)

## Support

nichxbt@gmail.com

## License

Apache-2.0 — see [LICENSE](LICENSE).

Part of the [x402 Suite](https://github.com/nirholas/x402-suite).
