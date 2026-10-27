"use client";

import {
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cx } from "./ui";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setWidth(Math.floor(e.contentRect.width)),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

const GRID = "rgb(60 60 67 / 0.12)";
const AXIS = "rgb(60 60 67 / 0.29)";
const DIM = "rgb(60 60 67 / 0.22)";

function Caption({
  children,
  muted,
}: {
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <div
      className={cx(
        "tnum h-5 truncate text-[13px]",
        muted ? "text-secondary" : "text-black",
      )}
    >
      {children}
    </div>
  );
}

type Point = { t: number; v: number };

/**
 * One line over time. Optional faint dots show the raw values behind a smoothed line.
 * Drag across it to read any point.
 */
export function LineChart({
  line,
  dots,
  format,
  formatT,
  height = 168,
  summary,
}: {
  line: Point[];
  dots?: Point[];
  format: (v: number) => string;
  formatT: (t: number) => string;
  height?: number;
  summary?: ReactNode;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const all = [...line, ...(dots ?? [])];
  if (all.length === 0) return null;

  const pad = { top: 10, right: 48, bottom: 22, left: 0 };
  const w = Math.max(0, width - pad.left - pad.right);
  const h = height - pad.top - pad.bottom;
  const t0 = Math.min(...all.map((p) => p.t));
  const t1 = Math.max(...all.map((p) => p.t));
  let v0 = Math.min(...all.map((p) => p.v));
  let v1 = Math.max(...all.map((p) => p.v));
  if (v1 - v0 < 1e-9) {
    v0 -= 1;
    v1 += 1;
  }
  const span = v1 - v0;
  v0 -= span * 0.08;
  v1 += span * 0.08;
  const x = (t: number) =>
    pad.left + (t1 === t0 ? w / 2 : ((t - t0) / (t1 - t0)) * w);
  const y = (v: number) => pad.top + (1 - (v - v0) / (v1 - v0)) * h;

  const path = line
    .map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`)
    .join("");
  const area =
    line.length > 1
      ? `${path}L${x(line.at(-1)?.t ?? 0)},${pad.top + h}L${x(line[0].t)},${pad.top + h}Z`
      : "";

  const ticks = [v1 - (v1 - v0) * 0.08, v0 + (v1 - v0) * 0.08];
  const focus = hover ?? line.length - 1;
  const fp = line[focus];

  function onMove(e: ReactPointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best = 0;
    for (let i = 1; i < line.length; i++) {
      if (Math.abs(x(line[i].t) - px) < Math.abs(x(line[best].t) - px))
        best = i;
    }
    setHover(best);
  }

  return (
    <div ref={ref} className="select-none">
      {hover !== null && fp ? (
        <Caption>
          {formatT(fp.t)} · <b className="font-semibold">{format(fp.v)}</b>
        </Caption>
      ) : (
        <Caption muted>
          {summary ?? "Drag across the chart to read values"}
        </Caption>
      )}
      {width > 0 ? (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={summary ? String(summary) : "Line chart"}
          className="mt-2 block touch-pan-y overflow-visible"
          onPointerDown={onMove}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          onPointerUp={(e) => e.pointerType !== "mouse" && setHover(null)}
          onPointerCancel={() => setHover(null)}
        >
          {ticks.map((v) => (
            <g key={v}>
              <line
                x1={pad.left}
                x2={pad.left + w}
                y1={y(v)}
                y2={y(v)}
                stroke={GRID}
              />
              <text
                x={pad.left + w + 8}
                y={y(v) + 4}
                className="tnum fill-secondary text-[11px]"
              >
                {format(v)}
              </text>
            </g>
          ))}
          <line
            x1={pad.left}
            x2={pad.left + w}
            y1={pad.top + h}
            y2={pad.top + h}
            stroke={AXIS}
          />
          {dots?.map((p) => (
            <circle
              key={`${p.t}-${p.v}`}
              cx={x(p.t)}
              cy={y(p.v)}
              r={2.5}
              fill="rgb(60 60 67 / 0.3)"
            />
          ))}
          {area && !dots ? <path d={area} fill="rgb(0 0 0 / 0.035)" /> : null}
          {line.length > 1 ? (
            <path
              d={path}
              fill="none"
              stroke="#000"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}
          {hover !== null && fp ? (
            <line
              x1={x(fp.t)}
              x2={x(fp.t)}
              y1={pad.top}
              y2={pad.top + h}
              stroke="rgb(60 60 67 / 0.4)"
            />
          ) : null}
          {fp ? (
            <circle
              cx={x(fp.t)}
              cy={y(fp.v)}
              r={4.5}
              fill="#000"
              stroke="#fff"
              strokeWidth={2}
            />
          ) : null}
          <text
            x={pad.left}
            y={height - 4}
            className="fill-secondary text-[11px]"
          >
            {formatT(t0)}
          </text>
          {t1 !== t0 ? (
            <text
              x={pad.left + w}
              y={height - 4}
              textAnchor="end"
              className="fill-secondary text-[11px]"
            >
              {formatT(t1)}
            </text>
          ) : null}
        </svg>
      ) : (
        <div style={{ height: height + 8 }} />
      )}
    </div>
  );
}

/** Vertical bars from one baseline. Tap or hover a bar to read it. */
export function Columns({
  data,
  format,
  height = 132,
  summary,
  reference,
}: {
  data: { key: string | number; label: string; value: number }[];
  format: (v: number) => string;
  height?: number;
  summary?: ReactNode;
  /** A goal or average drawn as a line across the bars. */
  reference?: { value: number; label: string };
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value), reference?.value ?? 0, 0);
  const slot = data.length ? width / data.length : 0;
  const bar = Math.min(24, Math.max(2, slot - 2));
  const top = 4;
  const h = height - top;
  const focus = hover !== null ? data[hover] : null;

  return (
    <div ref={ref} className="select-none">
      {focus ? (
        <Caption>
          {focus.label} · <b className="font-semibold">{format(focus.value)}</b>
        </Caption>
      ) : (
        <Caption muted>{summary}</Caption>
      )}
      {width > 0 ? (
        <svg
          width={width}
          height={height + 1}
          role="img"
          aria-label={summary ? String(summary) : "Bar chart"}
          className="mt-2 block touch-pan-y"
          onPointerLeave={() => setHover(null)}
          onPointerUp={(e) => e.pointerType !== "mouse" && setHover(null)}
          onPointerCancel={() => setHover(null)}
          onPointerMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const i = Math.floor((e.clientX - rect.left) / slot);
            setHover(i >= 0 && i < data.length ? i : null);
          }}
          onPointerDown={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const i = Math.floor((e.clientX - rect.left) / slot);
            setHover(i >= 0 && i < data.length ? i : null);
          }}
        >
          {data.map((d, i) => {
            const bh = max
              ? Math.max(d.value ? 2 : 0, (d.value / max) * (h - 2))
              : 0;
            const bx = i * slot + (slot - bar) / 2;
            const by = top + h - bh;
            const r = Math.min(4, bar / 2, bh);
            const dim = hover !== null && hover !== i;
            return bh > 0 ? (
              <path
                key={d.key}
                d={`M${bx},${top + h}V${by + r}Q${bx},${by} ${bx + r},${by}H${bx + bar - r}Q${bx + bar},${by} ${bx + bar},${by + r}V${top + h}Z`}
                fill={dim ? DIM : "#000"}
              />
            ) : null;
          })}
          <line
            x1={0}
            x2={width}
            y1={top + h + 0.5}
            y2={top + h + 0.5}
            stroke={AXIS}
          />
          {reference && max ? (
            <ReferenceLine
              y={top + h - (reference.value / max) * (h - 2)}
              width={width}
              label={reference.label}
            />
          ) : null}
        </svg>
      ) : (
        <div style={{ height: height + 9 }} />
      )}
      {data.length > 1 ? (
        <div className="mt-1.5 flex justify-between text-[11px] text-secondary">
          <span>{data[0].label}</span>
          <span>{data.at(-1)?.label}</span>
        </div>
      ) : null}
    </div>
  );
}

/** Horizontal bars with labels, for breakdowns like sets per muscle. */
export function Bars({
  rows,
  max: fixedMax,
}: {
  rows: { key: string; label: ReactNode; value: number; display: ReactNode }[];
  /** A fixed full-width value (like 1 for shares); defaults to the largest row. */
  max?: number;
}) {
  const max = fixedMax ?? Math.max(...rows.map((r) => r.value), 0);
  return (
    <div className="space-y-3 pt-3">
      {rows.map((r) => (
        <div key={r.key}>
          <div className="flex items-baseline justify-between gap-3 text-[15px]">
            <span className="truncate capitalize">{r.label}</span>
            <span className="tnum shrink-0 text-secondary">{r.display}</span>
          </div>
          <div className="mt-1.5 h-[5px] w-full rounded-full bg-fill">
            <div
              className="h-full rounded-full bg-black"
              style={{
                width: `${max ? Math.max(1.5, (r.value / max) * 100) : 0}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** One square per day, weeks as columns (Monday on top). Filled = trained. */
export function ActivityGrid({
  trained,
  weeks,
  describe,
}: {
  trained: (d: Date) => boolean;
  /** The most weeks to show; fewer fit on narrow screens. */
  weeks: number;
  describe: (d: Date) => string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [picked, setPicked] = useState<Date | null>(null);
  const gap = 3;
  // Squares stay small; wider screens show more weeks instead of bigger squares.
  const fit = width
    ? Math.max(4, Math.min(weeks, Math.floor((width + gap) / (16 + gap))))
    : 0;
  const cell = fit ? Math.floor((width - gap * (fit - 1)) / fit) : 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const first = new Date(monday);
  first.setDate(monday.getDate() - (Math.max(fit, 1) - 1) * 7);

  const columns = Array.from({ length: fit }, (_, wi) =>
    Array.from({ length: 7 }, (_, di) => {
      const d = new Date(first);
      d.setDate(first.getDate() + wi * 7 + di);
      return d;
    }),
  );

  return (
    <div ref={ref} className="select-none pt-3">
      <Caption muted={!picked}>
        {picked ? describe(picked) : "Tap a day"}
      </Caption>
      {cell > 0 ? (
        <div className="mt-2 flex" style={{ gap }}>
          {columns.map((col) => (
            <div
              key={col[0].getTime()}
              className="flex flex-col"
              style={{ gap }}
            >
              {col.map((d) => {
                const future = d > today;
                const on = !future && trained(d);
                const isToday = d.getTime() === today.getTime();
                const isPicked = picked?.getTime() === d.getTime();
                return (
                  <button
                    key={d.getTime()}
                    type="button"
                    disabled={future}
                    aria-label={describe(d)}
                    onClick={() => setPicked(isPicked ? null : d)}
                    style={{
                      width: cell,
                      height: cell,
                      borderRadius: Math.min(3, cell / 4),
                    }}
                    className={cx(
                      on ? "bg-black" : future ? "bg-transparent" : "bg-fill",
                      (isToday || isPicked) &&
                        "outline outline-[1.5px] outline-offset-1 outline-black",
                    )}
                  />
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ height: 7 * 12 }} />
      )}
    </div>
  );
}

function ReferenceLine({
  y,
  width,
  label,
}: {
  y: number;
  width: number;
  label: string;
}) {
  return (
    <g>
      <line
        x1={0}
        x2={width}
        y1={y}
        y2={y}
        stroke="rgb(60 60 67 / 0.5)"
        strokeDasharray="3 3"
      />
      <text
        x={width}
        y={y - 5}
        textAnchor="end"
        stroke="#fff"
        strokeWidth={4}
        paintOrder="stroke"
        className="fill-secondary text-[11px]"
      >
        {label}
      </text>
    </g>
  );
}

/** A tiny trend line with its last point marked. No axes. */
export function Sparkline({
  points,
  width = 96,
  height = 32,
}: {
  points: Point[];
  width?: number;
  height?: number;
}) {
  if (points.length < 2)
    return <svg width={width} height={height} aria-hidden="true" />;
  const t0 = points[0].t;
  const t1 = points.at(-1)?.t ?? t0;
  let v0 = Math.min(...points.map((p) => p.v));
  let v1 = Math.max(...points.map((p) => p.v));
  if (v1 - v0 < 1e-9) {
    v0 -= 1;
    v1 += 1;
  }
  const pad = 4;
  const x = (t: number) =>
    pad + ((t - t0) / (t1 - t0 || 1)) * (width - pad * 2);
  const y = (v: number) =>
    pad + (1 - (v - v0) / (v1 - v0)) * (height - pad * 2);
  const d = points
    .map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`)
    .join("");
  const last = points[points.length - 1];
  return (
    <svg
      width={width}
      height={height}
      aria-hidden="true"
      className="block shrink-0 overflow-visible"
    >
      <path
        d={d}
        fill="none"
        stroke="#000"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={x(last.t)}
        cy={y(last.v)}
        r={3}
        fill="#000"
        stroke="#fff"
        strokeWidth={1.5}
      />
    </svg>
  );
}

/** Small columns for side-by-side comparisons (small multiples). */
export function MiniColumns({
  values,
  height = 36,
}: {
  values: number[];
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const max = Math.max(...values, 0);
  const slot = values.length ? width / values.length : 0;
  const bar = Math.max(1.5, Math.min(10, slot - 1.5));
  return (
    <div ref={ref} style={{ height }} aria-hidden="true">
      {width > 0 ? (
        <svg width={width} height={height} className="block" aria-hidden="true">
          {values.map((v, i) => {
            const bh = max
              ? Math.max(v ? 1.5 : 0, (v / max) * (height - 1))
              : 0;
            return bh ? (
              <rect
                // biome-ignore lint/suspicious/noArrayIndexKey: positional series
                key={i}
                x={i * slot + (slot - bar) / 2}
                y={height - 1 - bh}
                width={bar}
                height={bh}
                rx={Math.min(1.5, bar / 2)}
                fill={i === values.length - 1 ? "#000" : "rgb(60 60 67 / 0.35)"}
              />
            ) : null;
          })}
          <line
            x1={0}
            x2={width}
            y1={height - 0.5}
            y2={height - 0.5}
            stroke={GRID}
          />
        </svg>
      ) : null}
    </div>
  );
}

/**
 * Floating bars on a clock axis: one per night, from bedtime down to wake time.
 * Values are minutes after noon of the day the night began, so midnight is 720.
 */
export function RangeBars({
  data,
  height = 220,
  summary,
  describe,
}: {
  data: { key: string | number; label: string; start: number; end: number }[];
  height?: number;
  summary?: ReactNode;
  describe: (d: { start: number; end: number; label: string }) => ReactNode;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return null;

  const axis = 44;
  const plot = Math.max(0, width - axis);
  const lo =
    Math.floor((Math.min(...data.map((d) => d.start)) - 30) / 120) * 120;
  const hi = Math.ceil((Math.max(...data.map((d) => d.end)) + 30) / 120) * 120;
  const top = 6;
  const h = height - top - 6;
  const y = (m: number) => top + ((m - lo) / (hi - lo)) * h;
  const slot = plot / data.length;
  const bar = Math.min(24, Math.max(2, slot - 2));
  const ticks: number[] = [];
  for (let m = lo; m <= hi; m += 120) ticks.push(m);
  const focus = hover !== null ? data[hover] : null;

  const pick = (clientX: number, rect: DOMRect) => {
    const i = Math.floor((clientX - rect.left) / slot);
    setHover(i >= 0 && i < data.length ? i : null);
  };

  return (
    <div ref={ref} className="select-none">
      {focus ? (
        <Caption>{describe(focus)}</Caption>
      ) : (
        <Caption muted>{summary}</Caption>
      )}
      {width > 0 ? (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={summary ? String(summary) : "Sleep schedule"}
          className="mt-2 block touch-pan-y"
          onPointerDown={(e) =>
            pick(e.clientX, e.currentTarget.getBoundingClientRect())
          }
          onPointerMove={(e) =>
            pick(e.clientX, e.currentTarget.getBoundingClientRect())
          }
          onPointerLeave={() => setHover(null)}
          onPointerUp={(e) => e.pointerType !== "mouse" && setHover(null)}
          onPointerCancel={() => setHover(null)}
        >
          {ticks.map((m) => (
            <g key={m}>
              <line x1={0} x2={plot} y1={y(m)} y2={y(m)} stroke={GRID} />
              <text
                x={plot + 8}
                y={y(m) + 4}
                className="tnum fill-secondary text-[11px]"
              >
                {String(
                  Math.floor(((((m + 720) % 1440) + 1440) % 1440) / 60),
                ).padStart(2, "0")}
                :00
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const by = y(d.start);
            const bh = Math.max(2, y(d.end) - by);
            const dim = hover !== null && hover !== i;
            return (
              <rect
                key={d.key}
                x={i * slot + (slot - bar) / 2}
                y={by}
                width={bar}
                height={bh}
                rx={Math.min(4, bar / 2)}
                fill={dim ? DIM : "#000"}
              />
            );
          })}
        </svg>
      ) : (
        <div style={{ height: height + 8 }} />
      )}
      {data.length > 1 ? (
        <div
          className="mt-1.5 flex justify-between text-[11px] text-secondary"
          style={{ width: plot || undefined }}
        >
          <span>{data[0].label}</span>
          <span>{data.at(-1)?.label}</span>
        </div>
      ) : null}
    </div>
  );
}
