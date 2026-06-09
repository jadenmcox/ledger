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
        className="pointer-events-none absolute -top-32 -left-24 size-[36rem] rounded-full blur-3xl opacity-70"
        style={{ background: "var(--blush-soft)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-32 size-[40rem] rounded-full blur-3xl opacity-60"
        style={{ background: "var(--blue-tint)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 right-1/4 size-[18rem] rounded-full blur-3xl opacity-40"
        style={{ background: "var(--lavender-tint)" }}
      />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 text-foreground-muted text-[10px] tracking-[0.3em] uppercase mb-8 bg-surface/80 backdrop-blur-sm border border-border px-3 py-1 rounded-full">
            <span className="size-1 rounded-full bg-blush drift" />
            Personal · Private
          </div>
          <h1 className="serif text-[3.75rem] md:text-7xl leading-[0.95] tracking-tight">
            A soft place
          </h1>
          <h1 className="serif text-[3.75rem] md:text-7xl leading-[0.95] tracking-tight mt-1">
            to watch{" "}
            <span className="serif-italic text-blush-deep">your money</span>.
          </h1>
          <p className="mt-6 text-foreground-muted text-sm md:text-base leading-relaxed max-w-sm mx-auto">
            One quiet view of every account, every category, every month — yours
            alone, kept on your own machine.
          </p>
        </div>

        <form action={googleSignIn} className="space-y-5">
          <Button type="submit" variant="primary" className="w-full">
            Sign in with Google
          </Button>
          {sp.error && (
            <div className="text-blush-deep text-xs tracking-tight text-center">
              {sp.error === "AccessDenied"
                ? "That email isn't allowed."
                : "Something went wrong. Try again."}
            </div>
          )}
        </form>

        <div className="mt-14 flex items-center justify-center gap-2 text-foreground-faint text-[10px] tracking-[0.3em] uppercase">
          <span className="size-1 rounded-full bg-blush" />
          <span className="size-1 rounded-full bg-peach" />
          <span className="size-1 rounded-full bg-blue" />
          <span className="size-1 rounded-full bg-lavender" />
        </div>
      </div>
    </div>
  );
}
