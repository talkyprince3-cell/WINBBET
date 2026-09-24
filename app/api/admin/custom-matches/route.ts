import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-guard";
import { hasColumn } from "@/lib/schema";
import { cleanStoppage } from "@/lib/clock";

export const dynamic = "force-dynamic";

type Goal = { minute: number; team: "home" | "away" };

/** Keep only well-formed goals, in match order. */
function cleanTimeline(raw: unknown): Goal[] {
  if (!Array.isArray(raw)) return [];
  const out: Goal[] = [];
  for (const g of raw) {
    const minute = Number((g as { minute?: unknown })?.minute);
    const team = (g as { team?: unknown })?.team;
    if (Number.isFinite(minute) && minute >= 1 && minute <= 90 && (team === "home" || team === "away")) {
      out.push({ minute: Math.floor(minute), team });
    }
  }
  return out.sort((a, b) => a.minute - b.minute);
}

function price(value: unknown, fallback: number): number | null {
  const n = value === undefined || value === "" ? fallback : Number(value);
  return Number.isFinite(n) && n > 1 ? Math.round(n * 100) / 100 : null;
}

/** Operator fixtures: create, run and finalise. */
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { data } = await supabase
    .from("custom_matches")
    .select("*")
    .order("kickoff", { ascending: false })
    .limit(100);

  return NextResponse.json({ matches: data ?? [] });
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const body = await req.json().catch(() => null);
  if (!String(body?.home_team ?? "").trim() || !String(body?.away_team ?? "").trim() || !body?.kickoff) {
    return NextResponse.json({ error: "Teams and kickoff are required" }, { status: 400 });
  }
  if (Number.isNaN(new Date(body.kickoff).getTime())) {
    return NextResponse.json({ error: "Kickoff time is not valid" }, { status: 400 });
  }
  const odds = { home: price(body.odds_home, 2), draw: price(body.odds_draw, 3.2), away: price(body.odds_away, 3.5) };
  if (!odds.home || !odds.draw || !odds.away) {
    return NextResponse.json({ error: "Every price must be above 1.00" }, { status: 400 });
  }

  const withStoppage = await hasColumn("custom_matches", "stoppage_first");
  const { data, error } = await supabase
    .from("custom_matches")
    .insert({
      ...(withStoppage
        ? { stoppage_first: cleanStoppage(body.stoppage_first), stoppage_second: cleanStoppage(body.stoppage_second) }
        : {}),
      home_team: String(body.home_team).trim(),
      away_team: String(body.away_team).trim(),
      home_crest: body.home_crest || null,
      away_crest: body.away_crest || null,
      league: body.league || "WinnBet Special",
      sport: body.sport || "football",
      kickoff: body.kickoff,
      odds_home: odds.home,
      odds_draw: odds.draw,
      odds_away: odds.away,
      goal_timeline: cleanTimeline(body.goal_timeline),
      is_live: Boolean(body.is_live),
      is_locked: Boolean(body.is_locked),
      best_odds: Boolean(body.best_odds),
    })
    .select("*")
    .single();

  if (error) {
    console.error("[admin] custom match insert", error);
    return NextResponse.json({ error: "Could not create the match" }, { status: 500 });
  }
  return NextResponse.json({ match: data });
}

export async function PATCH(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const field of [
    "home_team", "away_team", "home_crest", "away_crest", "league", "kickoff",
    "odds_home", "odds_draw", "odds_away", "goal_timeline",
    "is_live", "is_locked", "best_odds",
  ]) {
    if (field in body) patch[field] = body[field];
  }
  if ("goal_timeline" in patch) patch.goal_timeline = cleanTimeline(patch.goal_timeline);
  if ("stoppage_first" in body || "stoppage_second" in body) {
    if (!(await hasColumn("custom_matches", "stoppage_first"))) {
      return NextResponse.json({ error: "Stoppage time needs database migration 0016. Run it in Supabase, then try again." }, { status: 409 });
    }
    if ("stoppage_first" in body) patch.stoppage_first = cleanStoppage(body.stoppage_first);
    if ("stoppage_second" in body) patch.stoppage_second = cleanStoppage(body.stoppage_second);
  }
  for (const field of ["odds_home", "odds_draw", "odds_away"]) {
    if (field in patch) {
      const value = price(patch[field], 0);
      if (!value) return NextResponse.json({ error: "Every price must be above 1.00" }, { status: 400 });
      patch[field] = value;
    }
  }

  // "Set result" finalises the match; settlement then treats that score as
  // authoritative rather than deriving one from the timeline.
  if (body.final_home != null && body.final_away != null) {
    patch.final_home = Number(body.final_home);
    patch.final_away = Number(body.final_away);
    patch.finished = true;
    patch.is_live = false;
  }

  const { data, error } = await supabase
    .from("custom_matches")
    .update(patch)
    .eq("id", body.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: "Could not update the match" }, { status: 500 });
  return NextResponse.json({ match: data });
}

export async function DELETE(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  // A match with unsettled bets cannot go: settlement would never find it and
  // those stakes would sit pending for ever. Set a result first.
  const { count } = await supabase
    .from("bet_selections")
    .select("id", { count: "exact", head: true })
    .eq("match_id", `cm_${id}`)
    .eq("result", "pending");
  if (count) {
    return NextResponse.json(
      { error: `${count} open bet${count === 1 ? "" : "s"} on this match. Wait for it to finish or set the result, then remove it.` },
      { status: 409 },
    );
  }

  const { error } = await supabase.from("custom_matches").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Could not remove the match" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
