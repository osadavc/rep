"use client";

import { type RefObject, useRef, useState } from "react";
import {
  fmtDist,
  fmtNum,
  seconds as fmtSeconds,
  fmtWeight,
  fromDist,
  fromUnit,
  pace,
  parseNum,
  toDist,
  toUnit,
} from "@/lib/format";
import type { Kind, SetEntry, Settings } from "@/lib/model";
import { cx } from "./ui";

type Unit = Settings["unit"];
type Dist = NonNullable<Settings["distanceUnit"]>;

const same = (a?: number, b?: number) =>
  a === b || (a !== undefined && b !== undefined && Math.abs(a - b) < 1e-6);

const inputCls =
  "tnum h-10 w-full min-w-0 rounded-[10px] bg-fill px-1 text-center text-[17px] font-medium focus:bg-fill-strong";
const doneCls =
  "tnum h-10 w-full min-w-0 rounded-[10px] px-1 text-center text-[17px] font-medium focus:bg-fill-strong";

/** A number input that tolerates half-typed values like "62." or "62,". */
export function NumField({
  value,
  onChange,
  placeholder,
  decimal,
  label,
  inputRef,
  className,
  format = (n) => fmtNum(n, 2).replaceAll(",", ""),
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
  decimal?: boolean;
  label: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  /** Replaces the default boxed style. */
  className?: string;
  format?: (n: number) => string;
}) {
  const [text, setText] = useState(value === undefined ? "" : format(value));
  const [seen, setSeen] = useState(value);
  if (!same(value, seen)) {
    setSeen(value);
    if (!same(parseNum(text), value))
      setText(value === undefined ? "" : format(value));
  }
  return (
    <input
      ref={inputRef}
      aria-label={label}
      inputMode={decimal ? "decimal" : "numeric"}
      enterKeyHint="done"
      autoComplete="off"
      value={text}
      placeholder={placeholder}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => value !== undefined && setText(format(value))}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseNum(e.target.value);
        setSeen(n);
        onChange(n);
      }}
      className={cx(className ?? inputCls, "placeholder:font-normal")}
    />
  );
}

/** "90", "1:30" and "1.30" all mean 90 seconds. */
export function parseSeconds(text: string) {
  const t = text.trim().replace(".", ":");
  if (!t) return undefined;
  if (t.includes(":")) {
    const [m, s] = t.split(":");
    const mins = Number.parseInt(m || "0", 10);
    const secs = Number.parseInt(s || "0", 10);
    if (!Number.isFinite(mins) || !Number.isFinite(secs)) return undefined;
    return mins * 60 + secs;
  }
  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) ? n : undefined;
}

export function TimeField({
  value,
  onChange,
  placeholder,
  label,
  inputRef,
  className,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
  label: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  className?: string;
}) {
  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const [text, setText] = useState(value === undefined ? "" : fmt(value));
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (parseSeconds(text) !== value)
      setText(value === undefined ? "" : fmt(value));
  }
  return (
    <input
      ref={inputRef}
      aria-label={label}
      inputMode="decimal"
      enterKeyHint="done"
      autoComplete="off"
      value={text}
      placeholder={placeholder}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => value !== undefined && setText(fmt(value))}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseSeconds(e.target.value);
        setSeen(n);
        onChange(n);
      }}
      className={cx(className ?? inputCls, "placeholder:font-normal")}
    />
  );
}

