import { isoDay } from "./format";
import type { Db, Habit, HabitLog } from "./model";

// Days are local YYYY-MM-DD strings, like sleep and bodyweight.

/** Monday = 0 … Sunday = 6 */
export const weekday = (date: string) =>
  (new Date(`${date}T12:00`).getDay() + 6) % 7;

export function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00`);
  d.setDate(d.getDate() + n);
  return isoDay(d);
}

export const isDue = (h: Habit, date: string) =>
  !h.days || h.days.includes(weekday(date));

/** What was logged for each habit and day. */
export function tally(db: Db) {
  const map = new Map<string, HabitLog>();
  for (const l of db.habitLogs) map.set(`${l.habitId}:${l.date}`, l);
  const today = isoDay();
  const count = (habitId: string, date: string) =>
    map.get(`${habitId}:${date}`)?.count ?? 0;
  // Past days keep the target they were logged against; today follows the habit.
  const target = (h: Habit, date: string) =>
    (date < today ? map.get(`${h.id}:${date}`)?.target : undefined) ?? h.target;
  return {
    count,
    target,
    done: (h: Habit, date: string) => count(h.id, date) >= target(h, date),
  };
}

export type Tally = ReturnType<typeof tally>;

export const activeHabits = (db: Db) => db.habits.filter((h) => !h.archived);

/** The first day a habit counts from: the day it was made, or earlier if you logged before that. */
export function startOf(db: Db, h: Habit) {
  const made = isoDay(h.createdAt);
  const first = db.habitLogs.find((l) => l.habitId === h.id)?.date;
  return first && first < made ? first : made;
}

/** The habits that existed on a day (a habit counts from its first day). */
export function livingOn(db: Db, habits: Habit[]) {
  const starts = new Map(habits.map((h) => [h.id, startOf(db, h)]));
  return (date: string) =>
    habits.filter((h) => (starts.get(h.id) ?? date) <= date);
}

/** How many of the habits due that day were fully done. */
export function dayProgress(habits: Habit[], t: Tally, date: string) {
  const due = habits.filter((h) => isDue(h, date));
  return { due: due.length, done: due.filter((h) => t.done(h, date)).length };
}

/**
 * Runs of due days fully done. Days it isn't due don't break a run, and today
 * only counts once it's done, so an unfinished today doesn't reset the streak.
 */
export function streaks(h: Habit, t: Tally, start: string, today = isoDay()) {
  let best = 0;
  let run = 0;
  for (let d = start; d <= today; d = addDays(d, 1)) {
    if (!isDue(h, d)) continue;
    if (t.done(h, d)) best = Math.max(best, ++run);
    else if (d !== today) run = 0;
  }
  return { current: run, best };
}

/** Due days in [from, to] and how many were fully done. An unfinished today is left out. */
export function completion(h: Habit, t: Tally, from: string, to = isoDay()) {
  const today = isoDay();
  let due = 0;
  let done = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (!isDue(h, d)) continue;
    const full = t.done(h, d);
    if (d === today && !full) continue;
    due++;
    if (full) done++;
  }
  return { due, done };
}

/**
 * Days where every habit due was done. A habit only counts from its first
 * day, days with nothing due are skipped, and an unfinished today doesn't
 * break the run.
 */
export function perfectDays(db: Db, habits: Habit[], t: Tally) {
  const first = habits.map((h) => startOf(db, h)).sort()[0];
  const on = livingOn(db, habits);
  const today = isoDay();
  let best = 0;
  let run = 0;
  if (!first) return { current: 0, best: 0 };
  for (let d = first; d <= today; d = addDays(d, 1)) {
    const p = dayProgress(on(d), t, d);
    if (p.due === 0) continue;
    if (p.done === p.due) best = Math.max(best, ++run);
    else if (d !== today) run = 0;
  }
  return { current: run, best };
}

/** Share of due habit-days fully done in [from, to], across habits. */
export function overall(
  db: Db,
  habits: Habit[],
  t: Tally,
  from: string,
  to = isoDay(),
) {
  let due = 0;
  let done = 0;
  for (const h of habits) {
    const start = startOf(db, h);
    const c = completion(h, t, start > from ? start : from, to);
    due += c.due;
    done += c.done;
  }
  return { due, done, rate: due ? done / due : null };
}

/** Full days done by weekday (Monday first), as a share of days due. */
export function byWeekday(h: Habit, t: Tally, from: string, to = isoDay()) {
  const today = isoDay();
  const due = Array(7).fill(0) as number[];
  const done = Array(7).fill(0) as number[];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (!isDue(h, d)) continue;
    const full = t.done(h, d);
    if (d === today && !full) continue;
    const w = weekday(d);
    due[w]++;
    if (full) done[w]++;
  }
  return due.map((n, i) => (n ? done[i] / n : null));
}

export const percent = (rate: number | null) =>
  rate === null ? "–" : `${Math.round(rate * 100)}%`;

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** "Every day", "Weekdays", "Mon, Wed, Fri" */
export function describeDays(days?: number[]) {
  if (!days || days.length === 7) return "Every day";
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.join() === "0,1,2,3,4") return "Weekdays";
  if (sorted.join() === "5,6") return "Weekends";
  return sorted.map((d) => DAY_NAMES[d]).join(", ");
}

export const timesADay = (n: number) =>
  n === 1 ? "Once a day" : n === 2 ? "Twice a day" : `${n} times a day`;
