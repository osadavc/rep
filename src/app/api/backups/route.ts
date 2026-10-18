import { isAuthed, unauthorized } from "@/lib/server/auth";
import { listSnapshots } from "@/lib/server/db";

export async function GET() {
  if (!(await isAuthed())) return unauthorized();
  return Response.json(await listSnapshots(), {
    headers: { "Cache-Control": "no-store" },
  });
}
