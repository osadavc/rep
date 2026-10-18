import { isoDay } from "./format";
import type { Db, SleepEntry } from "./model";

// Times of night are handled as minutes after noon of the day the night began
// (22:00 = 600, midnight = 720, 07:00 = 1140), so averages work across midnight.

const MIN = 60_000;

function noonBefore(t: number) {
  const d = new Date(t);
  if (d.getHours() < 12) d.setDate(d.getDate() - 1);
  d.setHours(12, 0, 0, 0);
  return d.getTime();
}

export type Night = {
  entry: SleepEntry;
  /** The day you woke up, local YYYY-MM-DD. */
  date: string;
  minutes: number;
  bed: number;
  wake: number;
};

export function nights(db: Db): Night[] {
  return db.sleeps.map((entry) => {
    const anchor = noonBefore(entry.bed);
    return {
      entry,
      date: isoDay(entry.wake),
      minutes: (entry.wake - entry.bed) / MIN,
      bed: (entry.bed - anchor) / MIN,
      wake: (entry.wake - anchor) / MIN,
    };
  });
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

export function summary(list: Night[], goal: number) {
  const minutes = list.map((n) => n.minutes);
  return {
    count: list.length,
    average: mean(minutes),
    bed: mean(list.map((n) => n.bed)),
    wake: mean(list.map((n) => n.wake)),
    /** How much bedtime and wake time wander, in minutes (standard deviation). */
    bedSpread: sd(list.map((n) => n.bed)),
    wakeSpread: sd(list.map((n) => n.wake)),
    metGoal: list.filter((n) => n.minutes >= goal).length,
    /** Minutes short of the goal, summed over nights that fell short. */
    debt: list.reduce((a, n) => a + Math.max(0, goal - n.minutes), 0),
    longest: list.reduce<Night | null>(
      (a, n) => (!a || n.minutes > a.minutes ? n : a),
      null,
    ),
    shortest: list.reduce<Night | null>(
      (a, n) => (!a || n.minutes < a.minutes ? n : a),
      null,
    ),
  };
}

/** Average sleep by the weekday you woke up on, Monday first. */
export function byWeekday(list: Night[]) {
  const sums = Array(7).fill(0) as number[];
  const counts = Array(7).fill(0) as number[];
  for (const n of list) {
    const i = (new Date(`${n.date}T12:00`).getDay() + 6) % 7;
    sums[i] += n.minutes;
    counts[i]++;
  }
  return sums.map((s, i) => (counts[i] ? s / counts[i] : 0));
}

/** Sleep the night before days you trained, against the other nights. */
export function beforeTraining(db: Db, list: Night[]) {
  const trained = new Set(db.sessions.map((s) => isoDay(s.startedAt)));
  const before = list.filter((n) => trained.has(n.date)).map((n) => n.minutes);
  const other = list.filter((n) => !trained.has(n.date)).map((n) => n.minutes);
  return {
    before: before.length ? mean(before) : null,
    other: other.length ? mean(other) : null,
    beforeCount: before.length,
    otherCount: other.length,
  };
}

/** Usual bed and wake clock times (minutes after midnight) from recent nights. */
export function usualTimes(list: Night[]) {
  const recent = list.slice(-14);
  if (!recent.length) return { bed: 23 * 60, wake: 7 * 60 };
  return {
    bed: (720 + Math.round(median(recent.map((n) => n.bed)) / 5) * 5) % 1440,
    wake: (720 + Math.round(median(recent.map((n) => n.wake)) / 5) * 5) % 1440,
  };
}

/**
 * Turns "went to bed at HH:MM, woke at HH:MM on <day>" into timestamps.
 * A bedtime later in the clock than the wake time means the evening before.
 */
export function toEntryTimes(
  wakeDay: string,
  bedClock: string,
  wakeClock: string,
) {
  const wake = new Date(`${wakeDay}T${wakeClock}`).getTime();
  let bed = new Date(`${wakeDay}T${bedClock}`).getTime();
  if (bed >= wake) bed -= 24 * 60 * MIN;
  return { bed, wake };
}
