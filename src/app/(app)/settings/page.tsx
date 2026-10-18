"use client";

import { useEffect, useRef, useState } from "react";
import { Chip } from "@/components/exercise-picker";
import {
  Button,
  Empty,
  Header,
  Page,
  Row,
  Section,
  TextButton,
} from "@/components/ui";
import { registerPasskey } from "@/lib/client/passkey";
import {
  clearLocalCopy,
  dispatch,
  failedChanges,
  flush,
  replaceFromServer,
  useDb,
  useSync,
} from "@/lib/client/store";
import { day, fmtNum, hm, isoDay, plural, seconds } from "@/lib/format";
import { type Db, distanceUnit, sleepGoal } from "@/lib/model";
import { exerciseMap } from "@/lib/stats";

const REST = [30, 45, 60, 75, 90, 105, 120, 150, 180, 240, 300];

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toCsv(db: Db) {
  const ex = exerciseMap(db);
  const rows = [
    [
      "date",
      "workout",
      "exercise",
      "set",
      "weight_kg",
      "reps",
      "seconds",
      "distance_km",
      "rest_seconds",
      "calories",
      "heart_rate",
    ],
  ];
  for (const s of db.sessions) {
    for (const e of s.exercises) {
      e.sets.forEach((set, i) => {
        rows.push([
          new Date(s.startedAt).toISOString(),
          s.name,
          ex.get(e.exerciseId)?.name ?? e.exerciseId,
          String(i + 1),
          set.weight?.toString() ?? "",
          set.reps?.toString() ?? "",
          set.seconds?.toString() ?? "",
          set.distance?.toString() ?? "",
          set.rest?.toString() ?? "",
          set.calories?.toString() ?? "",
          set.heartRate?.toString() ?? "",
        ]);
      });
    }
  }
  return rows
    .map((r) =>
      r
        .map((c) => (/[",\n]/.test(c) ? `"${c.replaceAll('"', '""')}"` : c))
        .join(","),
    )
    .join("\n");
}

async function restore(body: unknown) {
  const res = await fetch("/api/restore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Restore failed");
  replaceFromServer(data);
}

export default function SettingsPage() {
  const db = useDb();
  const sync = useSync();
  const file = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [passkeys, setPasskeys] = useState<
    { id: string; createdAt: number }[] | null
  >(null);
  const [backups, setBackups] = useState<
    { name: string; size: number }[] | null
  >(null);
  const failed = failedChanges();

  const loadPasskeys = () =>
    fetch("/api/auth/passkeys", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setPasskeys)
      .catch(() => setPasskeys([]));

  // biome-ignore lint/correctness/useExhaustiveDependencies: load once
  useEffect(() => {
    loadPasskeys();
  }, []);
  if (!db) return null;

  const say = (m: string) => {
    setMessage(m);
    setTimeout(() => setMessage(null), 4000);
  };

  return (
    <Page>
      <Header
        back={{ href: "/", label: "Train" }}
        title="Settings"
        sub={message ?? undefined}
      />

      <Section title="Units">
        <div className="flex gap-2 pt-3">
          {(["kg", "lb"] as const).map((u) => (
            <Chip
              key={u}
              on={db.settings.unit === u}
              onClick={() =>
                dispatch({ t: "settings.put", settings: { unit: u } })
              }
            >
              {u}
            </Chip>
          ))}
        </div>
        <p className="pt-2 text-[13px] text-secondary">
          Switching converts what's shown. Everything is stored in kg, so
          nothing is lost.
        </p>
      </Section>

      <Section title="Distance">
        <div className="flex gap-2 pt-3">
          {(["km", "mi"] as const).map((u) => (
            <Chip
              key={u}
              on={distanceUnit(db) === u}
              onClick={() =>
                dispatch({ t: "settings.put", settings: { distanceUnit: u } })
              }
            >
              {u === "km" ? "Kilometres" : "Miles"}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Sleep goal">
        <select
          value={sleepGoal(db)}
          onChange={(e) =>
            dispatch({
              t: "settings.put",
              settings: { sleepGoal: Number(e.target.value) },
            })
          }
          className="tnum mt-3 h-11 rounded-[10px] bg-fill px-4 text-[17px] font-medium"
        >
          {Array.from({ length: 13 }, (_, i) => 300 + i * 30).map((m) => (
            <option key={m} value={m}>
              {hm(m)}
            </option>
          ))}
        </select>
      </Section>

      <Section title="Default rest">
        <select
          value={db.settings.defaultRest}
          onChange={(e) =>
            dispatch({
              t: "settings.put",
              settings: { defaultRest: Number(e.target.value) },
            })
          }
          className="tnum mt-3 h-11 rounded-[10px] bg-fill px-4 text-[17px] font-medium"
        >
          {REST.map((s) => (
            <option key={s} value={s}>
              {seconds(s)}
            </option>
          ))}
        </select>
        <p className="pt-2 text-[13px] text-secondary">
          For exercises added during a workout.
        </p>
      </Section>

      <Section title="Passkeys">
        {passkeys === null ? (
          <Empty>Loading…</Empty>
        ) : (
          passkeys.map((p, i) => (
            <Row key={p.id}>
              <span>
                Passkey {i + 1}{" "}
                <span className="text-secondary">
                  · added {day(p.createdAt)}
                </span>
              </span>
              {passkeys.length > 1 ? (
                <TextButton
                  className="text-secondary"
                  onClick={async () => {
                    if (
                      !confirm(
                        "Remove this passkey? The device it's on won't be able to sign in.",
                      )
                    )
                      return;
                    await fetch(
                      `/api/auth/passkeys?id=${encodeURIComponent(p.id)}`,
                      { method: "DELETE" },
                    );
                    loadPasskeys();
                  }}
                >
                  Remove
                </TextButton>
              ) : null}
            </Row>
          ))
        )}
        <TextButton
          className="mt-2"
          onClick={async () => {
            const error = await registerPasskey();
            if (error) say(error);
            else {
              say("Passkey added.");
              loadPasskeys();
            }
          }}
        >
          + Add a passkey for another device
        </TextButton>
      </Section>

      <Section title="Your data">
        <p className="pt-3 pb-4 text-[15px] text-secondary">
          {plural(db.sessions.length, "workout")},{" "}
          {plural(db.weights.length, "weight entry", "weight entries")}. Saved
          to the server after every change, with a daily backup.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            onClick={() =>
              download(
                `rep-${isoDay()}.json`,
                JSON.stringify(db, null, 2),
                "application/json",
              )
            }
          >
            Export
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              download(`rep-sets-${isoDay()}.csv`, toCsv(db), "text/csv")
            }
          >
            Export CSV
          </Button>
        </div>
        <p className="pt-2 text-[13px] text-secondary">
          Export is the full backup and can be imported again. CSV is every set,
          for spreadsheets.
        </p>

        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            if (
              !confirm(
                "Replace everything with this file? What's here now is kept as a backup first.",
              )
            )
              return;
            try {
              await restore({ data: JSON.parse(await f.text()) });
              say("Imported.");
            } catch (err) {
              say(err instanceof Error ? err.message : "Import failed");
            }
          }}
        />
        <TextButton className="mt-4" onClick={() => file.current?.click()}>
          Import from a file…
        </TextButton>
      </Section>

      <Section
        title="Backups"
        action={
          backups === null ? (
            <TextButton
              className="py-0 text-[13px]"
              onClick={() =>
                fetch("/api/backups", { cache: "no-store" })
                  .then((r) => (r.ok ? r.json() : []))
                  .then(setBackups)
                  .catch(() => say("Couldn't load backups"))
              }
            >
              Show
            </TextButton>
          ) : null
        }
      >
        <p className="pt-3 text-[13px] text-secondary">
          A copy is kept from before the first change each day: every day for 45
          days, then one per month.
        </p>
        {backups?.length === 0 ? <Empty>No backups yet.</Empty> : null}
        {backups?.map((b) => (
          <Row key={b.name}>
            <span className="tnum">
              {/^\d{4}-\d{2}-\d{2}$/.test(b.name)
                ? day(new Date(`${b.name}T12:00`))
                : b.name}
              <span className="text-secondary">
                {" "}
                · {fmtNum(b.size / 1024, 0)} KB
              </span>
            </span>
            <TextButton
              onClick={async () => {
                if (
                  !confirm(
                    "Restore this backup? Your current data is backed up first.",
                  )
                )
                  return;
                try {
                  await restore({ snapshot: b.name });
                  say("Restored.");
                } catch (err) {
                  say(err instanceof Error ? err.message : "Restore failed");
                }
              }}
            >
              Restore
            </TextButton>
          </Row>
        ))}
      </Section>

      <Section title="Sync">
        <Row>
          <span>
            {sync.status === "saving"
              ? "Saving…"
              : sync.pending
                ? `${plural(sync.pending, "change")} waiting`
                : "Everything is saved"}
          </span>
          {sync.pending ? (
            <TextButton onClick={() => flush()}>Retry now</TextButton>
          ) : null}
        </Row>
        {sync.message && sync.status !== "idle" ? (
          <p className="pt-2 text-[13px] text-secondary">{sync.message}</p>
        ) : null}
        {failed.length ? (
          <Row>
            <span>{plural(failed.length, "change")} couldn't be saved</span>
            <TextButton
              onClick={() =>
                download(
                  `rep-unsaved-${isoDay()}.json`,
                  JSON.stringify(failed, null, 2),
                  "application/json",
                )
              }
            >
              Download
            </TextButton>
          </Row>
        ) : null}
      </Section>

      <Button
        variant="secondary"
        className="mb-10"
        onClick={async () => {
          if (!confirm("Sign out of rep on this device?")) return;
          await fetch("/api/auth/logout", { method: "POST" });
          clearLocalCopy();
          location.href = "/login";
        }}
      >
        Sign out
      </Button>
    </Page>
  );
}
