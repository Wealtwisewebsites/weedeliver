import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import {
  readStitchConfig,
  isStitchConfigured,
  toStitchAmount,
  amountsMatch,
  stitchStatusFromTypename,
  buildStitchRedirectUrl,
  verifyStitchWebhook,
  parseStitchWebhook,
  createStitchClient,
  type StitchConfig,
} from "./stitch.js";

const SECRET_BYTES = crypto.randomBytes(24);
const WEBHOOK_SECRET = `whsec_${SECRET_BYTES.toString("base64")}`;

function sign(id: string, timestamp: string, body: string, key: Buffer = SECRET_BYTES): string {
  return crypto.createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
}

const FULL_ENV = {
  STITCH_CLIENT_ID: "test-client",
  STITCH_CLIENT_SECRET: "test-secret",
  STITCH_WEBHOOK_SECRET: WEBHOOK_SECRET,
  STITCH_BENEFICIARY_NAME: "WeeDeliver (Pty) Ltd",
  STITCH_BENEFICIARY_BANK_ID: "fnb",
  STITCH_BENEFICIARY_ACCOUNT_NUMBER: "62000000000",
};

function webhookBody(state: string, overrides: Record<string, unknown> = {}): unknown {
  return {
    data: {
      client: {
        paymentInitiationRequests: {
          node: {
            __typename: "PaymentInitiationRequest",
            id: "cGF5cmVxLzEyMw==",
            externalReference: "payment-1",
            amount: { currency: "ZAR", quantity: "500" },
            state: { __typename: state },
            ...overrides,
          },
        },
      },
    },
  };
}

describe("readStitchConfig / isStitchConfigured", () => {
  it("reads every field from the environment and defaults to card + eft", () => {
    const config = readStitchConfig(FULL_ENV);
    assert.equal(config.clientId, "test-client");
    assert.equal(config.beneficiaryBankId, "fnb");
    assert.deepEqual(config.paymentMethods, ["card", "eft"]);
    assert.equal(isStitchConfigured(config), true);
  });

  it("is not configured when any credential, the webhook secret or a beneficiary field is missing", () => {
    for (const key of Object.keys(FULL_ENV)) {
      const config = readStitchConfig({ ...FULL_ENV, [key]: "  " });
      assert.equal(isStitchConfigured(config), false, `${key} blank should disable Stitch`);
    }
  });

  it("keeps only known payment methods and falls back to the default when none are valid", () => {
    assert.deepEqual(readStitchConfig({ ...FULL_ENV, STITCH_PAYMENT_METHODS: "eft" }).paymentMethods, ["eft"]);
    assert.deepEqual(readStitchConfig({ ...FULL_ENV, STITCH_PAYMENT_METHODS: " Card , bogus " }).paymentMethods, ["card"]);
    assert.deepEqual(readStitchConfig({ ...FULL_ENV, STITCH_PAYMENT_METHODS: "bogus" }).paymentMethods, ["card", "eft"]);
  });
});

describe("amounts", () => {
  it("sends rand amounts rounded to cents", () => {
    assert.equal(toStitchAmount(500), 500);
    assert.equal(toStitchAmount(12.3), 12.3);
    assert.equal(toStitchAmount(199.999), 200);
  });

  it("treats amounts within half a cent as equal", () => {
    assert.equal(amountsMatch(500, 500.004), true);
    assert.equal(amountsMatch(500, 499.99), false);
  });
});

describe("stitchStatusFromTypename", () => {
  it("maps Stitch payment request states to our statuses", () => {
    assert.equal(stitchStatusFromTypename("PaymentInitiationRequestCompleted"), "COMPLETED");
    assert.equal(stitchStatusFromTypename("PaymentInitiationRequestCancelled"), "CANCELLED");
    assert.equal(stitchStatusFromTypename("PaymentInitiationRequestExpired"), "EXPIRED");
    assert.equal(stitchStatusFromTypename("PaymentInitiationRequestPending"), "PENDING");
    assert.equal(stitchStatusFromTypename("SomethingNew"), "UNKNOWN");
    assert.equal(stitchStatusFromTypename(undefined), "UNKNOWN");
  });
});

