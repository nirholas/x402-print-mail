---
name: send-physical-mail
description: Run the x402-print-mail HTTP service and mail a letter or postcard through Lob, receiving a preview PDF, mail id and expected delivery date. Use when an agent must send physical mail and can pay per piece in USDC over x402.
---

# x402-print-mail

x402-print-mail typesets a letter (US Letter, #10 double-window recipient block) or a postcard and returns a base64 PDF proof, mail id, page count, carrier, mail class and expected delivery date. Every response has `testMode`, which is `true` unless a live Lob key is configured. A Lob test key renders a real proof and mails nothing.

Paying is irreversible. Before any paid call, show the user the route, price, network and payTo address from the 402 response, and wait for an explicit yes.

## Run the service

From a clone (Node 18+):

```bash
git clone https://github.com/nirholas/x402-print-mail
cd x402-print-mail && npm install
npm run dev        # tsx src/server.ts, listens on :4024 (PORT overrides)
```

Environment (see `.env.example`): `LOB_API_KEY` (unset gives labelled fixtures; a `test_` key renders proofs without mailing; a `live_` key mails real paper), `LOB_BASE_URL` (default `https://api.lob.com/v1`). Payment settings: `PAY_TO_ADDRESS` (Base receive address), `SOLANA_PAY_TO_ADDRESS`, `NETWORK` (`base-sepolia` default, or `base`), `SOLANA_NETWORK`, `FACILITATOR_URL`, `PUBLIC_BASE_URL`. Set your own pay-to addresses to be paid yourself. `npm run build` then `npm start` runs the compiled server.

## Routes

| Route | Price | Body |
|---|---|---|
| `POST /letters` | $0.05 | `to` and `from` address objects (`name`, `company`, `addressLine1`, `addressCity`, `addressState`, `addressZip`, `addressCountry`), plain-text `body`; optional `color` (default `false`), `doubleSided` (default `true`), `mailType` (`usps_first_class` default, or `usps_standard`) |
| `POST /postcards` | $0.03 | `to`, `from`, `front` and `back` copy (1000 chars each); optional `size` (`4x6` default, `6x9`, `6x11`) |
| `GET /health`, `GET /.well-known/x402` | free | liveness and rails, discovery manifest |

## Paying

An unpaid request to a paid route returns 402 with an `accepts` array listing both rails (USDC on Base or Solana). Sign the entry your wallet supports and retry with the base64 `X-PAYMENT` header. The settlement receipt is in the `X-PAYMENT-RESPONSE` header. The reference client is `examples/agent-client.ts` (`npm run client`), which uses `x402-fetch` with `PRIVATE_KEY` for a Base Sepolia wallet and `BASE_URL` (default `http://localhost:4024`).

With a `live_` Lob key this service mails real paper that cannot be recalled. Confirm the recipient address, the copy and the price with the user before any paid call, and prefer a `test_` key until they say otherwise.

## Example

```bash
curl -i -X POST localhost:4024/postcards -H 'content-type: application/json' \
  -d '{"to":{"name":"Dana Reyes","addressLine1":"1600 Pennsylvania Ave NW","addressCity":"Washington","addressState":"DC","addressZip":"20500","addressCountry":"US"},"from":{"name":"Acme Robotics","addressLine1":"215 Clayton St","addressCity":"San Francisco","addressState":"CA","addressZip":"94117","addressCountry":"US"},"front":"Greetings from SF","back":"Wish you were here."}'
# 402 first. After approval and payment: mailId, previewPdfBase64, expectedDelivery, testMode.
```
