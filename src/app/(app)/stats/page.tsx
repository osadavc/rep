"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ActivityGrid,
  Bars,
  Columns,
  LineChart,
  MiniColumns,
  Sparkline,
} from "@/components/charts";
import { Chip } from "@/components/exercise-picker";
import { PrRow } from "@/components/session-view";
import {
  Empty,
  Header,
  Page,
  Row,
  Section,
  Stat,
  StatGrid,
} from "@/components/ui";
import { useDb } from "@/lib/client/store";
import {
  ago,
  day,
  duration,
  fmtDist,
  fmtMass,
  fmtNum,
  plural,
  seconds,
  shortDay,
  toUnit,
} from "@/lib/format";
import { distanceUnit } from "@/lib/model";
import {
  dayKey,
  exerciseMap,
  isCardio,
  longestBreak,
  muscleWeeks,
  overview,
  records,
  strengthTrends,
  summarize,
  trainedDays,
  weeklySeries,
  weekStart,
  weekStreaks,
} from "@/lib/stats";

const RANGES = [
  { key: "4w", label: "4 weeks", weeks: 4 },
  { key: "3m", label: "3 months", weeks: 13 },
  { key: "1y", label: "Year", weeks: 52 },
  { key: "all", label: "All", weeks: 0 },
] as const;

