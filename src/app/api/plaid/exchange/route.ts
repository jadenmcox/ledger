import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { plaid } from "@/lib/plaid";
import { db } from "@/db";
import { plaidItems } from "@/db/schema";
import { syncItem } from "@/lib/plaid-sync";
import { revalidatePath } from "next/cache";

export async function POST(req: Request) {
  if (process.env.AUTH_BYPASS !== "1") {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { public_token, institution } = await req.json();
  if (!public_token) {
    return NextResponse.json({ error: "public_token required" }, { status: 400 });
  }

  const ex = await plaid.itemPublicTokenExchange({ public_token });
  const accessToken = ex.data.access_token;
  const itemId = ex.data.item_id;

  const [row] = await db
    .insert(plaidItems)
    .values({
      itemId,
      accessToken,
      institutionId: institution?.institution_id ?? null,
      institutionName: institution?.name ?? null,
    })
    .returning();

  const result = await syncItem(row.id);

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");

  return NextResponse.json({ itemRowId: row.id, ...result });
}
