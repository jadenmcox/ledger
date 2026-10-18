import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const allowed = (process.env.ALLOWED_EMAIL ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  callbacks: {
    // Runs in the proxy on every request. Without it the proxy only reads the
    // session and lets everyone through, which left every page and server
    // action open to anyone with the URL. Only two machine endpoints skip
    // sign-in, and each checks its own credentials: Plaid's webhook
    // (verified signature) and the dashboard summary feed (API key).
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      if (path === "/api/plaid/webhook" || path === "/api/summary") return true;
      return !!auth?.user;
    },
    signIn({ profile }) {
      const email = profile?.email?.toLowerCase();
      if (!email) return false;
      return allowed.length === 0 ? false : allowed.includes(email);
    },
    session({ session }) {
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
