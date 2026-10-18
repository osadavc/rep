import { useSyncExternalStore } from "react";
import { type Db, newId, upgrade } from "@/lib/model";
import { applyAll, type Envelope, type Op } from "@/lib/ops";

// The phone keeps the last copy from the server plus a queue of changes that
// haven't been confirmed yet. Both live in localStorage, so a change survives
// a lost connection, a closed tab or a dead battery and is sent next time.

const DB_KEY = "rep:db";
const PENDING_KEY = "rep:pending";
const FAILED_KEY = "rep:failed";

export type SyncState = {
  status: "idle" | "saving" | "offline" | "error";
  message?: string;
  pending: number;
};

let serverDb: Db | null = null;
let pending: Envelope[] = [];
let view: Db | null = null;
let sync: SyncState = { status: "idle", pending: 0 };
let booted = false;
let inflight = false;
let sending = new Set<string>();
let timer: ReturnType<typeof setTimeout> | undefined;
let retryDelay = 2_000;
let lastFetch = 0;
const listeners = new Set<() => void>();

function emit() {
  view = serverDb ? applyAll(serverDb, pending) : null;
  sync = { ...sync, pending: pending.length };
  for (const l of listeners) l();
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the in-memory copy still syncs.
  }
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function setSync(next: Omit<SyncState, "pending">) {
  sync = { ...next, pending: pending.length };
  emit();
}

const toLogin = () => {
  if (!location.pathname.startsWith("/login")) location.href = "/login";
};

// Each request to the server is numbered, so a slow, older response can't
// overwrite a newer one. (Revisions alone aren't enough: after a reset or a
// wipe the server starts counting again from 0.)
let requests = 0;
let applied = 0;

function acceptServer(db: Db, request: number) {
  if (request < applied && serverDb && db.rev <= serverDb.rev) return;
  applied = Math.max(applied, request);
  serverDb = upgrade(db);
  save(DB_KEY, db);
}

export async function refresh() {
  lastFetch = Date.now();
  try {
    const request = ++requests;
    const res = await fetch("/api/db", { cache: "no-store" });
    if (res.status === 401) return toLogin();
    if (!res.ok) throw new Error(String(res.status));
    acceptServer(await res.json(), request);
    emit();
    flush();
  } catch {
    if (!serverDb)
      setSync({ status: "offline", message: "Can't reach the server" });
  }
}

function schedule(ms: number) {
  clearTimeout(timer);
  timer = setTimeout(flush, ms);
}

export async function flush() {
  if (inflight || pending.length === 0) return;
  inflight = true;
  const batch = pending.slice(0, 200);
  const sent = new Set(batch.map((e) => e.id));
  sending = sent;
  setSync({ status: "saving" });
  try {
    const request = ++requests;
    const res = await fetch("/api/ops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ops: batch }),
    });
    if (res.status === 401) {
      setSync({ status: "error", message: "Signed out, changes are kept" });
      return toLogin();
    }
    if (res.status === 400) {
      // Never silently drop data: park rejected changes where Settings can export them.
      save(FAILED_KEY, [...load<Envelope[]>(FAILED_KEY, []), ...batch]);
      pending = pending.filter((e) => !sent.has(e.id));
      save(PENDING_KEY, pending);
      setSync({ status: "error", message: "A change couldn't be saved" });
      return;
    }
    if (!res.ok) throw new Error(String(res.status));
    const db: Db = await res.json();
    pending = pending.filter((e) => !sent.has(e.id));
    save(PENDING_KEY, pending);
    acceptServer(db, request);
    retryDelay = 2_000;
    setSync({ status: "idle" });
  } catch {
    setSync(
      navigator.onLine
        ? { status: "error", message: "Couldn't save, retrying" }
        : { status: "offline", message: "Offline, will save when back" },
    );
    schedule(retryDelay);
    retryDelay = Math.min(retryDelay * 2, 60_000);
  } finally {
    inflight = false;
    sending = new Set();
    if (pending.length && sync.status === "idle") schedule(0);
  }
}

// Repeated edits to the same thing (typing a name, tapping a stepper) collapse
// into one queued change, as long as the earlier one isn't already being sent.
const target = (op: Op) =>
  op.t === "routine.put"
    ? `routine:${op.routine.id}`
    : op.t === "exercise.put"
      ? `exercise:${op.exercise.id}`
      : op.t === "rotation.set"
        ? "rotation"
        : null;

/** Applies a change right away and queues it for the server. */
export function dispatch(op: Op, opts: { now?: boolean } = {}) {
  const last = pending.at(-1);
  const key = target(op);
  const replace =
    last && key && target(last.op) === key && !sending.has(last.id);
  pending = [
    ...(replace ? pending.slice(0, -1) : pending),
    { id: newId(), op },
  ];
  save(PENDING_KEY, pending);
  emit();
  // Bursts of edits (e.g. building a routine) go out as one write.
  schedule(opts.now ? 0 : 1_200);
}

export function boot() {
  if (booted) return;
  booted = true;
  const cached = load<Db | null>(DB_KEY, null);
  serverDb = cached ? upgrade(cached) : null;
  pending = load<Envelope[]>(PENDING_KEY, []);
  emit();
  refresh();
  // Asks the browser not to evict local data (granted readily to Home Screen apps).
  navigator.storage?.persist?.().catch(() => {});
  window.addEventListener("online", () => flush());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") return flush();
    if (Date.now() - lastFetch > 30_000) refresh();
    else flush();
  });
}

/** After an import or restore the server copy replaces everything. */
export function replaceFromServer(db: Db) {
  serverDb = upgrade(db);
  save(DB_KEY, db);
  emit();
}

export function clearLocalCopy() {
  serverDb = null;
  try {
    localStorage.removeItem(DB_KEY);
  } catch {}
  emit();
}

export const failedChanges = () => load<Envelope[]>(FAILED_KEY, []);

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useDb = () =>
  useSyncExternalStore(
    subscribe,
    () => view,
    () => null,
  );

export const useSync = () =>
  useSyncExternalStore(
    subscribe,
    () => sync,
    () => sync,
  );
