"use client";

import Link from "next/link";
import { useState } from "react";
import { IconButton } from "@/components/controls";
import {
  HabitRow,
  logHabit,
  MonthStrip,
  UndoBar,
  useUndo,
  WeekStrip,
} from "@/components/habits";
import {
  ButtonLink,
  Empty,
  Header,
  Page,
  Row,
  Section,
  Stat,
  TextButton,
} from "@/components/ui";
import { dispatch, useDb } from "@/lib/client/store";
import { day, isoDay, plural } from "@/lib/format";
import {
  activeHabits,
  addDays,
  completion,
  dayProgress,
  isDue,
  livingOn,
  overall,
  percent,
  perfectDays,
  startOf,
  streaks,
  tally,
  weekday,
} from "@/lib/habits";
import type { Habit } from "@/lib/model";

export default function HabitsPage() {
  const db = useDb();
  const [selected, setSelected] = useState<string | null>(null);
  const [ordering, setOrdering] = useState(false);
  const { undo, offer, take } = useUndo();
  if (!db) return null;

  const today = isoDay();
  const date = selected ?? today;
  const habits = activeHabits(db);
  const archived = db.habits.filter((h) => h.archived);
  const t = tally(db);

  if (habits.length === 0) {
    return (
      <Page>
        <Header title="Habits" />
        <p className="pb-5 text-[15px] text-secondary">
          The small things you want to do every day, like vitamins or skin care.
          Say how many times a day each one needs, then tick them off as you go.
        </p>
        <ButtonLink href="/habits/new">Add a habit</ButtonLink>
        {archived.length ? <Archived habits={archived} /> : null}
      </Page>
    );
  }

  const isToday = date === today;
  const on = livingOn(db, habits);
  // Habits made after this day can still be logged, but aren't counted as due.
  const due = on(date).filter((h) => isDue(h, date));
  const notDue = habits.filter((h) => !due.includes(h));
  const progress = dayProgress(on(date), t, date);
  const perfect = perfectDays(db, habits, t);
  const week = overall(db, habits, t, addDays(today, -weekday(today)));
  const month = overall(db, habits, t, addDays(today, -29));
  const when = isToday ? " today" : "";

  // Each tap adds one. Tapping one that's done offers to take the last one back.
  const tap = (h: Habit) => {
    const count = t.count(h.id, date);
    const target = t.target(h, date);
    if (count >= target) {
      offer({
        label: `${h.name} is done`,
        revert: () => logHabit(h, date, count - 1, target),
      });
      return;
    }
    logHabit(h, date, count + 1, target);
    offer({
      label:
        count + 1 >= target
          ? `${h.name} done`
          : `${h.name} · ${count + 1} of ${target}`,
      revert: () => logHabit(h, date, count, target),
    });
  };

  const row = (h: Habit, meta?: string) => (
    <HabitRow
      key={h.id}
      habit={h}
      count={t.count(h.id, date)}
      target={t.target(h, date)}
      meta={meta}
      onTap={() => tap(h)}
    />
  );

  const move = (i: number, dir: -1 | 1) => {
    const ids = habits.map((h) => h.id);
    [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
    dispatch({
      t: "habit.order",
      ids: [...ids, ...archived.map((h) => h.id)],
    });
  };

  return (
    <Page>
      <Header
        title="Habits"
        action={
          <Link href="/habits/new" className="press text-[15px] font-medium">
            New
          </Link>
        }
        sub={
          progress.due === 0
            ? `Nothing due${when || " that day"}`
            : progress.done === progress.due
              ? `All ${progress.due} done${when}`
              : `${progress.done} of ${progress.due} done${when}`
        }
      />

      <WeekStrip
        habitsOn={on}
        t={t}
        selected={date}
        onSelect={(d) => setSelected(d === today ? null : d)}
      />

      <Section className="mt-3">
        {!isToday ? (
          <div className="flex items-baseline justify-between pb-1">
            <span className="text-[13px] font-medium uppercase tracking-[0.04em] text-secondary">
              {date === addDays(today, -1)
                ? "Yesterday"
                : day(new Date(`${date}T12:00`))}
            </span>
            <TextButton
              className="py-0 text-[13px]"
              onClick={() => setSelected(null)}
            >
              Today →
            </TextButton>
          </div>
        ) : null}
        {due.length === 0 ? (
          <Empty>Nothing due on {day(new Date(`${date}T12:00`))}.</Empty>
        ) : null}
        {due.map((h) => {
          const s = streaks(h, t, startOf(db, h));
          return row(
            h,
            isToday && s.current >= 2 ? `${s.current}-day streak` : undefined,
          );
        })}
      </Section>

      {notDue.length ? (
        <Section title={isToday ? "Not due today" : "Not due that day"}>
          {notDue.map((h) => row(h))}
        </Section>
      ) : null}

      <Section title="How it's going">
        {/* Three across: short enough to read at a glance. */}
        <div className="grid grid-cols-3 gap-x-4 py-4">
          <Stat
            label="Perfect streak"
            value={plural(perfect.current, "day")}
            sub={
              perfect.current && perfect.current >= perfect.best
                ? "your best"
                : `best ${plural(perfect.best, "day")}`
            }
          />
          <Stat
            label="This week"
            value={percent(week.rate)}
            sub={week.due ? `${week.done} of ${week.due}` : "just started"}
          />
          <Stat
            label="30 days"
            value={percent(month.rate)}
            sub={month.due ? `${month.done} of ${month.due}` : "–"}
          />
        </div>
        <p className="text-[13px] text-secondary">
          A perfect day is one where every habit due got done.
        </p>
      </Section>

      <Section
        title="Each habit · 30 days"
        action={
          habits.length > 1 ? (
            <TextButton
              className="py-0 text-[13px]"
              onClick={() => setOrdering(!ordering)}
            >
              {ordering ? "Done" : "Reorder"}
            </TextButton>
          ) : null
        }
      >
        <div className="pt-1">
          {habits.map((h, i) => {
            const start = startOf(db, h);
            if (ordering) {
              return (
                <div
                  key={h.id}
                  className="flex min-h-[52px] items-center justify-between gap-3 border-b-[0.5px] border-separator"
                >
                  <span className="truncate">{h.name}</span>
                  <div className="flex shrink-0">
                    <IconButton
                      label="Move up"
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                    >
                      ↑
                    </IconButton>
                    <IconButton
                      label="Move down"
                      disabled={i === habits.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      ↓
                    </IconButton>
                  </div>
                </div>
              );
            }
            const from = addDays(today, -29);
            const c = completion(h, t, start > from ? start : from);
            const s = streaks(h, t, start);
            return (
              <Link
                key={h.id}
                href={`/habits/${h.id}`}
                className="press block border-b-[0.5px] border-separator py-3"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate">{h.name}</span>
                  <span className="tnum shrink-0 text-[15px] text-secondary">
                    {s.current >= 2 ? `${s.current}-day streak · ` : ""}
                    {percent(c.due ? c.done / c.due : null)} ›
                  </span>
                </span>
                <span className="mt-2 block">
                  <MonthStrip habit={h} t={t} start={start} />
                </span>
              </Link>
            );
          })}
        </div>
      </Section>

      {archived.length ? <Archived habits={archived} /> : null}

      <UndoBar undo={undo} onUndo={take} />
    </Page>
  );
}

function Archived({ habits }: { habits: Habit[] }) {
  return (
    <Section title="Archived" className="mt-9">
      {habits.map((h) => (
        <Row key={h.id} href={`/habits/${h.id}`}>
          <span className="truncate text-secondary">{h.name}</span>
          <span className="shrink-0 text-[15px] text-secondary">›</span>
        </Row>
      ))}
    </Section>
  );
}
