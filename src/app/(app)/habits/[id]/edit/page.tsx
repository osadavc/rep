import { Suspense } from "react";
import { HabitForm } from "@/components/habit-form";

export default function Page({ params }: PageProps<"/habits/[id]/edit">) {
  return (
    <Suspense>
      {params.then(({ id }) => (
        <HabitForm id={id} />
      ))}
    </Suspense>
  );
}