const METRICS = [
  "Volume",
  "Workouts",
  "Sets",
  "Time",
  "Cardio",
  "Distance",
] as const;
const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export default function StatsPage() {
  const db = useDb();
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("3m");
  const [metric, setMetric] = useState<(typeof METRICS)[number]>("Volume");
  if (!db) return null;
  const unit = db.settings.unit;
  const dist = distanceUnit(db);

  if (db.sessions.length === 0) {
    return (
      <Page>
        <Header title="Stats" />
        <Empty>Finish a workout and your stats start here.</Empty>
      </Page>
    );
  }

  const r = RANGES.find((x) => x.key === range) ?? RANGES[1];
  const first = db.sessions[0].startedAt;
  const allWeeks = Math.max(
    1,
    Math.round((weekStart(Date.now()) - weekStart(first)) / (7 * 86_400_000)) +
      1,
  );
  const weeks = r.weeks || Math.min(allWeeks, 104);
  const from = r.weeks
    ? weekStart(Date.now()) - (r.weeks - 1) * 7 * 86_400_000
    : 0;
  const sessions = db.sessions.filter((s) => s.startedAt >= from);
  const o = overview(sessions, db);
  const t = o.total;
  const spanWeeks = Math.min(weeks, allWeeks);
  const streaks = weekStreaks(db.sessions);
  const last = db.sessions.at(-1);
  const { prs } = records(db);
  const rangePrs = prs.filter((p) => p.at >= from).reverse();
  const series = weeklySeries(db, weeks);
  const days = trainedDays(db.sessions);
  const byDay = new Map<string, string[]>();
  for (const s of db.sessions) {
    const k = dayKey(new Date(s.startedAt));
    byDay.set(k, [...(byDay.get(k) ?? []), s.name]);
  }
  const exName = new Map(db.exercises.map((e) => [e.id, e.name]));
  const mostSkipped = [...o.exercises.entries()].sort(
    (a, b) => b[1].skipped - a[1].skipped,
  )[0];

  const metricValue = (w: (typeof series)[number]) =>
    metric === "Volume"
      ? w.volume
      : metric === "Workouts"
        ? w.workouts
        : metric === "Sets"
          ? w.sets
          : metric === "Time"
            ? w.duration
            : metric === "Cardio"
              ? w.cardio * 1000
              : w.distance;
  const metricFormat = (v: number) =>
    metric === "Volume"
      ? fmtMass(v, unit)
      : metric === "Time" || metric === "Cardio"
        ? duration(v)
        : metric === "Distance"
          ? fmtDist(v, dist, 1)
          : fmtNum(v, 0);
  const avg =
    series.reduce((a, w) => a + metricValue(w), 0) / Math.max(1, series.length);

  const ex = exerciseMap(db);
  const perSession = sessions.map((x) => ({
    session: x,
    sum: summarize(x, ex),
  }));
  const strength = strengthTrends(db, from);
  const muscleSpan = Math.min(weeks, 26);
  const mw = muscleWeeks(db, muscleSpan);
  const muscleRows = [...mw.muscles.entries()]
    .map(([m, values]) => ({
      m,
      values,
      total: values.reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.total - a.total);
  const cardioRows = [...o.exercises.entries()]
    .filter(([id, x]) => isCardio(ex.get(id)) && x.sessions > 0)
    .sort((a, b) => b[1].sessions - a[1].sessions);

  return (
    <Page>
      <Header title="Stats" sub={`Since ${day(first)}`} />

      <div className="-mx-5 mb-7 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none]">
        {RANGES.map((x) => (
          <Chip
            key={x.key}
            on={range === x.key}
            onClick={() => setRange(x.key)}
          >
            {x.label}
          </Chip>
        ))}
      </div>

      <Section title="Overview">
        {t.workouts ? (
          <StatGrid>
            <Stat
              label="Workouts"
              value={t.workouts}
              sub={`${fmtNum(t.workouts / spanWeeks, 1)} a week`}
            />
            <Stat
              label="Time"
              value={duration(t.duration)}
              sub={`${duration(t.duration / t.workouts)} each`}
            />
            {t.volume ? (
              <Stat
                label="Volume"
                value={fmtMass(t.volume, unit)}
                sub={`${fmtMass(t.volume / t.workouts, unit)} each`}
              />
            ) : null}
            <Stat
              label="Sets"
              value={fmtNum(t.sets, 0)}
              sub={`${fmtNum(t.sets / t.workouts, 0)} each`}
            />
            <Stat label="Reps" value={fmtNum(t.reps, 0)} />
            {t.restCount ? (
              <Stat
                label="Avg rest"
                value={seconds(Math.round(t.restTotal / t.restCount))}
                sub="between sets"
              />
            ) : null}
            {t.cardioSeconds ? (
              <Stat
                label="Cardio"
                value={duration(t.cardioSeconds * 1000)}
                sub={t.distance ? fmtDist(t.distance, dist, 1) : undefined}
              />
            ) : null}
            {t.calories ? (
              <Stat
                label="Calories"
                value={fmtNum(t.calories, 0)}
                sub="logged"
              />
            ) : null}
          </StatGrid>
        ) : (
          <Empty>No workouts in this range.</Empty>
        )}
      </Section>

      <Section title="Consistency">
        <StatGrid>
          <Stat
            label="Week streak"
            value={streaks.current}
            sub={`best ${streaks.longest}`}
          />
          <Stat label="Last workout" value={last ? ago(last.startedAt) : "–"} />
          <Stat
            label="Longest break"
            value={plural(longestBreak(db.sessions), "day")}
          />
        </StatGrid>
        <ActivityGrid
          weeks={52}
          trained={(d) => days.has(dayKey(d))}
          describe={(d) =>
            `${day(d)} · ${byDay.get(dayKey(d))?.join(", ") ?? "rest day"}`
          }
        />
      </Section>

      <Section title="Per week">
        <div className="-mx-5 mb-3 flex gap-2 overflow-x-auto px-5 pt-3 [scrollbar-width:none]">
          {METRICS.map((m) => (
            <Chip key={m} on={metric === m} onClick={() => setMetric(m)}>
              {m}
            </Chip>
          ))}
        </div>
        <Columns
          data={series.map((w) => ({
            key: w.start,
            label: shortDay(w.start),
            value: metricValue(w),
          }))}
          format={metricFormat}
          summary={`Average ${metricFormat(avg)} a week`}
        />
      </Section>

      {strength.length ? (
        <Section title="Strength">
          <p className="pt-2 pb-1 text-[13px] text-secondary">
            Best estimated 1RM per workout for the lifts you do most.
          </p>
          {strength.map(({ exercise, points }) => {
            const first = points[0]?.v ?? 0;
            const latest = points.at(-1)?.v ?? 0;
            const change = first ? ((latest - first) / first) * 100 : 0;
            return (
              <Link
                key={exercise.id}
                href={`/stats/${exercise.id}`}
                className="press flex min-h-[60px] items-center justify-between gap-4 border-b-[0.5px] border-separator py-2"
              >
                <div className="min-w-0">
                  <div className="truncate">{exercise.name}</div>
                  <div className="tnum text-[13px] text-secondary">
                    {fmtNum(toUnit(latest, unit), 1)} {unit}
                    {points.length > 1
                      ? ` · ${change >= 0 ? "+" : "−"}${fmtNum(Math.abs(change), 1)}%`
                      : ""}
                  </div>
                </div>
                <Sparkline points={points} />
              </Link>
            );
          })}
        </Section>
      ) : null}

      {o.muscles.size ? (
        <Section title="Sets per muscle">
          <Bars
            rows={[...o.muscles.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([m, n]) => ({
                key: m,
                label: m,
                value: n,
                display: `${n} · ${fmtNum(n / spanWeeks, 1)}/wk`,
              }))}
          />
        </Section>
      ) : null}

      {muscleRows.length ? (
        <Section title="Muscles per week">
          <p className="pt-2 text-[13px] text-secondary">
            Sets each week, last {muscleSpan} weeks. The darkest bar is this
            week.
          </p>
          <div className="grid grid-cols-2 gap-x-5 gap-y-5 pt-4 sm:grid-cols-3">
            {muscleRows.map(({ m, values, total }) => (
              <div key={m} className="min-w-0">
                <div className="flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="truncate font-medium capitalize">{m}</span>
                  <span className="tnum shrink-0 text-secondary">
                    {fmtNum(total / muscleSpan, 1)}/wk
                  </span>
                </div>
                <div className="mt-1.5">
                  <MiniColumns values={values} />
                </div>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {perSession.length > 1 ? (
        <Section title="Workout length">
          <div className="pt-3">
            <LineChart
              line={perSession.map(({ session, sum }) => ({
                t: session.startedAt,
                v: sum.duration / 60_000,
              }))}
              format={(v) => duration(v * 60_000)}
              formatT={shortDay}
              summary={`Average ${duration(t.duration / Math.max(1, t.workouts))}`}
            />
          </div>
        </Section>
      ) : null}

      {perSession.filter((x) => x.sum.restCount).length > 1 ? (
        <Section title="Rest between sets">
          <div className="pt-3">
            <LineChart
              line={perSession
                .filter((x) => x.sum.restCount)
                .map(({ session, sum }) => ({
                  t: session.startedAt,
                  v: sum.restTotal / sum.restCount,
                }))}
              format={(v) => seconds(Math.round(v))}
              formatT={shortDay}
              summary={`Average ${seconds(Math.round(t.restTotal / Math.max(1, t.restCount)))} per workout`}
            />
          </div>
        </Section>
      ) : null}

      {cardioRows.length ? (
        <Section title="Cardio">
          <StatGrid>
            <Stat label="Time" value={duration(t.cardioSeconds * 1000)} />
            {t.distance ? (
              <Stat label="Distance" value={fmtDist(t.distance, dist, 1)} />
            ) : null}
            <Stat
              label="Sessions"
              value={cardioRows.reduce((a, [, x]) => a + x.sessions, 0)}
            />
          </StatGrid>
          {cardioRows.map(([id, x]) => (
            <Row key={id} href={`/stats/${id}`}>
              <div className="min-w-0">
                <div className="truncate">{exName.get(id) ?? "Unknown"}</div>
                <div className="tnum text-[13px] text-secondary">
                  {plural(x.sessions, "time")}
                  {x.distance ? ` · ${fmtDist(x.distance, dist, 1)}` : ""}
                  {x.seconds ? ` · ${duration(x.seconds * 1000)}` : ""}
                </div>
              </div>
              <span className="shrink-0 text-[13px] text-secondary">
                {ago(x.last)}
              </span>
            </Row>
          ))}
        </Section>
      ) : null}

      <Section title="Records">
        {rangePrs.length ? (
          rangePrs
            .slice(0, 10)
            .map((p) => (
              <PrRow
                key={`${p.sessionId}-${p.exerciseId}-${p.type}`}
                pr={p}
                db={db}
                showDate
              />
            ))
        ) : (
          <Empty>No new records in this range.</Empty>
        )}
      </Section>

      <Section title="Exercises">
        {[...o.exercises.entries()]
          .filter(([, x]) => x.sessions > 0)
          .sort(
            (a, b) => b[1].sessions - a[1].sessions || b[1].last - a[1].last,
          )
          .map(([id, x]) => (
            <Row key={id} href={`/stats/${id}`}>
              <div className="min-w-0">
                <div className="truncate">
                  {exName.get(id) ?? "Unknown exercise"}
                </div>
                <div className="tnum text-[13px] text-secondary">
                  {plural(x.sessions, "time")} · {plural(x.sets, "set")}
                  {x.volume ? ` · ${fmtMass(x.volume, unit)}` : ""}
                  {x.distance ? ` · ${fmtDist(x.distance, dist, 1)}` : ""}
                </div>
              </div>
              <span className="shrink-0 text-[13px] text-secondary">
                {ago(x.last)}
              </span>
            </Row>
          ))}
      </Section>

      {o.routines.size ? (
        <Section title="Workouts">
          <Bars
            rows={[...o.routines.entries()]
              .sort((a, b) => b[1].count - a[1].count)
              .map(([k, x]) => ({
                key: k,
                label: <span className="normal-case">{x.name}</span>,
                value: x.count,
                display: `${x.count} · ${duration(x.duration / x.count)} avg`,
              }))}
          />
        </Section>
      ) : null}

      {t.workouts ? (
        <Section title="When you train">
          <Bars
            rows={o.weekdays.map((n, i) => ({
              key: WEEKDAYS[i],
              label: WEEKDAYS[i],
              value: n,
              display: n,
            }))}
          />
          <div className="mt-6">
            <Bars
              rows={Object.entries(o.dayparts).map(([k, n]) => ({
                key: k,
                label: k,
                value: n,
                display: n,
              }))}
            />
          </div>
        </Section>
      ) : null}

      {t.exercises ? (
        <Section title="Skipped">
          <StatGrid>
            <Stat
              label="Exercises skipped"
              value={t.skipped}
              sub={`${fmtNum((t.skipped / t.exercises) * 100, 0)}% of planned`}
            />
            {mostSkipped?.[1].skipped ? (
              <Stat
                label="Most skipped"
                value={
                  <span className="text-[17px]">
                    {exName.get(mostSkipped[0]) ?? "Unknown"}
                  </span>
                }
                sub={plural(mostSkipped[1].skipped, "time")}
              />
            ) : null}
          </StatGrid>
        </Section>
      ) : null}
    </Page>
  );
}
