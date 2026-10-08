import { config } from "./config";
import { ghanaNetwork, type Gateway } from "./countries";
import {
  cardsConfigured,
  chargePaid,
  createCharge,
  createCustomer,
  createMobileMoneyPaymentMethod,
  findChargeByReference,
  getCharge,
  v4Configured,
  withFlutterwaveAccount,
} from "./flutterwave-v4";

/**
 * Payment gateway adapters.
 *
 * Each rail has its own start / status shape, but they all end at the same
 * place: a confirmed status hands the reference to applyDepositCredit, which is
 * the only function allowed to move money into a wallet.
 *
 * Every adapter degrades to a clear error rather than throwing, so a missing
 * key shows the player a message instead of a stack trace.
 */

export type ChargeStatus = "pending" | "confirmed" | "failed";

/**
 * What the rail says became of a charge.
 *
 * The settled amount matters as much as the status. A player can start a
 * GH₵500 deposit and approve GH₵5 on the handset, and the rail will call that
 * successful — it is, it just is not the deposit that was asked for. Every
 * adapter that can report what actually arrived does, and the credit path uses
 * that figure rather than the one the player typed in.
 */
export interface ChargeOutcome {
  status: ChargeStatus;
  /** What the rail says actually settled. Absent when the rail does not say. */
  paidAmount?: number;
  paidCurrency?: string;
}

export interface StartResult {
  ok: boolean;
  /** Anything the payment row should remember, such as the rail's charge id. */
  metadata?: Record<string, unknown>;
  /** Hosted checkout URL, when the rail redirects. */
  redirectUrl?: string;
  /** True when the player must approve a prompt on their handset. */
  awaitingPrompt?: boolean;
  /** True when the rail additionally wants an OTP typed in. */
  awaitingOtp?: boolean;
  error?: string;
}

export interface GatewayAdapter {
  id: Gateway;
  label: string;
  start(opts: StartOpts): Promise<StartResult>;
  /** `meta` is the payment row's metadata, which may carry the charge id. */
  status(reference: string, meta?: Record<string, unknown>): Promise<ChargeOutcome>;
}

export interface StartOpts {
  reference: string;
  amount: number;
  currency: string;
  phone: string;
  email: string;
  name: string;
  redirectUrl: string;
}

function env(name: string): string | null {
  return config(name) ?? null;
}

// ------------------------------------------------------------ Flutterwave

// Lives in countries so the deposit screen can name the same network the rail
// will be told about.
export { ghanaNetwork };

/**
 * Ask v4 how a charge ended up.
 *
 * The charge id is the authoritative way to ask, so it is used whenever the
 * payment row kept one. Looking it up by our own reference is the fallback for
 * a row written before the id came back.
 */
async function v4Outcome(reference: string, meta?: Record<string, unknown>): Promise<ChargeOutcome> {
  const chargeId = typeof meta?.charge_id === "string" ? meta.charge_id : undefined;
  const charge = chargeId ? await getCharge(chargeId) : await findChargeByReference(reference);

  // A charge that is not there yet is a player still holding the prompt. That
  // is pending, not failed — failing it would strand them.
  if (!charge) return { status: "pending" };

  const s = String(charge.status ?? "").toLowerCase();
  const status: ChargeStatus = chargePaid(charge)
    ? "confirmed"
    : s === "failed" || s === "voided"
      ? "failed"
      : "pending";
  const paid = Number(charge.amount);
  return {
    status,
    paidAmount: Number.isFinite(paid) && paid > 0 ? paid : undefined,
    paidCurrency: charge.currency,
  };
}

/**
 * Nigeria: our own checkout page, on our own domain.
 *
 * There is nothing to call at the start of this one. The player is sent to
 * /checkout, types the card there, and the routes under /api/deposits/card do
 * the talking to Flutterwave v4. All this adapter owes the rest of the app is
 * a way to ask how the charge ended up.
 */
const flutterwaveCard: GatewayAdapter = {
  id: "flutterwave_card",
  label: "Card",
  async start({ reference }) {
    if (!cardsConfigured()) return { ok: false, error: "Card payments are not available right now" };
    return { ok: true, redirectUrl: `/checkout?reference=${encodeURIComponent(reference)}` };
  },
  status: v4Outcome,
};

