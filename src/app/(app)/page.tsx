"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCreateRoutine } from "@/components/controls";
import { ExercisePicker } from "@/components/exercise-picker";
import {
  Button,
  ButtonLink,
  Empty,
  Header,
  Page,
  Row,
  Section,
  TextButton,
} from "@/components/ui";
import { useNow } from "@/lib/client/device";
import { dispatch, useDb, useSync } from "@/lib/client/store";
import * as w from "@/lib/client/workout";
import {
  ago,
  clock,
  clockOfDay,
  day,
  duration,
  fmtMass,
  fmtWeight,
  hm,
  isoDay,
  plural,
} from "@/lib/format";
import { activeHabits, dayProgress, perfectDays, tally } from "@/lib/habits";
import type { Db, Routine } from "@/lib/model";
import { nights } from "@/lib/sleep";
import { exerciseMap, summarize, weekStart } from "@/lib/stats";

export default function TrainPage() {
  const db = useDb();
  const router = useRouter();
  const active = w.useActive();
  const create = useCreateRoutine();
  const [pickingCardio, setPickingCardio] = useState(false);
  if (!db) return null;

  if (pickingCardio) {
    return (
      <ExercisePicker
        title="Start cardio"
        cardioOnly
        onClose={() => setPickingCardio(false)}
        onPick={(id) => {
          if (
            active &&
            !confirm(
              `${active.name} is still running. Discard it and start this?`,
            )
          )
            return;
          w.startSingle(db, id);
          router.push("/workout");
        }}
      />
    );
  }

  const { items, next } = db.rotation;
  const routines = new Map(db.routines.map((r) => [r.id, r]));
  const upNext = items.length ? routines.get(items[next]) : undefined;
  const others = db.routines.filter((r) => r.id !== upNext?.id);

  const start = (routine?: Routine) => {
    if (
      active &&
      !confirm(
        `${active.name} is still running. Discard it and start a new one?`,
      )
    )
      return;
    w.start(db, routine);
    router.push("/workout");
  };

  const lastDone = (id: string) =>
    db.sessions.findLast((s) => s.routineId === id);

  return (
    <Page>
      <Header
        title="Train"
        action={
          <Link href="/settings" className="press text-[15px] font-medium">
            Settings
          </Link>
        }
        sub={<SyncNote />}
      />

      {active ? (
        <ActiveCard name={active.name} startedAt={active.startedAt} />
      ) : upNext ? (
        <Section title="Up next">
          <div className="pt-3">
            <h2 className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">
              {upNext.name}
            </h2>
            <p className="mt-1 text-[15px] text-secondary">
              {plural(upNext.items.length, "exercise")}
              {lastDone(upNext.id)
                ? ` · last done ${ago(lastDone(upNext.id)?.startedAt ?? 0)}`
                : ""}
            </p>
            <Button className="mt-5" onClick={() => start(upNext)}>
              Start
            </Button>
            {items.length > 1 ? (
              <div className="mt-3 flex items-center justify-between text-[15px]">
                <span className="truncate text-secondary">
                  Then{" "}
                  {Array.from(
                    { length: Math.min(items.length - 1, 3) },
                    (_, k) =>
                      routines.get(items[(next + k + 1) % items.length])?.name,
                  ).join(", ")}
                </span>
                <TextButton
                  className="shrink-0 pl-3"
                  onClick={() =>
                    dispatch({ t: "rotation.set", items, next: next + 1 })
                  }
                >
                  Skip
                </TextButton>
              </div>
            ) : null}
          </div>
        </Section>
      ) : db.routines.length === 0 ? (
        <Section title="Get started">
          <p className="pt-3 pb-5 text-[15px] text-secondary">
            Make a workout, then put your workouts in the order you rotate
            through them. rep will always know what's next.
          </p>
          <Button onClick={create}>Create a workout</Button>
        </Section>
      ) : null}

      {!active ? (
        <Section title={upNext ? "Or" : "Start"}>
          {others.map((r) => (
            <Row key={r.id} onClick={() => start(r)}>
              <span className="truncate">{r.name}</span>
              <span className="shrink-0 text-[15px] text-secondary">Start</span>
            </Row>
          ))}
          <Row onClick={() => start()}>
            <span>Empty workout</span>
            <span className="text-[15px] text-secondary">Start</span>
          </Row>
          <Row onClick={() => setPickingCardio(true)}>
            <span>Cardio</span>
            <span className="text-[15px] text-secondary">Run, ride, row…</span>
          </Row>
        </Section>
      ) : null}

      <Glance db={db} />
    </Page>
  );
}

