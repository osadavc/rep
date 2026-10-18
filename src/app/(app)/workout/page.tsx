"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ExercisePicker } from "@/components/exercise-picker";
import { SessionView } from "@/components/session-view";
import { SetTable } from "@/components/sets";
import { ButtonLink, cx, Page, TextButton } from "@/components/ui";
import {
  restDoneAlert,
  unlockAudio,
  useNow,
  useWakeLock,
} from "@/lib/client/device";
import { useDb } from "@/lib/client/store";
import * as w from "@/lib/client/workout";
import { clock, fmtDist, pace, plural, seconds, speed } from "@/lib/format";
import {
  type Db,
  defaultsFor,
  distanceUnit,
  type SessionExercise,
  type SetEntry,
} from "@/lib/model";
import { previousSets } from "@/lib/stats";

const REST_OPTIONS = [
  0, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 300, 360, 420, 480, 600,
];

export default function WorkoutPage() {
  const db = useDb();
  const active = w.useActive();
  const router = useRouter();
  const now = useNow(500, Boolean(active));
  const [picking, setPicking] = useState(false);
  // The summary is shown right here rather than on another page, so finishing
  // works with no signal (another page might need to be fetched first).
  const [finished, setFinished] = useState<string | null>(null);
  const alerted = useRef<number | null>(null);
  const scrollTo = useRef<number | null>(null);
  useWakeLock(Boolean(active));

  const rest = active?.rest ?? null;
  const restOver = rest ? now - rest.since >= rest.target * 1000 : false;
  useEffect(() => {
    if (rest && restOver && rest.target > 0 && alerted.current !== rest.since) {
      alerted.current = rest.since;
      restDoneAlert();
    }
  }, [rest, restOver]);

  // Back from the picker: return to where you were (or the bottom, after adding).
  useEffect(() => {
    if (picking || scrollTo.current === null) return;
    const y =
      scrollTo.current === Number.POSITIVE_INFINITY
        ? document.body.scrollHeight
        : scrollTo.current;
    scrollTo.current = null;
    window.scrollTo(0, y);
  }, [picking]);

  if (!db) return null;

  if (picking) {
    return (
      <ExercisePicker
        onClose={() => setPicking(false)}
        onPick={(id) => {
          const d = defaultsFor(db, id);
          w.addExercise(id, d.rest, d.sets);
          setPicking(false);
          scrollTo.current = Number.POSITIVE_INFINITY;
        }}
      />
    );
  }

  if (!active && finished) {
    return (
      <>
        <SessionView id={finished} />
        <Page>
          <ButtonLink href="/" className="mb-10">
            Done
          </ButtonLink>
        </Page>
      </>
    );
  }

  if (!active) {
    return (
      <Page>
        <div className="pt-24">
          <h1 className="text-[32px] font-semibold tracking-[-0.025em]">
            No workout running
          </h1>
          <p className="mt-2 mb-8 text-secondary">Start one from Train.</p>
          <ButtonLink href="/">Go to Train</ButtonLink>
        </div>
      </Page>
    );
  }

  const ex = new Map(db.exercises.map((e) => [e.id, e]));
  let total = 0;
  let done = 0;
  for (const e of active.exercises) {
    if (e.skipped) continue;
    total += e.sets.length;
    done += e.sets.filter((s) => s.done).length;
  }

  const finish = () => {
    if (done === 0) {
      if (confirm("No sets completed. Discard this workout?")) {
        w.discard();
        router.push("/");
      }
      return;
    }
    const left = total - done;
    if (
      left > 0 &&
      !confirm(
        `${left} unfinished ${left === 1 ? "set" : "sets"} won't be saved. Finish?`,
      )
    ) {
      return;
    }
    setFinished(w.finish(db));
    window.scrollTo(0, 0);
  };

  return (
    <div onClickCapture={unlockAudio}>
      <div className="pt-safe sticky top-0 z-20 border-b-[0.5px] border-separator bg-white">
        <div className="mx-auto grid h-12 max-w-xl grid-cols-[1fr_auto_1fr] items-center px-5">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="press justify-self-start text-[17px]"
          >
            ‹ Train
          </button>
          <span className="tnum text-[17px] font-semibold">
            {clock(now - active.startedAt)}
          </span>
          <button
            type="button"
            onClick={finish}
            className="press justify-self-end text-[17px] font-semibold"
          >
            Finish
          </button>
        </div>
      </div>

      <Page>
        <input
          aria-label="Workout name"
          value={active.name}
          onChange={(e) => w.rename(e.target.value)}
          className="mt-5 w-full text-[32px] font-semibold tracking-[-0.025em]"
        />
        <p className="tnum mt-1 text-[15px] text-secondary">
          {done} of {plural(total, "set")}
        </p>

        {active.exercises.map((e, ei) => {
          const meta = ex.get(e.exerciseId);
          return (
            <ExerciseCard
              key={`${e.exerciseId}-${ei}`}
              index={ei}
              count={active.exercises.length}
              entry={e}
              name={meta?.name ?? "Unknown exercise"}
              kind={meta?.kind ?? "weight"}
              db={db}
              sessionId={active.id}
              timer={active.timer?.ei === ei ? active.timer : null}
              now={now}
            />
          );
        })}

        <div className="mt-8 space-y-3">
          <button
            type="button"
            onClick={() => {
              scrollTo.current = window.scrollY;
              setPicking(true);
            }}
            className="flex h-[52px] w-full items-center justify-center rounded-[14px] bg-fill text-[17px] font-semibold active:scale-[0.98]"
          >
            Add exercise
          </button>
          <button
            type="button"
            onClick={() => {
              if (
                confirm("Discard this workout? Nothing from it will be saved.")
              ) {
                w.discard();
                router.push("/");
              }
            }}
            className="press flex h-11 w-full items-center justify-center text-[15px] text-secondary"
          >
            Discard workout
          </button>
        </div>
        <div className="h-32" />
      </Page>

      {rest ? <RestBar rest={rest} now={now} over={restOver} /> : null}
    </div>
  );
}

