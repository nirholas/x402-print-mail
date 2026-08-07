# Expose x402-print-mail as an MCP tool

[MCP](https://modelcontextprotocol.io) lets Claude (and other MCP clients) call this service directly. The payment is invisible to the model: the wrapper handles the 402 and returns only the artifact.

## Install

```bash
npm install @modelcontextprotocol/sdk x402-fetch viem
```

## `mcp-server.ts`

```ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { writeFileSync } from "node:fs";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment } from "x402-fetch";

const BASE_URL = process.env.PRINT_MAIL_URL ?? "http://localhost:4024";

// One wallet, reused for every tool call. On base-sepolia this is testnet USDC.
const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const payFetch = wrapFetchWithPayment(fetch, account);

const TOOLS = [
  {
    name: "print_mail_send_letter",
    description: "Send a physical letter and get the printed proof back in the response. Costs $0.05 in USDC (paid automatically via x402).",
    inputSchema: {
          "type": "object",
          "properties": {
                "to": {
                      "type": "object",
                      "properties": {
                            "name": {
                                  "type": "string"
                            },
                            "addressLine1": {
                                  "type": "string"
                            },
                            "addressCity": {
                                  "type": "string"
                            },
                            "addressState": {
                                  "type": "string"
                            },
                            "addressZip": {
                                  "type": "string"
                            },
                            "addressCountry": {
                                  "type": "string"
                            }
                      },
                      "description": "See skill.md for the full shape of `to`."
                },
                "from": {
                      "type": "object",
                      "properties": {
                            "name": {
                                  "type": "string"
                            },
                            "company": {
                                  "type": "string"
                            },
                            "addressLine1": {
                                  "type": "string"
                            },
                            "addressCity": {
                                  "type": "string"
                            },
                            "addressState": {
                                  "type": "string"
                            },
                            "addressZip": {
                                  "type": "string"
                            },
                            "addressCountry": {
                                  "type": "string"
                            }
                      },
                      "description": "See skill.md for the full shape of `from`."
                },
                "body": {
                      "type": "string",
                      "description": "See skill.md for the full shape of `body`."
                },
                "color": {
                      "type": "boolean",
                      "description": "See skill.md for the full shape of `color`."
                },
                "doubleSided": {
                      "type": "boolean",
                      "description": "See skill.md for the full shape of `doubleSided`."
                },
                "mailType": {
                      "type": "string",
                      "description": "See skill.md for the full shape of `mailType`."
                }
          },
          "required": [
                "to",
                "from",
                "body",
                "color",
                "doubleSided",
                "mailType"
          ]
    },
  },
  {
    name: "print_mail_send_postcard",
    description: "Send a physical postcard and get the two-sided proof back in the response. Costs $0.03 in USDC (paid automatically via x402).",
    inputSchema: {
          "type": "object",
          "properties": {
                "to": {
                      "type": "object",
                      "properties": {
                            "name": {
                                  "type": "string"
                            },
                            "addressLine1": {
                                  "type": "string"
                            },
                            "addressCity": {
                                  "type": "string"
                            },
                            "addressState": {
                                  "type": "string"
                            },
                            "addressZip": {
                                  "type": "string"
                            },
                            "addressCountry": {
                                  "type": "string"
                            }
                      },
                      "description": "See skill.md for the full shape of `to`."
                },
                "from": {
                      "type": "object",
                      "properties": {
                            "name": {
                                  "type": "string"
                            },
                            "company": {
                                  "type": "string"
                            },
                            "addressLine1": {
                                  "type": "string"
                            },
                            "addressCity": {
                                  "type": "string"
                            },
                            "addressState": {
                                  "type": "string"
                            },
                            "addressZip": {
                                  "type": "string"
                            },
                            "addressCountry": {
                                  "type": "string"
                            }
                      },
                      "description": "See skill.md for the full shape of `from`."
                },
                "front": {
                      "type": "string",
                      "description": "See skill.md for the full shape of `front`."
                },
                "back": {
                      "type": "string",
                      "description": "See skill.md for the full shape of `back`."
                },
                "size": {
                      "type": "string",
                      "description": "See skill.md for the full shape of `size`."
                }
          },
          "required": [
                "to",
                "from",
                "front",
                "back",
                "size"
          ]
    },
  },
];

const server = new Server({ name: "x402-print-mail", version: "0.1.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const args = (req.params.arguments ?? {}) as Record<string, unknown>;
  let res: Response;

  switch (req.params.name) {
    case "print_mail_send_letter": {
      res = await payFetch(new URL("/letters", BASE_URL).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      break;
    }
    case "print_mail_send_postcard": {
      res = await payFetch(new URL("/postcards", BASE_URL).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      break;
    }
    default:
      throw new Error(`unknown tool: ${req.params.name}`);
  }

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`x402-print-mail ${res.status}: ${detail}`);
  }

  // The artifact is the 200 body — hand it straight to the model.
  return { content: [{ type: "text", text: await res.text() }] };
});

await server.connect(new StdioServerTransport());
```

## Register it with Claude Desktop

```json
{
  "mcpServers": {
    "x402-print-mail": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/mcp-server.ts"],
      "env": {
        "PRIVATE_KEY": "0xYourFundedKey",
        "PRINT_MAIL_URL": "http://localhost:4024"
      }
    }
  }
}
```

## Notes

- **Budget the wallet.** Every tool call spends real USDC (POST /letters = $0.05, POST /postcards = $0.03). Fund the key with only what a session should be allowed to spend — that cap is your real spending limit.
- **Both rails work.** The example uses the EVM rail because `x402-fetch` handles it in one wrapper. For a Solana-funded agent, use the `/api/x402-checkout` helpers described in [`curl.md`](curl.md) and set the `X-PAYMENT` header yourself.
- **Receipts.** `res.headers.get("X-PAYMENT-RESPONSE")` (base64 JSON) is the settlement proof; the body's `payment` field carries the same thing if you'd rather log the parsed artifact.
- **Point the model at [`skill.md`](../skill.md)** as a resource so it knows the response schemas without a trial call.
