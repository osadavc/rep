import { Suspense } from "react";
import { HabitDetail } from "@/components/habit-detail";

export default function Page({ params }: PageProps<"/habits/[id]">) {
  return (
    <Suspense>
      {params.then(({ id }) => (
        <HabitDetail id={id} />
      ))}
    </Suspense>
  );
}
