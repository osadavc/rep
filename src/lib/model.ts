import { z } from "zod";

export const MUSCLES = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "forearms",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "core",
  "full body",
  "cardio",
] as const;

// weight: load × reps · reps: bodyweight reps · time: held for seconds
// cardio: time, plus distance, calories and heart rate when you have them
export const KINDS = ["weight", "reps", "time", "cardio"] as const;

export const KIND_LABEL: Record<Kind, string> = {
  weight: "Weight × reps",
  reps: "Reps only",
  time: "Time",
  cardio: "Cardio",
};

const id = z.string().min(1).max(64);
const num = z.number().finite().nonnegative();

export const exerciseSchema = z.object({
  id,
  name: z.string().trim().min(1).max(80),
  kind: z.enum(KINDS),
  muscle: z.enum(MUSCLES),
  archived: z.boolean().optional(),
});

export const routineItemSchema = z.object({
  exerciseId: id,
  sets: z.number().int().min(1).max(20),
  reps: z.string().max(20).optional(),
  rest: z.number().int().min(0).max(1800),
});

export const routineSchema = z.object({
  id,
  name: z.string().trim().min(1).max(60),
  items: z.array(routineItemSchema).max(40),
});

// Weights are stored in kg and distances in km, whatever unit the UI shows.
export const setSchema = z.object({
  weight: num.optional(),
  reps: z.number().int().min(0).max(1000).optional(),
  seconds: z.number().int().min(0).max(86400).optional(),
  distance: num.optional(),
  calories: z.number().int().min(0).max(20000).optional(),
  heartRate: z.number().int().min(0).max(250).optional(),
  done: z.boolean(),
  doneAt: z.number().optional(),
  rest: z.number().int().min(0).max(86400).optional(),
});

export const sessionExerciseSchema = z.object({
  exerciseId: id,
  sets: z.array(setSchema).max(50),
  skipped: z.boolean().optional(),
  rest: z.number().int().min(0).max(1800),
  reps: z.string().max(20).optional(),
});

export const sessionSchema = z.object({
  id,
  routineId: id.optional(),
  name: z.string().trim().min(1).max(60),
  startedAt: z.number(),
  endedAt: z.number(),
  exercises: z.array(sessionExerciseSchema).max(60),
  notes: z.string().max(2000).optional(),
});

export const weightSchema = z.object({
  id,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weight: z.number().positive().max(500),
});

// One night: when you went to bed and when you woke up (epoch ms).
export const sleepSchema = z
  .object({ id, bed: z.number(), wake: z.number() })
  .refine((s) => s.wake > s.bed && s.wake - s.bed <= 24 * 3_600_000, {
    message: "Wake time must be after bedtime, within a day",
  });

export const settingsSchema = z.object({
  unit: z.enum(["kg", "lb"]),
  defaultRest: z.number().int().min(0).max(1800),
  distanceUnit: z.enum(["km", "mi"]).optional(),
  /** Minutes of sleep you aim for. */
  sleepGoal: z.number().int().min(60).max(960).optional(),
});

export const rotationSchema = z.object({
  items: z.array(id).max(30),
  next: z.number().int().min(0),
});

export const dbSchema = z.object({
  version: z.literal(1),
  rev: z.number().int(),
  updatedAt: z.number(),
  exercises: z.array(exerciseSchema),
  routines: z.array(routineSchema),
  rotation: rotationSchema,
  sessions: z.array(sessionSchema),
  weights: z.array(weightSchema),
  sleeps: z.array(sleepSchema).default([]),
  settings: settingsSchema,
  meta: z.object({ snapshotDay: z.string().optional() }),
});

export type Muscle = (typeof MUSCLES)[number];
export type Kind = (typeof KINDS)[number];
export type Exercise = z.infer<typeof exerciseSchema>;
export type RoutineItem = z.infer<typeof routineItemSchema>;
export type Routine = z.infer<typeof routineSchema>;
export type SetEntry = z.infer<typeof setSchema>;
export type SessionExercise = z.infer<typeof sessionExerciseSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type WeightEntry = z.infer<typeof weightSchema>;
export type SleepEntry = z.infer<typeof sleepSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type Db = z.infer<typeof dbSchema>;

