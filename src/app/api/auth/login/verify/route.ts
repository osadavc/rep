import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import {
  loadCredentials,
  relyingParty,
  saveCredentials,
  startSession,
  takeChallenge,
} from "@/lib/server/auth";

const failed = (error: string) => Response.json({ error }, { status: 400 });

export async function POST(request: Request) {
  const challenge = await takeChallenge("login");
  if (!challenge) return failed("Expired, try again");

  const { rpID, origin } = relyingParty(request);
  const body = await request.json().catch(() => null);
  const credentials = await loadCredentials();
  const stored = credentials.find(
    (c) => c.id === body?.response?.id && c.rpID === rpID,
  );
  if (!stored) return failed("This passkey isn't registered here");

  let result: Awaited<ReturnType<typeof verifyAuthenticationResponse>>;
  try {
    result = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: stored.id,
        publicKey: isoBase64URL.toBuffer(stored.publicKey),
        counter: stored.counter,
        transports: stored.transports,
      },
    });
  } catch {
    return failed("Passkey could not be verified");
  }
  if (!result.verified) return failed("Passkey could not be verified");

  // Synced passkeys (iCloud, Google) always report 0, so this rarely writes.
  const { newCounter } = result.authenticationInfo;
  if (newCounter > stored.counter) {
    await saveCredentials(
      credentials.map((c) =>
        c.id === stored.id ? { ...c, counter: newCounter } : c,
      ),
    );
  }

  await startSession();
  return Response.json({ ok: true });
}