export function describeSet(
  s: SetEntry,
  kind: Kind,
  unit: Unit,
  dist: Dist = "km",
) {
  if (kind === "weight")
    return `${fmtWeight(s.weight ?? 0, unit)} × ${s.reps ?? 0}`;
  if (kind === "reps") return `× ${s.reps ?? 0}`;
  if (kind === "time") return fmtSeconds(s.seconds ?? 0);
  return [
    s.distance ? fmtDist(s.distance, dist) : null,
    s.seconds ? fmtSeconds(s.seconds) : null,
    s.distance && s.seconds ? pace(s.seconds, s.distance, dist) : null,
    s.calories ? `${s.calories} kcal` : null,
    s.heartRate ? `${s.heartRate} bpm` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

const targetLow = (reps?: string) => {
  const n = Number.parseInt(reps ?? "", 10);
  return Number.isFinite(n) ? n : undefined;
};

/** The values a set falls back to when left empty: earlier sets today, then last time. */
export function fallbacks(
  sets: SetEntry[],
  previous: SetEntry[],
  i: number,
  targetReps?: string,
) {
  const prev = previous[i] ?? previous[previous.length - 1];
  const earlier = sets
    .slice(0, i)
    .reverse()
    .find((s) => s.done);
  return {
    weight: earlier?.weight ?? prev?.weight,
    reps: earlier?.reps ?? prev?.reps ?? targetLow(targetReps),
    seconds: earlier?.seconds ?? prev?.seconds,
    distance: earlier?.distance ?? prev?.distance,
    calories: earlier?.calories ?? prev?.calories,
    heartRate: earlier?.heartRate ?? prev?.heartRate,
  };
}

const GRID: Record<Kind, string> = {
  weight: "grid-cols-[22px_minmax(0,1fr)_72px_56px_44px]",
  reps: "grid-cols-[22px_minmax(0,1fr)_72px_44px]",
  time: "grid-cols-[22px_minmax(0,1fr)_80px_44px]",
  // Cardio has more to log, so "previous" shows as the placeholders instead.
  cardio:
    "grid-cols-[22px_minmax(0,1.1fr)_minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,0.9fr)_44px]",
};

export function SetTable({
  kind,
  unit,
  dist = "km",
  sets,
  previous,
  targetReps,
  onEdit,
  onComplete,
  onUncomplete,
  onRemove,
}: {
  kind: Kind;
  unit: Unit;
  dist?: Dist;
  sets: SetEntry[];
  previous: SetEntry[];
  targetReps?: string;
  onEdit: (si: number, patch: Partial<SetEntry>) => void;
  /** Live mode: a checkbox per set. */
  onComplete?: (si: number, values: Partial<SetEntry>) => void;
  onUncomplete?: (si: number) => void;
  /** Edit mode: a remove button per set instead. */
  onRemove?: (si: number) => void;
}) {
  const head =
    "text-[12px] font-medium uppercase tracking-[0.05em] text-secondary";
  return (
    <div>
      <div className={cx("grid items-center gap-2 pb-1", GRID[kind])}>
        <span className={head}>Set</span>
        {kind !== "cardio" ? <span className={head}>Previous</span> : null}
        {kind === "weight" ? (
          <>
            <span className={cx(head, "text-center")}>{unit}</span>
            <span className={cx(head, "text-center")}>Reps</span>
          </>
        ) : kind === "reps" ? (
          <span className={cx(head, "text-center")}>Reps</span>
        ) : kind === "time" ? (
          <span className={cx(head, "text-center")}>Time</span>
        ) : (
          <>
            <span className={cx(head, "text-center")}>{dist}</span>
            <span className={cx(head, "text-center")}>Time</span>
            <span className={cx(head, "text-center")}>kcal</span>
            <span className={cx(head, "text-center")}>bpm</span>
          </>
        )}
        <span />
      </div>
      {sets.map((s, i) => (
        <SetRow
          // biome-ignore lint/suspicious/noArrayIndexKey: sets have no identity beyond position
          key={i}
          index={i}
          kind={kind}
          unit={unit}
          dist={dist}
          set={s}
          prev={previous[i]}
          fallback={fallbacks(sets, previous, i, targetReps)}
          onEdit={(patch) => onEdit(i, patch)}
          onComplete={onComplete && ((v) => onComplete(i, v))}
          onUncomplete={onUncomplete && (() => onUncomplete(i))}
          onRemove={onRemove && (() => onRemove(i))}
        />
      ))}
    </div>
  );
}

function SetRow({
  index,
  kind,
  unit,
  dist,
  set,
  prev,
  fallback,
  onEdit,
  onComplete,
  onUncomplete,
  onRemove,
}: {
  index: number;
  kind: Kind;
  unit: Unit;
  dist: Dist;
  set: SetEntry;
  prev?: SetEntry;
  fallback: ReturnType<typeof fallbacks>;
  onEdit: (patch: Partial<SetEntry>) => void;
  onComplete?: (values: Partial<SetEntry>) => void;
  onUncomplete?: () => void;
  onRemove?: () => void;
}) {
  const repsRef = useRef<HTMLInputElement>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  const live = Boolean(onComplete);
  const done = live && set.done;
  const ph = (n: number | undefined, f: (n: number) => string = String) =>
    n === undefined ? "–" : f(n);

  function complete() {
    const v = {
      weight: set.weight ?? fallback.weight,
      reps: set.reps ?? fallback.reps,
      seconds: set.seconds ?? fallback.seconds,
      distance: set.distance ?? fallback.distance,
      calories: set.calories ?? fallback.calories,
      heartRate: set.heartRate ?? fallback.heartRate,
    };
    if (kind === "weight" && v.weight === undefined)
      return firstRef.current?.focus();
    if ((kind === "weight" || kind === "reps") && !v.reps) {
      return (kind === "weight" ? repsRef : firstRef).current?.focus();
    }
    if (kind === "time" && !v.seconds) return firstRef.current?.focus();
    if (kind === "cardio" && !v.distance && !v.seconds)
      return firstRef.current?.focus();
    onComplete?.({
      weight: kind === "weight" ? v.weight : undefined,
      reps: kind === "weight" || kind === "reps" ? v.reps : undefined,
      seconds: kind === "time" || kind === "cardio" ? v.seconds : undefined,
      distance: kind === "cardio" ? v.distance : undefined,
      calories: kind === "cardio" ? v.calories : undefined,
      heartRate: kind === "cardio" ? v.heartRate : undefined,
    });
  }

  return (
    <div className={cx("grid items-center gap-2 py-1", GRID[kind])}>
      <span
        className={cx(
          "tnum text-[15px] font-medium",
          done ? "text-black" : "text-secondary",
        )}
      >
        {index + 1}
      </span>
      {kind !== "cardio" ? (
        <span className="tnum truncate text-[15px] text-secondary">
          {prev ? describeSet(prev, kind, unit, dist) : "–"}
        </span>
      ) : null}

      {kind === "weight" ? (
        <>
          <NumField
            label={`Set ${index + 1} weight`}
            decimal
            inputRef={firstRef}
            value={
              set.weight === undefined ? undefined : toUnit(set.weight, unit)
            }
            placeholder={ph(fallback.weight, (n) => fmtWeight(n, unit))}
            onChange={(v) =>
              onEdit({
                weight: v === undefined ? undefined : fromUnit(v, unit),
              })
            }
            className={done ? doneCls : undefined}
          />
          <NumField
            label={`Set ${index + 1} reps`}
            inputRef={repsRef}
            value={set.reps}
            placeholder={ph(fallback.reps)}
            onChange={(v) =>
              onEdit({ reps: v === undefined ? undefined : Math.round(v) })
            }
            className={done ? doneCls : undefined}
          />
        </>
      ) : kind === "reps" ? (
        <NumField
          label={`Set ${index + 1} reps`}
          inputRef={firstRef}
          value={set.reps}
          placeholder={ph(fallback.reps)}
          onChange={(v) =>
            onEdit({ reps: v === undefined ? undefined : Math.round(v) })
          }
          className={done ? doneCls : undefined}
        />
      ) : kind === "time" ? (
        <TimeField
          label={`Set ${index + 1} time`}
          inputRef={firstRef}
          value={set.seconds}
          placeholder={ph(fallback.seconds, fmtSeconds)}
          onChange={(v) => onEdit({ seconds: v })}
          className={done ? doneCls : undefined}
        />
      ) : (
        <>
          <NumField
            label={`Set ${index + 1} distance`}
            decimal
            inputRef={firstRef}
            value={
              set.distance === undefined
                ? undefined
                : toDist(set.distance, dist)
            }
            placeholder={ph(fallback.distance, (n) =>
              fmtNum(toDist(n, dist), 2),
            )}
            onChange={(v) =>
              onEdit({
                distance: v === undefined ? undefined : fromDist(v, dist),
              })
            }
            className={done ? doneCls : undefined}
          />
          <TimeField
            label={`Set ${index + 1} time`}
            value={set.seconds}
            placeholder={ph(fallback.seconds, fmtSeconds)}
            onChange={(v) => onEdit({ seconds: v })}
            className={done ? doneCls : undefined}
          />
          <NumField
            label={`Set ${index + 1} calories`}
            value={set.calories}
            placeholder={ph(fallback.calories)}
            onChange={(v) =>
              onEdit({ calories: v === undefined ? undefined : Math.round(v) })
            }
            className={done ? doneCls : undefined}
          />
          <NumField
            label={`Set ${index + 1} average heart rate`}
            value={set.heartRate}
            placeholder={ph(fallback.heartRate)}
            onChange={(v) =>
              onEdit({
                heartRate:
                  v === undefined ? undefined : Math.min(250, Math.round(v)),
              })
            }
            className={done ? doneCls : undefined}
          />
        </>
      )}

      {live ? (
        <button
          type="button"
          aria-label={
            done ? `Undo set ${index + 1}` : `Complete set ${index + 1}`
          }
          aria-pressed={done}
          onClick={() => (done ? onUncomplete?.() : complete())}
          className="flex h-11 w-11 items-center justify-center"
        >
          <span
            className={cx(
              "flex h-[28px] w-[28px] items-center justify-center rounded-[8px] border-2 transition-transform duration-100 active:scale-90",
              done ? "border-black bg-black text-white" : "border-tertiary",
            )}
          >
            {done ? (
              <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
                <path
                  d="M3.5 8.5l3 3 6-7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : null}
          </span>
        </button>
      ) : (
        <button
          type="button"
          aria-label={`Remove set ${index + 1}`}
          onClick={onRemove}
          className="press flex h-11 w-11 items-center justify-center text-[20px] text-secondary"
        >
          ×
        </button>
      )}
    </div>
  );
}
