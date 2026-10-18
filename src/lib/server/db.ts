import { after } from "next/server";
import { type Db, dbSchema, emptyDb, upgrade } from "@/lib/model";
import { applyAll, type Envelope } from "@/lib/ops";
import { listFiles, readJson, removeJson, writeJson } from "./blob";

const DB = "db.json";
const KEEP_DAILY_DAYS = 45;

export async function loadDb(): Promise<{ db: Db; etag: string | null }> {
  const file = await readJson(DB);
  if (!file) return { db: emptyDb(), etag: null };
  return { db: upgrade(dbSchema.parse(file.data)), etag: file.etag };
}

const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);

/**
 * Writes the next version of the database. Retries when another request wrote
 * in between, and never overwrites an existing file it didn't read first.
 */
async function write(make: (current: Db) => Db, touched: string[] = []) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { db, etag } = await loadDb();
    const now = Date.now();
    const day = dayKey(now);
    const firstWriteToday = db.meta.snapshotDay !== day;

    // Daily backup: the state as it was before the first change of the day.
    if (firstWriteToday && etag) await writeJson(`snapshots/${day}.json`, db);

    const next = dbSchema.parse({
      ...make(db),
      rev: db.rev + 1,
      updatedAt: now,
      meta: { ...db.meta, snapshotDay: day },
    });

    try {
      await writeJson(DB, next, etag ? { ifMatch: etag } : { create: true });
    } catch (error) {
      if (attempt < 4) continue;
      throw error;
    }

    // A second copy of every workout, one file each.
    await Promise.all(
      touched.map((id) => {
        const session = next.sessions.find((s) => s.id === id);
        return session
          ? writeJson(`sessions/${id}.json`, session)
          : removeJson(`sessions/${id}.json`);
      }),
    );

    if (firstWriteToday) after(pruneSnapshots);
    return next;
  }
  throw new Error("Could not save");
}

export function commit(envelopes: Envelope[]) {
  const touched = new Set<string>();
  for (const { op } of envelopes) {
    if (op.t === "session.put") touched.add(op.session.id);
    if (op.t === "session.delete") touched.add(op.id);
  }
  return write((db) => applyAll(db, envelopes), [...touched]);
}

/** Replaces everything (import or restore), keeping a copy of what was there. */
export async function replaceDb(data: unknown) {
  const incoming = dbSchema.parse(data);
  const { db, etag } = await loadDb();
  if (etag) await writeJson(`snapshots/before-restore-${Date.now()}.json`, db);
  return write(() => ({ ...incoming, meta: db.meta }));
}

export async function listSnapshots() {
  const files = await listFiles("snapshots");
  return files
    .map((f) => ({ name: f.name.replace(/\.json$/, ""), size: f.size }))
    .sort((a, b) => b.name.localeCompare(a.name));
}

export async function readSnapshot(name: string) {
  if (!/^[\w-]+$/.test(name)) return null;
  const file = await readJson(`snapshots/${name}.json`);
  return file ? dbSchema.parse(file.data) : null;
}

// Keeps every daily backup for 45 days, then only the first one of each month.
async function pruneSnapshots() {
  const cutoff = dayKey(Date.now() - KEEP_DAILY_DAYS * 86_400_000);
  const days = (await listFiles("snapshots"))
    .map((f) => f.name.replace(/\.json$/, ""))
    .filter((n) => /^\d{4}-\d{2}-\d{2}$/.test(n))
    .sort();
  const firstOfMonth = new Set<string>();
  const seen = new Set<string>();
  for (const d of days) {
    if (!seen.has(d.slice(0, 7))) {
      seen.add(d.slice(0, 7));
      firstOfMonth.add(d);
    }
  }
  await Promise.all(
    days
      .filter((d) => d < cutoff && !firstOfMonth.has(d))
      .map((d) => removeJson(`snapshots/${d}.json`)),
  );
}
