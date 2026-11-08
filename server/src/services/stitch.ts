import crypto from "crypto";

// ─── Stitch (stitch.money) payment requests ───
// Docs: https://docs.stitch.money — OAuth client-credentials token, then a GraphQL
// `clientPaymentInitiationRequestCreate` that returns a hosted payment page URL (card and/or
// Pay by Bank). Webhooks are delivered by Svix and are the source of truth for payment status.

const TOKEN_URL = "https://secure.stitch.money/connect/token";
const GRAPHQL_URL = "https://api.stitch.money/graphql";
const TOKEN_SCOPE = "client_paymentrequest";
const TOKEN_REFRESH_MARGIN_MS = 60_000;
const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;
/** A real Svix signing key is 24+ random bytes; anything shorter is a misconfiguration. */
const MIN_WEBHOOK_KEY_BYTES = 16;
const HTTP_TIMEOUT_MS = 10_000;
const AMOUNT_TOLERANCE_RANDS = 0.005;
const DEFAULT_PAYMENT_METHODS: readonly StitchPaymentMethod[] = ["card", "eft"];

export type StitchPaymentMethod = "card" | "eft";
export type StitchPaymentStatus = "COMPLETED" | "CANCELLED" | "EXPIRED" | "PENDING" | "UNKNOWN";

export interface StitchConfig {
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
  beneficiaryName: string;
  beneficiaryBankId: string;
  beneficiaryAccountNumber: string;
  paymentMethods: StitchPaymentMethod[];
}

export interface StitchPaymentRequestInput {
  amountRands: number;
  externalReference: string;
  payerReference: string;
  beneficiaryReference: string;
  payer: { id: string; email?: string };
  expireAt: Date;
}

export interface StitchPaymentRequest {
  id: string;
  url: string;
}

export interface StitchPaymentResult {
  status: StitchPaymentStatus;
  amount: number | null;
}

export interface StitchWebhookEvent extends StitchPaymentResult {
  id: string;
  externalReference: string | null;
}

export interface StitchWebhookHeaders {
  id: string | undefined;
  timestamp: string | undefined;
  signature: string | undefined;
}

type Env = Record<string, string | undefined>;

export function readStitchConfig(env: Env = process.env): StitchConfig {
  const value = (key: string) => (env[key] || "").trim();
  const methods = value("STITCH_PAYMENT_METHODS")
    .split(",")
    .map(m => m.trim().toLowerCase())
    .filter((m): m is StitchPaymentMethod => m === "card" || m === "eft");
  return {
    clientId: value("STITCH_CLIENT_ID"),
    clientSecret: value("STITCH_CLIENT_SECRET"),
    webhookSecret: value("STITCH_WEBHOOK_SECRET"),
    beneficiaryName: value("STITCH_BENEFICIARY_NAME"),
    beneficiaryBankId: value("STITCH_BENEFICIARY_BANK_ID"),
    beneficiaryAccountNumber: value("STITCH_BENEFICIARY_ACCOUNT_NUMBER"),
    paymentMethods: methods.length > 0 ? methods : [...DEFAULT_PAYMENT_METHODS],
  };
}

/**
 * True when Stitch can take payments end to end: credentials, the account that receives funds,
 * and the webhook secret — without it a payer who closes the tab would be charged but never confirmed.
 */
export function isStitchConfigured(config: StitchConfig): boolean {
  return Boolean(
    config.clientId && config.clientSecret && config.webhookSecret &&
    config.beneficiaryName && config.beneficiaryBankId && config.beneficiaryAccountNumber,
  );
}

/** Stitch amounts are decimal rands (`{ quantity, currency: "ZAR" }`), rounded to cents. */
export function toStitchAmount(rands: number): number {
  return Math.round(rands * 100) / 100;
}

export function amountsMatch(a: number, b: number): boolean {
  return Math.abs(a - b) < AMOUNT_TOLERANCE_RANDS;
}

export function stitchStatusFromTypename(typename: string | undefined): StitchPaymentStatus {
  switch (typename) {
    case "PaymentInitiationRequestCompleted": return "COMPLETED";
    case "PaymentInitiationRequestCancelled": return "CANCELLED";
    case "PaymentInitiationRequestExpired": return "EXPIRED";
    case "PaymentInitiationRequestPending": return "PENDING";
    default: return "UNKNOWN";
  }
}

