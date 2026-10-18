"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { dispatch } from "@/lib/client/store";
import { newId } from "@/lib/model";

/** Creates an empty workout and opens it for editing. */
export function useCreateRoutine() {
  const router = useRouter();
  return () => {
    const id = newId();
    dispatch({
      t: "routine.put",
      routine: { id, name: "New workout", items: [] },
    });
    router.push(`/plan/${id}`);
  };
}

export function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="press flex h-11 w-9 items-center justify-center text-[17px] disabled:opacity-20"
    >
      {children}
    </button>
  );
}
