"use client";

import Link from "next/link";
import { Empty, Header, Page, Row, Section } from "@/components/ui";
import { useDb } from "@/lib/client/store";
import {
  day,
  duration,
  fmtDist,
  fmtMass,
  monthTitle,
  plural,
} from "@/lib/format";
import { distanceUnit, type Session } from "@/lib/model";
import { exerciseMap, records, summarize } from "@/lib/stats";

export default function HistoryPage() {
  const db = useDb();
  if (!db) return null;
  const ex = exerciseMap(db);
  const { prs } = records(db);
  const prCount = new Map<string, number>();
  for (const p of prs)
    prCount.set(p.sessionId, (prCount.get(p.sessionId) ?? 0) + 1);

  const months: { key: string; title: string; sessions: Session[] }[] = [];
  for (const s of [...db.sessions].reverse()) {
    const d = new Date(s.startedAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (months.at(-1)?.key !== key)
      months.push({ key, title: monthTitle(s.startedAt), sessions: [] });
    months.at(-1)?.sessions.push(s);
  }

  return (
    <Page>
      <Header
        title="History"
        sub={
          db.sessions.length ? plural(db.sessions.length, "workout") : undefined
        }
        action={
          <Link href="/history/new" className="press text-[15px] font-medium">
            Log past workout
          </Link>
        }
      />
      {months.length === 0 ? (
        <Empty>No workouts yet. Finished workouts show up here.</Empty>
      ) : null}
      {months.map((m) => (
        <Section key={m.key} title={m.title}>
          {m.sessions.map((s) => {
            const sum = summarize(s, ex);
            const n = prCount.get(s.id) ?? 0;
            return (
              <Row key={s.id} href={`/history/${s.id}`}>
                <div className="min-w-0">
                  <div className="truncate">{s.name}</div>
                  <div className="tnum truncate text-[15px] text-secondary">
                    {duration(sum.duration)} · {plural(sum.sets, "set")}
                    {sum.volume
                      ? ` · ${fmtMass(sum.volume, db.settings.unit)}`
                      : ""}
                    {sum.distance
                      ? ` · ${fmtDist(sum.distance, distanceUnit(db))}`
                      : ""}
                    {n ? ` · ${plural(n, "PR")}` : ""}
                  </div>
                </div>
                <span className="shrink-0 text-[15px] text-secondary">
                  {day(s.startedAt)}
                </span>
              </Row>
            );
          })}
        </Section>
      ))}
    </Page>
  );
}
