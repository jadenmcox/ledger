import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Button, Input, Label } from "@/components/ui";

async function login(formData: FormData) {
  "use server";
  const password = process.env.APP_PASSWORD ?? "";
  const attempt = String(formData.get("password") || "");
  const from = String(formData.get("from") || "/dashboard");
  if (attempt && attempt === password) {
    const store = await cookies();
    store.set("ledger_auth", password, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    redirect(from);
  }
  redirect(`/login?from=${encodeURIComponent(from)}&error=1`);
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; error?: string }>;
}) {
  const sp = await searchParams;
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
        <form action={login} className="space-y-6">
          <input type="hidden" name="from" value={sp.from ?? "/dashboard"} />
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoFocus
              required
            />
          </div>
          {sp.error && (
            <div className="text-clay text-xs tracking-tight">
              That's not it.
            </div>
          )}
          <Button type="submit" variant="primary" className="w-full">
            Enter
          </Button>
        </form>
      </div>
    </div>
  );
}
