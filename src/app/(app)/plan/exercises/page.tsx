"use client";

import { useState } from "react";
import {
  Chip,
  ExerciseFields,
  NewExercise,
} from "@/components/exercise-picker";
import { Button, Header, Page, Section, TextButton } from "@/components/ui";
import { dispatch, useDb } from "@/lib/client/store";
import { type Exercise, KIND_LABEL, MUSCLES } from "@/lib/model";

export default function ExercisesPage() {
  const db = useDb();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [archived, setArchived] = useState(false);
  if (!db) return null;

  const q = query.trim().toLowerCase();
  const list = db.exercises.filter(
    (e) =>
      Boolean(e.archived) === archived &&
      (!q || e.name.toLowerCase().includes(q)),
  );

  return (
    <Page>
      <Header
        back={{ href: "/plan", label: "Plan" }}
        title="Exercises"
        action={
          <TextButton onClick={() => setCreating(!creating)}>
            {creating ? "Cancel" : "New"}
          </TextButton>
        }
      />

      {creating ? (
        <Section title="New exercise">
          <NewExercise
            name={query.trim()}
            submitLabel="Create"
            onCreate={(exercise) => {
              dispatch({ t: "exercise.put", exercise });
              setCreating(false);
            }}
          />
        </Section>
      ) : null}

      <input
        type="search"
        placeholder="Search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
        className="mb-3 h-11 w-full rounded-[12px] bg-fill px-4 text-[17px]"
      />
      <div className="mb-6 flex gap-2">
        <Chip on={!archived} onClick={() => setArchived(false)}>
          Active
        </Chip>
        <Chip on={archived} onClick={() => setArchived(true)}>
          Archived
        </Chip>
      </div>

      {MUSCLES.map((m) => {
        const items = list
          .filter((e) => e.muscle === m)
          .sort((a, b) => a.name.localeCompare(b.name));
        if (!items.length) return null;
        return (
          <Section key={m} title={m}>
            {items.map((e) =>
              open === e.id ? (
                <EditExercise
                  key={e.id}
                  exercise={e}
                  onDone={() => setOpen(null)}
                />
              ) : (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setOpen(e.id)}
                  className="press flex min-h-[50px] w-full items-center justify-between border-b-[0.5px] border-separator text-left"
                >
                  <span className="truncate">{e.name}</span>
                  {e.kind !== "weight" ? (
                    <span className="shrink-0 text-[13px] text-secondary">
                      {KIND_LABEL[e.kind]}
                    </span>
                  ) : null}
                </button>
              ),
            )}
          </Section>
        );
      })}
      {list.length === 0 ? (
        <p className="text-[15px] text-secondary">Nothing here.</p>
      ) : null}
    </Page>
  );
}

function EditExercise({
  exercise,
  onDone,
}: {
  exercise: Exercise;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState(exercise);
  return (
    <div className="border-b-[0.5px] border-separator py-4">
      <ExerciseFields
        name={draft.name}
        kind={draft.kind}
        muscle={draft.muscle}
        onName={(name) => setDraft({ ...draft, name })}
        onKind={(kind) => setDraft({ ...draft, kind })}
        onMuscle={(muscle) => setDraft({ ...draft, muscle })}
      />
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button
          disabled={!draft.name.trim()}
          onClick={() => {
            dispatch({
              t: "exercise.put",
              exercise: { ...draft, name: draft.name.trim() },
            });
            onDone();
          }}
        >
          Save
        </Button>
      </div>
      <TextButton
        className="mt-3 text-secondary"
        onClick={() => {
          dispatch({
            t: "exercise.put",
            exercise: { ...exercise, archived: !exercise.archived },
          });
          onDone();
        }}
      >
        {exercise.archived
          ? "Restore to library"
          : "Archive (hides it, keeps its history)"}
      </TextButton>
    </div>
  );
}