function ExerciseCard({
  index,
  count,
  entry,
  name,
  kind,
  db,
  sessionId,
  timer,
  now,
}: {
  index: number;
  count: number;
  entry: SessionExercise;
  name: string;
  kind: "weight" | "reps" | "time" | "cardio";
  db: Db;
  sessionId: string;
  timer: { si: number; since: number } | null;
  now: number;
}) {
  const [menu, setMenu] = useState(false);
  const dist = distanceUnit(db);

  if (entry.skipped) {
    return (
      <section className="mt-8 flex items-center justify-between border-b-[0.5px] border-separator pb-3">
        <div>
          <h2 className="text-[17px] font-semibold text-secondary line-through">
            {name}
          </h2>
          <p className="text-[13px] text-secondary">Skipped</p>
        </div>
        <TextButton onClick={() => w.setSkipped(index, false)}>Undo</TextButton>
      </section>
    );
  }

  const target = [
    entry.sets.length && plural(entry.sets.length, "set"),
    entry.reps && `${entry.reps} reps`,
  ]
    .filter(Boolean)
    .join(" × ");

  return (
    <section className="mt-8">
      <div className="flex items-start justify-between gap-3 border-b-[0.5px] border-separator pb-2">
        <div className="min-w-0">
          <h2 className="text-[19px] font-semibold leading-tight tracking-[-0.01em]">
            {name}
          </h2>
          <p className="tnum mt-0.5 text-[13px] text-secondary">
            {[target, entry.rest ? `rest ${seconds(entry.rest)}` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <button
          type="button"
          aria-label={`${name} options`}
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
          className={cx(
            "press -mr-2 h-9 shrink-0 px-2 text-[15px] font-medium",
            menu && "underline",
          )}
        >
          {menu ? "Close" : "Edit"}
        </button>
      </div>

      {menu ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b-[0.5px] border-separator py-2">
          <TextButton
            onClick={() => {
              w.setSkipped(index, true);
              setMenu(false);
            }}
          >
            Skip
          </TextButton>
          <TextButton
            disabled={index === 0}
            onClick={() => w.moveExercise(index, -1)}
          >
            Move up
          </TextButton>
          <TextButton
            disabled={index === count - 1}
            onClick={() => w.moveExercise(index, 1)}
          >
            Move down
          </TextButton>
          <label className="press flex items-center gap-1 py-1 text-[15px] font-medium">
            Rest
            <select
              value={entry.rest}
              onChange={(e) => w.setExerciseRest(index, Number(e.target.value))}
              className="tnum underline"
            >
              {REST_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s ? seconds(s) : "off"}
                </option>
              ))}
            </select>
          </label>
          <TextButton
            onClick={() => {
              if (confirm(`Remove ${name} from this workout?`))
                w.removeExercise(index);
            }}
          >
            Remove
          </TextButton>
        </div>
      ) : null}

      <div className="pt-2">
        <SetTable
          kind={kind}
          unit={db.settings.unit}
          dist={dist}
          sets={entry.sets}
          previous={previousSets(db, entry.exerciseId, sessionId)}
          targetReps={entry.reps}
          onEdit={(si, patch) => w.editSet(index, si, patch)}
          onComplete={(si, values) => w.completeSet(index, si, values)}
          onUncomplete={(si) => w.uncompleteSet(index, si)}
        />
      </div>

      {kind === "cardio" ? (
        <CardioTotals sets={entry.sets} dist={dist} />
      ) : null}

      {kind === "time" || kind === "cardio" ? (
        <Stopwatch
          running={timer}
          now={now}
          onStart={() => {
            let si = entry.sets.findIndex((x) => !x.done);
            if (si === -1) {
              w.addSet(index);
              si = entry.sets.length;
            }
            w.startTimer(index, si);
          }}
          onStop={() => {
            const si = timer?.si ?? 0;
            const secs = w.stopTimer();
            // A held exercise is done when the clock stops; cardio still needs its distance.
            if (kind === "time") w.completeSet(index, si, { seconds: secs });
          }}
        />
      ) : null}

      <div className="flex gap-5 pt-1">
        <TextButton onClick={() => w.addSet(index)}>+ Add set</TextButton>
        {entry.sets.length > 0 ? (
          <TextButton
            className="text-secondary"
            onClick={() => {
              const last = entry.sets.length - 1;
              if (
                !entry.sets[last].done ||
                confirm("Remove the last set? It's already completed.")
              ) {
                w.removeSet(index, last);
              }
            }}
          >
            − Remove set
          </TextButton>
        ) : null}
      </div>
    </section>
  );
}

