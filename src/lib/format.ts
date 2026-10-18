import type { Settings } from "./model";

type Unit = Settings["unit"];

const LB_PER_KG = 2.2046226218;

export const toUnit = (kg: number, unit: Unit) =>
  unit === "lb" ? kg * LB_PER_KG : kg;

export const fromUnit = (value: number, unit: Unit) =>
  unit === "lb" ? value / LB_PER_KG : value;

const nf = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });

export const fmtNum = (n: number, digits: 0 | 1 | 2 = 1) =>
  (digits === 0 ? nf0 : digits === 2 ? nf2 : nf).format(n);

/** A weight in the user's unit, without the unit label. */
export const fmtWeight = (kg: number, unit: Unit) =>
  nf2.format(toUnit(kg, unit));

/** Large totals like volume: no decimals. */
export const fmtMass = (kg: number, unit: Unit) =>
  `${nf0.format(toUnit(kg, unit))} ${unit}`;

type DistanceUnit = "km" | "mi";
const KM_PER_MI = 1.609344;

export const toDist = (km: number, unit: DistanceUnit) =>
  unit === "mi" ? km / KM_PER_MI : km;

export const fromDist = (value: number, unit: DistanceUnit) =>
  unit === "mi" ? value * KM_PER_MI : value;

/** 5.02 km */
export const fmtDist = (
  km: number,
  unit: DistanceUnit,
  digits: 0 | 1 | 2 = 2,
) => `${fmtNum(toDist(km, unit), digits)} ${unit}`;

/** Time per km (or mile): 5:12 /km */
export function pace(seconds: number, km: number, unit: DistanceUnit) {
  const d = toDist(km, unit);
  if (!d || !seconds) return "–";
  const per = Math.round(seconds / d);
  return `${Math.floor(per / 60)}:${String(per % 60).padStart(2, "0")} /${unit}`;
}

/** 11.5 km/h (or mph) */
export function speed(seconds: number, km: number, unit: DistanceUnit) {
  if (!seconds || !km) return "–";
  return `${fmtNum(toDist(km, unit) / (seconds / 3600), 1)} ${unit === "mi" ? "mph" : "km/h"}`;
}

/** 7h 32m (from minutes) */
export function hm(minutes: number) {
  const m = Math.round(minutes);
  const h = Math.floor(Math.abs(m) / 60);
  const r = Math.abs(m) % 60;
  return `${m < 0 ? "−" : ""}${h ? `${h}h ` : ""}${String(r).padStart(h ? 2 : 1, "0")}m`;
}

/** 23:41 from minutes after midnight (wraps past 24h). */
export function clockOfDay(minutes: number) {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Accepts "62.5" and "62,5" (the iOS decimal pad uses a comma in some regions). */
export function parseNum(text: string): number | undefined {
  const n = Number.parseFloat(text.replace(",", ".").trim());
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** 0:42, 12:07, 1:04:09 */
export function clock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** 54m, 1h 05m */
export function duration(ms: number) {
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}

/** 1:30, 45s */
export function seconds(s: number) {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const sameYear = (d: Date) => d.getFullYear() === new Date().getFullYear();

/** Thu 16 Oct (adds the year when it isn't this year) */
export function day(t: number | Date) {
  const d = new Date(t);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(sameYear(d) ? {} : { year: "numeric" }),
  });
}

/** 16 Oct, 16 Oct 2025 */
export function shortDay(t: number | Date) {
  const d = new Date(t);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(sameYear(d) ? {} : { year: "numeric" }),
  });
}

export function time(t: number) {
  return new Date(t).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function monthTitle(t: number) {
  const d = new Date(t);
  return d.toLocaleDateString("en-GB", {
    month: "long",
    ...(sameYear(d) ? {} : { year: "numeric" }),
  });
}

const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export function daysBetween(a: number, b: number) {
  return Math.round((startOfDay(b) - startOfDay(a)) / 86_400_000);
}

export function ago(t: number) {
  const n = daysBetween(t, Date.now());
  if (n <= 0) return "today";
  if (n === 1) return "yesterday";
  if (n < 14) return `${n} days ago`;
  if (n < 60) return `${Math.round(n / 7)} weeks ago`;
  return `${Math.round(n / 30)} months ago`;
}

/** Local YYYY-MM-DD */
export function isoDay(t: number | Date = Date.now()) {
  const d = new Date(t);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${String(d.getDate()).padStart(2, "0")}`;
}

export const plural = (n: number, word: string, many = `${word}s`) =>
  `${fmtNum(n, 0)} ${n === 1 ? word : many}`;
