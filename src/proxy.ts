import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/((?!_next|api/health|login|icon.svg|manifest.webmanifest|favicon|.*\\.(?:png|jpg|svg|webmanifest)).*)"],
};

export function proxy(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();
  const cookie = req.cookies.get("ledger_auth")?.value;
  if (cookie === password) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("from", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}