function RestBar({
  rest,
  now,
  over,
}: {
  rest: w.Rest;
  now: number;
  over: boolean;
}) {
  const elapsed = now - rest.since;
  return (
    <div
      className={cx(
        "hide-kb pb-safe fixed inset-x-0 bottom-0 z-30 border-t-[0.5px] transition-colors duration-200",
        over ? "border-black bg-black text-white" : "border-separator bg-white",
      )}
    >
      <div className="mx-auto flex h-[68px] max-w-xl items-center gap-2 px-5">
        <div className="min-w-0 flex-1" aria-live="polite">
          <div
            className={cx(
              "text-[13px]",
              over ? "text-white/60" : "text-secondary",
            )}
          >
            {over ? "Rest over" : "Resting"}
          </div>
          <div className="tnum text-[28px] font-semibold leading-none tracking-[-0.02em]">
            {clock(elapsed)}
            {rest.target ? (
              <span
                className={cx(
                  "text-[17px] font-medium",
                  over ? "text-white/50" : "text-secondary",
                )}
              >
                {" "}
                / {clock(rest.target * 1000)}
              </span>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={() => w.adjustRest(-15)}
          className="press tnum h-11 px-2.5 text-[15px] font-medium"
        >
          −15
        </button>
        <button
          type="button"
          onClick={() => w.adjustRest(15)}
          className="press tnum h-11 px-2.5 text-[15px] font-medium"
        >
          +15
        </button>
        <button
          type="button"
          onClick={w.endRest}
          className={cx(
            "h-11 rounded-[12px] px-4 text-[15px] font-semibold active:scale-[0.97]",
            over ? "bg-white text-black" : "bg-black text-white",
          )}
        >
          Done
        </button>
      </div>
    </div>
  );
}

function Stopwatch({
  running,
  now,
  onStart,
  onStop,
}: {
  running: { si: number; since: number } | null;
  now: number;
  onStart: () => void;
  onStop: () => void;
}) {
  return running ? (
    <button
      type="button"
      onClick={onStop}
      className="mt-2 flex h-11 w-full items-center justify-between rounded-[12px] bg-black px-4 text-white active:scale-[0.99]"
    >
      <span className="text-[15px] font-medium">
        Stop · set {running.si + 1}
      </span>
      <span className="tnum text-[20px] font-semibold">
        {clock(now - running.since)}
      </span>
    </button>
  ) : (
    <button
      type="button"
      onClick={onStart}
      className="mt-2 flex h-11 w-full items-center justify-center rounded-[12px] bg-fill text-[15px] font-medium active:scale-[0.99]"
    >
      Start timer
    </button>
  );
}

function CardioTotals({ sets, dist }: { sets: SetEntry[]; dist: "km" | "mi" }) {
  const done = sets.filter((x) => x.done);
  if (!done.length) return null;
  const km = done.reduce((a, x) => a + (x.distance ?? 0), 0);
  const secs = done.reduce((a, x) => a + (x.seconds ?? 0), 0);
  const kcal = done.reduce((a, x) => a + (x.calories ?? 0), 0);
  const parts = [
    km ? fmtDist(km, dist) : null,
    secs ? seconds(secs) : null,
    km && secs ? pace(secs, km, dist) : null,
    km && secs ? speed(secs, km, dist) : null,
    kcal ? `${kcal} kcal` : null,
  ].filter(Boolean);
  return (
    <p className="tnum pt-1 text-[13px] text-secondary">{parts.join(" · ")}</p>
  );
}
