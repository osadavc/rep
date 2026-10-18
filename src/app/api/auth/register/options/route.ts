import { generateRegistrationOptions } from "@simplewebauthn/server";
import {
  checkSetupSecret,
  isAuthed,
  loadCredentials,
  relyingParty,
  setChallenge,
} from "@/lib/server/auth";

// Adding a passkey needs either an existing sign-in or the setup secret
// (which is also the way back in if every passkey is lost).
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (!(await isAuthed()) && !checkSetupSecret(body?.secret)) {
    return Response.json({ error: "Wrong setup secret" }, { status: 403 });
  }

  const { rpID } = relyingParty(request);
  const existing = (await loadCredentials()).filter((c) => c.rpID === rpID);

  const options = await generateRegistrationOptions({
    rpName: "rep",
    rpID,
    userName: "rep",
    userDisplayName: "rep",
    userID: new TextEncoder().encode("rep-owner"),
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({
      id: c.id,
      transports: c.transports,
    })),
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "preferred",
    },
  });

  await setChallenge(options.challenge, "register");
  return Response.json(options);
}
