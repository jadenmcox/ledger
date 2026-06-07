import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const allowed = (process.env.ALLOWED_EMAIL ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  callbacks: {
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
