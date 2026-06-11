import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { plaidItems, accounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { plaid } from "@/lib/plaid";
import { revalidatePath } from "next/cache";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (process.env.AUTH_BYPASS !== "1") {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const itemRowId = Number(id);
  const [item] = await db
    .select()
    .from(plaidItems)
    .where(eq(plaidItems.id, itemRowId))
    .limit(1);

  if (item) {
    try {
      await plaid.itemRemove({ access_token: item.accessToken });
    } catch {
      // Even if Plaid rejects (already removed), continue cleaning up locally.
    }
    // Detach linked accounts but keep their data
    await db
      .update(accounts)
      .set({ plaidItemId: null, plaidAccountId: null })
      .where(eq(accounts.plaidItemId, itemRowId));
    await db.delete(plaidItems).where(eq(plaidItems.id, itemRowId));
  }

  revalidatePath("/accounts");
  return NextResponse.json({ ok: true });
}
