import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { syncAllItems, syncItem } from "@/lib/plaid-sync";
import { revalidatePath } from "next/cache";

export async function POST(req: Request) {
  if (process.env.AUTH_BYPASS !== "1") {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const itemRowId = body?.itemRowId as number | undefined;

  const result = itemRowId
    ? await syncItem(itemRowId)
    : await syncAllItems();

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");

  return NextResponse.json({ result });
}
