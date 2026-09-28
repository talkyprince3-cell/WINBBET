import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { refreshConfig } from "@/lib/config";
import { validateFlutterwaveV3Otp } from "@/lib/gateways";

export const dynamic = "force-dynamic";

/** The one-time code some mobile-money networks send before they take the payment. */
export async function POST(req: Request) {
  await refreshConfig();
  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as { reference?: string; userId?: string; otp?: string } | null;
  const reference = String(body?.reference ?? "");
  const otp = String(body?.otp ?? "").trim();
  if (!reference || !body?.userId) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (!otp) return NextResponse.json({ error: "Enter the code you were sent" }, { status: 400 });

  const { data: payment } = await supabase
    .from("payments")
    .select("reference, user_id, provider, status, metadata")
    .eq("reference", reference)
    .maybeSingle();

  if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (payment.user_id !== body.userId) return NextResponse.json({ error: "Not your deposit" }, { status: 403 });
  if (payment.status !== "pending") return NextResponse.json({ error: "That deposit is already settled" }, { status: 409 });
  if (payment.provider !== "flutterwave_v3_momo") return NextResponse.json({ error: "This payment does not take a code" }, { status: 400 });

  const flwRef = (payment.metadata as Record<string, unknown> | null)?.flw_ref;
  if (typeof flwRef !== "string" || !flwRef) return NextResponse.json({ error: "That payment has not started yet" }, { status: 409 });

  const result = await validateFlutterwaveV3Otp(flwRef, otp);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
