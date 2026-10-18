"use client";

import Link from "next/link";
import { useDb } from "@/lib/client/store";
import {
  day,
  duration,
  fmtDist,
  fmtMass,
  fmtNum,
  fmtWeight,
  pace,
  plural,
  seconds,
  shortDay,
  toDist,
  toUnit,
} from "@/lib/format";
import { distanceUnit, KIND_LABEL } from "@/lib/model";
import { exerciseHistory, type HistoryEntry, records } from "@/lib/stats";
import { LineChart } from "./charts";
import { describeSet } from "./sets";
import { Empty, Header, Page, Section, Stat, StatGrid } from "./ui";

type Chart = {
  title: string;
  points: { t: number; v: number }[];
  format: (v: number) => string;
  note?: string;
};

const sum = (h: HistoryEntry[], f: (x: HistoryEntry) => number) =>
  h.reduce((a, x) => a + f(x), 0);
const at = (h: HistoryEntry) => h.session.startedAt;

export function ExerciseStats({ id }: { id: string }) {
  const db = useDb();
  if (!db) return null;
  const exercise = db.exercises.find((e) => e.id === id);
  const unit = db.settings.unit;
  const dist = distanceUnit(db);
  const back = { href: "/stats", label: "Stats" };

  if (!exercise) {
    return (
      <Page>
        <Header back={back} title="Not found" />
        <Empty>This exercise doesn't exist.</Empty>
      </Page>
    );
  }

  const kind = exercise.kind;
  const history = exerciseHistory(db, id);
  const rec = records(db).byExercise.get(id);
  const kindLabel = KIND_LABEL[kind].toLowerCase();
  const sub =
    exercise.muscle === kindLabel
      ? kindLabel
      : `${exercise.muscle} · ${kindLabel}`;

  if (!history.length || !rec) {
    return (
      <Page>
        <Header back={back} title={exercise.name} sub={sub} />
        <Empty>Not done yet.</Empty>
      </Page>
    );
  }

  const w = (kg: number) => `${fmtWeight(kg, unit)} ${unit}`;
  const w1 = (kg: number) => `${fmtNum(toUnit(kg, unit), 1)} ${unit}`;
  const secs = (v: number) => seconds(Math.round(v));
  const series = (
    f: (x: HistoryEntry) => number,
    keep = (v: number) => v > 0,
  ) => history.map((h) => ({ t: at(h), v: f(h) })).filter((p) => keep(p.v));
  const firstAt = at(history[0]);
  const totalSets = sum(history, (h) => h.sets.length);
  const totalReps = sum(history, (h) => h.reps);
  const rest = series((h) => h.restAvg);
  const restChart: Chart = {
    title: "Rest between sets",
    points: rest,
    format: secs,
    note: "Average per workout",
  };

  let charts: Chart[] = [];
  if (kind === "weight") {
    charts = [
      {
        title: "Best est. 1RM",
        points: series((h) => h.best),
        format: w1,
        note: "Best set of each workout, Epley formula",
      },
      { title: "Heaviest set", points: series((h) => h.topWeight), format: w },
      {
        title: "Volume",
        points: series((h) => h.volume),
        format: (v) => fmtMass(v, unit),
        note: "Weight × reps, all sets",
      },
      {
        title: "Reps per workout",
        points: series((h) => h.reps),
        format: (v) => fmtNum(v, 0),
      },
      restChart,
    ];
  } else if (kind === "reps") {
    charts = [
      {
        title: "Most reps in a set",
        points: series((h) => h.maxReps),
        format: (v) => fmtNum(v, 0),
      },
      {
        title: "Reps per workout",
        points: series((h) => h.reps),
        format: (v) => fmtNum(v, 0),
      },
      restChart,
    ];
  } else if (kind === "time") {
    charts = [
      { title: "Longest set", points: series((h) => h.best), format: secs },
      {
        title: "Time per workout",
        points: series((h) => h.seconds),
        format: secs,
      },
      restChart,
    ];
  } else {
    const paced = history.filter((h) => h.distance >= 0.4 && h.seconds > 0);
    charts = [
      {
        title: "Distance",
        points: series((h) => toDist(h.distance, dist)),
        format: (v) => `${fmtNum(v, 2)} ${dist}`,
      },
      { title: "Duration", points: series((h) => h.seconds), format: secs },
      {
        title: "Pace",
        points: paced.map((h) => ({
          t: at(h),
          v: h.seconds / toDist(h.distance, dist),
        })),
        format: (v) =>
          `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, "0")} /${dist}`,
        note: "Lower is faster",
      },
      {
        title: "Calories",
        points: series((h) => h.calories),
        format: (v) => `${fmtNum(v, 0)} kcal`,
      },
      {
        title: "Average heart rate",
        points: series((h) => h.heartRate),
        format: (v) => `${fmtNum(v, 0)} bpm`,
      },
    ];
  }
  charts = charts.filter((c) => c.points.length > 1);

  const totalSeconds = sum(history, (h) => h.seconds);
  const totalDistance = sum(history, (h) => h.distance);
  const totalCalories = sum(history, (h) => h.calories);
  const hrSessions = history.filter((h) => h.heartRate);

  return (
    <Page>
      <Header back={back} title={exercise.name} sub={sub} />

      <Section>
        <StatGrid>
          {kind === "weight" ? (
            <>
              {rec.e1rm ? (
                <Stat
                  label="Est. 1RM"
                  value={w1(rec.e1rm.value)}
                  sub={shortDay(rec.e1rm.at)}
                />
              ) : null}
              {rec.weight ? (
                <Stat
                  label="Heaviest"
                  value={w(rec.weight.value)}
                  sub={
                    rec.weight.set
                      ? `× ${rec.weight.set.reps} · ${shortDay(rec.weight.at)}`
                      : undefined
                  }
                />
              ) : null}
              {rec.volume ? (
                <Stat
                  label="Best workout"
                  value={fmtMass(rec.volume.value, unit)}
                  sub={shortDay(rec.volume.at)}
                />
              ) : null}
              <Stat
                label="Total volume"
                value={fmtMass(
                  sum(history, (h) => h.volume),
                  unit,
                )}
              />
            </>
          ) : null}
          {kind === "reps" && rec.reps ? (
            <>
              <Stat
                label="Most reps"
                value={rec.reps.value}
                sub={shortDay(rec.reps.at)}
              />
              <Stat
                label="Best workout"
                value={`${Math.max(...history.map((h) => h.reps))} reps`}
              />
            </>
          ) : null}
          {kind === "time" && rec.time ? (
            <Stat
              label="Longest"
              value={secs(rec.time.value)}
              sub={shortDay(rec.time.at)}
            />
          ) : null}
          {kind === "cardio" ? (
            <>
              {rec.distance ? (
                <Stat
                  label="Farthest"
                  value={fmtDist(rec.distance.value, dist)}
                  sub={shortDay(rec.distance.at)}
                />
              ) : null}
              {rec.time ? (
                <Stat
                  label="Longest"
                  value={secs(rec.time.value)}
                  sub={shortDay(rec.time.at)}
                />
              ) : null}
              {rec.speed?.set ? (
                <Stat
                  label="Fastest pace"
                  value={pace(
                    rec.speed.set.seconds ?? 0,
                    rec.speed.set.distance ?? 0,
                    dist,
                  )}
                  sub={`${fmtDist(rec.speed.set.distance ?? 0, dist)} · ${shortDay(rec.speed.at)}`}
                />
              ) : null}
              {totalDistance ? (
                <Stat
                  label="Total distance"
                  value={fmtDist(totalDistance, dist, 1)}
                  sub={
                    totalSeconds
                      ? `avg ${pace(totalSeconds, totalDistance, dist)}`
                      : undefined
                  }
                />
              ) : null}
              {totalCalories ? (
                <Stat
                  label="Calories"
                  value={fmtNum(totalCalories, 0)}
                  sub="total"
                />
              ) : null}
              {hrSessions.length ? (
                <Stat
                  label="Avg heart rate"
                  value={`${fmtNum(sum(hrSessions, (h) => h.heartRate) / hrSessions.length, 0)} bpm`}
                />
              ) : null}
            </>
          ) : null}
          <Stat
            label="Done"
            value={plural(history.length, "time")}
            sub={`since ${shortDay(firstAt)}`}
          />
          {kind === "time" || kind === "cardio" ? (
            <Stat label="Total time" value={duration(totalSeconds * 1000)} />
          ) : null}
          <Stat label="Sets" value={fmtNum(totalSets, 0)} />
          {totalReps ? (
            <Stat label="Reps" value={fmtNum(totalReps, 0)} />
          ) : null}
        </StatGrid>
      </Section>

      {charts.map((c) => {
        const latest = c.points.at(-1)?.v ?? 0;
        return (
          <Section key={c.title} title={c.title}>
            {c.note ? (
              <p className="pt-2 text-[13px] text-secondary">{c.note}</p>
            ) : null}
            <div className="pt-3">
              <LineChart
                line={c.points}
                format={c.format}
                formatT={shortDay}
                summary={`Latest ${c.format(latest)}`}
              />
            </div>
          </Section>
        );
      })}

      {kind === "weight" && Object.keys(rec.repMax).length ? (
        <Section title="Best weight by reps">
          <div className="tnum grid grid-cols-[48px_1fr_auto] gap-y-0 pt-1 text-[15px]">
            {Object.entries(rec.repMax)
              .filter(([r]) => Number(r) <= 12)
              .map(([r, b]) => (
                <div key={r} className="contents">
                  <span className="border-b-[0.5px] border-separator py-2 text-secondary">
                    {r} RM
                  </span>
                  <span className="border-b-[0.5px] border-separator py-2 font-medium">
                    {w(b.value)}
                  </span>
                  <span className="border-b-[0.5px] border-separator py-2 text-right text-secondary">
                    {shortDay(b.at)}
                  </span>
                </div>
              ))}
          </div>
        </Section>
      ) : null}

      <Section title="History">
        {[...history].reverse().map((h) => (
          <Link
            key={h.session.id}
            href={`/history/${h.session.id}`}
            className="press block border-b-[0.5px] border-separator py-3"
          >
            <div className="flex justify-between gap-3 text-[15px]">
              <span className="font-medium">{day(h.session.startedAt)}</span>
              <span className="truncate text-secondary">{h.session.name}</span>
            </div>
            <div className="tnum mt-0.5 text-[15px] text-black/80">
              {h.sets
                .map((s) => describeSet(s, kind, unit, dist))
                .join("  ·  ")}
            </div>
          </Link>
        ))}
      </Section>
    </Page>
  );
}
