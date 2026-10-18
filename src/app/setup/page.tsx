"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, field } from "@/components/ui";
import { registerPasskey } from "@/lib/client/passkey";

export default function SetupPage() {
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="pt-safe mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 pb-16">
      <h1 className="text-[40px] font-bold leading-none tracking-[-0.035em]">
        Set up
      </h1>
      <p className="mt-3 mb-8 text-[17px] text-secondary">
        Enter the setup secret from your Vercel project to create a passkey on
        this device.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          const err = await registerPasskey(secret);
          if (err) {
            setError(err);
            setBusy(false);
          } else {
            location.href = "/";
          }
        }}
      >
        <label className="block">
          <span className="text-[13px] text-secondary">Setup secret</span>
          <input
            type="password"
            autoComplete="off"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className={field}
          />
        </label>
        <Button type="submit" className="mt-6" disabled={busy || !secret}>
          {busy ? "Waiting for passkey…" : "Create passkey"}
        </Button>
      </form>
      <p className="mt-4 min-h-6 text-[15px]" role="alert">
        {error}
      </p>
      <Link href="/login" className="press mt-6 text-[15px] text-secondary">
        Already set up? Sign in
      </Link>
    </main>
  );
}
