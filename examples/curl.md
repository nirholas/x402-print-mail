# Raw HTTP walkthrough — x402-print-mail

The full 402 → pay → 200 flow with nothing but `curl`. Start the server first:

```bash
npm run dev   # http://localhost:4024
```

## 0. Free routes need no payment

```bash
curl -s http://localhost:4024/health
curl -s http://localhost:4024/.well-known/x402
```

## 1. Ask without paying → `402`

```bash
curl -i -X POST http://localhost:4024/letters \
  -H 'Content-Type: application/json' \
  -d '{"to":{"name":"Dana Reyes","addressLine1":"1600 Pennsylvania Ave NW","addressCity":"Washington","addressState":"DC","addressZip":"20500"},"from":{"name":"Acme Robotics","addressLine1":"215 Clayton St","addressCity":"San Francisco","addressState":"CA","addressZip":"94117"},"body":"Dear Dana,\n\nYour order shipped today.\n\nSincerely,\nAcme"}'
```

```http
HTTP/1.1 402 Payment Required
Content-Type: application/json
```

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

**Both rails, one challenge.** Pick either entry:

- the `base-sepolia` entry → sign an EIP-3009 USDC authorization
- the `solana` entry → sign an SPL `transferChecked`

`maxAmountRequired` is in USDC atomic units (6 decimals), so `"50000"` = `$0.05`.

## 2a. Pay on Base (EVM)

The EIP-3009 signature is produced by your wallet, so this step isn't a `curl`. The payload you base64-encode into `X-PAYMENT` looks like:

```json
{
  "x402Version": 1,
  "scheme": "exact",
  "network": "base-sepolia",
  "payload": {
    "signature": "0x…",
    "authorization": {
      "from": "0xYourWallet",
      "to": "0x40252CFDF8B20Ed757D61ff157719F33Ec332402",
      "value": "50000",
      "validAfter": "0",
      "validBefore": "1893456000",
      "nonce": "0x…"
    }
  }
}
```

```bash
X_PAYMENT=$(printf '%s' "$PAYLOAD_JSON" | base64 -w0)
```

In practice let [`x402-fetch`](https://www.npmjs.com/package/x402-fetch) build it — see [`agent-client.ts`](agent-client.ts).

## 2b. Pay on Solana

Solana wallets sign serialized transactions, so the server builds one:

```bash
# Save the solana accept from step 1
ACCEPT='{"scheme":"exact","network":"solana","amount":"50000","asset":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","payTo":"WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW","extra":{"name":"USD Coin","decimals":6,"feePayer":"2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4"}}'

# Build the unsigned transfer
curl -s -X POST 'http://localhost:4024/api/x402-checkout?action=prepare' \
  -H 'content-type: application/json' \
  -d "{\"accept\": $ACCEPT, \"buyer\": \"YOUR_BASE58_PUBKEY\"}"
# → { "network": "solana", "tx_base64": "…", "recent_blockhash": "…" }

# …sign tx_base64 in your wallet, then wrap it…
curl -s -X POST 'http://localhost:4024/api/x402-checkout?action=encode' \
  -H 'content-type: application/json' \
  -d "{\"accept\": $ACCEPT, \"signed_tx_base64\": \"SIGNED_TX\", \"resource_url\": \"http://localhost:4024/letters\"}"
# → { "x_payment": "…" }
```

The `feePayer` sponsor pays the SOL network fee — you only need USDC.

## 3. Retry with the header → `200`

```bash
curl -sD - -X POST http://localhost:4024/letters \
  -H 'Content-Type: application/json' \
  -d '{
    "to":   {"name":"Dana Reyes","addressLine1":"1600 Pennsylvania Ave NW","addressCity":"Washington","addressState":"DC","addressZip":"20500"},
    "from": {"name":"Acme Robotics","addressLine1":"215 Clayton St","addressCity":"San Francisco","addressState":"CA","addressZip":"94117"},
    "body": "Dear Dana,\n\nYour order #4417 shipped today.\n\nSincerely,\nAcme Robotics"
  }' > letter.json

# The proof is already in the response — write it to disk, no second request.
node -e 'require("fs").writeFileSync("letter.pdf",Buffer.from(require("./letter.json").previewPdfBase64,"base64"))'
```

```http
HTTP/1.1 200 OK
X-PAYMENT-RESPONSE: eyJzdWNjZXNzIjp0cnVlLCJyYWlsIjoiZXZtIiwi…
```

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

Decode the receipt header:

```bash
echo "$RESPONSE_HEADER" | base64 -d
# {"success":true,"rail":"evm","network":"base-sepolia","transaction":"0x…","payer":"0x…"}
```

The same object is in the body's `payment` field, so you can skip the header entirely.

## Other routes

### `POST /postcards` — $0.03

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

## Errors you may hit

| Body `error` | HTTP | Fix |
|---|---|---|
| `invalid_address` | 400 | `to` or `from` is missing `name`, `addressLine1`, `addressCity`, `addressState` or `addressZip` |
| `missing_body` | 400 | `body` (letters) or `front`/`back` (postcards) is empty |
| `body_too_long` | 400 | Body copy exceeds 20,000 characters, or postcard copy exceeds 1,000 |
| `invalid_mail_piece` | 400 | Lob rejected the address or the rendered content |
| `preview_unavailable` | 502 | Lob created the piece but the proof PDF could not be fetched — the message says where to retrieve it |
| `upstream_error` | 502 | The Lob API was unreachable or returned an unexpected error |
| `facilitator_unreachable` | 502 | The facilitator is down or unreachable — retry; you were not charged |
