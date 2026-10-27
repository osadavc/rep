import { z } from "zod";
import {
  type Db,
  exerciseSchema,
  habitSchema,
  routineSchema,
  sessionSchema,
  settingsSchema,
  sleepSchema,
  weightSchema,
} from "./model";

// Every change to the data is one of these operations. They are applied
// optimistically on the phone and then authoritatively on the server, so each
// one must be idempotent: replaying it (e.g. after a dropped connection) is safe.
export const opSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("exercise.put"), exercise: exerciseSchema }),
  z.object({ t: z.literal("routine.put"), routine: routineSchema }),
  z.object({ t: z.literal("routine.delete"), id: z.string() }),
  z.object({
    t: z.literal("rotation.set"),
    items: z.array(z.string()).max(30),
    next: z.number().int().min(0),
  }),
  z.object({
    t: z.literal("session.put"),
    session: sessionSchema,
    rotationNext: z.number().int().min(0).optional(),
  }),
  z.object({ t: z.literal("session.delete"), id: z.string() }),
  z.object({ t: z.literal("weight.put"), entry: weightSchema }),
  z.object({ t: z.literal("weight.delete"), id: z.string() }),
  z.object({ t: z.literal("sleep.put"), entry: sleepSchema }),
  z.object({ t: z.literal("sleep.delete"), id: z.string() }),
  z.object({ t: z.literal("habit.put"), habit: habitSchema }),
  z.object({ t: z.literal("habit.delete"), id: z.string() }),
  z.object({ t: z.literal("habit.order"), ids: z.array(z.string()).max(200) }),
  // Sets (not adds to) a day's count, so replaying it is harmless. 0 clears it.
  z.object({
    t: z.literal("habit.log"),
    habitId: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    count: z.number().int().min(0).max(100),
    target: z.number().int().min(1).max(20).optional(),
  }),
  z.object({
    t: z.literal("settings.put"),
    settings: settingsSchema.partial(),
  }),
]);

export const envelopeSchema = z.object({
  id: z.string().min(1).max(64),
  op: opSchema,
});

export type Op = z.infer<typeof opSchema>;
export type Envelope = z.infer<typeof envelopeSchema>;

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [...list, item];
  const next = list.slice();
  next[i] = item;
  return next;
}

const without = <T extends { id: string }>(list: T[], id: string) =>
  list.filter((x) => x.id !== id);

export function applyOp(db: Db, op: Op): Db {
  switch (op.t) {
    case "exercise.put":
      return { ...db, exercises: upsert(db.exercises, op.exercise) };
    case "routine.put":
      return { ...db, routines: upsert(db.routines, op.routine) };
    case "routine.delete": {
      const items = db.rotation.items.filter((r) => r !== op.id);
      return {
        ...db,
        routines: without(db.routines, op.id),
        rotation: {
          items,
          next: items.length ? db.rotation.next % items.length : 0,
        },
      };
    }
    case "rotation.set":
      return {
        ...db,
        rotation: {
          items: op.items,
          next: op.items.length ? op.next % op.items.length : 0,
        },
      };
    case "session.put": {
      const sessions = upsert(db.sessions, op.session).sort(
        (a, b) => a.startedAt - b.startedAt,
      );
      const { items } = db.rotation;
      const rotation =
        op.rotationNext !== undefined && items.length
          ? { items, next: op.rotationNext % items.length }
          : db.rotation;
      return { ...db, sessions, rotation };
    }
    case "session.delete":
      return { ...db, sessions: without(db.sessions, op.id) };
    case "weight.put":
      return {
        ...db,
        weights: upsert(db.weights, op.entry).sort((a, b) =>
          a.date.localeCompare(b.date),
        ),
      };
    case "weight.delete":
      return { ...db, weights: without(db.weights, op.id) };
    case "sleep.put":
      return {
        ...db,
        sleeps: upsert(db.sleeps, op.entry).sort((a, b) => a.wake - b.wake),
      };
    case "sleep.delete":
      return { ...db, sleeps: without(db.sleeps, op.id) };
    case "habit.put":
      return { ...db, habits: upsert(db.habits, op.habit) };
    case "habit.delete":
      return {
        ...db,
        habits: without(db.habits, op.id),
        habitLogs: db.habitLogs.filter((l) => l.habitId !== op.id),
      };
    case "habit.order": {
      const rank = (id: string) => {
        const i = op.ids.indexOf(id);
        return i === -1 ? op.ids.length : i;
      };
      return {
        ...db,
        habits: [...db.habits].sort((a, b) => rank(a.id) - rank(b.id)),
      };
    }
    case "habit.log": {
      // A habit deleted on another device takes its days with it.
      if (!db.habits.some((h) => h.id === op.habitId)) return db;
      const rest = db.habitLogs.filter(
        (l) => !(l.habitId === op.habitId && l.date === op.date),
      );
      if (op.count === 0) return { ...db, habitLogs: rest };
      const entry = {
        habitId: op.habitId,
        date: op.date,
        count: op.count,
        ...(op.target ? { target: op.target } : {}),
      };
      return {
        ...db,
        habitLogs: [...rest, entry].sort((a, b) =>
          a.date.localeCompare(b.date),
        ),
      };
    }
    case "settings.put":
      return { ...db, settings: { ...db.settings, ...op.settings } };
  }
}

export const applyAll = (db: Db, envelopes: Envelope[]) =>
  envelopes.reduce((acc, e) => applyOp(acc, e.op), db);
