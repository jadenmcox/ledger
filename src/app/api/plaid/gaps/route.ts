import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { findBankGaps } from "@/lib/plaid-sync";

export const dynamic = "force-dynamic";

// Read-only check: what the bank has that Budgetly doesn't. Signed-in only.
export async function GET() {
  if (process.env.AUTH_BYPASS !== "1") {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await findBankGaps());
}
