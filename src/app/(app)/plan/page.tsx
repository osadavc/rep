"use client";

import { useState } from "react";
import { IconButton, useCreateRoutine } from "@/components/controls";
import { Chip } from "@/components/exercise-picker";
import { Empty, Header, Page, Row, Section, TextButton } from "@/components/ui";
import { dispatch, useDb } from "@/lib/client/store";
import { plural } from "@/lib/format";

export default function PlanPage() {
  const db = useDb();
  const create = useCreateRoutine();
  const [adding, setAdding] = useState(false);
  if (!db) return null;
  const { items, next } = db.rotation;
  const names = new Map(db.routines.map((r) => [r.id, r.name]));

  const setRotation = (list: string[], n = next) =>
    dispatch({ t: "rotation.set", items: list, next: n });
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    const list = items.slice();
    [list[i], list[j]] = [list[j], list[i]];
    setRotation(list, next === i ? j : next === j ? i : next);
  };
  const remove = (i: number) =>
    setRotation(
      items.filter((_, k) => k !== i),
      i < next ? next - 1 : next,
    );

  return (
    <Page>
      <Header title="Plan" />

      <Section
        title="Rotation"
        action={
          db.routines.length ? (
            <TextButton
              className="py-0 text-[13px]"
              onClick={() => setAdding(!adding)}
            >
              {adding ? "Done" : "Add"}
            </TextButton>
          ) : null
        }
      >
        <p className="pt-2 pb-1 text-[13px] text-secondary">
          The order you cycle through your workouts, regardless of the day.
          Finishing one moves you on to the next.
        </p>
        {adding ? (
          <div className="flex flex-wrap gap-2 py-3">
            {db.routines.map((r) => (
              <Chip
                key={r.id}
                on={false}
                onClick={() => setRotation([...items, r.id])}
              >
                + {r.name}
              </Chip>
            ))}
          </div>
        ) : null}
        {items.length === 0 ? (
          <Empty>
            {db.routines.length
              ? "Add workouts to start a rotation."
              : "Create a workout first."}
          </Empty>
        ) : (
          items.map((id, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: a workout can appear more than once
              key={`${id}-${i}`}
              className="flex min-h-[52px] items-center gap-3 border-b-[0.5px] border-separator"
            >
              <span className="tnum w-5 text-[15px] text-secondary">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {names.get(id) ?? "Deleted workout"}
              </span>
              {i === next ? (
                <span className="rounded-full bg-black px-2 py-0.5 text-[12px] font-medium text-white">
                  Next
                </span>
              ) : (
                <TextButton
                  className="text-[13px] text-secondary"
                  onClick={() => setRotation(items, i)}
                >
                  Make next
                </TextButton>
              )}
              <div className="flex">
                <IconButton
                  label="Move up"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  ↑
                </IconButton>
                <IconButton
                  label="Move down"
                  disabled={i === items.length - 1}
                  onClick={() => move(i, 1)}
                >
                  ↓
                </IconButton>
                <IconButton
                  label="Remove from rotation"
                  onClick={() => remove(i)}
                >
                  ×
                </IconButton>
              </div>
            </div>
          ))
        )}
      </Section>

      <Section
        title="Workouts"
        action={
          <TextButton className="py-0 text-[13px]" onClick={create}>
            New
          </TextButton>
        }
      >
        {db.routines.length === 0 ? <Empty>No workouts yet.</Empty> : null}
        {db.routines.map((r) => (
          <Row key={r.id} href={`/plan/${r.id}`}>
            <span className="truncate">{r.name}</span>
            <span className="shrink-0 text-[15px] text-secondary">
              {plural(r.items.length, "exercise")}
            </span>
          </Row>
        ))}
      </Section>

      <Section title="Library">
        <Row href="/plan/exercises">
          <span>Exercises</span>
          <span className="text-[15px] text-secondary">
            {db.exercises.filter((e) => !e.archived).length}
          </span>
        </Row>
      </Section>
    </Page>
  );
}
