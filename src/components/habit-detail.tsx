"use client";

import Link from "next/link";
import { useState } from "react";
import { useDb } from "@/lib/client/store";
import { day, isoDay, plural, shortDay } from "@/lib/format";
import {
  addDays,
  byWeekday,
  completion,
  describeDays,
  isDue,
  percent,
  startOf,
  streaks,
  tally,
  timesADay,
} from "@/lib/habits";
import { Bars } from "./charts";
import { DayStepper, Dots, HabitGrid } from "./habits";
import { Empty, Header, Page, Section, Stat, StatGrid } from "./ui";

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export function HabitDetail({ id }: { id: string }) {
  const db = useDb();
  const [picked, setPicked] = useState<string | null>(null);
  if (!db) return null;
  const habit = db.habits.find((h) => h.id === id);

  if (!habit) {
    return (
      <Page>
        <Header back={{ href: "/habits", label: "Habits" }} title="Not found" />
        <Empty>This habit doesn't exist, or it was deleted.</Empty>
      </Page>
    );
  }

  const today = isoDay();
  const t = tally(db);
  const start = startOf(db, habit);
  const s = streaks(habit, t, start);
  const from30 = addDays(today, -29);
  const month = completion(habit, t, start > from30 ? start : from30);
  const all = completion(habit, t, start);
  const total = db.habitLogs
    .filter((l) => l.habitId === habit.id)
    .reduce((a, l) => a + l.count, 0);
  const weekdays = byWeekday(habit, t, start);
  const showWeekdays = all.due >= 14;

  return (
    <Page>
      <Header
        back={{ href: "/habits", label: "Habits" }}
        title={habit.name}
        sub={`${timesADay(habit.target)} · ${describeDays(habit.days)}${habit.archived ? " · Archived" : ""}`}
        action={
          <Link
            href={`/habits/${habit.id}/edit`}
            className="press text-[15px] font-medium"
          >
            Edit
          </Link>
        }
      />

      {!habit.archived ? (
        <Section title={isDue(habit, today) ? "Today" : "Today · not due"}>
          <div className="flex min-h-[64px] items-center justify-between gap-4 border-b-[0.5px] border-separator py-2">
            <Dots count={t.count(habit.id, today)} target={habit.target} />
            <DayStepper habit={habit} t={t} date={today} />
          </div>
        </Section>
      ) : null}

      <Section title="Progress">
        <StatGrid>
          <Stat
            big
            label="Current"
            value={plural(s.current, "day")}
            sub={
              s.current && s.current >= s.best
                ? "Your best yet"
                : `Best ${plural(s.best, "day")}`
            }
          />
          <Stat
            big
            label="Last 30 days"
            value={percent(month.due ? month.done / month.due : null)}
            sub={`${month.done} of ${plural(month.due, "day")}`}
          />
          <Stat
            label="All time"
            value={percent(all.due ? all.done / all.due : null)}
            sub={`${all.done} of ${plural(all.due, "day")}`}
          />
          <Stat
            label="Logged"
            value={plural(total, "time")}
            sub={`since ${shortDay(new Date(`${start}T12:00`))}`}
          />
        </StatGrid>
      </Section>

      <Section title="History">
        <div className="pt-3">
          <HabitGrid
            habit={habit}
            t={t}
            start={start}
            weeks={16}
            picked={picked}
            onPick={setPicked}
          />
          <div className="mt-3 flex items-center gap-4 text-[13px] text-secondary">
            <Key className="bg-black" label="Done" />
            {habit.target > 1 ? <Key className="part" label="Part" /> : null}
            <Key className="bg-fill" label="Missed" />
            {habit.days ? (
              <Key
                className="border-[0.5px] border-separator"
                label="Not due"
              />
            ) : null}
          </div>
          {picked ? (
            <div className="mt-4 flex items-center justify-between gap-4 border-t-[0.5px] border-separator pt-4">
              <div className="min-w-0">
                <div>{day(new Date(`${picked}T12:00`))}</div>
                <div className="text-[13px] text-secondary">
                  {isDue(habit, picked) ? "Fix this day" : "Not due this day"}
                </div>
              </div>
              <DayStepper habit={habit} t={t} date={picked} />
            </div>
          ) : (
            <p className="mt-3 text-[13px] text-secondary">
              Tap a day to see or fix it.
            </p>
          )}
        </div>
      </Section>

      {showWeekdays ? (
        <Section title="By weekday">
          <Bars
            max={1}
            rows={weekdays.flatMap((rate, i) =>
              rate === null
                ? []
                : [
                    {
                      key: WEEKDAYS[i],
                      label: WEEKDAYS[i],
                      value: rate,
                      display: percent(rate),
                    },
                  ],
            )}
          />
        </Section>
      ) : null}
    </Page>
  );
}

function Key({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={
          className === "part"
            ? "h-2.5 w-2.5 rounded-[2px] bg-[linear-gradient(to_top,#000_50%,var(--color-fill)_50%)]"
            : `h-2.5 w-2.5 rounded-[2px] ${className}`
        }
      />
      {label}
    </span>
  );
}
