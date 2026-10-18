import { jwtVerify, SignJWT } from "jose";

// Kept free of storage imports so the proxy can use it.

export const SESSION_COOKIE = "rep_session";
export const PROD_HOST = "rep.osada.vc";
export const SESSION_DAYS = 400;

const key = () => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(secret);
};

export function sign(payload: Record<string, unknown>, expiresIn: string) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key());
}

export async function read(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), {
      algorithms: ["HS256"],
    });
    return payload;
  } catch {
    return null;
  }
}

export async function isValidSession(token: string | undefined) {
  const payload = await read(token);
  return payload?.sub === "owner";
}
