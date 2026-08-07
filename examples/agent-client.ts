/**
 * x402-print-mail — a complete paid call, end to end.
 *
 *   PRIVATE_KEY=0x... npm run client
 *
 * `wrapFetchWithPayment` intercepts the 402, signs an EIP-3009 USDC
 * authorization for exactly the quoted amount, and replays the request with the
 * `X-PAYMENT` header. You never write the retry loop.
 *
 * Fund the key with base-sepolia USDC: https://faucet.circle.com
 *
 * Prefer the Solana rail? See the commented section at the bottom — the same
 * 402 challenge carries a `solana` accept, and the server exposes the two
 * checkout helpers a Solana wallet needs.
 */

import { writeFileSync } from "node:fs";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment } from "x402-fetch";

const BASE_URL = process.env.PRINT_MAIL_URL ?? "http://localhost:4024";

function decodeReceipt(header: string | null): unknown {
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  } catch {
    return header;
  }
}

async function main(): Promise<void> {
  // ── Step 1: see the challenge ─────────────────────────────────────────────
  // A plain fetch with no payment shows what the server wants. Both rails are
  // always listed; a client picks whichever wallet it holds.
  const unpaid = await fetch(new URL("/letters", BASE_URL), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({"to":{"name":"Dana Reyes","addressLine1":"1600 Pennsylvania Ave NW","addressCity":"Washington","addressState":"DC","addressZip":"20500","addressCountry":"US"},"from":{"name":"Acme Robotics","company":"Acme Robotics Inc","addressLine1":"215 Clayton St","addressCity":"San Francisco","addressState":"CA","addressZip":"94117","addressCountry":"US"},"body":"Dear Dana,\n\nYour order #4417 shipped today and should arrive by the end of the week. The tracking number is on the enclosed slip.\n\nThank you for your business.\n\nSincerely,\nAcme Robotics","color":false,"doubleSided":true,"mailType":"usps_first_class"}) });
  if (unpaid.status === 402) {
    const challenge = (await unpaid.json()) as { accepts: Array<{ network: string; maxAmountRequired: string; payTo: string }> };
    console.log("402 challenge — accepted rails:");
    for (const a of challenge.accepts) {
      console.log(`  ${a.network.padEnd(14)} ${a.maxAmountRequired.padStart(8)} atomic USDC → ${a.payTo}`);
    }
    console.log();
  }

  const key = process.env.PRIVATE_KEY as `0x${string}` | undefined;
  if (!key) {
    console.error("Set PRIVATE_KEY to a base-sepolia key holding testnet USDC (https://faucet.circle.com).");
    console.error("Without it this script can only show the 402 challenge above.");
    process.exit(1);
  }

  // ── Step 2: pay and get the artifact ──────────────────────────────────────
  const payFetch = wrapFetchWithPayment(fetch, privateKeyToAccount(key));

  const to = {
      "name": "Dana Reyes",
      "addressLine1": "1600 Pennsylvania Ave NW",
      "addressCity": "Washington",
      "addressState": "DC",
      "addressZip": "20500",
      "addressCountry": "US"
  };
  const from = {
      "name": "Acme Robotics",
      "company": "Acme Robotics Inc",
      "addressLine1": "215 Clayton St",
      "addressCity": "San Francisco",
      "addressState": "CA",
      "addressZip": "94117",
      "addressCountry": "US"
  };

  // Put paper in someone's mailbox — $0.05
  const letterRes = await payFetch(new URL("/letters", BASE_URL).toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to,
      from,
      body: "Dear Dana,\n\nYour order #4417 shipped today and should arrive by the end of the week. The tracking number is on the enclosed slip.\n\nThank you for your business.\n\nSincerely,\nAcme Robotics",
    }),
  });
  const letter = (await letterRes.json()) as {
    source: string;
    testMode: boolean;
    mailId: string;
    pageCount: number;
    expectedDelivery: string;
    previewPdfBase64: string;
  };
  writeFileSync("letter.pdf", Buffer.from(letter.previewPdfBase64, "base64"));
  console.log(`\nletter ${letter.mailId} (source: ${letter.source}, testMode: ${letter.testMode})`);
  console.log(`  ${letter.pageCount} page(s), arrives by ${letter.expectedDelivery}`);
  console.log(`  proof:  letter.pdf (${Buffer.from(letter.previewPdfBase64, "base64").length} bytes, written from the response body)`);
  console.log("receipt:", decodeReceipt(letterRes.headers.get("X-PAYMENT-RESPONSE")));

  // Or a postcard — $0.03
  const cardRes = await payFetch(new URL("/postcards", BASE_URL).toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to,
      from,
      front: "Your order shipped!",
      back: "Order #4417 is on its way. Track it at acme.example/4417.",
      size: "4x6",
    }),
  });
  const card = (await cardRes.json()) as { mailId: string; expectedDelivery: string; previewPdfBase64: string };
  writeFileSync("postcard.pdf", Buffer.from(card.previewPdfBase64, "base64"));
  console.log(`\npostcard ${card.mailId} arrives by ${card.expectedDelivery} — proof written to postcard.pdf`);
  console.log("receipt:", decodeReceipt(cardRes.headers.get("X-PAYMENT-RESPONSE")));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/* ─────────────────────────────────────────────────────────────────────────────
 * Paying on Solana instead
 * ─────────────────────────────────────────────────────────────────────────────
 * The same 402 body carries a `solana` accept. A Solana wallet signs a
 * serialized SPL transfer rather than typed data, so the server builds it:
 *
 *   const { accepts } = await (await fetch(url)).json();
 *   const accept = accepts.find((a) => a.network === "solana");
 *
 *   // 1. Build the unsigned transfer
 *   const prep = await fetch(`${BASE_URL}/api/x402-checkout?action=prepare`, {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify({ accept, buyer: myBase58Pubkey }),
 *   }).then((r) => r.json());              // → { tx_base64, recent_blockhash }
 *
 *   // 2. Sign tx_base64 with your wallet (Phantom, @solana/web3.js, ...)
 *   const signedTxBase64 = await wallet.signTransaction(prep.tx_base64);
 *
 *   // 3. Wrap it into the X-PAYMENT header
 *   const { x_payment } = await fetch(`${BASE_URL}/api/x402-checkout?action=encode`, {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify({ accept, signed_tx_base64: signedTxBase64, resource_url: accept.resource }),
 *   }).then((r) => r.json());
 *
 *   // 4. Retry the original request
 *   const res = await fetch(url, { headers: { "X-PAYMENT": x_payment } });
 *
 * `accept.extra.feePayer` is a facilitator sponsor account that pays the SOL
 * network fee, so the agent's wallet needs only USDC.
 *
 * In a browser, @three-ws/x402-payment-modal does all four steps from one
 * <button> — for both rails.
 *
 * And the raw dual-rail 402 body, for reference:
 *
 *   $ curl -s -X POST http://localhost:4024/letters \
  -H 'Content-Type: application/json' \
  -d '{"to":{"name":"Dana Reyes","addressLine1":"1600 Pennsylvania Ave NW","addressCity":"Washington","addressState":"DC","addressZip":"20500"},"from":{"name":"Acme Robotics","addressLine1":"215 Clayton St","addressCity":"San Francisco","addressState":"CA","addressZip":"94117"},"body":"Dear Dana,\n\nYour order shipped today.\n\nSincerely,\nAcme"}'
 *   {
 *     "x402Version": 1,
 *     "error": "X-PAYMENT header is required",
 *     "accepts": [
 *       {
 *         "scheme": "exact",
 *         "network": "base-sepolia",
 *         "maxAmountRequired": "50000",
 *         "resource": "http://localhost:4024/letters",
 *         "description": "Send a physical letter and get the printed proof back in the response.",
 *         "mimeType": "application/json",
 *         "payTo": "0x40252CFDF8B20Ed757D61ff157719F33Ec332402",
 *         "maxTimeoutSeconds": 60,
 *         "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
 *         "extra": {
 *           "name": "USDC",
 *           "version": "2"
 *         }
 *       },
 *       {
 *         "scheme": "exact",
 *         "network": "solana",
 *         "maxAmountRequired": "50000",
 *         "resource": "http://localhost:4024/letters",
 *         "description": "Send a physical letter and get the printed proof back in the response.",
 *         "mimeType": "application/json",
 *         "payTo": "WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW",
 *         "maxTimeoutSeconds": 60,
 *         "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
 *         "extra": {
 *           "name": "USD Coin",
 *           "decimals": 6,
 *           "feePayer": "2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4",
 *           "amount": "50000"
 *         }
 *       }
 *     ]
 *   }
 */
