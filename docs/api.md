# API reference — x402-print-mail

Base URL: `http://localhost:4024` locally, or your deployment's origin.

All paid routes answer `402` when called without an `X-PAYMENT` header, and the 402 body lists **both** payment rails. See [tutorial.md](tutorial.md) for the end-to-end flow and [agents.md](agents.md) for the agent integration.

---

## `POST /letters`

**$0.05** · Send a physical letter and get the printed proof back in the response.

Typesets plain-text `body` copy on US Letter with the recipient block positioned for a #10 double-window envelope, paginates it, and returns the proof as base64 PDF. Also returns the mail id, the page count, the carrier and mail class, and the expected delivery date computed on USPS business-day transit.

`color` defaults to `false` and `doubleSided` defaults to `true` (the cheaper, greener combination). `mailType` is `usps_first_class` (default, ~5 business days) or `usps_standard` (~8).

### Request body

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

### Example

```bash
curl -s -X POST http://localhost:4024/letters \
  -H 'Content-Type: application/json' \
  -d '{
    "to":   {"name":"Dana Reyes","addressLine1":"1600 Pennsylvania Ave NW","addressCity":"Washington","addressState":"DC","addressZip":"20500"},
    "from": {"name":"Acme Robotics","addressLine1":"215 Clayton St","addressCity":"San Francisco","addressState":"CA","addressZip":"94117"},
    "body": "Dear Dana,\n\nYour order #4417 shipped today.\n\nSincerely,\nAcme Robotics"
  }' > letter.json

# The proof is already in the response — write it to disk, no second request.
node -e 'require("fs").writeFileSync("letter.pdf",Buffer.from(require("./letter.json").previewPdfBase64,"base64"))'
```

### Response `200`

`{mailId, previewPdfBase64, expectedDelivery}` plus page count, carrier, mail class, and the addresses as printed. The `payment` field mirrors the `X-PAYMENT-RESPONSE` header.

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

### Errors

`400 invalid_address` names the exact missing field. `400 body_too_long` above 20,000 characters. `400 invalid_mail_piece` when Lob rejects the address as undeliverable. `502 preview_unavailable` in the rare case where Lob created the piece but the proof couldn't be fetched — the message includes the mail id and where to retrieve it, so nothing is lost.

---

## `POST /postcards`

**$0.03** · Send a physical postcard and get the two-sided proof back in the response.

Takes `front` and `back` copy (1,000 characters each) and returns a two-page proof: page 1 is the front, page 2 is the back with the message on the left and the recipient address block plus postage box on the right, exactly as it prints. `size` is `4x6` (default), `6x9` or `6x11`.

### Request body

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

### Example

```bash
curl -s -X POST http://localhost:4024/postcards \
  -H 'Content-Type: application/json' \
  -d '{
    "to":   {"name":"Dana Reyes","addressLine1":"1600 Pennsylvania Ave NW","addressCity":"Washington","addressState":"DC","addressZip":"20500"},
    "from": {"name":"Acme Robotics","addressLine1":"215 Clayton St","addressCity":"San Francisco","addressState":"CA","addressZip":"94117"},
    "front": "Your order shipped!",
    "back":  "Order #4417 is on its way. Track it at acme.example/4417.",
    "size":  "4x6"
  }'
```

### Response `200`

`{mailId, previewPdfBase64, expectedDelivery}` for a two-page proof: front artwork, then back with address block and postage box. The `payment` field mirrors the `X-PAYMENT-RESPONSE` header.

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

### Errors

`400 missing_body` when `front` or `back` is empty. `400 body_too_long` above 1,000 characters per side. An unrecognized `size` falls back to `4x6` rather than failing — you paid for a postcard and you get one.

---

## Free routes

### `GET /health`

```json
{
  "ok": true,
  "service": "x402-print-mail",
  "source": "fixture",
  "rails": [
    { "rail": "evm", "network": "base-sepolia" },
    { "rail": "solana", "network": "solana" }
  ]
}
```

### `GET /.well-known/x402`

The discovery manifest. Every resource entry carries its price and an `accepts` array with both rails. This is what [x402scan.com](https://x402scan.com), the x402 Bazaar and [agentic.market](https://agentic.market) index.

---

## The 402 challenge

```json
{
  "x402Version": 1,
  "error": "X-PAYMENT header is required",
  "accepts": [
    {
      "scheme": "exact",
      "network": "base-sepolia",
      "maxAmountRequired": "50000",
      "resource": "http://localhost:4024/letters",
      "description": "Send a physical letter and get the printed proof back in the response.",
      "mimeType": "application/json",
      "payTo": "0x40252CFDF8B20Ed757D61ff157719F33Ec332402",
      "maxTimeoutSeconds": 60,
      "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "extra": {
        "name": "USDC",
        "version": "2"
      }
    },
    {
      "scheme": "exact",
      "network": "solana",
      "maxAmountRequired": "50000",
      "resource": "http://localhost:4024/letters",
      "description": "Send a physical letter and get the printed proof back in the response.",
      "mimeType": "application/json",
      "payTo": "WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW",
      "maxTimeoutSeconds": 60,
      "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "extra": {
        "name": "USD Coin",
        "decimals": 6,
        "feePayer": "2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4",
        "amount": "50000"
      }
    }
  ]
}
```

Amounts are USDC atomic units (6 decimals): `"2000"` is `$0.002`.

## Settlement receipt

Successful paid responses carry `X-PAYMENT-RESPONSE`, base64 JSON:

```json
{
  "success": true,
  "rail": "evm",
  "network": "base-sepolia",
  "transaction": "0x…",
  "payer": "0x…",
  "amount": "50000",
  "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  "resource": "http://localhost:4024/letters"
}
```

The same object is echoed in the response body's `payment` field, so an agent that only reads JSON still gets its receipt.

## Error codes

| Code | HTTP | Meaning |
|---|---|---|
| `invalid_address` | 400 | `to` or `from` is missing `name`, `addressLine1`, `addressCity`, `addressState` or `addressZip` |
| `missing_body` | 400 | `body` (letters) or `front`/`back` (postcards) is empty |
| `body_too_long` | 400 | Body copy exceeds 20,000 characters, or postcard copy exceeds 1,000 |
| `invalid_mail_piece` | 400 | Lob rejected the address or the rendered content |
| `preview_unavailable` | 502 | Lob created the piece but the proof PDF could not be fetched — the message says where to retrieve it |
| `upstream_error` | 502 | The Lob API was unreachable or returned an unexpected error |
| `no_payment_rail` | 500 | Neither rail is configured on this instance |
| `facilitator_unreachable` | 502 | The rail's facilitator could not be reached to verify the payment |
| `settlement_error` | 502 | The payment verified but settlement failed — you were not charged |
