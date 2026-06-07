export { auth as proxy } from "@/auth";

export const config = {
  matcher: [
    "/((?!api/auth|_next|login|icon.svg|manifest.webmanifest|favicon|.*\\.(?:png|jpg|svg|webmanifest)).*)",
  ],
};
