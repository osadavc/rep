import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { readJson, writeJson } from "./blob";
import {
  isValidSession,
  PROD_HOST,
  read,
  SESSION_COOKIE,
  SESSION_DAYS,
  sign,
} from "./session";

const CHALLENGE_COOKIE = "rep_challenge";

export type StoredCredential = {
  id: string;
  publicKey: string;
  counter: number;
  transports?: string[];
  rpID: string;
  createdAt: number;
};

export async function isAuthed() {
  const jar = await cookies();
  return isValidSession(jar.get(SESSION_COOKIE)?.value);
}

export const unauthorized = () =>
  Response.json({ error: "Not signed in" }, { status: 401 });

/** Passkeys are bound to the site's domain; only these origins are accepted. */
export function relyingParty(request: Request) {
  if (process.env.VERCEL_ENV === "production") {
    return { rpID: PROD_HOST, origin: `https://${PROD_HOST}` };
  }
  const host = request.headers.get("host") ?? "localhost:3000";
  const hostname = host.split(":")[0];
  const scheme = hostname === "localhost" ? "http" : "https";
  return { rpID: hostname, origin: `${scheme}://${host}` };
}

const secure = () => process.env.NODE_ENV === "production";

export async function startSession() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await sign({ sub: "owner" }, `${SESSION_DAYS}d`), {
    httpOnly: true,
    secure: secure(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function setChallenge(challenge: string, purpose: string) {
  (await cookies()).set(
    CHALLENGE_COOKIE,
    await sign({ challenge, purpose }, "5m"),
    {
      httpOnly: true,
      secure: secure(),
      sameSite: "strict",
      path: "/",
      maxAge: 300,
    },
  );
}

export async function takeChallenge(purpose: string) {
  const jar = await cookies();
  const payload = await read(jar.get(CHALLENGE_COOKIE)?.value);
  jar.delete(CHALLENGE_COOKIE);
  if (payload?.purpose !== purpose || typeof payload.challenge !== "string") {
    return null;
  }
  return payload.challenge;
}

export function checkSetupSecret(given: unknown) {
  const expected = process.env.SETUP_SECRET;
  if (!expected || typeof given !== "string" || !given) return false;
  const hash = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(hash(given.trim()), hash(expected));
}

export async function loadCredentials(): Promise<StoredCredential[]> {
  const file = await readJson("auth.json");
  const data = file?.data as { credentials?: StoredCredential[] } | undefined;
  return data?.credentials ?? [];
}

export async function saveCredentials(credentials: StoredCredential[]) {
  await writeJson("auth.json", { credentials });
}
