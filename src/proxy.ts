import { type NextRequest, NextResponse } from "next/server";
import {
  isValidSession,
  PROD_HOST,
  SESSION_COOKIE,
} from "@/lib/server/session";

const PUBLIC = ["/login", "/setup", "/api/auth/login/", "/api/auth/register/"];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Passkeys only work on the real domain, so send *.vercel.app visits there.
  if (
    process.env.VERCEL_ENV === "production" &&
    request.headers.get("host") !== PROD_HOST
  ) {
    return NextResponse.redirect(
      `https://${PROD_HOST}${pathname}${search}`,
      308,
    );
  }

  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();

  if (await isValidSession(request.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest).*)",
  ],
};