const SEED: [string, Kind, Muscle][] = [
  ["Bench Press", "weight", "chest"],
  ["Incline Bench Press", "weight", "chest"],
  ["Dumbbell Bench Press", "weight", "chest"],
  ["Incline Dumbbell Press", "weight", "chest"],
  ["Machine Chest Press", "weight", "chest"],
  ["Cable Fly", "weight", "chest"],
  ["Push-up", "reps", "chest"],
  ["Dip", "reps", "chest"],
  ["Deadlift", "weight", "back"],
  ["Pull-up", "reps", "back"],
  ["Chin-up", "reps", "back"],
  ["Lat Pulldown", "weight", "back"],
  ["Barbell Row", "weight", "back"],
  ["Dumbbell Row", "weight", "back"],
  ["Seated Cable Row", "weight", "back"],
  ["T-Bar Row", "weight", "back"],
  ["Straight-Arm Pulldown", "weight", "back"],
  ["Overhead Press", "weight", "shoulders"],
  ["Dumbbell Shoulder Press", "weight", "shoulders"],
  ["Lateral Raise", "weight", "shoulders"],
  ["Rear Delt Fly", "weight", "shoulders"],
  ["Face Pull", "weight", "shoulders"],
  ["Barbell Curl", "weight", "biceps"],
  ["EZ-Bar Curl", "weight", "biceps"],
  ["Dumbbell Curl", "weight", "biceps"],
  ["Hammer Curl", "weight", "biceps"],
  ["Preacher Curl", "weight", "biceps"],
  ["Cable Curl", "weight", "biceps"],
  ["Triceps Pushdown", "weight", "triceps"],
  ["Overhead Triceps Extension", "weight", "triceps"],
  ["Skull Crusher", "weight", "triceps"],
  ["Close-Grip Bench Press", "weight", "triceps"],
  ["Wrist Curl", "weight", "forearms"],
  ["Squat", "weight", "quads"],
  ["Front Squat", "weight", "quads"],
  ["Leg Press", "weight", "quads"],
  ["Hack Squat", "weight", "quads"],
  ["Leg Extension", "weight", "quads"],
  ["Bulgarian Split Squat", "weight", "quads"],
  ["Goblet Squat", "weight", "quads"],
  ["Lunge", "weight", "quads"],
  ["Romanian Deadlift", "weight", "hamstrings"],
  ["Leg Curl", "weight", "hamstrings"],
  ["Hip Thrust", "weight", "glutes"],
  ["Standing Calf Raise", "weight", "calves"],
  ["Seated Calf Raise", "weight", "calves"],
  ["Plank", "time", "core"],
  ["Hanging Leg Raise", "reps", "core"],
  ["Cable Crunch", "weight", "core"],
  ["Ab Wheel", "reps", "core"],
  ["Farmer's Carry", "time", "full body"],
  ["Running", "cardio", "cardio"],
  ["Treadmill", "cardio", "cardio"],
  ["Walking", "cardio", "cardio"],
  ["Incline Walk", "cardio", "cardio"],
  ["Hiking", "cardio", "cardio"],
  ["Cycling", "cardio", "cardio"],
  ["Stationary Bike", "cardio", "cardio"],
  ["Rowing", "cardio", "cardio"],
  ["Elliptical", "cardio", "cardio"],
  ["Stair Climber", "cardio", "cardio"],
  ["Swimming", "cardio", "cardio"],
  ["HIIT", "cardio", "cardio"],
  ["Jump Rope", "time", "cardio"],
  ["Yoga", "time", "full body"],
  ["Stretching", "time", "full body"],
];

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const seeded = (): Exercise[] =>
  SEED.map(([name, kind, muscle]) => ({ id: slug(name), name, kind, muscle }));

export function emptyDb(): Db {
  return {
    version: 1,
    rev: 0,
    updatedAt: 0,
    exercises: seeded(),
    routines: [],
    rotation: { items: [], next: 0 },
    sessions: [],
    weights: [],
    sleeps: [],
    settings: { unit: "kg", defaultRest: 90 },
    meta: {},
  };
}

/**
 * Brings older saved data up to date: adds built-in exercises introduced since
 * (exercises are only ever archived, so a missing id means it's new) and
 * fills in collections that didn't exist yet.
 */
export function upgrade(db: Db): Db {
  const have = new Set(db.exercises.map((e) => e.id));
  const missing = seeded().filter((e) => !have.has(e.id));
  return {
    ...db,
    exercises: missing.length ? [...db.exercises, ...missing] : db.exercises,
    sleeps: db.sleeps ?? [],
  };
}

/** Sensible starting sets, reps and rest when an exercise is added somewhere. */
export function defaultsFor(db: Db, exerciseId: string) {
  const kind = db.exercises.find((e) => e.id === exerciseId)?.kind ?? "weight";
  if (kind === "cardio") return { sets: 1, reps: undefined, rest: 0 };
  return {
    sets: 3,
    reps: kind === "time" ? undefined : "8–12",
    rest: db.settings.defaultRest,
  };
}

export const distanceUnit = (db: Db) => db.settings.distanceUnit ?? "km";
export const sleepGoal = (db: Db) => db.settings.sleepGoal ?? 480;

export const newId = () => crypto.randomUUID().replaceAll("-", "").slice(0, 16);
