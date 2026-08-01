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
    // The trailing extension group already covers every generated icon
    // (png/svg/ico) and the manifest, so they are served without a session.
    // iOS fetches apple-touch-icon WITHOUT cookies at add-to-home-screen time,
    // which is exactly what a missing exclusion here would break.
    "/((?!api/auth|_next|login|preview|manifest.webmanifest|favicon|.*\\.(?:png|jpg|svg|ico|webmanifest)).*)",
  ],
};
