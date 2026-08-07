# For AI agents — x402-print-mail

How an autonomous agent finds this service, pays for a call, and uses what comes back.

## 1. Discovery

Two machine-readable entry points, both free:

```bash
curl -s {BASE_URL}/.well-known/x402      # the manifest below
```

```jsonc
{
  "x402Version": 1,
  "name": "x402-print-mail",
  "description": "Agents send physical letters and postcards via Lob's test environment — preview PDF returned in-response",
  "resources": [
    {
      "resource": "POST /letters",
      "description": "Send a physical letter and get the printed proof back in the response.",
      "price": "$0.05",
      "accepts": [
        { "scheme": "exact", "network": "base-sepolia", "asset": "USDC", "payTo": "0x40252CFDF8B20Ed757D61ff157719F33Ec332402", "maxAmountRequired": "50000" },
        { "scheme": "exact", "network": "solana",       "asset": "USDC", "payTo": "WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW", "maxAmountRequired": "50000" }
      ],
      "outputSchema": { /* … */ }
    }
    // …
  ]
}
```

And [`skill.md`](https://github.com/nirholas/x402-print-mail/blob/main/skill.md) at the repo root — the prose contract written for a model to read directly: what each endpoint does, its price, its exact response shape, and the error codes. Drop it into your agent's context and it can call this service without any other documentation.

## 2. Paying

**Pay in USDC on Base or Solana — your client picks the rail.** Every 402 lists both:

| Rail | Network | Asset | payTo | Facilitator |
|---|---|---|---|---|
| EVM | `base-sepolia` / `base` | USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | `0x40252CFDF8B20Ed757D61ff157719F33Ec332402` | `https://x402.org/facilitator` |
| Solana | `solana` | USDC `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | `WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW` | `https://facilitator.payai.network` |

### EVM

The wallet signs an EIP-3009 transfer authorization entirely locally — no round-trip, no gas from the agent. With [`x402-fetch`](https://www.npmjs.com/package/x402-fetch) it's two lines:

```ts
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment } from "x402-fetch";

const payFetch = wrapFetchWithPayment(fetch, privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`));
const res = await payFetch("{BASE_URL}/letters");   // 402 → pay → 200, transparently
```

### Solana

Solana wallets sign serialized transactions, so the server builds one for you:

```
POST {BASE_URL}/api/x402-checkout?action=prepare
  { "accept": <solana entry from the 402>, "buyer": "<base58 pubkey>" }
  → { "tx_base64", "recent_blockhash" }

POST {BASE_URL}/api/x402-checkout?action=encode
  { "accept": <same>, "signed_tx_base64": "<signed>", "resource_url": "<resource>" }
  → { "x_payment" }
```

Retry the original request with `X-PAYMENT: <x_payment>`. The `extra.feePayer` sponsor covers the SOL network fee, so the agent's wallet needs only USDC.

### What the 402 tells you

Each entry in `accepts[]` carries an `outputSchema` describing the route it guards:

```jsonc
"outputSchema": {
  "input":  { "type": "http", "method": "POST", "bodyType": "json",
              "bodyFields": { "to": { "type": "object" }, "body": { "type": "string" } } },
  "output": { "type": "object", "properties": { "letter": { "type": "object" } } }
}
```

`input` is how to call the route, `output` is the shape of the 200 body. Both are generated from
[`openapi.json`](https://github.com/nirholas/x402-print-mail/blob/main/openapi.json), so a client that only
ever sees a 402 can still invoke the endpoint correctly and parse what comes back. Both rails carry
the same schema.

### Protocol version

This service speaks **x402 v1**: the challenge is `{ x402Version: 1, error, accepts[] }`, which is
what the `x402-fetch` clients in [`examples/`](https://github.com/nirholas/x402-print-mail/tree/main/examples)
and every current wallet integration expect. x402 v2 — CAIP-2 network ids and
`extensions.bazaar.schema` instead of `outputSchema` — is a future upgrade for agentcash
compatibility; it changes the challenge shape, so it will land as a deliberate version bump rather
than silently.

## 3. What you get back

A `200` whose body **is** the artifact — every paid route in this service returns what you bought inline. No job ids, no polling, no webhooks. Alongside it:

- `X-PAYMENT-RESPONSE` header — base64 JSON settlement receipt
- `payment` field in the body — the same receipt, for agents that only parse JSON

```json
{ "success": true, "rail": "solana", "network": "solana", "transaction": "5xk…", "payer": "9wF…", "amount": "50000" }
```

Persist it — it's the audit trail linking a spend to the data it bought.

## 4. Budgeting

- `POST /letters` → **$0.05**
- `POST /postcards` → **$0.03**

A letter is `$0.05` and a postcard is `$0.03`, regardless of page count. That's the x402 fee only — with a live Lob key, Lob separately charges your account for printing and postage. 100 letters cost $5 in x402 fees.

## 5. MCP integration

[`examples/mcp-tool.md`](https://github.com/nirholas/x402-print-mail/blob/main/examples/mcp-tool.md) has a complete MCP server exposing these 2 endpoints as tools for Claude, with the payment wrapper already wired in.

## 6. Listing this service

Once deployed at a public origin (set `PUBLIC_BASE_URL` so the 402 `resource` is correct):

- **[x402scan.com](https://x402scan.com)** — crawls `/.well-known/x402`; submit your base URL.
- **x402 Bazaar** — the protocol's own directory, reachable through the facilitator's `list` API; see <https://x402.org>.
- **[agentic.market](https://agentic.market)** — agent-facing marketplace; the manifest plus `skill.md` is all it needs.

All three read the same manifest this repo already serves, so listing is a URL submission, not an integration.

## 7. Data honesty

Live printing runs through [Lob](https://lob.com) when `LOB_API_KEY` is set. Without it, the service typesets and renders the proof itself — a genuine, paginated PDF with the address block, body copy and a footer marking it a preview — and labels every response `"source": "fixture"` with `"testMode": true`. Expected delivery dates use the same USPS First-Class business-day math Lob quotes. Nothing is printed or mailed in either mode unless you supply a **live** Lob key.

An agent should branch on the `source` field rather than assume live data.
