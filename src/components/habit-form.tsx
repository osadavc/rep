"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { dispatch, useDb } from "@/lib/client/store";
import { describeDays, timesADay } from "@/lib/habits";
import { type Habit, newId } from "@/lib/model";
import { Button, cx, Empty, field, Header, Page, TextButton } from "./ui";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const DAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const SUGGESTED = [1, 2, 3];

/** Creates a habit, or edits one when given its id. */
export function HabitForm({ id }: { id?: string }) {
  const db = useDb();
  const router = useRouter();
  const habit = id ? db?.habits.find((h) => h.id === id) : undefined;
  const [name, setName] = useState<string | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [days, setDays] = useState<number[] | null | undefined>(undefined);
  if (!db) return null;

  const back = habit
    ? { href: `/habits/${habit.id}`, label: habit.name }
    : { href: "/habits", label: "Habits" };

  if (id && !habit) {
    return (
      <Page>
        <Header back={{ href: "/habits", label: "Habits" }} title="Not found" />
        <Empty>This habit doesn't exist, or it was deleted.</Empty>
      </Page>
    );
  }

  // Untouched fields show what's saved.
  const nameValue = name ?? habit?.name ?? "";
  const targetValue = target ?? habit?.target ?? 1;
  const daysValue = days === undefined ? habit?.days : (days ?? undefined);
  const picked = daysValue ?? [0, 1, 2, 3, 4, 5, 6];
  const valid = nameValue.trim().length > 0;

  const toggleDay = (d: number) => {
    const next = picked.includes(d)
      ? picked.filter((x) => x !== d)
      : [...picked, d].sort((a, b) => a - b);
    if (next.length === 0) return;
    setDays(next.length === 7 ? null : next);
  };

  function save() {
    if (!valid) return;
    const next: Habit = {
      id: habit?.id ?? newId(),
      name: nameValue.trim(),
      target: targetValue,
      createdAt: habit?.createdAt ?? Date.now(),
      ...(daysValue ? { days: daysValue } : {}),
      ...(habit?.archived ? { archived: true } : {}),
    };
    dispatch({ t: "habit.put", habit: next });
    router.replace(habit ? `/habits/${habit.id}` : "/habits");
  }

  return (
    <Page>
      <Header back={back} title={habit ? "Edit habit" : "New habit"} />

      <label className="block">
        <span className="block text-[13px] text-secondary">Name</span>
        <input
          value={nameValue}
          // biome-ignore lint/a11y/noAutofocus: the one thing to fill in
          autoFocus={!habit}
          maxLength={60}
          placeholder="Vitamins, skin care…"
          autoComplete="off"
          enterKeyHint="done"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className={cx(field, "text-[22px] font-semibold tracking-[-0.01em]")}
        />
      </label>

      <div className="mt-8">
        <div className="flex items-baseline justify-between">
          <span id="target-label" className="text-[13px] text-secondary">
            How often
          </span>
          <span className="text-[13px] text-secondary">
            {timesADay(targetValue)}
          </span>
        </div>
        <fieldset
          aria-labelledby="target-label"
          className="mt-2 flex min-w-0 items-center gap-2"
        >
          {SUGGESTED.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={targetValue === n}
              onClick={() => setTarget(n)}
              className={cx(
                "press h-10 flex-1 rounded-[10px] text-[17px] font-medium",
                targetValue === n ? "bg-black text-white" : "bg-fill",
              )}
            >
              {n}×
            </button>
          ))}
          <div
            className={cx(
              "flex h-10 flex-[1.6] items-center justify-between rounded-[10px]",
              targetValue > 3 ? "bg-black text-white" : "bg-fill",
            )}
          >
            <button
              type="button"
              aria-label="Fewer times"
              disabled={targetValue <= 1}
              onClick={() => setTarget(Math.max(1, targetValue - 1))}
              className="press h-10 w-9 text-[19px] disabled:opacity-25"
            >
              −
            </button>
            <span className="tnum text-[17px] font-medium">
              {targetValue > 3 ? `${targetValue}×` : "More"}
            </span>
            <button
              type="button"
              aria-label="More times"
              disabled={targetValue >= 20}
              onClick={() => setTarget(Math.min(20, targetValue + 1))}
              className="press h-10 w-9 text-[19px] disabled:opacity-25"
            >
              +
            </button>
          </div>
        </fieldset>
      </div>

      <div className="mt-8">
        <div className="flex items-baseline justify-between">
          <span id="days-label" className="text-[13px] text-secondary">
            On
          </span>
          <span className="text-[13px] text-secondary">
            {describeDays(daysValue)}
          </span>
        </div>
        <fieldset
          aria-labelledby="days-label"
          className="mt-2 grid min-w-0 grid-cols-7 gap-1.5"
        >
          {DAYS.map((label, d) => {
            const on = picked.includes(d);
            return (
              <button
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed weekday list
                key={d}
                type="button"
                aria-pressed={on}
                aria-label={DAY_LABELS[d]}
                onClick={() => toggleDay(d)}
                className={cx(
                  "press h-10 rounded-[10px] text-[15px] font-medium",
                  on ? "bg-black text-white" : "bg-fill text-secondary",
                )}
              >
                {label}
              </button>
            );
          })}
        </fieldset>
      </div>

      <Button className="mt-10" disabled={!valid} onClick={save}>
        {habit ? "Save" : "Add habit"}
      </Button>

      {habit ? (
        <div className="mt-3 mb-8 flex justify-between">
          <TextButton
            className="text-secondary"
            onClick={() => {
              dispatch({
                t: "habit.put",
                habit: { ...habit, archived: !habit.archived || undefined },
              });
              router.replace("/habits");
            }}
          >
            {habit.archived ? "Bring back" : "Archive"}
          </TextButton>
          <TextButton
            className="text-secondary"
            onClick={() => {
              if (
                confirm(
                  `Delete ${habit.name} and every day you've logged for it? Archive keeps them.`,
                )
              ) {
                dispatch({ t: "habit.delete", id: habit.id });
                router.replace("/habits");
              }
            }}
          >
            Delete
          </TextButton>
        </div>
      ) : null}
    </Page>
  );
}
