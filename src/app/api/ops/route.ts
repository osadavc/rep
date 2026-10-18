import { ZodError, z } from "zod";
import { envelopeSchema } from "@/lib/ops";
import { isAuthed, unauthorized } from "@/lib/server/auth";
import { commit } from "@/lib/server/db";

const bodySchema = z.object({ ops: z.array(envelopeSchema).min(1).max(500) });

const invalid = () =>
  Response.json({ error: "Invalid change" }, { status: 400 });

export async function POST(request: Request) {
  if (!(await isAuthed())) return unauthorized();
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return invalid();
  try {
    const db = await commit(body.data.ops);
    return Response.json(db, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ZodError) return invalid();
    throw error;
  }
}
