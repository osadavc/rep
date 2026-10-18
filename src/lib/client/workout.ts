import { useSyncExternalStore } from "react";
import {
  type Db,
  newId,
  type Routine,
  type Session,
  type SessionExercise,
  type SetEntry,
} from "@/lib/model";
import { dispatch } from "./store";

// The workout in progress lives only on this device until it's finished.
// It's written to localStorage on every change, so refreshing, switching apps
// or the phone dying mid-set loses nothing.

const KEY = "rep:active";

export type Rest = {
  ei: number;
  si: number;
  since: number;
  target: number;
};

export type Active = {
  id: string;
  routineId?: string;
  name: string;
  startedAt: number;
  exercises: SessionExercise[];
  rotationIndex?: number;
  rest: Rest | null;
  /** A running stopwatch for a timed set (cardio, planks). */
  timer?: { ei: number; si: number; since: number } | null;
};

let active: Active | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function read() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    active = raw ? JSON.parse(raw) : null;
  } catch {
    active = null;
  }
  // Keep two open tabs (e.g. phone + laptop browser) from fighting.
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    active = e.newValue ? JSON.parse(e.newValue) : null;
    for (const l of listeners) l();
  });
}

function set(next: Active | null) {
  active = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {}
  for (const l of listeners) l();
}

const update = (fn: (a: Active) => Active) => {
  if (active) set(fn(active));
};

