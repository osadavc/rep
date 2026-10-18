"use client";

import { type ReactNode, useEffect, useState } from "react";
import { dispatch, useDb } from "@/lib/client/store";
import {
  type Exercise,
  KIND_LABEL,
  KINDS,
  type Kind,
  MUSCLES,
  type Muscle,
  newId,
} from "@/lib/model";
import { cx, field } from "./ui";

/** Full-screen sheet for choosing (or creating) an exercise. */
export function ExercisePicker({
  onPick,
  onClose,
  title = "Add exercise",
  cardioOnly,
}: {
  onPick: (exerciseId: string) => void;
  onClose: () => void;
  title?: string;
  /** Only list cardio activities (and create new ones as cardio). */
  cardioOnly?: boolean;
}) {
  const db = useDb();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  // Shown in place of the page (not as an overlay, which iOS 26 renders with gaps).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  if (!db) return null;

  const q = query.trim().toLowerCase();
  const visible = db.exercises.filter(
    (e) =>
      !e.archived &&
      (!cardioOnly || e.kind === "cardio" || e.muscle === "cardio") &&
      (!q || e.name.toLowerCase().includes(q) || e.muscle.includes(q)),
  );
  const exact = db.exercises.some((e) => e.name.toLowerCase() === q);
  const groups = MUSCLES.map((m) => ({
    muscle: m,
    items: visible
      .filter((e) => e.muscle === m)
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((g) => g.items.length);

  return (
    <div className="min-h-dvh bg-white">
      <div className="pt-safe sticky top-0 z-10 bg-white">
        <div className="mx-auto max-w-xl px-5">
          <div className="flex h-12 items-center justify-between">
            <span className="text-[17px] font-semibold">{title}</span>
            <button
              type="button"
              onClick={onClose}
              className="press text-[17px]"
            >
              Cancel
            </button>
          </div>
          <input
            type="search"
            placeholder="Search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCreating(false);
            }}
            enterKeyHint="search"
            autoComplete="off"
            className="mb-2 h-11 w-full rounded-[12px] bg-fill px-4 text-[17px]"
          />
        </div>
      </div>

      <div className="mx-auto max-w-xl px-5 pb-[calc(32px+env(safe-area-inset-bottom))]">
        {q && !exact ? (
          creating ? (
            <NewExercise
              name={query.trim()}
              kind={cardioOnly ? "cardio" : undefined}
              muscle={cardioOnly ? "cardio" : undefined}
              onCreate={(ex) => {
                dispatch({ t: "exercise.put", exercise: ex });
                onPick(ex.id);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="press flex min-h-[52px] w-full items-center border-b-[0.5px] border-separator text-left text-[17px] font-medium"
            >
              Create “{query.trim()}”
            </button>
          )
        ) : null}

        {groups.map((g) => (
          <section key={g.muscle} className="mt-5">
            <h2 className="pb-1.5 text-[13px] font-medium uppercase tracking-[0.06em] text-secondary">
              {g.muscle}
            </h2>
            {g.items.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => onPick(e.id)}
                className="press flex min-h-[50px] w-full items-center justify-between border-b-[0.5px] border-separator text-left text-[17px]"
              >
                {e.name}
                {e.kind !== "weight" && !cardioOnly ? (
                  <span className="text-[13px] text-secondary">
                    {KIND_LABEL[e.kind]}
                  </span>
                ) : null}
              </button>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

export function NewExercise({
  name: initialName,
  kind: initialKind = "weight",
  muscle: initialMuscle = "chest",
  onCreate,
  submitLabel = "Create and add",
}: {
  name: string;
  kind?: Kind;
  muscle?: Muscle;
  onCreate: (exercise: Exercise) => void;
  submitLabel?: string;
}) {
  const [name, setName] = useState(initialName);
  const [kind, setKind] = useState<Kind>(initialKind);
  const [muscle, setMuscle] = useState<Muscle>(initialMuscle);
  return (
    <div className="mt-2 border-b-[0.5px] border-separator pb-5">
      <ExerciseFields
        name={name}
        kind={kind}
        muscle={muscle}
        onName={setName}
        onKind={setKind}
        onMuscle={setMuscle}
      />
      <button
        type="button"
        disabled={!name.trim()}
        onClick={() =>
          onCreate({ id: newId(), name: name.trim(), kind, muscle })
        }
        className="mt-5 flex h-[52px] w-full items-center justify-center rounded-[14px] bg-black text-[17px] font-semibold text-white active:scale-[0.98] disabled:opacity-30"
      >
        {submitLabel}
      </button>
    </div>
  );
}

export function ExerciseFields({
  name,
  kind,
  muscle,
  onName,
  onKind,
  onMuscle,
}: {
  name: string;
  kind: Kind;
  muscle: Muscle;
  onName: (v: string) => void;
  onKind: (v: Kind) => void;
  onMuscle: (v: Muscle) => void;
}) {
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-[13px] text-secondary">Name</span>
        <input
          value={name}
          onChange={(e) => onName(e.target.value)}
          className={field}
        />
      </label>
      <div>
        <span className="text-[13px] text-secondary">Tracks</span>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <Chip key={k} on={kind === k} onClick={() => onKind(k)}>
              {KIND_LABEL[k]}
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <span className="text-[13px] text-secondary">Muscle</span>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {MUSCLES.map((m) => (
            <Chip key={m} on={muscle === m} onClick={() => onMuscle(m)}>
              <span className="capitalize">{m}</span>
            </Chip>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx(
        "press h-9 rounded-full border px-3.5 text-[15px]",
        on ? "border-black bg-black text-white" : "border-transparent bg-fill",
      )}
    >
      {children}
    </button>
  );
}