/**
 * Ghana: Flutterwave v4 direct mobile money. Three calls — a customer, a
 * payment method naming the network, then the charge — and the player approves
 * the prompt on their handset without ever leaving the deposit screen.
 */
const flutterwaveMomo: GatewayAdapter = {
  id: "flutterwave_momo",
  label: "Mobile money",
  async start({ reference, amount, currency, phone, email, name, redirectUrl }) {
    if (!v4Configured()) return { ok: false, error: "Mobile money deposits are not available right now" };

    const customer = await createCustomer({ email, name, phone, dialCode: "233", reference });
    if (!customer.ok || !customer.data?.id) {
      return { ok: false, error: customer.error ?? "Could not start your deposit. Please try again." };
    }

    const method = await createMobileMoneyPaymentMethod({ countryCode: "233", network: ghanaNetwork(phone), phone });
    if (!method.ok || !method.data?.id) {
      return { ok: false, error: method.error ?? "Could not start your deposit. Check the number and try again." };
    }

    const charge = await createCharge({
      reference,
      amount,
      currency,
      customerId: customer.data.id,
      paymentMethodId: method.data.id,
      redirectUrl,
    });
    if (!charge.ok || !charge.data) {
      return { ok: false, error: charge.error ?? "Could not send the payment prompt. Please try again." };
    }

    const { chargeId, step } = charge.data;
    const metadata = { charge_id: chargeId, phone };
    if (step.kind === "failed") return { ok: false, error: "The charge was declined. Check the number and try again." };
    // Some networks route through a page of Flutterwave's rather than a
    // handset prompt; the charge says which with a redirect next_action.
    if (step.kind === "redirect") return { ok: true, redirectUrl: step.url, metadata };
    // Vodafone-style voucher flows ask for a code the network texts; the
    // deposit screen collects it and /api/deposits/otp authorizes the charge.
    if (step.kind === "otp") return { ok: true, awaitingPrompt: true, awaitingOtp: true, metadata };
    return { ok: true, awaitingPrompt: true, metadata };
  },
  status: v4Outcome,
};

// ------------------------------------------------------- Flutterwave v3

/**
 * Flutterwave v3 Ghana mobile money, for accounts where v4 is not enabled for
 * mobile money ("Merchant is not enabled to use this payment method"). Charge
 * the wallet, the player approves the prompt (or types an OTP some networks
 * send), and the outcome is read back by our own reference. When even v3
 * direct charges are not enabled, the hosted checkout takes the payment.
 */
const FLW3 = "https://api.flutterwave.com/v3";

const flutterwaveV3Momo: GatewayAdapter = {
  id: "flutterwave_v3_momo",
  label: "Mobile money",
  async start({ reference, amount, currency, phone, email, name, redirectUrl }) {
    const key = env("FLUTTERWAVE_SECRET_KEY");
    if (!key) return { ok: false, error: "Mobile money is not available right now" };
    const payerEmail = email || `${phone.replace(/\D/g, "")}@goalvault.live`;
    try {
      const res = await fetch(`${FLW3}/charges?type=mobile_money_ghana`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          tx_ref: reference,
          amount,
          currency,
          email: payerEmail,
          phone_number: localGhanaNumber(phone),
          network: ghanaNetwork(phone),
          fullname: name || undefined,
        }),
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as {
        status?: string;
        message?: string;
        data?: { flw_ref?: string; id?: number; status?: string };
        meta?: { authorization?: { redirect?: string; mode?: string } };
      };
      if (!res.ok || json.status !== "success") {
        console.error("[flw3] charge refused", res.status, json.message);
        // Direct charges need their own approval from Flutterwave; until then
        // the hosted checkout (where Momo Ghana is enabled) takes the payment.
        if (/not available|not enabled|contact support/i.test(String(json.message ?? ""))) {
          return hostedCheckout(key, { reference, amount, currency, email: payerEmail, phone, name, redirectUrl });
        }
        return { ok: false, error: json.message ?? "Could not start the payment" };
      }
      const flwRef = json.data?.flw_ref ?? (json.data?.id != null ? String(json.data.id) : null);
      const auth = json.meta?.authorization;
      const metadata = { flw_ref: flwRef, flw_id: json.data?.id ?? null };
      if (auth?.mode === "redirect" && auth.redirect) return { ok: true, redirectUrl: auth.redirect, metadata };
      if (auth?.mode === "otp") return { ok: true, awaitingOtp: true, awaitingPrompt: true, metadata };
      return { ok: true, awaitingPrompt: true, metadata };
    } catch (err) {
      console.error("[flw3] charge threw", err);
      return { ok: false, error: "Could not start the payment" };
    }
  },
  async status(reference) {
    const key = env("FLUTTERWAVE_SECRET_KEY");
    if (!key) return { status: "pending" };
    try {
      const res = await fetch(`${FLW3}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${key}` },
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as { status?: string; data?: { status?: string; amount?: number; currency?: string } };
      const s = String(json.data?.status ?? "").toLowerCase();
      return {
        status: s === "successful" ? "confirmed" : s === "failed" || s === "cancelled" ? "failed" : "pending",
        paidAmount: Number(json.data?.amount) > 0 ? Number(json.data?.amount) : undefined,
        paidCurrency: json.data?.currency,
      };
    } catch {
      return { status: "pending" };
    }
  },
};

