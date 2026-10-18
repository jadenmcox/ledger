import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { realignPurchaseDates } from "@/lib/plaid-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function signedIn() {
  if (process.env.AUTH_BYPASS === "1") return true;
  return !!(await auth());
}

// Moves bank rows saved with the bank's posted day onto the day of purchase.
// GET lists what would move; POST moves them. Signed-in only.
export async function GET() {
  if (!(await signedIn())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await realignPurchaseDates(false));
}

export async function POST() {
  if (!(await signedIn())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await realignPurchaseDates(true));
}
