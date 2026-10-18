import {
  isAuthed,
  loadCredentials,
  relyingParty,
  saveCredentials,
  unauthorized,
} from "@/lib/server/auth";

export async function GET(request: Request) {
  if (!(await isAuthed())) return unauthorized();
  const { rpID } = relyingParty(request);
  const credentials = await loadCredentials();
  return Response.json(
    credentials
      .filter((c) => c.rpID === rpID)
      .map(({ id, createdAt }) => ({ id, createdAt })),
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(request: Request) {
  if (!(await isAuthed())) return unauthorized();
  const { rpID } = relyingParty(request);
  const id = new URL(request.url).searchParams.get("id");
  const credentials = await loadCredentials();
  const here = credentials.filter((c) => c.rpID === rpID);
  if (here.length <= 1) {
    return Response.json(
      { error: "Can't remove your only passkey" },
      { status: 400 },
    );
  }
  await saveCredentials(credentials.filter((c) => c.id !== id));
  return Response.json({ ok: true });
}
