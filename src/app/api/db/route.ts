import { isAuthed, unauthorized } from "@/lib/server/auth";
import { loadDb } from "@/lib/server/db";

export async function GET() {
  if (!(await isAuthed())) return unauthorized();
  const { db } = await loadDb();
  return Response.json(db, { headers: { "Cache-Control": "no-store" } });
}
