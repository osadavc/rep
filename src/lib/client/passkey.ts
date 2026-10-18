import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong");
  return data;
}

function friendly(error: unknown) {
  const name = (error as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "AbortError") return "Cancelled.";
  if (name === "InvalidStateError")
    return "This device already has a passkey for rep.";
  return error instanceof Error ? error.message : "Something went wrong";
}

/** Creates a passkey. Needs the setup secret unless already signed in. */
export async function registerPasskey(secret?: string) {
  try {
    const optionsJSON = await post("/api/auth/register/options", { secret });
    const response = await startRegistration({ optionsJSON });
    await post("/api/auth/register/verify", { response });
    return null;
  } catch (error) {
    return friendly(error);
  }
}

export async function signIn() {
  try {
    const optionsJSON = await post("/api/auth/login/options", {});
    const response = await startAuthentication({ optionsJSON });
    await post("/api/auth/login/verify", { response });
    return null;
  } catch (error) {
    return friendly(error);
  }
}
