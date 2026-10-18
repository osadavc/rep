"use client";

import Link from "next/link";
import { useState } from "react";
import { Bars, Columns, LineChart, RangeBars } from "@/components/charts";
import { Chip } from "@/components/exercise-picker";
import {
  Button,
  cx,
  Empty,
  field,
  Header,
  Page,
  Row,
  Section,
  Stat,
  StatGrid,
  TextButton,
} from "@/components/ui";
import { dispatch, useDb } from "@/lib/client/store";
import { clockOfDay, day, hm, isoDay, shortDay } from "@/lib/format";
import { newId, sleepGoal } from "@/lib/model";
import {
  beforeTraining,
  byWeekday,
  nights as getNights,
  type Night,
  summary,
  toEntryTimes,
  usualTimes,
} from "@/lib/sleep";
import { movingAverage } from "@/lib/stats";

const RANGES = [
  { label: "2 weeks", days: 14 },
  { label: "Month", days: 30 },
  { label: "3 months", days: 91 },
  { label: "Year", days: 365 },
];

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const hhmm = (minutes: number) => clockOfDay(minutes);
const toClock = (t: number) => {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export default function SleepPage() {
  const db = useDb();
  const [range, setRange] = useState(30);
  // The form starts empty and falls back to your usual times until you change it.
  const [bed, setBed] = useState<string | null>(null);
  const [wake, setWake] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  if (!db) return null;

  const all = getNights(db);
  const goal = sleepGoal(db);
  const usual = usualTimes(all);
  const wakeDay = date ?? isoDay();
  const existing = all.find((n) => n.date === wakeDay);
  // Untouched fields show that night's times if it's logged, else your usual ones.
  const bedClock =
    bed ?? (existing ? toClock(existing.entry.bed) : hhmm(usual.bed));
  const wakeClock =
    wake ?? (existing ? toClock(existing.entry.wake) : hhmm(usual.wake));
  const times = toEntryTimes(wakeDay, bedClock, wakeClock);
  const length = (times.wake - times.bed) / 60_000;
  const valid = Number.isFinite(length) && length > 0 && length <= 20 * 60;

  function reset() {
    setBed(null);
    setWake(null);
    setDate(null);
    setEditing(null);
  }

  function save() {
    if (!valid) return;
    dispatch({
      t: "sleep.put",
      entry: { id: existing?.entry.id ?? editing ?? newId(), ...times },
    });
    reset();
  }

  function edit(n: Night) {
    setEditing(n.entry.id);
    setDate(n.date);
    setBed(toClock(n.entry.bed));
    setWake(toClock(n.entry.wake));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const cutoff = isoDay(Date.now() - range * 86_400_000);
  const list = all.filter((n) => n.date > cutoff);
  const s = summary(list, goal);
  const last = all.at(-1);
  const training = beforeTraining(db, list);
  const weekday = byWeekday(list);

  return (
    <Page>
      <Header
        title="Sleep"
        sub={
          last
            ? `${last.date === isoDay() ? "Last night" : `Last logged ${day(new Date(`${last.date}T12:00`))}`} · ${hm(last.minutes)} · ${hhmm(last.bed + 720)} → ${hhmm(last.wake + 720)}`
            : undefined
        }
      />

      <Section
        title={
          editing || existing
            ? `Night before ${day(new Date(`${wakeDay}T12:00`))}`
            : "Log last night"
        }
      >
        <div className="grid grid-cols-2 gap-4 pt-3">
          <label className="block min-w-0">
            <span className="block text-[13px] text-secondary">
              Went to bed
            </span>
            <input
              type="time"
              value={bedClock}
              onChange={(e) => setBed(e.target.value || null)}
              className={cx(
                field,
                "tnum h-14 appearance-auto text-[24px] font-semibold tracking-[-0.02em]",
              )}
            />
          </label>
          <label className="block min-w-0">
            <span className="block text-[13px] text-secondary">Woke up</span>
            <input
              type="time"
              value={wakeClock}
              onChange={(e) => setWake(e.target.value || null)}
              className={cx(
                field,
                "tnum h-14 appearance-auto text-[24px] font-semibold tracking-[-0.02em]",
              )}
            />
          </label>
        </div>
        <div className="mt-4 flex items-end justify-between gap-4">
          <label className="block min-w-0">
            <span className="block text-[13px] text-secondary">Woke up on</span>
            <input
              type="date"
              value={wakeDay}
              max={isoDay()}
              onChange={(e) => setDate(e.target.value || null)}
              className={cx(field, "appearance-auto")}
            />
          </label>
          <div className="text-right">
            <div className="text-[13px] text-secondary">Slept</div>
            <div className="tnum text-[28px] font-semibold tracking-[-0.02em]">
              {valid ? hm(length) : "–"}
            </div>
          </div>
        </div>
        <Button className="mt-5" disabled={!valid} onClick={save}>
          {existing ? "Update" : "Log"}
        </Button>
        {editing || existing ? (
          <div className="mt-2 flex justify-between">
            <TextButton className="text-secondary" onClick={reset}>
              Cancel
            </TextButton>
            {existing ? (
              <TextButton
                className="text-secondary"
                onClick={() => {
                  if (
                    confirm(
                      `Delete the night before ${day(new Date(`${wakeDay}T12:00`))}?`,
                    )
                  ) {
                    dispatch({ t: "sleep.delete", id: existing.entry.id });
                    reset();
                  }
                }}
              >
                Delete
              </TextButton>
            ) : null}
          </div>
        ) : null}
      </Section>

      {all.length === 0 ? (
        <Empty>Log a few nights and your patterns show up here.</Empty>
      ) : (
        <>
          <div className="-mx-5 mb-7 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none]">
            {RANGES.map((r) => (
              <Chip
                key={r.days}
                on={range === r.days}
                onClick={() => setRange(r.days)}
              >
                {r.label}
              </Chip>
            ))}
          </div>

          {list.length === 0 ? (
            <Empty>No nights logged in this range.</Empty>
          ) : (
            <>
              <Section
                title="Summary"
                action={
                  <Link
                    href="/settings"
                    className="press text-[13px] font-medium"
                  >
                    Goal {hm(goal)}
                  </Link>
                }
              >
                <StatGrid>
                  <Stat
                    label="Average"
                    value={hm(s.average)}
                    sub={`${s.metGoal} of ${s.count} nights hit ${hm(goal)}`}
                  />
                  <Stat
                    label="Bedtime"
                    value={hhmm(s.bed + 720)}
                    sub={`± ${Math.round(s.bedSpread)} min`}
                  />
                  <Stat
                    label="Wake up"
                    value={hhmm(s.wake + 720)}
                    sub={`± ${Math.round(s.wakeSpread)} min`}
                  />
                  <Stat
                    label="Sleep debt"
                    value={hm(s.debt)}
                    sub={`short of ${hm(goal)} a night`}
                  />
                  {s.longest ? (
                    <Stat
                      label="Longest"
                      value={hm(s.longest.minutes)}
                      sub={shortDay(new Date(`${s.longest.date}T12:00`))}
                    />
                  ) : null}
                  {s.shortest ? (
                    <Stat
                      label="Shortest"
                      value={hm(s.shortest.minutes)}
                      sub={shortDay(new Date(`${s.shortest.date}T12:00`))}
                    />
                  ) : null}
                </StatGrid>
              </Section>

              <Section title="Schedule">
                <div className="pt-3">
                  <RangeBars
                    data={list.map((n) => ({
                      key: n.entry.id,
                      label: shortDay(new Date(`${n.date}T12:00`)),
                      start: n.bed,
                      end: n.wake,
                    }))}
                    summary={`Usually ${hhmm(s.bed + 720)} → ${hhmm(s.wake + 720)}`}
                    describe={(d) => (
                      <>
                        {d.label} · {hhmm(d.start + 720)} → {hhmm(d.end + 720)}{" "}
                        · <b className="font-semibold">{hm(d.end - d.start)}</b>
                      </>
                    )}
                  />
                </div>
              </Section>

              <Section title="Hours per night">
                <div className="pt-3">
                  <Columns
                    data={list.map((n) => ({
                      key: n.entry.id,
                      label: shortDay(new Date(`${n.date}T12:00`)),
                      value: n.minutes,
                    }))}
                    format={hm}
                    summary={`Average ${hm(s.average)}`}
                    reference={{ value: goal, label: `Goal ${hm(goal)}` }}
                  />
                </div>
              </Section>

              {list.length >= 7 ? (
                <Section title="7-night average">
                  <div className="pt-3">
                    <LineChart
                      line={movingAverage(
                        list.map((n) => ({ t: n.entry.wake, v: n.minutes })),
                        7,
                      )}
                      format={hm}
                      formatT={shortDay}
                      summary={`Now ${hm(
                        movingAverage(
                          list.map((n) => ({ t: n.entry.wake, v: n.minutes })),
                          7,
                        ).at(-1)?.v ?? 0,
                      )}`}
                    />
                  </div>
                </Section>
              ) : null}

              <Section title="By day you woke up">
                <Bars
                  rows={weekday.map((m, i) => ({
                    key: WEEKDAYS[i],
                    label: WEEKDAYS[i],
                    value: m,
                    display: m ? hm(m) : "–",
                  }))}
                />
              </Section>

              {training.before !== null && training.other !== null ? (
                <Section title="Sleep and training">
                  <StatGrid>
                    <Stat
                      label="Before training days"
                      value={hm(training.before)}
                      sub={`${training.beforeCount} nights`}
                    />
                    <Stat
                      label="Other nights"
                      value={hm(training.other)}
                      sub={`${training.otherCount} nights`}
                    />
                  </StatGrid>
                </Section>
              ) : null}
            </>
          )}

          <Section title="Nights">
            {[...all]
              .reverse()
              .slice(0, 60)
              .map((n) => (
                <Row key={n.entry.id} onClick={() => edit(n)}>
                  <div className="min-w-0">
                    <div>{day(new Date(`${n.date}T12:00`))}</div>
                    <div className="tnum text-[15px] text-secondary">
                      {hhmm(n.bed + 720)} → {hhmm(n.wake + 720)}
                    </div>
                  </div>
                  <span
                    className={cx(
                      "tnum shrink-0",
                      n.minutes < goal ? "text-secondary" : "font-medium",
                    )}
                  >
                    {hm(n.minutes)}
                  </span>
                </Row>
              ))}
            <p className="pt-2 text-[13px] text-secondary">
              Tap a night to change or delete it.
            </p>
          </Section>
        </>
      )}
    </Page>
  );
}
