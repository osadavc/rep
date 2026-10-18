"use client";

import { useState } from "react";
import { LineChart } from "@/components/charts";
import { Chip } from "@/components/exercise-picker";
import { NumField } from "@/components/sets";
import {
  Button,
  cx,
  Empty,
  field,
  Header,
  Page,
  Row,
  Section,
  Stat,
  StatGrid,
} from "@/components/ui";
import { dispatch, useDb } from "@/lib/client/store";
import {
  day,
  fmtNum,
  fmtWeight,
  fromUnit,
  isoDay,
  shortDay,
  toUnit,
} from "@/lib/format";
import { newId, type WeightEntry } from "@/lib/model";
import { movingAverage, weeklySlope } from "@/lib/stats";

const RANGES = [
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "Year", days: 365 },
  { label: "All", days: 0 },
];

const at = (e: WeightEntry) => new Date(`${e.date}T12:00`).getTime();

export default function BodyPage() {
  const db = useDb();
  const [value, setValue] = useState<number | undefined>(undefined);
  // Today isn't known while prerendering on the server.
  const [date, setDate] = useState(() =>
    typeof window === "undefined" ? "" : isoDay(),
  );
  const [range, setRange] = useState(90);
  if (!db) return null;
  const unit = db.settings.unit;
  const entries = db.weights;
  const latest = entries.at(-1);

  function log() {
    if (value === undefined || value <= 0) return;
    const existing = entries.find((e) => e.date === date);
    dispatch({
      t: "weight.put",
      entry: {
        id: existing?.id ?? newId(),
        date,
        weight: fromUnit(value, unit),
      },
    });
    setValue(undefined);
    setDate(isoDay());
  }

  const w = (kg: number) => `${fmtWeight(kg, unit)} ${unit}`;
  const signed = (kg: number) =>
    `${kg > 0 ? "+" : kg < 0 ? "−" : "±"}${fmtWeight(Math.abs(kg), unit)}`;
  const changeOver = (days: number) => {
    if (!latest) return undefined;
    const cutoff = at(latest) - days * 86_400_000;
    const base = entries.findLast((e) => at(e) <= cutoff);
    return base ? latest.weight - base.weight : undefined;
  };

  const from = range ? Date.now() - range * 86_400_000 : 0;
  const points = entries.map((e) => ({ t: at(e), v: toUnit(e.weight, unit) }));
  const smooth = movingAverage(points, 7).filter((p) => p.t >= from);
  const raw = points.filter((p) => p.t >= from);
  const weights = entries.map((e) => e.weight);
  const recent = entries
    .filter((e) => at(e) >= Date.now() - 28 * 86_400_000)
    .map((e) => ({ t: at(e), v: e.weight }));
  const trend = recent.length >= 3 ? weeklySlope(recent) : null;

  return (
    <Page>
      <Header
        title="Body"
        sub={latest ? `Last logged ${day(at(latest))}` : undefined}
      />

      <Section title="Log weight">
        <div className="grid grid-cols-[1fr_1.2fr] items-end gap-4 pt-3">
          <div className="min-w-0">
            <span className="text-[13px] text-secondary">Weight ({unit})</span>
            <NumField
              label="Bodyweight"
              decimal
              value={value}
              onChange={setValue}
              placeholder={latest ? fmtWeight(latest.weight, unit) : "0"}
              className={cx(
                field,
                "tnum h-14 text-[34px] font-semibold tracking-[-0.02em]",
              )}
            />
          </div>
          <label className="block min-w-0">
            <span className="text-[13px] text-secondary">Date</span>
            <input
              type="date"
              value={date}
              max={isoDay()}
              onChange={(e) => setDate(e.target.value || isoDay())}
              className={cx(field, "h-14 appearance-auto")}
            />
          </label>
        </div>
        <Button
          className="mt-5"
          disabled={value === undefined || value <= 0}
          onClick={log}
        >
          {entries.some((e) => e.date === date) ? "Update" : "Log"}
        </Button>
      </Section>

      {latest ? (
        <>
          <Section title="Summary">
            <StatGrid>
              <Stat label="Current" value={w(latest.weight)} />
              {[7, 30, 90].map((d) => {
                const c = changeOver(d);
                return c === undefined ? null : (
                  <Stat key={d} label={`${d} days`} value={signed(c)} />
                );
              })}
              <Stat label="Lowest" value={w(Math.min(...weights))} />
              <Stat label="Highest" value={w(Math.max(...weights))} />
              {trend !== null ? (
                <Stat
                  label="Trend"
                  value={`${signed(trend)}/wk`}
                  sub="last 4 weeks"
                />
              ) : null}
              {entries.length > 1 ? (
                <Stat
                  label="Since start"
                  value={signed(latest.weight - entries[0].weight)}
                  sub={shortDay(at(entries[0]))}
                />
              ) : null}
            </StatGrid>
          </Section>

          {entries.length > 1 ? (
            <Section title="Trend">
              <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pt-3 pb-4 [scrollbar-width:none]">
                {RANGES.map((r) => (
                  <Chip
                    key={r.label}
                    on={range === r.days}
                    onClick={() => setRange(r.days)}
                  >
                    {r.label}
                  </Chip>
                ))}
              </div>
              {raw.length ? (
                <>
                  <LineChart
                    line={smooth}
                    dots={raw}
                    format={(v) => `${fmtNum(v, 1)} ${unit}`}
                    formatT={shortDay}
                    summary={`7-day average ${fmtNum(smooth.at(-1)?.v ?? 0, 1)} ${unit}`}
                  />
                  <div className="mt-3 flex gap-5 text-[13px] text-secondary">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-[2px] w-4 bg-black" />{" "}
                      7-day average
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-[6px] w-[6px] rounded-full bg-tertiary" />{" "}
                      Each entry
                    </span>
                  </div>
                </>
              ) : (
                <Empty>No entries in this range.</Empty>
              )}
            </Section>
          ) : null}

          <Section title="Entries">
            {[...entries].reverse().map((e, i, list) => {
              const prev = list[i + 1];
              return (
                <Row
                  key={e.id}
                  onClick={() => {
                    if (confirm(`Delete ${w(e.weight)} on ${day(at(e))}?`))
                      dispatch({ t: "weight.delete", id: e.id });
                  }}
                >
                  <span>{day(at(e))}</span>
                  <span className="tnum flex gap-4">
                    {prev ? (
                      <span className="text-secondary">
                        {signed(e.weight - prev.weight)}
                      </span>
                    ) : null}
                    <span className="font-medium">{w(e.weight)}</span>
                  </span>
                </Row>
              );
            })}
            <p className="pt-2 text-[13px] text-secondary">
              Tap an entry to delete it.
            </p>
          </Section>
        </>
      ) : (
        <Empty>Log your weight to see trends.</Empty>
      )}
    </Page>
  );
}
