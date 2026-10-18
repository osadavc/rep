import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { relyingParty, setChallenge } from "@/lib/server/auth";

export async function POST(request: Request) {
  const { rpID } = relyingParty(request);
  // No allow-list: the phone offers whichever rep passkey it has.
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
  });
  await setChallenge(options.challenge, "login");
  return Response.json(options);
}
