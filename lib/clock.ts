/**
 * The match clock.
 *
 * The upstream feed reports whole minutes and lags, so the ticking clock is
 * derived from the kickoff timestamp instead. One function decides the minute,
 * whether a match is live, which half is running and when it is over — so the
 * displayed clock, the lock rules and settlement can never disagree.
 */

export type Phase = "pre" | "first" | "ht" | "second" | "ft";

export interface MatchClock {
  phase: Phase;
  /** Minute within regulation time, 0-90 for football. Stoppage reads as 45 or 90. */
  minute: number;
  /** "12:34", "45+01:20", "HT", "90+02:05", "FT" or the kickoff time label. */
  label: string;
  isLive: boolean;
  isOver: boolean;
}

/** Added time at the end of each half, in whole minutes. */
export interface Stoppage {
  first: number;
  second: number;
}

const HALF = 45;
const BREAK = 10;
const NO_STOPPAGE: Stoppage = { first: 0, second: 0 };
/** The most added time an operator can give one half. */
export const MAX_STOPPAGE = 15;

/** Regulation length per sport, in minutes of a single running period. */
const REGULATION: Record<string, { half: number; halves: number; breakLen: number }> = {
  football: { half: 45, halves: 2, breakLen: 10 },
  basketball: { half: 24, halves: 2, breakLen: 15 },
  tennis: { half: 60, halves: 2, breakLen: 5 },
  hockey: { half: 30, halves: 2, breakLen: 15 },
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Clamp an operator-entered stoppage value to whole minutes in range. */
export function cleanStoppage(value: unknown): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? Math.min(MAX_STOPPAGE, Math.max(0, n)) : 0;
}

/**
 * Where a match is at `now`.
 *
 * Timeline for football with stoppage s1 and s2:
 *   0 → 45          first half, "12:34"
 *   45 → 45+s1      first-half stoppage, "45+01:20"
 *   then 10 minutes half time, "HT"
 *   then 45 → 90    second half, "67:05"
 *   90 → 90+s2      second-half stoppage, "90+02:05"
 *   then "FT"
 */
export function matchClock(
  kickoff: string | Date,
  sport = "football",
  now = new Date(),
  stoppage: Stoppage = NO_STOPPAGE,
): MatchClock {
  const ko = typeof kickoff === "string" ? new Date(kickoff) : kickoff;
  const reg = REGULATION[sport] ?? REGULATION.football;
  const s1 = cleanStoppage(stoppage.first);
  const s2 = cleanStoppage(stoppage.second);
  const elapsedMs = now.getTime() - ko.getTime();
  const elapsed = Math.floor(elapsedMs / 60000);
  const secs = pad(Math.floor(elapsedMs / 1000) % 60);

  if (elapsed < 0) {
    return {
      phase: "pre",
      minute: 0,
      isLive: false,
      isOver: false,
      label: ko.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
  }

  const firstEnd = reg.half + s1;
  if (elapsed < reg.half) {
    return { phase: "first", minute: elapsed, isLive: true, isOver: false, label: `${elapsed}:${secs}` };
  }
  if (elapsed < firstEnd) {
    return { phase: "first", minute: reg.half, isLive: true, isOver: false, label: `${reg.half}+${pad(elapsed - reg.half)}:${secs}` };
  }

  const secondStart = firstEnd + reg.breakLen;
  if (elapsed < secondStart) {
    return { phase: "ht", minute: reg.half, isLive: true, isOver: false, label: "HT" };
  }

  const regulation = reg.half * reg.halves;
  const secondRegEnd = secondStart + (regulation - reg.half);
  if (elapsed < secondRegEnd) {
    const minute = reg.half + (elapsed - secondStart);
    return { phase: "second", minute, isLive: true, isOver: false, label: `${minute}:${secs}` };
  }
  if (elapsed < secondRegEnd + s2) {
    return { phase: "second", minute: regulation, isLive: true, isOver: false, label: `${regulation}+${pad(elapsed - secondRegEnd)}:${secs}` };
  }

  return { phase: "ft", minute: regulation, isLive: false, isOver: true, label: "FT" };
}

/** Score implied by a scripted goal timeline at the current clock minute. */
export function scoreFromTimeline(
  timeline: { minute: number; team: "home" | "away" }[],
  clock: MatchClock,
): { home: number; away: number } {
  const cutoff = clock.isOver ? Number.POSITIVE_INFINITY : clock.minute;
  let home = 0;
  let away = 0;
  for (const g of timeline ?? []) {
    if (g.minute <= cutoff) {
      if (g.team === "home") home++;
      else away++;
    }
  }
  return { home, away };
}

export const HALF_LENGTH = HALF;
export const BREAK_LENGTH = BREAK;