/** Stitch sends the payer back to `redirect_uri` (an allow-listed URL) with id/status appended. */
export function buildStitchRedirectUrl(paymentUrl: string, redirectUri: string): string {
  const url = new URL(paymentUrl);
  url.searchParams.set("redirect_uri", redirectUri);
  return url.toString();
}

/**
 * Verify a Svix-signed Stitch webhook: HMAC-SHA256 over `${svix-id}.${svix-timestamp}.${rawBody}`,
 * keyed with the base64 part of the `whsec_` secret, compared against each `v1,<sig>` in the header.
 */
export function verifyStitchWebhook(
  rawBody: string,
  headers: StitchWebhookHeaders,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  const { id, timestamp, signature } = headers;
  if (!secret || !id || !timestamp || !signature) return false;

  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(nowSeconds - sentAt) > WEBHOOK_TOLERANCE_SECONDS) return false;

  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret, "base64");
  if (key.length < MIN_WEBHOOK_KEY_BYTES) return false;
  const expected = crypto.createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest();

  return signature.split(" ").some(entry => {
    const [version, value] = entry.split(",");
    if (version !== "v1" || !value) return false;
    const given = Buffer.from(value, "base64");
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Stitch money values arrive as `{ quantity, currency }`; only rand amounts are accepted. */
function parseMoney(value: unknown): number | null {
  if (!isRecord(value)) return null;
  if (value.currency !== undefined && value.currency !== "ZAR") return null;
  const quantity = Number(value.quantity);
  return Number.isFinite(quantity) ? quantity : null;
}

/** Depth-first search for the PaymentInitiationRequest node, wherever Stitch nests it. */
function findPaymentRequestNode(value: unknown, depth = 0): Record<string, unknown> | null {
  if (!isRecord(value) || depth > 6) return null;
  if (value.__typename === "PaymentInitiationRequest" && typeof value.id === "string") return value;
  for (const child of Object.values(value)) {
    const found = findPaymentRequestNode(child, depth + 1);
    if (found) return found;
  }
  return null;
}

/** Extract the payment request from a `payment` webhook; null for any other payload. */
export function parseStitchWebhook(body: unknown): StitchWebhookEvent | null {
  const node = findPaymentRequestNode(body);
  if (!node) return null;
  const state = isRecord(node.state) ? node.state : {};
  return {
    id: node.id as string,
    externalReference: typeof node.externalReference === "string" ? node.externalReference : null,
    status: stitchStatusFromTypename(typeof state.__typename === "string" ? state.__typename : undefined),
    amount: parseMoney(node.amount) ?? parseMoney(state.amount),
  };
}

/**
 * Stitch documents `paymentMethods` only as an inline literal, so it is written into the
 * mutation from the whitelisted method names rather than passed as a variable.
 */
function createPaymentRequestMutation(methods: readonly StitchPaymentMethod[]): string {
  const paymentMethods = methods.map(m => `${m}: { enabled: true }`).join(", ");
  return `
mutation CreatePaymentRequest(
  $amount: MoneyInput!,
  $externalReference: String,
  $payerReference: String!,
  $beneficiaryReference: String!,
  $beneficiaryName: String!,
  $beneficiaryBankId: BankBeneficiaryBankId!,
  $beneficiaryAccountNumber: String!,
  $expireAt: Date,
  $payerInformation: PayerInformationInput
) {
  clientPaymentInitiationRequestCreate(input: {
    amount: $amount,
    externalReference: $externalReference,
    payerReference: $payerReference,
    beneficiaryReference: $beneficiaryReference,
    beneficiary: { bankAccount: { name: $beneficiaryName, bankId: $beneficiaryBankId, accountNumber: $beneficiaryAccountNumber } },
    expireAt: $expireAt,
    payerInformation: $payerInformation,
    paymentMethods: { ${paymentMethods} }
  }) {
    paymentInitiationRequest { id url }
  }
}`;
}

const GET_PAYMENT_REQUEST = `
query GetPaymentRequest($id: ID!) {
  node(id: $id) {
    ... on PaymentInitiationRequest {
      id
      state {
        __typename
        ... on PaymentInitiationRequestCompleted { date amount }
      }
    }
  }
}`;

export interface StitchClient {
  createPaymentRequest(input: StitchPaymentRequestInput): Promise<StitchPaymentRequest>;
  getPaymentRequest(id: string): Promise<StitchPaymentResult>;
}

/** API client with its own cached client token (Stitch asks callers not to mint one per request). */
export function createStitchClient(config: StitchConfig, fetchImpl: typeof fetch = fetch): StitchClient {
  let token: { value: string; expiresAt: number } | null = null;
  let tokenInFlight: Promise<string> | null = null;

  function getToken(): Promise<string> {
    if (token && Date.now() < token.expiresAt - TOKEN_REFRESH_MARGIN_MS) return Promise.resolve(token.value);
    // Concurrent callers (webhook + return-page verify) share one token request.
    tokenInFlight ??= fetchToken().finally(() => { tokenInFlight = null; });
    return tokenInFlight;
  }

  async function fetchToken(): Promise<string> {
    const res = await fetchImpl(TOKEN_URL, {
      method: "POST",
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        scope: TOKEN_SCOPE,
        audience: TOKEN_URL,
      }).toString(),
    });
    const data: unknown = await res.json().catch(() => ({}));
    if (!res.ok || !isRecord(data) || typeof data.access_token !== "string") {
      throw new Error(`Stitch token request failed (HTTP ${res.status})`);
    }
    const lifetimeSeconds = Number(data.expires_in) || 3600;
    token = { value: data.access_token, expiresAt: Date.now() + lifetimeSeconds * 1000 };
    return token.value;
  }

  async function graphql(query: string, variables: Record<string, unknown>): Promise<Record<string, unknown>> {
    const res = await fetchImpl(GRAPHQL_URL, {
      method: "POST",
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
      body: JSON.stringify({ query, variables }),
    });
    // A revoked or expired token: forget it so the next call fetches a fresh one.
    if (res.status === 401) token = null;
    const body: unknown = await res.json().catch(() => ({}));
    const errors = isRecord(body) && Array.isArray(body.errors) ? body.errors : [];
    if (errors.length > 0) {
      const message = errors.map(e => (isRecord(e) && typeof e.message === "string" ? e.message : "unknown error")).join("; ");
      throw new Error(`Stitch API error: ${message}`);
    }
    if (!res.ok || !isRecord(body) || !isRecord(body.data)) {
      throw new Error(`Stitch API request failed (HTTP ${res.status})`);
    }
    return body.data;
  }

  return {
    async createPaymentRequest(input) {
      const data = await graphql(createPaymentRequestMutation(config.paymentMethods), {
        amount: { quantity: toStitchAmount(input.amountRands), currency: "ZAR" },
        externalReference: input.externalReference,
        payerReference: input.payerReference,
        beneficiaryReference: input.beneficiaryReference,
        beneficiaryName: config.beneficiaryName,
        beneficiaryBankId: config.beneficiaryBankId,
        beneficiaryAccountNumber: config.beneficiaryAccountNumber,
        expireAt: input.expireAt.toISOString(),
        payerInformation: { payerId: input.payer.id, ...(input.payer.email ? { email: input.payer.email } : {}) },
      });
      const created = isRecord(data.clientPaymentInitiationRequestCreate) ? data.clientPaymentInitiationRequestCreate : {};
      const request = isRecord(created.paymentInitiationRequest) ? created.paymentInitiationRequest : {};
      if (typeof request.id !== "string" || typeof request.url !== "string") {
        throw new Error("Stitch did not return a payment request URL");
      }
      return { id: request.id, url: request.url };
    },

    async getPaymentRequest(id) {
      const data = await graphql(GET_PAYMENT_REQUEST, { id });
      const node = isRecord(data.node) ? data.node : {};
      const state = isRecord(node.state) ? node.state : {};
      return {
        status: stitchStatusFromTypename(typeof state.__typename === "string" ? state.__typename : undefined),
        amount: parseMoney(state.amount),
      };
    },
  };
}
