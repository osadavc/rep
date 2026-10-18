"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui";
import { signIn } from "@/lib/client/passkey";

export default function LoginPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="pt-safe mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 pb-16">
      <h1 className="text-[56px] font-bold leading-none tracking-[-0.045em]">
        rep
      </h1>
      <p className="mt-3 mb-10 text-[17px] text-secondary">Your workout log.</p>
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const err = await signIn();
          if (err) {
            setError(err);
            setBusy(false);
          } else {
            location.href = "/";
          }
        }}
      >
        {busy ? "Waiting for passkey…" : "Sign in with passkey"}
      </Button>
      <p className="mt-4 min-h-6 text-[15px]" role="alert">
        {error}
      </p>
      <Link href="/setup" className="press mt-6 text-[15px] text-secondary">
        First time on this site? Set up a passkey
      </Link>
    </main>
  );
}