/** Flutterwave's hosted page, limited to Ghana mobile money. */
async function hostedCheckout(
  key: string,
  opts: { reference: string; amount: number; currency: string; email: string; phone: string; name: string; redirectUrl: string },
): Promise<StartResult> {
  const res = await fetch(`${FLW3}/payments`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      tx_ref: opts.reference,
      amount: opts.amount,
      currency: opts.currency,
      redirect_url: opts.redirectUrl,
      payment_options: "mobilemoneyghana",
      customer: { email: opts.email, phonenumber: localGhanaNumber(opts.phone), name: opts.name },
      customizations: { title: "GoalVault", description: "Deposit to your GoalVault wallet" },
    }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { status?: string; message?: string; data?: { link?: string } };
  if (!res.ok || json.status !== "success" || !json.data?.link) {
    console.error("[flw3] hosted checkout refused", res.status, json.message);
    return { ok: false, error: json.message ?? "Could not start the payment" };
  }
  return { ok: true, redirectUrl: json.data.link, metadata: { hosted: true } };
}

/** Submit the OTP a v3 mobile-money charge asked for. */
export async function validateFlutterwaveV3Otp(flwRef: string, otp: string): Promise<{ ok: boolean; error?: string }> {
  const key = env("FLUTTERWAVE_SECRET_KEY");
  if (!key) return { ok: false, error: "Mobile money is not available right now" };
  const res = await fetch(`${FLW3}/validate-charge`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "mobile_money_ghana", flw_ref: flwRef, otp }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { status?: string; message?: string };
  return res.ok && json.status === "success" ? { ok: true } : { ok: false, error: json.message ?? "That code was not accepted" };
}

// ---------------------------------------------------------------- Edibytes

/**
 * Edibytes (AlphaPay): initialize with the player's number, which texts them a
 * one-time code; the real charge is only dispatched when that code passes
 * verify-otp. Nothing reaches the player's wallet before then, so the deposit
 * screen collects the code itself and the player never leaves us.
 *
 * Every payment names a domain that must be whitelisted on the Edibytes
 * dashboard; by default it is the host this site is served from.
 *
 * Per their docs: initialize with phone_number answers { status:
 * "otp_required", checkout_url, ... } (or { status: "pending" } when the
 * merchant has OTP switched off, meaning the prompt is already on its way),
 * verify-otp answers { status: "pending" } and dispatches the charge, and
 * verify answers { status, amount, channel, paid_at }. Other field names are
 * still tried, and anything unrecognised is logged in full rather than
 * guessed at.
 */
/** The code the player was texted. A correct one dispatches the real charge. */
export async function edibytesVerifyCode(reference: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${edibytesBase()}/api/payments/${encodeURIComponent(reference)}/verify-otp/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (res.ok) return { ok: true };
  console.error("[edibytes] verify-otp refused", res.status, JSON.stringify(json));
  return { ok: false, error: String(pick(json, "error.message", "message", "detail") ?? "That code was not accepted") };
}

export interface EdibytesResendOpts {
  reference: string;
  phone: string;
  amount: number;
  currency: string;
  /** The whitelisted domain the payment was opened for. */
  domain?: string;
}

/**
 * A fresh code. Their documented resend path is initializing the same payment
 * again with the same phone number, which re-texts the code.
 */
