import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Dev-only auth bypass — set AUTH_BYPASS=1 in .env.local to skip auth
// for local screenshots / design work. Never set this in production.
export const proxy =
  process.env.AUTH_BYPASS === "1"
    ? () => NextResponse.next()
    : (auth as unknown as (req: Request) => Response | Promise<Response>);

export const config = {
  matcher: [
    "/((?!api/auth|_next|login|preview|icon.svg|manifest.webmanifest|favicon|.*\\.(?:png|jpg|svg|webmanifest)).*)",
  ],
};
