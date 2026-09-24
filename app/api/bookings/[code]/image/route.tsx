import { ImageResponse } from "next/og";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface Leg {
  homeTeam: string;
  awayTeam: string;
  marketLabel: string;
  outcomeLabel: string;
  odds: number;
}

/**
 * The shareable ticket image.
 *
 * A booking code on its own is a string someone has to type correctly. The
 * image carries the code and the selections together, so a screenshot posted
 * to WhatsApp is readable on its own and still says where it came from.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const supabase = db();

  let legs: Leg[] = [];
  let expires: string | null = null;

  if (supabase) {
    const { data } = await supabase
      .from("bookings")
      .select("selections, expires_at")
      .eq("code", code.toUpperCase())
      .maybeSingle();

    legs = ((data?.selections ?? []) as Leg[]).slice(0, 8);
    expires = data?.expires_at ?? null;
  }

  const totalOdds = legs.reduce((acc, l) => acc * Number(l.odds || 1), 1);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#FFFFFF",
          fontFamily: "sans-serif",
        }}
      >
        {/* Brand bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "#ED1324",
            padding: "28px 48px",
            fontSize: 46,
            fontWeight: 900,
            fontStyle: "italic",
            color: "#FFFFFF",
          }}
        >
          GoalVault
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: 48 }}>
        {/* The code */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 20, color: "#6B7077" }}>Booking Code</div>
          <div style={{ fontSize: 82, fontWeight: 900, color: "#ED1324", letterSpacing: 8 }}>
            {code.toUpperCase()}
          </div>
        </div>

        {/* Selections */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 26, gap: 10 }}>
          {legs.map((l, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                background: "#F5F6F7",
                border: "1px solid #D7D9DD",
                padding: "12px 16px",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <div style={{ fontSize: 21, color: "#24262C" }}>
                  {`${l.homeTeam} v ${l.awayTeam}`}
                </div>
                <div style={{ fontSize: 17, color: "#6B7077" }}>
                  {`${l.marketLabel} · ${l.outcomeLabel}`}
                </div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#ED1324" }}>
                {Number(l.odds).toFixed(2)}
              </div>
            </div>
          ))}

          {!legs.length && (
            <div style={{ fontSize: 21, color: "#6B7077" }}>This code has no selections.</div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginTop: "auto",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 18, color: "#6B7077" }}>Total odds</div>
            <div style={{ fontSize: 40, fontWeight: 900, color: "#0B9B3A" }}>
              {totalOdds.toFixed(2)}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ fontSize: 17, color: "#8B8F94" }}>
              {expires ? `Expires ${new Date(expires).toLocaleString("en-GB")}` : "No expiry"}
            </div>
            <div style={{ fontSize: 19, color: "#6B7077" }}>Load this code to bet the same slip</div>
          </div>
        </div>
        </div>
      </div>
    ),
    { width: 900, height: 1200 },
  );
}
