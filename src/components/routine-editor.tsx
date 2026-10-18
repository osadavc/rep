"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { dispatch, useDb } from "@/lib/client/store";
import * as w from "@/lib/client/workout";
import { seconds } from "@/lib/format";
import { defaultsFor, type Routine, type RoutineItem } from "@/lib/model";
import { IconButton } from "./controls";
import { ExercisePicker } from "./exercise-picker";
import { Button, Empty, Header, Page, TextButton } from "./ui";

const REST = [
  0, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 300, 360, 420, 480, 600,
];

export function RoutineEditor({ id }: { id: string }) {
  const db = useDb();
  const router = useRouter();
  const active = w.useActive();
  const [picking, setPicking] = useState(false);
  // Only set while typing, so a half-typed (or empty) name never gets saved.
  const [name, setName] = useState<string | null>(null);
  const scrollY = useRef<number | null>(null);

  useEffect(() => {
    if (picking || scrollY.current === null) return;
    window.scrollTo(0, scrollY.current);
    scrollY.current = null;
  }, [picking]);

  if (!db) return null;
  const routine = db.routines.find((r) => r.id === id);

  if (!routine) {
    return (
      <Page>
        <Header back={{ href: "/plan", label: "Plan" }} title="Not found" />
        <Empty>This workout doesn't exist, or it was deleted.</Empty>
      </Page>
    );
  }

  const save = (patch: Partial<Routine>) =>
    dispatch({ t: "routine.put", routine: { ...routine, ...patch } });
  const setItem = (i: number, patch: Partial<RoutineItem>) =>
    save({
      items: routine.items.map((it, k) => (k === i ? { ...it, ...patch } : it)),
    });

  if (picking) {
    return (
      <ExercisePicker
        onClose={() => setPicking(false)}
        onPick={(exerciseId) => {
          save({
            items: [
              ...routine.items,
              { exerciseId, ...defaultsFor(db, exerciseId) },
            ],
          });
          scrollY.current = Number.MAX_SAFE_INTEGER;
          setPicking(false);
        }}
      />
    );
  }

  const ex = new Map(db.exercises.map((e) => [e.id, e]));
  const inRotation = db.rotation.items.includes(routine.id);

  return (
    <Page>
      <Header
        back={{ href: "/plan", label: "Plan" }}
        title={
          <input
            aria-label="Workout name"
            value={name ?? routine.name}
            maxLength={60}
            onChange={(e) => {
              setName(e.target.value);
              if (e.target.value.trim()) save({ name: e.target.value.trim() });
            }}
            onBlur={() => setName(null)}
            className="w-full"
          />
        }
        action={
          <TextButton
            disabled={!routine.items.length}
            onClick={() => {
              if (
                active &&
                !confirm(
                  `${active.name} is still running. Discard it and start this one?`,
                )
              )
                return;
              w.start(db, routine);
              router.push("/workout");
            }}
          >
            Start
          </TextButton>
        }
      />

      <div className="flex min-h-[52px] items-center justify-between border-y-[0.5px] border-separator">
        <span id="rotation-label">In rotation</span>
        <Switch
          labelledBy="rotation-label"
          on={inRotation}
          onChange={() =>
            dispatch({
              t: "rotation.set",
              items: inRotation
                ? db.rotation.items.filter((r) => r !== routine.id)
                : [...db.rotation.items, routine.id],
              next: db.rotation.next,
            })
          }
        />
      </div>

      {routine.items.length === 0 ? (
        <Empty>Add the exercises this workout is made of.</Empty>
      ) : null}

      {routine.items.map((it, i) => {
        const meta = ex.get(it.exerciseId);
        const timed = meta?.kind === "time" || meta?.kind === "cardio";
        return (
          <section key={`${it.exerciseId}-${i}`} className="mt-7">
            <div className="flex items-center justify-between gap-2 border-b-[0.5px] border-separator pb-1">
              <h2 className="truncate text-[19px] font-semibold tracking-[-0.01em]">
                {meta?.name ?? "Unknown exercise"}
              </h2>
              <div className="flex shrink-0">
                <IconButton
                  label="Move up"
                  disabled={i === 0}
                  onClick={() => {
                    const items = routine.items.slice();
                    [items[i - 1], items[i]] = [items[i], items[i - 1]];
                    save({ items });
                  }}
                >
                  ↑
                </IconButton>
                <IconButton
                  label="Move down"
                  disabled={i === routine.items.length - 1}
                  onClick={() => {
                    const items = routine.items.slice();
                    [items[i + 1], items[i]] = [items[i], items[i + 1]];
                    save({ items });
                  }}
                >
                  ↓
                </IconButton>
                <IconButton
                  label="Remove"
                  onClick={() =>
                    save({ items: routine.items.filter((_, k) => k !== i) })
                  }
                >
                  ×
                </IconButton>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-3">
              <div>
                <div className="text-[13px] text-secondary">Sets</div>
                <div className="mt-1 flex h-10 items-center justify-between rounded-[10px] bg-fill">
                  <button
                    type="button"
                    aria-label="Fewer sets"
                    disabled={it.sets <= 1}
                    onClick={() => setItem(i, { sets: it.sets - 1 })}
                    className="press h-10 w-9 text-[19px] disabled:opacity-25"
                  >
                    −
                  </button>
                  <span className="tnum text-[17px] font-medium">
                    {it.sets}
                  </span>
                  <button
                    type="button"
                    aria-label="More sets"
                    disabled={it.sets >= 20}
                    onClick={() => setItem(i, { sets: it.sets + 1 })}
                    className="press h-10 w-9 text-[19px] disabled:opacity-25"
                  >
                    +
                  </button>
                </div>
              </div>
              {timed ? (
                <div />
              ) : (
                <label className="block">
                  <span className="block text-[13px] text-secondary">Reps</span>
                  <input
                    value={it.reps ?? ""}
                    placeholder="8–12"
                    maxLength={20}
                    inputMode="text"
                    autoComplete="off"
                    onChange={(e) =>
                      setItem(i, { reps: e.target.value || undefined })
                    }
                    className="tnum mt-1 h-10 w-full rounded-[10px] bg-fill text-center text-[17px] font-medium"
                  />
                </label>
              )}
              <label className="block">
                <span className="block text-[13px] text-secondary">Rest</span>
                <select
                  value={it.rest}
                  onChange={(e) => setItem(i, { rest: Number(e.target.value) })}
                  className="tnum mt-1 h-10 w-full rounded-[10px] bg-fill text-center text-[17px] font-medium"
                >
                  {REST.map((s) => (
                    <option key={s} value={s}>
                      {s ? seconds(s) : "Off"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
        );
      })}

      <Button
        variant="secondary"
        className="mt-8"
        onClick={() => {
          scrollY.current = window.scrollY;
          setPicking(true);
        }}
      >
        Add exercise
      </Button>

      <TextButton
        className="mt-6 mb-8 text-secondary"
        onClick={() => {
          if (
            confirm(
              `Delete ${routine.name}? Past workouts stay in your history.`,
            )
          ) {
            dispatch({ t: "routine.delete", id: routine.id });
            router.replace("/plan");
          }
        }}
      >
        Delete workout
      </TextButton>
    </Page>
  );
}

export function Switch({
  on,
  onChange,
  labelledBy,
}: {
  on: boolean;
  onChange: () => void;
  labelledBy: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-labelledby={labelledBy}
      onClick={onChange}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 ${on ? "bg-black" : "bg-fill-strong"}`}
    >
      <span
        className={`absolute top-[2px] left-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.2)] transition-transform duration-200 ${on ? "translate-x-5" : ""}`}
      />
    </button>
  );
}
