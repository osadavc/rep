import type { Db, Exercise, Kind, Muscle, Session, SetEntry } from "./model";

export const exerciseMap = (db: Db) =>
  new Map(db.exercises.map((e) => [e.id, e]));

/** Estimated one-rep max (Epley). Only trusted up to 12 reps. */
export const e1rm = (weight: number, reps: number) =>
  reps <= 0 || weight <= 0 || reps > 12
    ? 0
    : reps === 1
      ? weight
      : weight * (1 + reps / 30);

export const setVolume = (s: SetEntry, kind: Kind) =>
  kind === "weight" ? (s.weight ?? 0) * (s.reps ?? 0) : 0;

const doneSets = (sets: SetEntry[]) => sets.filter((s) => s.done);

/** Cardio counts toward cardio time and distance (jump rope included). */
export const isCardio = (e?: Exercise) =>
  e?.kind === "cardio" || e?.muscle === "cardio";

/** km/h for a set, if it has enough distance to mean something. */
const setSpeed = (s: SetEntry) =>
  (s.distance ?? 0) >= 0.4 && (s.seconds ?? 0) > 0
    ? (s.distance ?? 0) / ((s.seconds ?? 0) / 3600)
    : 0;

export type Summary = {
  duration: number;
  volume: number;
  sets: number;
  reps: number;
  exercises: number;
  skipped: number;
  restTotal: number;
  restCount: number;
  cardioSeconds: number;
  distance: number;
  calories: number;
};

export function summarize(
  session: Session,
  ex: Map<string, Exercise>,
): Summary {
  const out: Summary = {
    duration: session.endedAt - session.startedAt,
    volume: 0,
    sets: 0,
    reps: 0,
    exercises: 0,
    skipped: 0,
    restTotal: 0,
    restCount: 0,
    cardioSeconds: 0,
    distance: 0,
    calories: 0,
  };
  for (const e of session.exercises) {
    if (e.skipped) {
      out.skipped++;
      continue;
    }
    out.exercises++;
    const meta = ex.get(e.exerciseId);
    const kind = meta?.kind ?? "weight";
    const cardio = isCardio(meta);
    for (const s of doneSets(e.sets)) {
      out.sets++;
      out.reps += s.reps ?? 0;
      out.volume += setVolume(s, kind);
      out.calories += s.calories ?? 0;
      if (cardio) {
        out.cardioSeconds += s.seconds ?? 0;
        out.distance += s.distance ?? 0;
      }
      if (s.rest !== undefined) {
        out.restTotal += s.rest;
        out.restCount++;
      }
    }
  }
  return out;
}

/** The sets from the last time this exercise was done, for "previous" hints. */
export function previousSets(
  db: Db,
  exerciseId: string,
  beforeSessionId?: string,
) {
  for (let i = db.sessions.length - 1; i >= 0; i--) {
    const s = db.sessions[i];
    if (s.id === beforeSessionId) continue;
    const e = s.exercises.find(
      (x) => x.exerciseId === exerciseId && !x.skipped,
    );
    if (e?.sets.some((x) => x.done)) return doneSets(e.sets);
  }
  return [];
}

// ——— Records and PRs ———

export type PrType =
  | "weight"
  | "e1rm"
  | "volume"
  | "reps"
  | "time"
  | "distance"
  | "speed";

export const PR_LABEL: Record<PrType, string> = {
  weight: "Heaviest",
  e1rm: "Est. 1RM",
  volume: "Volume",
  reps: "Most reps",
  time: "Longest",
  distance: "Farthest",
  speed: "Fastest pace",
};

export type Best = {
  value: number;
  at: number;
  sessionId: string;
  set?: SetEntry;
};

export type Records = Partial<Record<PrType, Best>> & {
  repMax: Record<number, Best>;
};

export type Pr = {
  type: PrType;
  exerciseId: string;
  sessionId: string;
  at: number;
  value: number;
  previous: number;
};