describe("buildStitchRedirectUrl", () => {
  it("appends the URL-encoded redirect_uri to the payment request URL", () => {
    const url = buildStitchRedirectUrl(
      "https://secure.stitch.money/connect/payment-request/abc",
      "https://weedeliver.online/payment/callback?provider=stitch&paymentId=p1",
    );
    const parsed = new URL(url);
    assert.equal(parsed.origin + parsed.pathname, "https://secure.stitch.money/connect/payment-request/abc");
    assert.equal(parsed.searchParams.get("redirect_uri"), "https://weedeliver.online/payment/callback?provider=stitch&paymentId=p1");
  });

  it("keeps query parameters already on the payment request URL", () => {
    const url = buildStitchRedirectUrl("https://secure.stitch.money/x?a=1", "https://example.com/cb");
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get("a"), "1");
    assert.equal(parsed.searchParams.get("redirect_uri"), "https://example.com/cb");
  });
});

describe("verifyStitchWebhook", () => {
  const body = JSON.stringify(webhookBody("PaymentInitiationRequestCompleted"));
  const now = 1_760_000_000;
  const timestamp = String(now);
  const id = "msg_2abc";

  it("accepts a correctly signed, fresh webhook", () => {
    const signature = `v1,${sign(id, timestamp, body)}`;
    assert.equal(verifyStitchWebhook(body, { id, timestamp, signature }, WEBHOOK_SECRET, now), true);
  });

  it("accepts the header when one of several space-separated signatures matches", () => {
    const signature = `v1,${sign(id, timestamp, body, crypto.randomBytes(24))} v1,${sign(id, timestamp, body)}`;
    assert.equal(verifyStitchWebhook(body, { id, timestamp, signature }, WEBHOOK_SECRET, now), true);
  });

  it("rejects a tampered body", () => {
    const signature = `v1,${sign(id, timestamp, body)}`;
    assert.equal(verifyStitchWebhook(body.replace("500", "5"), { id, timestamp, signature }, WEBHOOK_SECRET, now), false);
  });

  it("rejects a signature made with a different secret", () => {
    const signature = `v1,${sign(id, timestamp, body, crypto.randomBytes(24))}`;
    assert.equal(verifyStitchWebhook(body, { id, timestamp, signature }, WEBHOOK_SECRET, now), false);
  });

  it("rejects a webhook older or newer than five minutes (replay protection)", () => {
    const signature = `v1,${sign(id, timestamp, body)}`;
    assert.equal(verifyStitchWebhook(body, { id, timestamp, signature }, WEBHOOK_SECRET, now + 301), false);
    assert.equal(verifyStitchWebhook(body, { id, timestamp, signature }, WEBHOOK_SECRET, now - 301), false);
  });

  it("rejects a secret too short to be a real signing key, even when the signature matches it", () => {
    const weakKey = crypto.randomBytes(8);
    const signature = `v1,${sign(id, timestamp, body, weakKey)}`;
    assert.equal(verifyStitchWebhook(body, { id, timestamp, signature }, `whsec_${weakKey.toString("base64")}`, now), false);
    assert.equal(verifyStitchWebhook(body, { id, timestamp, signature: `v1,${sign(id, timestamp, body, Buffer.alloc(0))}` }, "whsec_", now), false);
  });

  it("rejects missing headers, a missing secret and non-v1 signatures", () => {
    const sig = sign(id, timestamp, body);
    assert.equal(verifyStitchWebhook(body, { id: undefined, timestamp, signature: `v1,${sig}` }, WEBHOOK_SECRET, now), false);
    assert.equal(verifyStitchWebhook(body, { id, timestamp: undefined, signature: `v1,${sig}` }, WEBHOOK_SECRET, now), false);
    assert.equal(verifyStitchWebhook(body, { id, timestamp, signature: undefined }, WEBHOOK_SECRET, now), false);
    assert.equal(verifyStitchWebhook(body, { id, timestamp, signature: `v1,${sig}` }, "", now), false);
    assert.equal(verifyStitchWebhook(body, { id, timestamp, signature: `v2,${sig}` }, WEBHOOK_SECRET, now), false);
  });
});

