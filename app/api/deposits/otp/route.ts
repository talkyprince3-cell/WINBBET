import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { refreshConfig } from "@/lib/config";
import { edibytesResend, edibytesVerifyCode } from "@/lib/gateways";
import { authorizeCharge, withFlutterwaveAccount } from "@/lib/flutterwave-v4";

export const dynamic = "force-dynamic";

/**
 * The verification code Edibytes texts the player before it will dispatch the
 * charge — a correct code is what sends the approval prompt to their phone —
 * and "resend" when it never arrived. Only the player who opened the deposit
 * can act on it.
 */
export async function POST(req: Request) {
  await refreshConfig();
  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as { reference?: string; userId?: string; code?: string; action?: string } | null;
  const reference = String(body?.reference ?? "");
  if (!reference || !body?.userId) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { data: payment } = await supabase
    .from("payments")
    .select("reference, user_id, provider, status, amount, currency, metadata")
    .eq("reference", reference)
    .maybeSingle();

  if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (payment.user_id !== body.userId) return NextResponse.json({ error: "Not your deposit" }, { status: 403 });
  if (payment.status !== "pending") return NextResponse.json({ error: "That deposit is already settled" }, { status: 409 });

  const meta = (payment.metadata ?? {}) as Record<string, unknown>;

  // Flutterwave mobile money: the code goes back onto the charge itself.
  if (payment.provider === "flutterwave_momo") {
    if (body.action === "resend") {
      return NextResponse.json({ error: "A new code can't be requested on this network. Check the first SMS, or start the deposit again." }, { status: 400 });
    }
    const code = String(body.code ?? "").replace(/\D/g, "");
    if (code.length < 4) return NextResponse.json({ error: "Enter the code you were sent" }, { status: 400 });
    const chargeId = typeof meta.charge_id === "string" ? meta.charge_id : "";
    if (!chargeId) return NextResponse.json({ error: "This payment does not take a code" }, { status: 400 });
    const result = await withFlutterwaveAccount("GH", () => authorizeCharge(chargeId, { type: "otp", code }));
    if (!result.ok) return NextResponse.json({ error: result.error ?? "That code was not accepted" }, { status: 400 });
    if (result.data?.step.kind === "failed") return NextResponse.json({ error: "That code was not accepted" }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (payment.provider !== "edibytes") return NextResponse.json({ error: "This payment does not take a code" }, { status: 400 });

  const edibytesRef = typeof meta.edibytesRef === "string" && meta.edibytesRef ? meta.edibytesRef : reference;

  if (body.action === "resend") {
    const phone = typeof meta.phone === "string" ? meta.phone : "";
    if (!phone) return NextResponse.json({ error: "Start the deposit again to get a new code" }, { status: 409 });
    const result = await edibytesResend({
      reference: edibytesRef,
      phone,
      amount: Number(payment.amount),
      currency: String(payment.currency),
      domain: typeof meta.domain === "string" ? meta.domain : undefined,
    });
    return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: 400 });
  }

  const code = String(body.code ?? "").replace(/\D/g, "");
  if (code.length < 4) return NextResponse.json({ error: "Enter the code you were sent" }, { status: 400 });
  const result = await edibytesVerifyCode(edibytesRef, code);
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: 400 });
}
