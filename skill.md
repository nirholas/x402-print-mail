# x402-print-mail

x402-print-mail lets an agent put physical mail in the post by paying per piece. `POST /letters` accepts `to` and `from` addresses plus plain-text `body` copy, lays it out on US Letter with the recipient block positioned for a #10 double-window envelope, paginates it, and returns the proof as base64 PDF alongside the mail id, page count, carrier, mail class and expected delivery date. `POST /postcards` takes `front` and `back` copy and returns a two-page proof (front, then back with the address block and postage box). Both artifacts are in the 200 body. Every response carries `testMode`, which is `true` unless a live Lob key is configured — this service will not quietly mail something on your behalf.

**Base URL:** `{BASE_URL}` (local default `http://localhost:4024`)

## Endpoints

### `POST /letters` — $0.05

Typesets plain-text `body` copy on US Letter with the recipient block positioned for a #10 double-window envelope, paginates it, and returns the proof as base64 PDF. Also returns the mail id, the page count, the carrier and mail class, and the expected delivery date computed on USPS business-day transit.

`color` defaults to `false` and `doubleSided` defaults to `true` (the cheaper, greener combination). `mailType` is `usps_first_class` (default, ~5 business days) or `usps_standard` (~8).

Request body:

```json
{
  "to": {
    "name": "Dana Reyes",
    "addressLine1": "1600 Pennsylvania Ave NW",
    "addressCity": "Washington",
    "addressState": "DC",
    "addressZip": "20500",
    "addressCountry": "US"
  },
  "from": {
    "name": "Acme Robotics",
    "company": "Acme Robotics Inc",
    "addressLine1": "215 Clayton St",
    "addressCity": "San Francisco",
    "addressState": "CA",
    "addressZip": "94117",
    "addressCountry": "US"
  },
  "body": "Dear Dana,\n\nYour order #4417 shipped today and should arrive by the end of the week. The tracking number is on the enclosed slip.\n\nThank you for your business.\n\nSincerely,\nAcme Robotics",
  "color": false,
  "doubleSided": true,
  "mailType": "usps_first_class"
}
```

Returns `{mailId, previewPdfBase64, expectedDelivery}` plus page count, carrier, mail class, and the addresses as printed:

```json
{
  "source": "fixture",
  "testMode": true,
  "mailId": "ltr_fixture_c77578d069f3be73",
  "type": "letter",
  "createdAt": "2026-08-07T12:00:00.000Z",
  "expectedDelivery": "2026-08-17",
  "carrier": "USPS",
  "mailType": "usps_first_class",
  "to": {
    "name": "Dana Reyes",
    "addressLine1": "1600 Pennsylvania Ave NW",
    "addressCity": "Washington",
    "addressState": "DC",
    "addressZip": "20500",
    "addressCountry": "US"
  },
  "from": {
    "name": "Acme Robotics",
    "company": "Acme Robotics Inc",
    "addressLine1": "215 Clayton St",
    "addressCity": "San Francisco",
    "addressState": "CA",
    "addressZip": "94117",
    "addressCountry": "US"
  },
  "pageCount": 1,
  "color": false,
  "doubleSided": true,
  "previewFormat": "PDF",
  "previewPdfBase64": "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4K…",
  "previewUrl": null,
  "thumbnails": [],
  "payment": {
    "success": true,
    "rail": "evm",
    "network": "base-sepolia",
    "transaction": "0x9c1f…",
    "payer": "0xA11ce…",
    "amount": "50000",
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "resource": "http://localhost:4024/letters"
  }
}
```

### `POST /postcards` — $0.03

Takes `front` and `back` copy (1,000 characters each) and returns a two-page proof: page 1 is the front, page 2 is the back with the message on the left and the recipient address block plus postage box on the right, exactly as it prints. `size` is `4x6` (default), `6x9` or `6x11`.

Request body:

```json
{
  "to": {
    "name": "Dana Reyes",
    "addressLine1": "1600 Pennsylvania Ave NW",
    "addressCity": "Washington",
    "addressState": "DC",
    "addressZip": "20500",
    "addressCountry": "US"
  },
  "from": {
    "name": "Acme Robotics",
    "company": "Acme Robotics Inc",
    "addressLine1": "215 Clayton St",
    "addressCity": "San Francisco",
    "addressState": "CA",
    "addressZip": "94117",
    "addressCountry": "US"
  },
  "front": "Your order shipped!",
  "back": "Order #4417 is on its way. Track it at acme.example/4417.",
  "size": "4x6"
}
```

Returns `{mailId, previewPdfBase64, expectedDelivery}` for a two-page proof: front artwork, then back with address block and postage box:

