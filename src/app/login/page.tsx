import { signIn } from "@/auth";
import { Button } from "@/components/ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const callbackUrl = sp.from ?? "/dashboard";

  async function googleSignIn() {
    "use server";
    await signIn("google", { redirectTo: callbackUrl });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-32 size-[40rem] rounded-full blur-3xl opacity-50"
        style={{ background: "var(--blush-soft)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-32 size-[40rem] rounded-full blur-3xl opacity-40"
        style={{ background: "var(--blue-tint)" }}
      />

      <div className="relative w-full max-w-sm">
        {/* Logo mark */}
        <div className="flex justify-center mb-8">
          <div className="size-12 rounded-2xl bg-sage-deep flex items-center justify-center shadow-[0_8px_24px_-12px] shadow-sage-deep/40">
            <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M8 7h5.5a3 3 0 0 1 0 6H8V7Zm0 6h6a3 3 0 0 1 0 6H8v-6Z"
                fill="var(--blush)"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-3xl md:text-4xl font-semibold tracking-[-0.035em] text-center leading-[1.1]">
          Welcome to Budgetly
        </h1>
        <p className="text-foreground-muted text-[15px] text-center mt-3 leading-relaxed">
          Sign in to see every account, every category, every month.
        </p>

        <form action={googleSignIn} className="mt-10 space-y-4">
          <Button type="submit" variant="primary" className="w-full">
            Continue with Google
          </Button>
          {sp.error && (
            <div className="text-blush-deep text-xs tracking-tight text-center">
              {sp.error === "AccessDenied"
                ? "That email isn't allowed."
                : "Something went wrong. Try again."}
            </div>
          )}
        </form>

        <div className="mt-12 text-center text-[11px] tracking-[0.18em] uppercase text-foreground-faint">
          Private · local-first · yours
        </div>
      </div>
    </div>
  );
}