describe("parseStitchWebhook", () => {
  it("reads id, reference, status and amount from a completed payment event", () => {
    assert.deepEqual(parseStitchWebhook(webhookBody("PaymentInitiationRequestCompleted")), {
      id: "cGF5cmVxLzEyMw==",
      externalReference: "payment-1",
      status: "COMPLETED",
      amount: 500,
    });
  });

  it("maps cancelled and expired events", () => {
    assert.equal(parseStitchWebhook(webhookBody("PaymentInitiationRequestCancelled"))?.status, "CANCELLED");
    assert.equal(parseStitchWebhook(webhookBody("PaymentInitiationRequestExpired"))?.status, "EXPIRED");
  });

  it("tolerates a missing reference and amount", () => {
    const event = parseStitchWebhook(webhookBody("PaymentInitiationRequestCompleted", { externalReference: null, amount: undefined }));
    assert.equal(event?.externalReference, null);
    assert.equal(event?.amount, null);
  });

  it("returns null for payloads that are not payment request events", () => {
    assert.equal(parseStitchWebhook(null), null);
    assert.equal(parseStitchWebhook({ data: { something: "else" } }), null);
    assert.equal(parseStitchWebhook("not json"), null);
  });
});

describe("createStitchClient", () => {
  const config: StitchConfig = readStitchConfig(FULL_ENV);

  /** GraphQL responses are bodies, or `{ httpStatus, body }` to simulate an HTTP error. */
  function fakeFetch(graphqlResponses: unknown[]) {
    const calls: { url: string; init: RequestInit }[] = [];
    let tokenCount = 0;
    const impl = async (url: string | URL | Request, init: RequestInit = {}): Promise<Response> => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith("/connect/token")) {
        tokenCount += 1;
        return new Response(JSON.stringify({ access_token: `tok-${tokenCount}`, expires_in: 3600, token_type: "Bearer" }), { status: 200 });
      }
      const next = graphqlResponses.shift() as { httpStatus?: number; body?: unknown } | undefined;
      if (next && typeof next.httpStatus === "number") {
        return new Response(JSON.stringify(next.body ?? {}), { status: next.httpStatus });
      }
      return new Response(JSON.stringify(next), { status: 200 });
    };
    return { calls, impl: impl as typeof fetch };
  }

  const pending = { data: { node: { id: "req-1", state: { __typename: "PaymentInitiationRequestPending" } } } };

  it("creates a payment request with the order amount, references, beneficiary and payment methods", async () => {
    const { calls, impl } = fakeFetch([{
      data: { clientPaymentInitiationRequestCreate: { paymentInitiationRequest: { id: "req-1", url: "https://secure.stitch.money/connect/payment-request/req-1" } } },
    }]);
    const client = createStitchClient(config, impl);

    const result = await client.createPaymentRequest({
      amountRands: 465.5,
      externalReference: "payment-1",
      payerReference: "WeeDeliver",
      beneficiaryReference: "WD-ABCD1234",
      payer: { id: "user-1", email: "buyer@example.com" },
      expireAt: new Date("2026-10-22T12:00:00.000Z"),
    });

    assert.deepEqual(result, { id: "req-1", url: "https://secure.stitch.money/connect/payment-request/req-1" });
    const tokenBody = new URLSearchParams(String(calls[0].init.body));
    assert.equal(tokenBody.get("grant_type"), "client_credentials");
    assert.equal(tokenBody.get("client_id"), "test-client");
    assert.equal(tokenBody.get("scope"), "client_paymentrequest");
    assert.equal(tokenBody.get("audience"), "https://secure.stitch.money/connect/token");

    assert.equal(calls[1].url, "https://api.stitch.money/graphql");
    assert.equal((calls[1].init.headers as Record<string, string>).Authorization, "Bearer tok-1");
    const { query, variables } = JSON.parse(String(calls[1].init.body));
    assert.match(query, /clientPaymentInitiationRequestCreate/);
    assert.match(query, /paymentMethods: \{ card: \{ enabled: true \}, eft: \{ enabled: true \} \}/);
    assert.deepEqual(variables.amount, { quantity: 465.5, currency: "ZAR" });
    assert.equal(variables.externalReference, "payment-1");
    assert.equal(variables.payerReference, "WeeDeliver");
    assert.equal(variables.beneficiaryReference, "WD-ABCD1234");
    assert.equal(variables.beneficiaryBankId, "fnb");
    assert.deepEqual(variables.payerInformation, { payerId: "user-1", email: "buyer@example.com" });
    assert.equal(variables.expireAt, "2026-10-22T12:00:00.000Z");
  });

  it("reuses a cached token for later calls", async () => {
    const { calls, impl } = fakeFetch([pending, pending]);
    const client = createStitchClient(config, impl);
    await client.getPaymentRequest("req-1");
    await client.getPaymentRequest("req-1");
    assert.equal(calls.filter(c => c.url.endsWith("/connect/token")).length, 1);
  });

  it("shares one token request between concurrent calls", async () => {
    const { calls, impl } = fakeFetch([pending, pending]);
    const client = createStitchClient(config, impl);
    await Promise.all([client.getPaymentRequest("req-1"), client.getPaymentRequest("req-1")]);
    assert.equal(calls.filter(c => c.url.endsWith("/connect/token")).length, 1);
  });

  it("drops the cached token after a 401 so the next call fetches a fresh one", async () => {
    const { calls, impl } = fakeFetch([{ httpStatus: 401, body: {} }, pending]);
    const client = createStitchClient(config, impl);
    await assert.rejects(() => client.getPaymentRequest("req-1"), /HTTP 401/);
    await client.getPaymentRequest("req-1");
    assert.equal(calls.filter(c => c.url.endsWith("/connect/token")).length, 2);
    assert.equal((calls.at(-1)!.init.headers as Record<string, string>).Authorization, "Bearer tok-2");
  });

  it("puts a timeout on every request to Stitch", async () => {
    const { calls, impl } = fakeFetch([pending]);
    const client = createStitchClient(config, impl);
    await client.getPaymentRequest("req-1");
    assert.equal(calls.length, 2);
    for (const call of calls) assert.ok(call.init.signal instanceof AbortSignal, `${call.url} has no timeout signal`);
  });

  it("refuses a paid amount in any currency other than rand", async () => {
    const { impl } = fakeFetch([{
      data: { node: { id: "req-1", state: { __typename: "PaymentInitiationRequestCompleted", amount: { quantity: "465.5", currency: "USD" } } } },
    }]);
    const client = createStitchClient(config, impl);
    assert.deepEqual(await client.getPaymentRequest("req-1"), { status: "COMPLETED", amount: null });
  });

  it("reads the status and paid amount of a payment request", async () => {
    const { impl } = fakeFetch([{
      data: { node: { id: "req-1", state: { __typename: "PaymentInitiationRequestCompleted", amount: { quantity: "465.5", currency: "ZAR" } } } },
    }]);
    const client = createStitchClient(config, impl);
    assert.deepEqual(await client.getPaymentRequest("req-1"), { status: "COMPLETED", amount: 465.5 });
  });

  it("throws when Stitch returns GraphQL errors", async () => {
    const { impl } = fakeFetch([{ errors: [{ message: "Beneficiary not allowed" }] }]);
    const client = createStitchClient(config, impl);
    await assert.rejects(() => client.getPaymentRequest("req-1"), /Beneficiary not allowed/);
  });

  it("throws when the token request is rejected", async () => {
    const impl = (async () => new Response(JSON.stringify({ error: "invalid_client" }), { status: 400 })) as typeof fetch;
    const client = createStitchClient(config, impl);
    await assert.rejects(() => client.getPaymentRequest("req-1"), /token request failed \(HTTP 400\)/);
  });
});