```json
{
  "source": "fixture",
  "testMode": true,
  "mailId": "psc_fixture_bafec9d202eca43e",
  "type": "postcard",
  "createdAt": "2026-08-07T12:00:00.000Z",
  "expectedDelivery": "2026-08-17",
  "carrier": "USPS",
  "mailType": "usps_first_class",
  "to": {
    "name": "Dana Reyes",
    "addressLine1": "1600 Pennsylvania Ave NW",
    "addressCity": "Washington",
    "addressState": "DC",
    "addressZip": "20500",
    "addressCountry": "US"
  },
  "from": {
    "name": "Acme Robotics",
    "company": "Acme Robotics Inc",
    "addressLine1": "215 Clayton St",
    "addressCity": "San Francisco",
    "addressState": "CA",
    "addressZip": "94117",
    "addressCountry": "US"
  },
  "pageCount": 2,
  "color": true,
  "doubleSided": true,
  "previewFormat": "PDF",
  "previewPdfBase64": "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4K…",
  "previewUrl": null,
  "thumbnails": [],
  "payment": {
    "success": true,
    "rail": "solana",
    "network": "solana",
    "transaction": "5xkQ…",
    "payer": "9wFh…",
    "amount": "30000",
    "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "resource": "http://localhost:4024/postcards"
  }
}
```

### Free routes

| Route | Returns |
|---|---|
| `GET /health` | `{ok, service, source, rails}` — liveness plus the rails this instance advertises |
| `GET /.well-known/x402` | The discovery manifest below |

## Payment

This service speaks **x402** (HTTP 402 payment protocol, <https://x402.org>). **Pay in USDC on Base or Solana — your client picks the rail.**

1. Call the endpoint normally. With no `X-PAYMENT` header you get `402` and a JSON body with an `accepts` array holding **both** rails.
2. Pick a rail, produce a payment for it, and retry the identical request with the base64 `X-PAYMENT` header.
3. You get `200` with the artifact **in the response body**, plus an `X-PAYMENT-RESPONSE` header carrying the settlement receipt (tx hash / signature + rail). The same receipt is echoed in the body's `payment` field.

| Rail | Network | Asset | payTo | Facilitator |
|---|---|---|---|---|
| EVM | `base-sepolia` (or `base`) | USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | `0x40252CFDF8B20Ed757D61ff157719F33Ec332402` | `https://x402.org/facilitator` |
| Solana | `solana` | USDC `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | `WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW` | `https://facilitator.payai.network` |

Pay via [`x402-fetch`](https://www.npmjs.com/package/x402-fetch) (EVM), [`@three-ws/x402-payment-modal`](https://www.npmjs.com/package/@three-ws/x402-payment-modal) (browser, both rails), or any x402 client. Solana wallets that sign serialized transactions can use this server's helper endpoints:

```
POST /api/x402-checkout?action=prepare   → unsigned SPL transfer for a chosen accept
POST /api/x402-checkout?action=encode    → wraps your signed tx into an X-PAYMENT header
```

The Solana `extra.feePayer` sponsor pays the SOL network fee, so you need only USDC.

## Errors

| Code | HTTP | Meaning |
|---|---|---|
| `invalid_address` | 400 | `to` or `from` is missing `name`, `addressLine1`, `addressCity`, `addressState` or `addressZip` |
| `missing_body` | 400 | `body` (letters) or `front`/`back` (postcards) is empty |
| `body_too_long` | 400 | Body copy exceeds 20,000 characters, or postcard copy exceeds 1,000 |
| `invalid_mail_piece` | 400 | Lob rejected the address or the rendered content |
| `preview_unavailable` | 502 | Lob created the piece but the proof PDF could not be fetched — the message says where to retrieve it |
| `upstream_error` | 502 | The Lob API was unreachable or returned an unexpected error |
| `no_payment_rail` | 500 | Neither rail is configured on this instance |
| `facilitator_unreachable` | 502 | The rail's facilitator could not be reached to verify |
| `settlement_error` | 502 | Verified, but settlement failed — you were not charged |

## Data source

Live printing runs through [Lob](https://lob.com) when `LOB_API_KEY` is set. Without it, the service typesets and renders the proof itself — a genuine, paginated PDF with the address block, body copy and a footer marking it a preview — and labels every response `"source": "fixture"` with `"testMode": true`. Expected delivery dates use the same USPS First-Class business-day math Lob quotes. Nothing is printed or mailed in either mode unless you supply a **live** Lob key.

## Discovery

- Manifest: `{BASE_URL}/.well-known/x402`
- OpenAPI: [`openapi.json`](https://github.com/nirholas/x402-print-mail/blob/main/openapi.json)
- Docs: <https://nirholas.github.io/x402-print-mail/>
- Contact: nichxbt@gmail.com
