/**
 * Per-route x402 schemas — GENERATED FROM `openapi.json`, do not edit by hand.
 *
 * The x402 challenge a paid route answers with has to tell an agent two things
 * it cannot guess: how to call the route, and what it gets back for its money.
 * Both live under `accepts[].outputSchema` in the x402 Bazaar shape:
 *
 *     outputSchema.input   how to invoke  (method + path/query params or JSON body fields)
 *     outputSchema.output  the JSON Schema of the 200/201 body
 *
 * Keys match the paywall route map in `server.ts` exactly, so a route is
 * declared once and its schema is spread in:
 *
 *     "POST /thing": { price: "$0.01", description: "…", ...ROUTE_SCHEMAS["POST /thing"] }
 *
 * Everything here is copied verbatim from this service's OpenAPI document, so
 * the runtime 402 and the published spec can never drift apart.
 */

/** How an agent invokes a paid route. */
export type X402Input = {
  type: "http";
  method: string;
  /** Path segments, e.g. `:id` in `/cases/:id`. */
  pathParams?: Record<string, unknown>;
  queryParams?: Record<string, unknown>;
  queryRequired?: string[];
  bodyType?: "json";
  /** JSON Schema properties of the request body. */
  bodyFields?: Record<string, unknown>;
  bodyRequired?: string[];
};

/** The `outputSchema` object published in every `accepts[]` entry. */
export type X402RouteSchema = {
  input: X402Input;
  /** JSON Schema of the success response body. */
  output: Record<string, unknown>;
};

export type RouteSchemaEntry = { outputSchema: X402RouteSchema };

export const ROUTE_SCHEMAS: Record<string, RouteSchemaEntry> = {
  "POST /letters": {
    "outputSchema": {
      "input": {
        "type": "http",
        "method": "POST",
        "bodyType": "json",
        "bodyFields": {
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
            }
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
            }
          },
          "body": {
            "type": "string"
          },
          "color": {
            "type": "boolean"
          },
          "doubleSided": {
            "type": "boolean"
          },
          "mailType": {
            "type": "string"
          }
        }
      },
      "output": {
        "type": "object",
        "properties": {
          "source": {
            "type": "string"
          },
          "testMode": {
            "type": "boolean"
          },
          "mailId": {
            "type": "string"
          },
          "type": {
            "type": "string"
          },
          "createdAt": {
            "type": "string"
          },
          "expectedDelivery": {
            "type": "string"
          },
          "carrier": {
            "type": "string"
          },
          "mailType": {
            "type": "string"
          },
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
            }
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
            }
          },
          "pageCount": {
            "type": "integer"
          },
          "color": {
            "type": "boolean"
          },
          "doubleSided": {
            "type": "boolean"
          },
          "previewFormat": {
            "type": "string"
          },
          "previewPdfBase64": {
            "type": "string"
          },
          "previewUrl": {
            "type": [
              "null",
              "string"
            ]
          },
          "thumbnails": {
            "type": "array",
            "items": {}
          },
          "payment": {
            "type": "object",
            "properties": {
              "success": {
                "type": "boolean"
              },
              "rail": {
                "type": "string"
              },
              "network": {
                "type": "string"
              },
              "transaction": {
                "type": "string"
              },
              "payer": {
                "type": "string"
              },
              "amount": {
                "type": "string"
              },
              "asset": {
                "type": "string"
              },
              "resource": {
                "type": "string"
              }
            }
          }
        }
      }
    }
  },
  "POST /postcards": {
    "outputSchema": {
      "input": {
        "type": "http",
        "method": "POST",
        "bodyType": "json",
        "bodyFields": {
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
            }
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
            }
          },
          "front": {
            "type": "string"
          },
          "back": {
            "type": "string"
          },
          "size": {
            "type": "string"
          }
        }
      },
      "output": {
        "type": "object",
        "properties": {
          "source": {
            "type": "string"
          },
          "testMode": {
            "type": "boolean"
          },
          "mailId": {
            "type": "string"
          },
          "type": {
            "type": "string"
          },
          "createdAt": {
            "type": "string"
          },
          "expectedDelivery": {
            "type": "string"
          },
          "carrier": {
            "type": "string"
          },
          "mailType": {
            "type": "string"
          },
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
            }
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
            }
          },
          "pageCount": {
            "type": "integer"
          },
          "color": {
            "type": "boolean"
          },
          "doubleSided": {
            "type": "boolean"
          },
          "previewFormat": {
            "type": "string"
          },
          "previewPdfBase64": {
            "type": "string"
          },
          "previewUrl": {
            "type": [
              "null",
              "string"
            ]
          },
          "thumbnails": {
            "type": "array",
            "items": {}
          },
          "payment": {
            "type": "object",
            "properties": {
              "success": {
                "type": "boolean"
              },
              "rail": {
                "type": "string"
              },
              "network": {
                "type": "string"
              },
              "transaction": {
                "type": "string"
              },
              "payer": {
                "type": "string"
              },
              "amount": {
                "type": "string"
              },
              "asset": {
                "type": "string"
              },
              "resource": {
                "type": "string"
              }
            }
          }
        }
      }
    }
  }
};
