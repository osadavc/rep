import { Suspense } from "react";
import { SessionView } from "@/components/session-view";

export default function Page({ params }: PageProps<"/history/[id]">) {
  return (
    <Suspense>
      {params.then(({ id }) => (
        <SessionView id={id} />
      ))}
    </Suspense>
  );
}
