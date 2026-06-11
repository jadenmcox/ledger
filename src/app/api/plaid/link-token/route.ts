import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { plaid, PLAID_COUNTRY_CODES, PLAID_PRODUCTS } from "@/lib/plaid";
import { db } from "@/db";
import { plaidItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Products, CountryCode } from "plaid";

export async function POST(req: Request) {
  if (process.env.AUTH_BYPASS !== "1") {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const itemRowId = body?.itemId as number | undefined;

  // Update mode: re-link an existing item (e.g. after credentials change)
  let accessToken: string | undefined;
  if (itemRowId) {
    const [item] = await db
      .select()
      .from(plaidItems)
      .where(eq(plaidItems.id, itemRowId))
      .limit(1);
    accessToken = item?.accessToken;
  }

  const res = await plaid.linkTokenCreate({
    user: { client_user_id: "budgetly-user" },
    client_name: "Budgetly",
    products: accessToken
      ? undefined
      : (PLAID_PRODUCTS as readonly string[] as Products[]),
    country_codes: PLAID_COUNTRY_CODES as readonly string[] as CountryCode[],
    language: "en",
    access_token: accessToken,
    webhook: process.env.PLAID_WEBHOOK_URL || undefined,
  });

  return NextResponse.json({ link_token: res.data.link_token });
}