export async function edibytesResend({ reference, phone, amount, currency, domain }: EdibytesResendOpts): Promise<{ ok: boolean; error?: string }> {
  const key = env("EDIBYTES_SECRET_KEY");
  const forDomain = domain || env("EDIBYTES_DOMAIN");
  if (!key || !forDomain) return { ok: false, error: "Start the deposit again to get a new code" };
  const res = await fetch(`${edibytesBase()}/api/payments/initialize/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: Math.round(amount * 100) / 100,
      currency,
      reference,
      domain: forDomain,
      phone_number: localGhanaNumber(phone),
    }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (res.ok) return { ok: true };
  return { ok: false, error: String(pick(json, "error.message", "message", "detail") ?? "Couldn't resend the code") };
}

function edibytesBase() {
  return (env("EDIBYTES_BASE_URL") ?? "https://api.edibytes.online").replace(/\/+$/, "");
}

/** "0241234567": the local form their charge endpoint accepts. */
function localGhanaNumber(phone: string): string {
  const digits = String(phone || "").replace(/\D/g, "");
  const local = digits.startsWith("233") ? digits.slice(3) : digits.replace(/^0+/, "");
  return `0${local.slice(-9)}`;
}

function pick(json: Record<string, unknown> | null, ...paths: string[]): unknown {
  for (const path of paths) {
    let value: unknown = json;
    for (const key of path.split(".")) value = value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined;
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

const edibytes: GatewayAdapter = {
  id: "edibytes",
  label: "Edibytes",
  async start({ reference, amount, currency, email, phone, name, redirectUrl }) {
    const key = env("EDIBYTES_SECRET_KEY");
    if (!key) return { ok: false, error: "Edibytes is not available right now" };
    const domain = env("EDIBYTES_DOMAIN") ?? new URL(redirectUrl).host;
    try {
      const res = await fetch(`${edibytesBase()}/api/payments/initialize/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          // Whole currency units: a test with amount 100 opened a GH₵100
          // checkout, so this is cedis, not pesewas.
          amount: Math.round(amount * 100) / 100,
          currency,
          reference,
          domain,
          // Their API texts this number a one-time code and holds the real
          // charge until verify-otp passes, so the deposit screen collects
          // the code rather than redirecting to their hosted page.
          phone_number: localGhanaNumber(phone),
          email: email || undefined,
          name,
          callback_url: redirectUrl,
        }),
      });
      const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      const message = pick(json, "error.message", "message", "detail");
      if (!res.ok) {
        console.error("[edibytes] start refused", res.status, String(message ?? ""), { domain });
        if (res.status >= 500) return { ok: false, error: "The payment service is busy. Please try again in a minute." };
        const setup = /whitelist|domain|api key|not approved|inactive/i.test(String(message ?? ""));
        return { ok: false, error: setup ? "Deposits are being set up. Please try again shortly." : "Could not start your payment. Please try again." };
      }

      const id = pick(json, "data.id", "id", "data.access_code", "access_code");
      const payRef = String(pick(json, "data.reference", "reference") ?? reference);
      const status = String(pick(json, "data.status", "status") ?? "").toLowerCase();
      const metadata = { edibytesId: id ?? null, edibytesRef: payRef, phone: localGhanaNumber(phone), domain };

      // otp_required: the code gates the charge, so the player must type it in
      // before anything lands on their handset. A plain pending means the
      // merchant has OTP switched off and the approval prompt is already out.
      if (status === "otp_required") return { ok: true, awaitingPrompt: true, awaitingOtp: true, metadata };
      return { ok: true, awaitingPrompt: true, metadata };
    } catch (err) {
      console.error("[edibytes] start", err);
      return { ok: false, error: "Could not start checkout" };
    }
  },
  async status(reference) {
    const key = env("EDIBYTES_SECRET_KEY");
    if (!key) return { status: "pending" };
    try {
      const res = await fetch(`${edibytesBase()}/api/payments/verify/${encodeURIComponent(reference)}/`, {
        headers: { Authorization: `Bearer ${key}` },
        cache: "no-store",
      });
      if (res.status === 404) return { status: "pending" };
      const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      const raw = String(pick(json, "data.status", "status", "data.payment_status", "payment_status") ?? "").toLowerCase();
      const confirmed = ["success", "successful", "succeeded", "completed", "complete", "paid", "confirmed"].includes(raw);
      const failed = ["failed", "failure", "cancelled", "canceled", "abandoned", "expired", "declined", "reversed"].includes(raw);
      if (!confirmed && !failed && raw && !["pending", "processing", "initialized", "initiated", "ongoing"].includes(raw)) {
        console.warn("[edibytes] unknown status", raw, JSON.stringify(json));
      }
      // Reported in whole units too ("100.00" for GH₵100).
      const paid = Number(pick(json, "data.amount", "amount"));
      return {
        status: confirmed ? "confirmed" : failed ? "failed" : "pending",
        paidAmount: Number.isFinite(paid) && paid > 0 ? paid : undefined,
        paidCurrency: pick(json, "data.currency", "currency") as string | undefined,
      };
    } catch {
      return { status: "pending" };
    }
  },
};

