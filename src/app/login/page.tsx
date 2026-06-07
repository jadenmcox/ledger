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
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-12">
          <div className="text-foreground-faint text-[10px] tracking-[0.3em] uppercase mb-3">
            Private
          </div>
          <div className="serif text-5xl">
            Ledger<span className="serif-italic text-gold">.</span>
          </div>
        </div>
        <form action={googleSignIn} className="space-y-6">
          <Button type="submit" variant="primary" className="w-full">
            Sign in with Google
          </Button>
          {sp.error && (
            <div className="text-clay text-xs tracking-tight text-center">
              {sp.error === "AccessDenied"
                ? "That email isn't allowed."
                : "Something went wrong. Try again."}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