/** What a single exercise in one session achieved, per record type. */
function sessionBests(kind: Kind, sets: SetEntry[]) {
  const best: Partial<Record<PrType, { value: number; set?: SetEntry }>> = {};
  const bump = (type: PrType, value: number, set?: SetEntry) => {
    if (value > 0 && value > (best[type]?.value ?? 0))
      best[type] = { value, set };
  };
  let volume = 0;
  for (const s of sets) {
    if (kind === "weight") {
      if ((s.reps ?? 0) >= 1) bump("weight", s.weight ?? 0, s);
      bump("e1rm", e1rm(s.weight ?? 0, s.reps ?? 0), s);
      volume += setVolume(s, kind);
    } else if (kind === "reps") {
      bump("reps", s.reps ?? 0, s);
    } else if (kind === "time") {
      bump("time", s.seconds ?? 0, s);
    } else {
      bump("distance", s.distance ?? 0, s);
      bump("time", s.seconds ?? 0, s);
      bump("speed", setSpeed(s), s);
    }
  }
  if (kind === "weight") bump("volume", volume);
  return best;
}

/** Walks every session in order, tracking bests and when they were beaten. */
export function records(db: Db) {
  const ex = exerciseMap(db);
  const byExercise = new Map<string, Records>();
  const prs: Pr[] = [];

  for (const session of db.sessions) {
    for (const e of session.exercises) {
      if (e.skipped) continue;
      const sets = doneSets(e.sets);
      if (!sets.length) continue;
      const kind = ex.get(e.exerciseId)?.kind ?? "weight";
      let rec = byExercise.get(e.exerciseId);
      if (!rec) {
        rec = { repMax: {} };
        byExercise.set(e.exerciseId, rec);
      }
      const isFirst = !Object.keys(rec).some((k) => k !== "repMax");

      for (const [type, b] of Object.entries(sessionBests(kind, sets)) as [
        PrType,
        { value: number; set?: SetEntry },
      ][]) {
        const prev = rec[type];
        if (prev && b.value <= prev.value + 1e-9) continue;
        if (!isFirst && prev) {
          prs.push({
            type,
            exerciseId: e.exerciseId,
            sessionId: session.id,
            at: session.startedAt,
            value: b.value,
            previous: prev.value,
          });
        }
        rec[type] = {
          value: b.value,
          at: session.startedAt,
          sessionId: session.id,
          set: b.set,
        };
      }

      if (kind === "weight") {
        for (const s of sets) {
          const w = s.weight ?? 0;
          for (let r = 1; r <= Math.min(s.reps ?? 0, 15); r++) {
            if (w > (rec.repMax[r]?.value ?? 0)) {
              rec.repMax[r] = {
                value: w,
                at: session.startedAt,
                sessionId: session.id,
                set: s,
              };
            }
          }
        }
      }
    }
  }
  return { byExercise, prs };
}

// ——— Time ———

const DAY = 86_400_000;