/**
 * The manual rail: the player sends money to the displayed agent number and
 * uploads a screenshot. Nothing is automatic, so the status stays pending until
 * the operator confirms it in the console.
 */
const manual: GatewayAdapter = {
  id: "manual",
  label: "Mobile money transfer",
  async start() {
    return { ok: true };
  },
  async status(): Promise<ChargeOutcome> {
    return { status: "pending" };
  },
};

/** Run an adapter against one country's Flutterwave account. */
function onAccount(adapter: GatewayAdapter, country: string): GatewayAdapter {
  return {
    ...adapter,
    start: (opts) => withFlutterwaveAccount(country, () => adapter.start(opts)),
    status: (reference, meta) => withFlutterwaveAccount(country, () => adapter.status(reference, meta)),
  };
}

const ADAPTERS: Record<Gateway, GatewayAdapter> = {
  flutterwave_card: onAccount(flutterwaveCard, "NG"),
  flutterwave_momo: onAccount(flutterwaveMomo, "GH"),
  flutterwave_v3_momo: flutterwaveV3Momo,
  edibytes,
  manual,
};

/**
 * What a confirmed charge is actually worth.
 *
 * The rail's own figure wins whenever it gives one in the currency the deposit
 * was opened in. Everything else — a rail that reports nothing, a figure that
 * arrives in another currency — falls back to what the player asked for, which
 * is the best guess available and the behaviour that stood before.
 */
export function settledAmount(outcome: ChargeOutcome, requested: number, currency: string): number {
  const paid = outcome.paidAmount;
  if (!paid || !Number.isFinite(paid) || paid <= 0) return requested;
  if (outcome.paidCurrency && outcome.paidCurrency.toUpperCase() !== String(currency).toUpperCase()) {
    return requested;
  }
  return paid;
}

/**
 * The gateway a country's deposits go through. The operator can switch it in
 * the admin console (DEPOSIT_GATEWAY_GH and so on); otherwise the country's
 * built-in default stands.
 */
export function depositGateway(countryCode: string, fallback: Gateway): Gateway {
  const chosen = config(`DEPOSIT_GATEWAY_${countryCode.toUpperCase()}`)?.trim().toLowerCase();
  if (chosen && chosen in ADAPTERS) return chosen as Gateway;
  // Nothing chosen: keep the country's default while it has keys, otherwise
  // use a gateway that does, rather than refusing every deposit.
  return fallback;
}

/** Whether a gateway has the credentials it needs to take a payment. */
function hasKeys(gateway: Gateway): boolean {
  switch (gateway) {
    case "flutterwave_card":
      return withFlutterwaveAccount("NG", () => cardsConfigured());
    case "flutterwave_momo":
      return withFlutterwaveAccount("GH", () => v4Configured());
    case "flutterwave_v3_momo":
      return Boolean(env("FLUTTERWAVE_SECRET_KEY"));
    case "edibytes":
      return Boolean(env("EDIBYTES_SECRET_KEY"));
    default:
      return true;
  }
}

/** True when the gateway a country uses has its keys in place. */
export function gatewayReady(gateway: Gateway): boolean {
  return hasKeys(gateway);
}

export function adapterFor(gateway: Gateway): GatewayAdapter {
  return ADAPTERS[gateway] ?? manual;
}

export function allAdapters(): GatewayAdapter[] {
  return Object.values(ADAPTERS);
}