const subscribe = (l: () => void) => {
  read();
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useActive = () =>
  useSyncExternalStore(
    subscribe,
    () => {
      read();
      return active;
    },
    () => null,
  );

/** Where a routine sits in the rotation, looking forward from "next". */
function rotationIndex(db: Db, routineId?: string) {
  const { items, next } = db.rotation;
  if (!routineId || !items.length) return undefined;
  for (let k = 0; k < items.length; k++) {
    const i = (next + k) % items.length;
    if (items[i] === routineId) return i;
  }
  return undefined;
}

/** Starts a workout with a single activity, e.g. a run. */
export function startSingle(db: Db, exerciseId: string) {
  const exercise = db.exercises.find((e) => e.id === exerciseId);
  set({
    id: newId(),
    name: exercise?.name ?? "Workout",
    startedAt: Date.now(),
    rest: null,
    exercises: [{ exerciseId, rest: 0, sets: [{ done: false }] }],
  });
}

export function start(db: Db, routine?: Routine) {
  set({
    id: newId(),
    routineId: routine?.id,
    name: routine?.name ?? "Workout",
    startedAt: Date.now(),
    rotationIndex: rotationIndex(db, routine?.id),
    rest: null,
    exercises: (routine?.items ?? []).map((item) => ({
      exerciseId: item.exerciseId,
      rest: item.rest,
      reps: item.reps,
      sets: Array.from({ length: item.sets }, () => ({ done: false })),
    })),
  });
}

const mapExercise = (
  a: Active,
  ei: number,
  fn: (e: SessionExercise) => SessionExercise,
): Active => ({
  ...a,
  exercises: a.exercises.map((e, i) => (i === ei ? fn(e) : e)),
});

export function editSet(ei: number, si: number, patch: Partial<SetEntry>) {
  update((a) =>
    mapExercise(a, ei, (e) => ({
      ...e,
      sets: e.sets.map((s, i) => (i === si ? { ...s, ...patch } : s)),
    })),
  );
}

/** Records how long the last rest actually was. */
function closeRest(a: Active, now: number): Active {
  const { rest } = a;
  if (!rest) return a;
  const seconds = Math.round((now - rest.since) / 1000);
  return {
    ...mapExercise(a, rest.ei, (e) => ({
      ...e,
      sets: e.sets.map((s, i) =>
        i === rest.si && s.done ? { ...s, rest: seconds } : s,
      ),
    })),
    rest: null,
  };
}

export function completeSet(ei: number, si: number, values: Partial<SetEntry>) {
  const now = Date.now();
  update((a) => {
    const closed = closeRest(a, now);
    const next = mapExercise(closed, ei, (e) => ({
      ...e,
      skipped: false,
      sets: e.sets.map((s, i) =>
        i === si
          ? { ...s, ...values, done: true, doneAt: now, rest: undefined }
          : s,
      ),
    }));
    // Rest set to "off" (e.g. cardio) means no rest timer.
    const target = next.exercises[ei].rest;
    return {
      ...next,
      rest: target > 0 ? { ei, si, since: now, target } : null,
    };
  });
}

export function uncompleteSet(ei: number, si: number) {
  update((a) => {
    const next = mapExercise(a, ei, (e) => ({
      ...e,
      sets: e.sets.map((s, i) =>
        i === si
          ? { ...s, done: false, doneAt: undefined, rest: undefined }
          : s,
      ),
    }));
    const restHere = a.rest?.ei === ei && a.rest.si === si;
    return restHere ? { ...next, rest: null } : next;
  });
}

export const endRest = () => update((a) => closeRest(a, Date.now()));

export const adjustRest = (delta: number) =>
  update((a) =>
    a.rest
      ? {
          ...a,
          rest: { ...a.rest, target: Math.max(0, a.rest.target + delta) },
        }
      : a,
  );

export const addSet = (ei: number) =>
  update((a) =>
    mapExercise(a, ei, (e) => ({
      ...e,
      skipped: false,
      sets: [...e.sets, { done: false }],
    })),
  );

export function removeSet(ei: number, si: number) {
  stopTimer();
  update((a) => {
    const next = mapExercise(a, ei, (e) => ({
      ...e,
      sets: e.sets.filter((_, i) => i !== si),
    }));
    return a.rest?.ei === ei ? { ...next, rest: null } : next;
  });
}

export const setSkipped = (ei: number, skipped: boolean) =>
  update((a) => mapExercise(a, ei, (e) => ({ ...e, skipped })));

export const setExerciseRest = (ei: number, rest: number) =>
  update((a) => mapExercise(a, ei, (e) => ({ ...e, rest })));

export function addExercise(exerciseId: string, rest: number, sets = 3) {
  update((a) => ({
    ...a,
    exercises: [
      ...a.exercises,
      {
        exerciseId,
        rest,
        sets: Array.from({ length: sets }, () => ({ done: false })),
      },
    ],
  }));
}

export function removeExercise(ei: number) {
  stopTimer();
  update((a) => ({
    ...a,
    exercises: a.exercises.filter((_, i) => i !== ei),
    rest:
      a.rest && a.rest.ei !== ei
        ? { ...a.rest, ei: a.rest.ei - (a.rest.ei > ei ? 1 : 0) }
        : null,
  }));
}

export function moveExercise(ei: number, dir: -1 | 1) {
  stopTimer();
  update((a) => {
    const to = ei + dir;
    if (to < 0 || to >= a.exercises.length) return a;
    const exercises = a.exercises.slice();
    [exercises[ei], exercises[to]] = [exercises[to], exercises[ei]];
    let rest = a.rest;
    if (rest?.ei === ei) rest = { ...rest, ei: to };
    else if (rest?.ei === to) rest = { ...rest, ei };
    return { ...a, exercises, rest };
  });
}

export const rename = (name: string) => update((a) => ({ ...a, name }));

export const discard = () => set(null);

/** Starts timing a set; stopping fills in its time. */
export function startTimer(ei: number, si: number) {
  stopTimer();
  update((a) => ({ ...a, timer: { ei, si, since: Date.now() } }));
}

/** Stops the stopwatch and returns the seconds it recorded. */
export function stopTimer() {
  const t = active?.timer;
  if (!t) return 0;
  const seconds = Math.max(1, Math.round((Date.now() - t.since) / 1000));
  update((a) => ({
    ...mapExercise(a, t.ei, (e) => ({
      ...e,
      sets: e.sets.map((x, i) => (i === t.si ? { ...x, seconds } : x)),
    })),
    timer: null,
  }));
  return seconds;
}

/** Saves the workout (only completed sets) and returns its id. */
export function finish(db: Db): string | null {
  if (!active) return null;
  stopTimer();
  const a = closeRest(active as Active, Date.now());
  const session: Session = {
    id: a.id,
    routineId: a.routineId,
    name: a.name.trim() || "Workout",
    startedAt: a.startedAt,
    endedAt: Date.now(),
    exercises: a.exercises.map((e) => {
      const sets = e.sets.filter((s) => s.done);
      return { ...e, sets, skipped: e.skipped || sets.length === 0 };
    }),
  };
  const len = db.rotation.items.length;
  dispatch(
    {
      t: "session.put",
      session,
      rotationNext:
        a.rotationIndex !== undefined && len
          ? (a.rotationIndex + 1) % len
          : undefined,
    },
    { now: true },
  );
  set(null);
  return session.id;
}