export function weekStart(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

const addWeeks = (t: number, n: number) => {
  const d = new Date(t);
  d.setDate(d.getDate() + n * 7);
  return d.getTime();
};

export type Week = {
  start: number;
  workouts: number;
  volume: number;
  sets: number;
  duration: number;
  cardio: number;
  distance: number;
};

/** The last `count` weeks (Monday start), oldest first, including empty ones. */
export function weeklySeries(db: Db, count: number): Week[] {
  const ex = exerciseMap(db);
  const thisWeek = weekStart(Date.now());
  const weeks: Week[] = Array.from({ length: count }, (_, i) => ({
    start: addWeeks(thisWeek, i - count + 1),
    workouts: 0,
    volume: 0,
    sets: 0,
    duration: 0,
    cardio: 0,
    distance: 0,
  }));
  const index = new Map(weeks.map((w, i) => [w.start, i]));
  for (const s of db.sessions) {
    const i = index.get(weekStart(s.startedAt));
    if (i === undefined) continue;
    const sum = summarize(s, ex);
    weeks[i].workouts++;
    weeks[i].volume += sum.volume;
    weeks[i].sets += sum.sets;
    weeks[i].duration += sum.duration;
    weeks[i].cardio += sum.cardioSeconds;
    weeks[i].distance += sum.distance;
  }
  return weeks;
}

/** Sets per week for each muscle, oldest week first. */
export function muscleWeeks(db: Db, count: number) {
  const ex = exerciseMap(db);
  const thisWeek = weekStart(Date.now());
  const starts = Array.from({ length: count }, (_, i) =>
    addWeeks(thisWeek, i - count + 1),
  );
  const index = new Map(starts.map((w, i) => [w, i]));
  const out = new Map<Muscle, number[]>();
  for (const s of db.sessions) {
    const i = index.get(weekStart(s.startedAt));
    if (i === undefined) continue;
    for (const e of s.exercises) {
      const meta = ex.get(e.exerciseId);
      if (e.skipped || !meta || meta.muscle === "cardio") continue;
      const row = out.get(meta.muscle) ?? Array(count).fill(0);
      row[i] += doneSets(e.sets).length;
      out.set(meta.muscle, row);
    }
  }
  return { starts, muscles: out };
}

/** Consecutive weeks with at least one workout. This week counts once it has one. */
export function weekStreaks(sessions: Session[]) {
  const trained = new Set(sessions.map((s) => weekStart(s.startedAt)));
  let current = 0;
  let w = weekStart(Date.now());
  if (!trained.has(w)) w = addWeeks(w, -1);
  while (trained.has(w)) {
    current++;
    w = addWeeks(w, -1);
  }
  let longest = 0;
  let run = 0;
  let prev: number | undefined;
  for (const week of [...trained].sort((a, b) => a - b)) {
    run = prev !== undefined && addWeeks(prev, 1) === week ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = week;
  }
  return { current, longest };
}

/** Longest stretch of days between two workouts. */
export function longestBreak(sessions: Session[]) {
  let longest = 0;
  for (let i = 1; i < sessions.length; i++) {
    const a = new Date(sessions[i - 1].startedAt).setHours(0, 0, 0, 0);
    const b = new Date(sessions[i].startedAt).setHours(0, 0, 0, 0);
    longest = Math.max(longest, Math.round((b - a) / DAY) - 1);
  }
  return longest;
}

/** Days (local, YYYY-MM-DD) that had a workout. */
export function trainedDays(sessions: Session[]) {
  const days = new Set<string>();
  for (const s of sessions) {
    const d = new Date(s.startedAt);
    days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  }
  return days;
}

export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

// ——— Breakdown ———

export function overview(sessions: Session[], db: Db) {
  const ex = exerciseMap(db);
  const muscles = new Map<Muscle, number>();
  const weekdays = Array(7).fill(0) as number[];
  const dayparts = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 };
  const routines = new Map<
    string,
    { name: string; count: number; duration: number; volume: number }
  >();
  const exercises = new Map<
    string,
    {
      sessions: number;
      sets: number;
      reps: number;
      volume: number;
      seconds: number;
      distance: number;
      last: number;
      skipped: number;
    }
  >();
  const total = {
    workouts: sessions.length,
    duration: 0,
    cardioSeconds: 0,
    distance: 0,
    calories: 0,
    volume: 0,
    sets: 0,
    reps: 0,
    restTotal: 0,
    restCount: 0,
    exercises: 0,
    skipped: 0,
  };

  for (const s of sessions) {
    const sum = summarize(s, ex);
    total.duration += sum.duration;
    total.cardioSeconds += sum.cardioSeconds;
    total.distance += sum.distance;
    total.calories += sum.calories;
    total.volume += sum.volume;
    total.sets += sum.sets;
    total.reps += sum.reps;
    total.restTotal += sum.restTotal;
    total.restCount += sum.restCount;
    total.exercises += sum.exercises + sum.skipped;
    total.skipped += sum.skipped;

    const d = new Date(s.startedAt);
    weekdays[(d.getDay() + 6) % 7]++;
    const h = d.getHours();
    dayparts[
      h >= 5 && h < 12
        ? "Morning"
        : h >= 12 && h < 17
          ? "Afternoon"
          : h >= 17 && h < 22
            ? "Evening"
            : "Night"
    ]++;

    const key = s.routineId ?? `name:${s.name}`;
    const r = routines.get(key) ?? {
      name: s.name,
      count: 0,
      duration: 0,
      volume: 0,
    };
    r.count++;
    r.duration += sum.duration;
    r.volume += sum.volume;
    r.name = s.name;
    routines.set(key, r);

    for (const e of s.exercises) {
      const row = exercises.get(e.exerciseId) ?? {
        sessions: 0,
        sets: 0,
        reps: 0,
        volume: 0,
        seconds: 0,
        distance: 0,
        last: 0,
        skipped: 0,
      };
      if (e.skipped) {
        row.skipped++;
        exercises.set(e.exerciseId, row);
        continue;
      }
      const meta = ex.get(e.exerciseId);
      const sets = doneSets(e.sets);
      row.sessions++;
      row.sets += sets.length;
      row.last = Math.max(row.last, s.startedAt);
      for (const set of sets) {
        row.reps += set.reps ?? 0;
        row.volume += setVolume(set, meta?.kind ?? "weight");
        row.seconds += set.seconds ?? 0;
        row.distance += set.distance ?? 0;
      }
      exercises.set(e.exerciseId, row);
      if (meta && meta.muscle !== "cardio")
        muscles.set(meta.muscle, (muscles.get(meta.muscle) ?? 0) + sets.length);
    }
  }

  return { total, muscles, weekdays, dayparts, routines, exercises };
}

