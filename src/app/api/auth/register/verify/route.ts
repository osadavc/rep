import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import {
  loadCredentials,
  relyingParty,
  saveCredentials,
  startSession,
  takeChallenge,
} from "@/lib/server/auth";

export async function POST(request: Request) {
  // The challenge is only issued after the secret or a session was checked.
  const challenge = await takeChallenge("register");
  if (!challenge) {
    return Response.json({ error: "Expired, try again" }, { status: 400 });
  }

  const { rpID, origin } = relyingParty(request);
  const body = await request.json().catch(() => null);

  let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
  try {
    verification = await verifyRegistrationResponse({
      response: body?.response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch {
    return Response.json(
      { error: "Passkey could not be verified" },
      { status: 400 },
    );
  }
  if (!verification.verified) {
    return Response.json(
      { error: "Passkey could not be verified" },
      { status: 400 },
    );
  }

  const { credential } = verification.registrationInfo;
  const credentials = await loadCredentials();
  await saveCredentials([
    ...credentials.filter((c) => c.id !== credential.id),
    {
      id: credential.id,
      publicKey: isoBase64URL.fromBuffer(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports,
      rpID,
      createdAt: Date.now(),
    },
  ]);

  await startSession();
  return Response.json({ ok: true });
}
