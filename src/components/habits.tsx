"use client";

import { useEffect, useRef, useState } from "react";
import { dispatch } from "@/lib/client/store";
import { day, isoDay } from "@/lib/format";
import {
  addDays,
  dayProgress,
  isDue,
  type Tally,
  timesADay,
  weekday,
} from "@/lib/habits";
import type { Habit } from "@/lib/model";
import { cx } from "./ui";

/** Sets how many times a habit was done that day, and the target it counts against. */
export const logHabit = (
  habit: Habit,
  date: string,
  count: number,
  target: number,
) =>
  dispatch(
    { t: "habit.log", habitId: habit.id, date, count, target },
    { now: true },
  );

const MAX_DOTS = 6;

function Check({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="block"
    >
      <circle cx={12} cy={12} r={12} className="fill-black" />
      <path
        d="M7 12.5l3.2 3.2L17 9"
        fill="none"
        stroke="#fff"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Progress you can count: one dot per time a day (○○ → ●○ → ●●), a single
 * circle for once a day, and "3/8" past six.
 */
export function Dots({ count, target }: { count: number; target: number }) {
  const done = count >= target;
  if (target === 1) {
    return done ? (
      <Check size={26} />
    ) : (
      <span className="block h-[26px] w-[26px] rounded-full border-[1.5px] border-tertiary" />
    );
  }
  if (target > MAX_DOTS) {
    return (
      <span className="flex items-center gap-2">
        <span
          className={cx(
            "tnum text-[15px] font-medium",
            !done && "text-secondary",
          )}
        >
          {Math.min(count, target)}/{target}
        </span>
        {done ? (
          <Check size={26} />
        ) : (
          <span className="block h-[26px] w-[26px] rounded-full border-[1.5px] border-tertiary" />
        )}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-[7px]">
      {Array.from({ length: target }, (_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: one per time a day
          key={i}
          className={cx(
            "block h-3 w-3 rounded-full",
            i < count ? "bg-black" : "border-[1.5px] border-tertiary",
          )}
        />
      ))}
    </span>
  );
}

/** One habit on one day. The whole row is the button: each tap adds one. */
export function HabitRow({
  habit,
  count,
  target,
  meta,
  onTap,
}: {
  habit: Habit;
  count: number;
  target: number;
  meta?: string;
  onTap: () => void;
}) {
  const done = count >= target;
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={`${habit.name}, ${Math.min(count, target)} of ${target}${done ? ", done" : ""}`}
      className="flex min-h-[64px] w-full items-center gap-4 border-b-[0.5px] border-separator py-2 text-left transition-opacity duration-100 active:opacity-50"
    >
      <span className="min-w-0 flex-1">
        <span
          className={cx(
            "block truncate transition-colors duration-200",
            done && "text-secondary",
          )}
        >
          {habit.name}
        </span>
        <span className="tnum block truncate text-[13px] text-secondary">
          {target > 1
            ? `${Math.min(count, target)} of ${target}`
            : done
              ? "Done"
              : timesADay(1)}
          {meta ? ` · ${meta}` : ""}
        </span>
      </span>
      <span className="shrink-0">
        <Dots count={count} target={target} />
      </span>
    </button>
  );
}

export type Undo = { label: string; revert: () => void };

/** Remembers the last change for a few seconds so a stray tap can be taken back. */
export function useUndo(ms = 4000) {
  const [undo, setUndo] = useState<(Undo & { key: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const offer = (u: Undo) => {
    clearTimeout(timer.current);
    setUndo({ ...u, key: Date.now() });
    timer.current = setTimeout(() => setUndo(null), ms);
  };
  const take = () => {
    clearTimeout(timer.current);
    undo?.revert();
    setUndo(null);
  };
  return { undo, offer, take };
}

/** Floats just above the tab bar. */
export function UndoBar({
  undo,
  onUndo,
}: {
  undo: (Undo & { key: number }) | null;
  onUndo: () => void;
}) {
  if (!undo) return null;
  return (
    <div className="hide-kb pointer-events-none fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] z-30 px-3">
      <output
        key={undo.key}
        className="pointer-events-auto mx-auto flex h-11 max-w-xl items-center justify-between gap-3 rounded-xl bg-black pr-1 pl-4 text-[15px] text-white"
      >
        <span className="truncate">{undo.label}</span>
        <button
          type="button"
          onClick={onUndo}
          className="press h-11 shrink-0 px-3 font-semibold"
        >
          Undo
        </button>
      </output>
    </div>
  );
}

/** A ring split by habits due, filled with the ones done. Done is a solid check. */
function DayRing({
  done,
  due,
  size,
}: {
  done: number;
  due: number;
  size: number;
}) {
  if (due && done >= due) return <Check size={size} />;
  const stroke = 2.5;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      className="block"
    >
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        strokeWidth={stroke}
        className="stroke-fill-strong"
      />
      {done > 0 ? (
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(done / due) * circumference} ${circumference}`}
          transform={`rotate(-90 ${c} ${c})`}
          className="stroke-black"
        />
      ) : null}
    </svg>
  );
}

const LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

/** Monday to Sunday of the week holding `selected`, each day with its progress. */
export function WeekStrip({
  habitsOn,
  t,
  selected,
  onSelect,
}: {
  /** The habits that existed on a day. */
  habitsOn: (date: string) => Habit[];
  t: Tally;
  selected: string;
  onSelect: (date: string) => void;
}) {
  const today = isoDay();
  const monday = addDays(selected, -weekday(selected));
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  return (
    <div className="flex items-center">
      <button
        type="button"
        aria-label="Previous week"
        onClick={() => onSelect(addDays(selected, -7))}
        className="press -ml-2 h-12 w-6 shrink-0 text-[17px] text-secondary"
      >
        ‹
      </button>
      <div className="grid flex-1 grid-cols-7">
        {days.map((d, i) => {
          const future = d > today;
          const p = dayProgress(habitsOn(d), t, d);
          const on = d === selected;
          return (
            <button
              key={d}
              type="button"
              disabled={future}
              aria-pressed={on}
              aria-label={`${day(new Date(`${d}T12:00`))}, ${p.done} of ${p.due} done`}
              onClick={() => onSelect(d)}
              className="press flex flex-col items-center gap-1 py-1 disabled:opacity-30"
            >
              <span
                className={cx(
                  "text-[11px] font-medium",
                  on ? "text-black" : "text-secondary",
                )}
              >
                {LETTERS[i]}
              </span>
              <span className="relative block h-8 w-8">
                {!future && p.due ? (
                  <DayRing done={p.done} due={p.due} size={32} />
                ) : null}
                {!future && p.due && p.done >= p.due ? null : (
                  <span
                    className={cx(
                      "tnum absolute inset-[4px] flex items-center justify-center rounded-full text-[13px]",
                      on && "bg-black font-semibold text-white",
                    )}
                  >
                    {Number(d.slice(8))}
                  </span>
                )}
              </span>
              <span
                className={cx(
                  "block h-1 w-1 rounded-full",
                  on ? "bg-black" : "bg-transparent",
                )}
              />
            </button>
          );
        })}
      </div>
      <button
        type="button"
        aria-label="Next week"
        disabled={days.includes(today)}
        onClick={() => {
          const next = addDays(selected, 7);
          onSelect(next > today ? today : next);
        }}
        className="press -mr-2 h-12 w-6 shrink-0 text-[17px] text-secondary disabled:opacity-0"
      >
        ›
      </button>
    </div>
  );
}

/** A square filled from the bottom by the share of the day's target done. */
function DaySquare({
  habit,
  t,
  date,
  start,
  className,
  ring,
}: {
  habit: Habit;
  t: Tally;
  date: string;
  start: string;
  className?: string;
  ring?: boolean;
}) {
  const today = isoDay();
  const future = date > today;
  const count = t.count(habit.id, date);
  const share = Math.min(1, count / t.target(habit, date));
  // Before the habit existed is blank; days it isn't due are just outlined.
  const blank = future || (date < start && !count);
  const notDue = !isDue(habit, date) && !count;
  return (
    <span
      className={cx(
        "relative block overflow-hidden rounded-[3px]",
        blank
          ? "bg-transparent"
          : notDue
            ? "border-[0.5px] border-separator"
            : "bg-fill",
        ring && "outline outline-[1.5px] outline-offset-1 outline-black",
        className,
      )}
    >
      {share > 0 && !blank ? (
        <span
          className="absolute inset-x-0 bottom-0 bg-black"
          style={{ height: `${share * 100}%` }}
        />
      ) : null}
    </span>
  );
}

/** The last 30 days of one habit as a row of small squares. */
export function MonthStrip({
  habit,
  t,
  start,
}: {
  habit: Habit;
  t: Tally;
  start: string;
}) {
  const today = isoDay();
  const days = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29));
  return (
    <span className="flex gap-[2px]" aria-hidden="true">
      {days.map((d) => (
        <DaySquare
          key={d}
          habit={habit}
          t={t}
          date={d}
          start={start}
          className="aspect-[1/1.4] flex-1"
        />
      ))}
    </span>
  );
}

/** One square per day for one habit, weeks as columns, Monday on top. */
export function HabitGrid({
  habit,
  t,
  start,
  weeks,
  onPick,
  picked,
}: {
  habit: Habit;
  t: Tally;
  start: string;
  weeks: number;
  picked: string | null;
  onPick: (date: string | null) => void;
}) {
  const today = isoDay();
  const monday = addDays(today, -weekday(today));
  const first = addDays(monday, -(weeks - 1) * 7);
  const columns = Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(first, w * 7 + d)),
  );
  return (
    <div className="flex justify-between gap-[3px]">
      {columns.map((col) => (
        <div key={col[0]} className="flex flex-1 flex-col gap-[3px]">
          {col.map((d) => (
            <button
              key={d}
              type="button"
              disabled={d > today}
              aria-label={`${day(new Date(`${d}T12:00`))}: ${t.count(habit.id, d)} of ${t.target(habit, d)}`}
              onClick={() => onPick(picked === d ? null : d)}
              className="block aspect-square w-full"
            >
              <DaySquare
                habit={habit}
                t={t}
                date={d}
                start={start}
                ring={d === picked || (!picked && d === today)}
                className="h-full w-full"
              />
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

/** − n/target + for setting the count on any day. */
export function DayStepper({
  habit,
  t,
  date,
}: {
  habit: Habit;
  t: Tally;
  date: string;
}) {
  const count = t.count(habit.id, date);
  const target = t.target(habit, date);
  return (
    <div className="flex h-10 w-[132px] shrink-0 items-center justify-between rounded-[10px] bg-fill">
      <button
        type="button"
        aria-label="One less"
        disabled={count <= 0}
        onClick={() => logHabit(habit, date, count - 1, target)}
        className="press h-10 w-10 text-[19px] disabled:opacity-25"
      >
        −
      </button>
      <span className="tnum text-[17px] font-medium">
        {count}/{target}
      </span>
      <button
        type="button"
        aria-label="One more"
        disabled={count >= 100}
        onClick={() => logHabit(habit, date, count + 1, target)}
        className="press h-10 w-10 text-[19px] disabled:opacity-25"
      >
        +
      </button>
    </div>
  );
}