export type HistoryEntry = {
  session: Session;
  sets: SetEntry[];
  /** e1RM (weight), max reps, longest time or farthest distance. */
  best: number;
  topSet?: SetEntry;
  volume: number;
  topWeight: number;
  reps: number;
  maxReps: number;
  seconds: number;
  distance: number;
  calories: number;
  /** Average of the sets that have a heart rate. */
  heartRate: number;
  restAvg: number;
};

/** Per-session history of one exercise, oldest first. */
export function exerciseHistory(db: Db, exerciseId: string) {
  const kind = exerciseMap(db).get(exerciseId)?.kind ?? "weight";
  const out: HistoryEntry[] = [];
  for (const session of db.sessions) {
    const e = session.exercises.find(
      (x) => x.exerciseId === exerciseId && !x.skipped,
    );
    if (!e) continue;
    const sets = doneSets(e.sets);
    if (!sets.length) continue;
    const entry: HistoryEntry = {
      session,
      sets,
      best: 0,
      volume: 0,
      topWeight: 0,
      reps: 0,
      maxReps: 0,
      seconds: 0,
      distance: 0,
      calories: 0,
      heartRate: 0,
      restAvg: 0,
    };
    let hrSum = 0;
    let hrN = 0;
    let restSum = 0;
    let restN = 0;
    for (const s of sets) {
      const v =
        kind === "weight"
          ? e1rm(s.weight ?? 0, s.reps ?? 0) || (s.weight ?? 0)
          : kind === "reps"
            ? (s.reps ?? 0)
            : kind === "time"
              ? (s.seconds ?? 0)
              : (s.distance ?? 0) || (s.seconds ?? 0);
      if (v > entry.best) {
        entry.best = v;
        entry.topSet = s;
      }
      entry.volume += setVolume(s, kind);
      entry.topWeight = Math.max(entry.topWeight, s.weight ?? 0);
      entry.reps += s.reps ?? 0;
      entry.maxReps = Math.max(entry.maxReps, s.reps ?? 0);
      entry.seconds += s.seconds ?? 0;
      entry.distance += s.distance ?? 0;
      entry.calories += s.calories ?? 0;
      if (s.heartRate) {
        hrSum += s.heartRate;
        hrN++;
      }
      if (s.rest !== undefined) {
        restSum += s.rest;
        restN++;
      }
    }
    entry.heartRate = hrN ? hrSum / hrN : 0;
    entry.restAvg = restN ? restSum / restN : 0;
    out.push(entry);
  }
  return out;
}

/** The lifts you do most, with their best est. 1RM per workout since `from`. */
export function strengthTrends(db: Db, from: number, limit = 6) {
  const counts = new Map<string, number>();
  for (const s of db.sessions) {
    if (s.startedAt < from) continue;
    for (const e of s.exercises) {
      if (!e.skipped && e.sets.some((x) => x.done)) {
        counts.set(e.exerciseId, (counts.get(e.exerciseId) ?? 0) + 1);
      }
    }
  }
  const ex = exerciseMap(db);
  return [...counts.entries()]
    .filter(([id, n]) => ex.get(id)?.kind === "weight" && n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => ({
      exercise: ex.get(id) as Exercise,
      points: exerciseHistory(db, id)
        .filter((h) => h.session.startedAt >= from)
        .map((h) => ({ t: h.session.startedAt, v: h.best })),
    }));
}

/** Least-squares slope of v against time, per week. */
export function weeklySlope(points: { t: number; v: number }[]) {
  if (points.length < 2) return 0;
  const n = points.length;
  const mx = points.reduce((a, p) => a + p.t, 0) / n;
  const my = points.reduce((a, p) => a + p.v, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.t - mx) * (p.v - my);
    den += (p.t - mx) ** 2;
  }
  return den ? (num / den) * 7 * DAY : 0;
}

/** Simple trailing moving average over the previous `days` days. */
export function movingAverage(
  points: { t: number; v: number }[],
  days: number,
) {
  return points.map((p, i) => {
    let sum = 0;
    let n = 0;
    for (let j = i; j >= 0 && p.t - points[j].t < days * DAY; j--) {
      sum += points[j].v;
      n++;
    }
    return { t: p.t, v: sum / n };
  });
}
