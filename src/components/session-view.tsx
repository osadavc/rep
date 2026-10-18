"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { dispatch, useDb } from "@/lib/client/store";
import {
  day,
  duration,
  fmtDist,
  fmtMass,
  fmtNum,
  fmtWeight,
  isoDay,
  pace,
  plural,
  seconds,
  time,
  toDist,
  toUnit,
} from "@/lib/format";
import { type Db, distanceUnit, newId, type Session } from "@/lib/model";
import {
  e1rm,
  exerciseMap,
  PR_LABEL,
  type Pr,
  records,
  summarize,
} from "@/lib/stats";
import { SessionEditor } from "./session-editor";
import { describeSet } from "./sets";
import { Empty, Header, Page, Section, Stat, StatGrid, TextButton } from "./ui";

export function SessionView({ id }: { id: string }) {
  const db = useDb();
  const router = useRouter();
  const [editing, setEditing] = useState(id === "new");
  if (!db) return null;
  const existing = db.sessions.find((s) => s.id === id);

  if (id === "new" || (editing && existing)) {
    const now = Date.now();
    const draft: Session = existing ?? {
      id: newId(),
      name: "Workout",
      startedAt: now - 60 * 60_000,
      endedAt: now,
      exercises: [],
    };
    return (
      <SessionEditor
        initial={draft}
        title={existing ? "Edit workout" : "Log past workout"}
        onCancel={() =>
          existing ? setEditing(false) : router.push("/history")
        }
        onSave={(session) => {
          dispatch({ t: "session.put", session }, { now: true });
          if (existing) setEditing(false);
          else router.replace(`/history/${session.id}`);
        }}
      />
    );
  }

  if (!existing) {
    return (
      <Page>
        <Header
          title="Not found"
          back={{ href: "/history", label: "History" }}
        />
        <Empty>This workout doesn't exist, or it was deleted.</Empty>
      </Page>
    );
  }

  const s = existing;
  const ex = exerciseMap(db);
  const unit = db.settings.unit;
  const dist = distanceUnit(db);
  const sum = summarize(s, ex);
  const prs = records(db).prs.filter((p) => p.sessionId === s.id);
  const justFinished =
    Date.now() - s.endedAt < 5 * 60_000 && isoDay(s.endedAt) === isoDay();

  return (
    <Page>
      <Header
        back={{ href: "/history", label: "History" }}
        title={s.name}
        sub={`${day(s.startedAt)} · ${time(s.startedAt)}–${time(s.endedAt)}`}
        action={<TextButton onClick={() => setEditing(true)}>Edit</TextButton>}
      />

      {justFinished ? (
        <p className="-mt-2 mb-6 text-[17px] font-medium">
          Saved.{prs.length ? ` ${plural(prs.length, "new record")}.` : ""}
        </p>
      ) : null}

      <Section>
        <StatGrid>
          <Stat label="Duration" value={duration(sum.duration)} />
          {sum.volume ? (
            <Stat label="Volume" value={fmtMass(sum.volume, unit)} />
          ) : null}
          {sum.cardioSeconds ? (
            <Stat
              label="Cardio"
              value={seconds(sum.cardioSeconds)}
              sub={
                sum.distance
                  ? `${fmtDist(sum.distance, dist)} · ${pace(sum.cardioSeconds, sum.distance, dist)}`
                  : undefined
              }
            />
          ) : null}
          {sum.calories ? (
            <Stat label="Calories" value={fmtNum(sum.calories, 0)} />
          ) : null}
          <Stat label="Sets" value={sum.sets} />
          {sum.reps ? <Stat label="Reps" value={sum.reps} /> : null}
          {sum.restCount ? (
            <Stat
              label="Avg rest"
              value={seconds(Math.round(sum.restTotal / sum.restCount))}
            />
          ) : null}
          <Stat
            label="Exercises"
            value={sum.exercises}
            sub={sum.skipped ? `${sum.skipped} skipped` : undefined}
          />
        </StatGrid>
      </Section>

      {prs.length ? (
        <Section title="Records">
          {prs.map((p) => (
            <PrRow key={`${p.exerciseId}-${p.type}`} pr={p} db={db} />
          ))}
        </Section>
      ) : null}

      <Section title="Exercises">
        {s.exercises.map((e, i) => {
          const meta = ex.get(e.exerciseId);
          const kind = meta?.kind ?? "weight";
          const best =
            kind === "weight"
              ? Math.max(
                  0,
                  ...e.sets.map((x) => e1rm(x.weight ?? 0, x.reps ?? 0)),
                )
              : 0;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: exercises may repeat
            <div key={i} className="border-b-[0.5px] border-separator py-3">
              <div className="flex items-baseline justify-between gap-3">
                <Link
                  href={`/stats/${e.exerciseId}`}
                  className={
                    e.skipped
                      ? "press text-secondary line-through"
                      : "press font-medium"
                  }
                >
                  {meta?.name ?? "Unknown exercise"}
                </Link>
                {e.skipped ? (
                  <span className="text-[13px] text-secondary">Skipped</span>
                ) : best ? (
                  <span className="tnum text-[13px] text-secondary">
                    e1RM {fmtNum(toUnit(best, unit), 1)} {unit}
                  </span>
                ) : null}
              </div>
              {e.sets.map((set, si) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: sets are positional
                  key={si}
                  className="tnum mt-1 grid grid-cols-[22px_1fr_auto] text-[15px]"
                >
                  <span className="text-secondary">{si + 1}</span>
                  <span>{describeSet(set, kind, unit, dist)}</span>
                  <span className="text-secondary">
                    {set.rest !== undefined ? `rest ${seconds(set.rest)}` : ""}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </Section>

      {s.notes ? (
        <Section title="Notes">
          <p className="whitespace-pre-wrap pt-3 text-[15px]">{s.notes}</p>
        </Section>
      ) : null}

      <TextButton
        className="mb-8 text-secondary"
        onClick={() => {
          if (
            confirm(
              `Delete ${s.name} from ${day(s.startedAt)}? This can't be undone.`,
            )
          ) {
            dispatch({ t: "session.delete", id: s.id }, { now: true });
            router.replace("/history");
          }
        }}
      >
        Delete workout
      </TextButton>
    </Page>
  );
}

export function PrRow({
  pr,
  db,
  showDate,
}: {
  pr: Pr;
  db: Db;
  showDate?: boolean;
}) {
  const name =
    db.exercises.find((e) => e.id === pr.exerciseId)?.name ?? "Unknown";
  const unit = db.settings.unit;
  const dist = distanceUnit(db);
  const fmt = (v: number) =>
    pr.type === "reps"
      ? `${v} reps`
      : pr.type === "time"
        ? seconds(Math.round(v))
        : pr.type === "distance"
          ? fmtDist(v, dist)
          : pr.type === "speed"
            ? perDistance(v, dist)
            : pr.type === "volume"
              ? fmtMass(v, unit)
              : pr.type === "e1rm"
                ? `${fmtNum(toUnit(v, unit), 1)} ${unit}`
                : `${fmtWeight(v, unit)} ${unit}`;
  return (
    <Link
      href={`/stats/${pr.exerciseId}`}
      className="press flex min-h-[52px] items-center justify-between gap-4 border-b-[0.5px] border-separator py-2.5"
    >
      <div className="min-w-0">
        <div className="truncate">{name}</div>
        <div className="text-[13px] text-secondary">
          {PR_LABEL[pr.type]}
          {showDate ? ` · ${day(pr.at)}` : ""}
        </div>
      </div>
      <div className="tnum shrink-0 text-right">
        <div className="font-medium">{fmt(pr.value)}</div>
        <div className="text-[13px] text-secondary">was {fmt(pr.previous)}</div>
      </div>
    </Link>
  );
}

/** A speed record (km/h) shown the way runners read it: time per km or mile. */
function perDistance(kmh: number, dist: "km" | "mi") {
  const per = Math.round(3600 / toDist(kmh, dist));
  return `${Math.floor(per / 60)}:${String(per % 60).padStart(2, "0")} /${dist}`;
}
