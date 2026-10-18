"use client";

import { useState } from "react";
import { useDb } from "@/lib/client/store";
import { isoDay } from "@/lib/format";
import {
  type Db,
  distanceUnit,
  type Session,
  type SessionExercise,
  type SetEntry,
} from "@/lib/model";
import { previousSets } from "@/lib/stats";
import { ExercisePicker } from "./exercise-picker";
import { NumField, SetTable } from "./sets";
import { Button, cx, field, Page, TextButton } from "./ui";

const hhmm = (t: number) => {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const hasValue = (s: SetEntry) =>
  s.weight !== undefined ||
  s.reps !== undefined ||
  s.seconds !== undefined ||
  s.distance !== undefined;

/** Edits a finished workout, or logs one after the fact. */
export function SessionEditor({
  initial,
  title,
  onSave,
  onCancel,
}: {
  initial: Session;
  title: string;
  onSave: (s: Session) => void;
  onCancel: () => void;
}) {
  const db = useDb() as Db;
  const [name, setName] = useState(initial.name);
  const [date, setDate] = useState(isoDay(initial.startedAt));
  const [start, setStart] = useState(hhmm(initial.startedAt));
  const [minutes, setMinutes] = useState<number | undefined>(
    Math.max(1, Math.round((initial.endedAt - initial.startedAt) / 60_000)),
  );
  const [exercises, setExercises] = useState<SessionExercise[]>(
    initial.exercises,
  );
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [picking, setPicking] = useState(false);

  const ex = new Map(db.exercises.map((e) => [e.id, e]));
  const editExercise = (
    ei: number,
    fn: (e: SessionExercise) => SessionExercise,
  ) => setExercises((list) => list.map((e, i) => (i === ei ? fn(e) : e)));

  if (picking) {
    return (
      <ExercisePicker
        onClose={() => setPicking(false)}
        onPick={(exerciseId) => {
          setExercises((list) => [
            ...list,
            {
              exerciseId,
              rest: db.settings.defaultRest,
              sets: [{ done: true }],
            },
          ]);
          setPicking(false);
        }}
      />
    );
  }

  function save() {
    const startedAt = new Date(`${date}T${start || "00:00"}`).getTime();
    if (!Number.isFinite(startedAt)) return alert("Check the date and time.");
    onSave({
      ...initial,
      name: name.trim() || "Workout",
      startedAt,
      endedAt: startedAt + (minutes ?? 1) * 60_000,
      notes: notes.trim() || undefined,
      exercises: exercises.map((e) => {
        const sets = e.sets.filter(hasValue).map((s) => ({ ...s, done: true }));
        return { ...e, sets, skipped: e.skipped || sets.length === 0 };
      }),
    });
  }

  return (
    <Page>
      <header className="flex h-12 items-center justify-between pt-4">
        <button type="button" onClick={onCancel} className="press text-[17px]">
          Cancel
        </button>
        <span className="text-[17px] font-semibold">{title}</span>
        <button
          type="button"
          onClick={save}
          className="press text-[17px] font-semibold"
        >
          Save
        </button>
      </header>

      <input
        aria-label="Workout name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mt-6 w-full text-[32px] font-semibold tracking-[-0.025em]"
      />

      <div className="mt-4 grid grid-cols-[1.4fr_1fr_1fr] gap-4">
        <label className="block min-w-0">
          <span className="text-[13px] text-secondary">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={cx(field, "appearance-auto")}
          />
        </label>
        <label className="block min-w-0">
          <span className="text-[13px] text-secondary">Start</span>
          <input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className={cx(field, "appearance-auto")}
          />
        </label>
        <div className="min-w-0">
          <span className="text-[13px] text-secondary">Minutes</span>
          <NumField
            label="Duration in minutes"
            value={minutes}
            onChange={setMinutes}
            className={cx(field, "tnum")}
          />
        </div>
      </div>

      {exercises.map((e, ei) => {
        const meta = ex.get(e.exerciseId);
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: exercises may repeat
          <section key={ei} className="mt-8">
            <div className="flex items-center justify-between gap-3 border-b-[0.5px] border-separator pb-2">
              <h2 className="truncate text-[19px] font-semibold tracking-[-0.01em]">
                {meta?.name ?? "Unknown exercise"}
              </h2>
              <div className="flex shrink-0 gap-4">
                <TextButton
                  disabled={ei === 0}
                  aria-label="Move up"
                  onClick={() =>
                    setExercises((list) => {
                      const next = list.slice();
                      [next[ei - 1], next[ei]] = [next[ei], next[ei - 1]];
                      return next;
                    })
                  }
                >
                  ↑
                </TextButton>
                <TextButton
                  onClick={() =>
                    setExercises((list) => list.filter((_, i) => i !== ei))
                  }
                >
                  Remove
                </TextButton>
              </div>
            </div>
            <div className="pt-2">
              <SetTable
                kind={meta?.kind ?? "weight"}
                unit={db.settings.unit}
                dist={distanceUnit(db)}
                sets={e.sets}
                previous={previousSets(db, e.exerciseId, initial.id)}
                onEdit={(si, patch) =>
                  editExercise(ei, (x) => ({
                    ...x,
                    skipped: false,
                    sets: x.sets.map((s, i) =>
                      i === si ? { ...s, ...patch } : s,
                    ),
                  }))
                }
                onRemove={(si) =>
                  editExercise(ei, (x) => ({
                    ...x,
                    sets: x.sets.filter((_, i) => i !== si),
                  }))
                }
              />
            </div>
            <TextButton
              onClick={() =>
                editExercise(ei, (x) => ({
                  ...x,
                  skipped: false,
                  sets: [
                    ...x.sets,
                    {
                      ...(x.sets.at(-1) ?? {}),
                      done: true,
                      rest: undefined,
                      doneAt: undefined,
                    },
                  ],
                }))
              }
            >
              + Add set
            </TextButton>
          </section>
        );
      })}

      <button
        type="button"
        onClick={() => setPicking(true)}
        className="mt-8 flex h-[52px] w-full items-center justify-center rounded-[14px] bg-fill text-[17px] font-semibold active:scale-[0.98]"
      >
        Add exercise
      </button>

      <label className="mt-8 block">
        <span className="text-[13px] text-secondary">Notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-1 w-full resize-none border-b-[0.5px] border-separator py-2 text-[17px] focus:border-secondary"
        />
      </label>

      <Button className="mt-8 mb-10" onClick={save}>
        Save
      </Button>
    </Page>
  );
}
