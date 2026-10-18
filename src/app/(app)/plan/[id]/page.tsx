import { Suspense } from "react";
import { RoutineEditor } from "@/components/routine-editor";

export default function Page({ params }: PageProps<"/plan/[id]">) {
  return (
    <Suspense>
      {params.then(({ id }) => (
        <RoutineEditor id={id} />
      ))}
    </Suspense>
  );
}
