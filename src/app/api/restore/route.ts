import { ZodError } from "zod";
import { isAuthed, unauthorized } from "@/lib/server/auth";
import { readSnapshot, replaceDb } from "@/lib/server/db";

// Body is either { snapshot: "2026-10-18" } or { data: <exported file> }.
export async function POST(request: Request) {
  if (!(await isAuthed())) return unauthorized();
  const body = await request.json().catch(() => null);

  let data: unknown = body?.data;
  if (typeof body?.snapshot === "string") {
    data = await readSnapshot(body.snapshot);
    if (!data)
      return Response.json({ error: "Backup not found" }, { status: 404 });
  }

  try {
    const db = await replaceDb(data);
    return Response.json(db, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { error: "That file isn't a rep export" },
        { status: 400 },
      );
    }
    throw error;
  }
}
