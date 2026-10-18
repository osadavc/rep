import { useEffect, useState } from "react";

let audio: AudioContext | null = null;

/** iOS only allows sound after a tap, so call this from a tap handler. */
export function unlockAudio() {
  try {
    audio ??= new AudioContext();
    if (audio.state !== "running") void audio.resume();
  } catch {}
}

/** Two short tones when a rest is over. Phones also vibrate where supported. */
export function restDoneAlert() {
  navigator.vibrate?.([120, 80, 120]);
  if (!audio || audio.state !== "running") return;
  const t = audio.currentTime;
  for (const offset of [0, 0.22]) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = 1046;
    gain.gain.setValueAtTime(0.0001, t + offset);
    gain.gain.exponentialRampToValueAtTime(0.35, t + offset + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.16);
    osc.connect(gain).connect(audio.destination);
    osc.start(t + offset);
    osc.stop(t + offset + 0.18);
  }
}

/** Keeps the screen on while `on` is true (re-acquired when returning to the app). */
export function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      if (document.visibilityState !== "visible" || lock) return;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (cancelled) return void next.release();
        lock = next;
        lock.addEventListener("release", () => {
          lock = null;
        });
      } catch {}
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", acquire);
      void lock?.release();
    };
  }, [on]);
}

/** The current time, updated every `ms` while `on`. */
export function useNow(ms = 1000, on = true) {
  // Not read on the server, where pages are prerendered once for everyone.
  const [now, setNow] = useState(() =>
    typeof window === "undefined" ? 0 : Date.now(),
  );
  useEffect(() => {
    if (!on) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms, on]);
  return now;
}
