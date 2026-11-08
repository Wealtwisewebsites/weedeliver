import { api } from "./api";

/** Online payment providers the app knows how to present, keyed by the server's provider code. */
export const PAYMENT_OPTIONS = {
  STITCH: { label: "Stitch", title: "Card or Instant EFT", sub: "Stitch - Visa, Mastercard or pay straight from your bank", icon: "\u{1F4B3}" },
  IKHOKHA: { label: "iKhokha", title: "Pay by Card / EFT", sub: "iKhokha - card or instant EFT", icon: "\u{1F4B3}" },
};

/**
 * Providers the server can process right now, in its order of preference.
 * Empty when none are configured, so callers can say payment is unavailable instead of failing later.
 * @returns {Promise<string[]>}
 */
export async function fetchPaymentProviders() {
  const res = await api("GET", "/payments/providers");
  const list = res.ok && Array.isArray(res.data?.providers) ? res.data.providers : [];
  return list.filter(code => PAYMENT_OPTIONS[code]);
}