function ActiveCard({ name, startedAt }: { name: string; startedAt: number }) {
  const now = useNow();
  return (
    <Section title="In progress">
      <div className="pt-3">
        <h2 className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">
          {name}
        </h2>
        <p className="tnum mt-1 text-[15px] text-secondary">
          {clock(now - startedAt)}
        </p>
        <ButtonLink href="/workout" className="mt-5">
          Resume
        </ButtonLink>
      </div>
    </Section>
  );
}

function SyncNote() {
  const sync = useSync();
  if (sync.status === "idle" && sync.pending === 0) return null;
  if (sync.status === "saving") return "Saving…";
  const waiting = sync.pending
    ? ` · ${plural(sync.pending, "change")} waiting`
    : "";
  return `${sync.message ?? "Not saved yet"}${waiting}`;
}

function Glance({ db }: { db: Db }) {
  const ex = exerciseMap(db);
  const last = db.sessions.at(-1);
  const thisWeek = weekStart(Date.now());
  const week = db.sessions
    .filter((s) => s.startedAt >= thisWeek)
    .map((s) => summarize(s, ex));
  const unit = db.settings.unit;
  const weights = db.weights;
  const latest = weights.at(-1);
  const lastNight = nights(db).find((n) => n.date === isoDay());
  const monthAgo = weights.findLast(
    (x) => new Date(x.date).getTime() <= Date.now() - 30 * 86_400_000,
  );

  return (
    <>
      {last ? (
        <Section title="Last workout">
          <Row href={`/history/${last.id}`}>
            <div className="min-w-0">
              <div className="truncate">{last.name}</div>
              <div className="tnum text-[15px] text-secondary">
                {(() => {
                  const s = summarize(last, ex);
                  return `${duration(s.duration)} · ${plural(s.sets, "set")}${s.volume ? ` · ${fmtMass(s.volume, unit)}` : ""}`;
                })()}
              </div>
            </div>
            <span className="shrink-0 text-[15px] text-secondary">
              {day(last.startedAt)}
            </span>
          </Row>
        </Section>
      ) : null}

      <Section title="This week">
        {week.length ? (
          <p className="tnum pt-3 text-[17px]">
            {plural(week.length, "workout")} ·{" "}
            {duration(week.reduce((a, s) => a + s.duration, 0))}
            {week.some((s) => s.volume)
              ? ` · ${fmtMass(
                  week.reduce((a, s) => a + s.volume, 0),
                  unit,
                )}`
              : ""}
          </p>
        ) : (
          <Empty>Nothing yet this week.</Empty>
        )}
      </Section>

      <HabitsGlance db={db} />

      <Section
        title="Sleep"
        action={
          <Link href="/sleep" className="press text-[13px] font-medium">
            {lastNight ? "Edit" : "Log"}
          </Link>
        }
      >
        {lastNight ? (
          <p className="tnum pt-3 text-[17px]">
            {hm(lastNight.minutes)}
            <span className="text-secondary">
              {" "}
              · {clockOfDay(lastNight.bed + 720)} →{" "}
              {clockOfDay(lastNight.wake + 720)}
            </span>
          </p>
        ) : (
          <Empty>Last night isn't logged yet.</Empty>
        )}
      </Section>

      <Section
        title="Bodyweight"
        action={
          <Link href="/body" className="press text-[13px] font-medium">
            Log
          </Link>
        }
      >
        {latest ? (
          <p className="tnum pt-3 text-[17px]">
            {fmtWeight(latest.weight, unit)} {unit}
            {monthAgo ? (
              <span className="text-secondary">
                {" "}
                · {latest.weight - monthAgo.weight >= 0 ? "+" : "−"}
                {fmtWeight(Math.abs(latest.weight - monthAgo.weight), unit)} in
                30 days
              </span>
            ) : null}
          </p>
        ) : (
          <Empty>No entries yet.</Empty>
        )}
      </Section>
    </>
  );
}

function HabitsGlance({ db }: { db: Db }) {
  const habits = activeHabits(db);
  if (!habits.length) return null;
  const t = tally(db);
  const today = dayProgress(habits, t, isoDay());
  const perfect = perfectDays(db, habits, t);
  return (
    <Section
      title="Habits"
      action={
        <Link href="/habits" className="press text-[13px] font-medium">
          {today.due && today.done < today.due ? "Tick off" : "Open"}
        </Link>
      }
    >
      <p className="tnum pt-3 text-[17px]">
        {today.due
          ? today.done === today.due
            ? `All ${today.due} done`
            : `${today.done} of ${today.due} done`
          : "Nothing due today"}
        {perfect.current >= 2 ? (
          <span className="text-secondary">
            {" "}
            · {perfect.current} perfect days in a row
          </span>
        ) : null}
      </p>
    </Section>
  );
}
