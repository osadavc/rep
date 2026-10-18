import { Suspense } from "react";
import { ExerciseStats } from "@/components/exercise-stats";

export default function Page({ params }: PageProps<"/stats/[id]">) {
  return (
    <Suspense>
      {params.then(({ id }) => (
        <ExerciseStats id={id} />
      ))}
    </Suspense>
  );
}
