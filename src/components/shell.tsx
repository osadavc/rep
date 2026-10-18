"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, Suspense, useEffect, useState } from "react";
import { useNow } from "@/lib/client/device";
import { boot, useDb, useSync } from "@/lib/client/store";
import { useActive } from "@/lib/client/workout";
import { clock } from "@/lib/format";
import { cx } from "./ui";

const TABS = [
  { href: "/", label: "Train" },
  { href: "/history", label: "History" },
  { href: "/stats", label: "Stats" },
  { href: "/sleep", label: "Sleep" },
  { href: "/body", label: "Body" },
  { href: "/plan", label: "Plan" },
];

export function Shell({ children }: { children: ReactNode }) {
  useEffect(boot, []);
  useKeyboardFlag();
  const db = useDb();
  return (
    <>
      <div className="pb-[calc(76px+env(safe-area-inset-bottom))]">
        {children}
        {db ? null : <Loading />}
      </div>
      <Suspense fallback={<Bar pathname={null} />}>
        <CurrentBar />
      </Suspense>
    </>
  );
}

function Loading() {
  const sync = useSync();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 600);
    return () => clearTimeout(t);
  }, []);
  if (!slow) return null;
  return (
    <p className="mx-auto max-w-xl px-5 pt-24 text-[15px] text-secondary">
      {sync.status === "offline"
        ? "Can't reach the server. Check your connection."
        : "Loading…"}
    </p>
  );
}

function CurrentBar() {
  return <Bar pathname={usePathname()} />;
}

function Bar({ pathname }: { pathname: string | null }) {
  if (pathname === "/workout") return null;
  return (
    <nav className="hide-kb pb-safe fixed inset-x-0 bottom-0 z-20 border-t-[0.5px] border-separator bg-white">
      <ActiveStrip />
      <div className="mx-auto flex h-[52px] max-w-xl items-stretch justify-between px-2">
        {TABS.map((t) => {
          const on =
            pathname !== null &&
            (t.href === "/" ? pathname === "/" : pathname.startsWith(t.href));
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cx(
                "press flex flex-1 items-center justify-center text-[13px] tracking-[0.01em]",
                on ? "font-semibold text-black" : "font-medium text-secondary",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** A reminder that a workout is still running, from any other screen. */
function ActiveStrip() {
  const active = useActive();
  const now = useNow(1000, Boolean(active));
  if (!active) return null;
  return (
    <Link
      href="/workout"
      className="press mx-auto flex h-11 max-w-xl items-center justify-between bg-black px-5 text-[15px] text-white sm:mt-2 sm:rounded-xl"
    >
      <span className="truncate font-medium">{active.name}</span>
      <span className="tnum flex shrink-0 items-center gap-3">
        {clock(now - active.startedAt)}
        <span className="font-medium">Resume ›</span>
      </span>
    </Link>
  );
}

/**
 * Marks <html data-kb> while a text field is focused, so fixed bottom bars can
 * get out of the way of the iOS keyboard instead of floating over the inputs.
 */
function useKeyboardFlag() {
  useEffect(() => {
    const root = document.documentElement;
    const isField = (el: EventTarget | null) =>
      el instanceof HTMLTextAreaElement ||
      (el instanceof HTMLInputElement &&
        !["checkbox", "radio", "button", "submit", "file"].includes(el.type));
    const onIn = (e: FocusEvent) => {
      if (isField(e.target)) root.dataset.kb = "";
    };
    const onOut = () =>
      requestAnimationFrame(() => {
        if (!isField(document.activeElement)) delete root.dataset.kb;
      });
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, []);
}
