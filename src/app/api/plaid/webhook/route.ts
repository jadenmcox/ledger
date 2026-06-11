import { NextResponse } from "next/server";
import { db } from "@/db";
import { plaidItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { syncItem } from "@/lib/plaid-sync";
import { plaid } from "@/lib/plaid";
import { revalidatePath } from "next/cache";
import { decodeProtectedHeader, importJWK, jwtVerify } from "jose";
import crypto from "node:crypto";

// Cache JWKs by kid — they rarely rotate, no need to re-fetch every webhook.
const jwkCache = new Map<string, Awaited<ReturnType<typeof importJWK>>>();

async function verifyPlaidWebhook(
  rawBody: string,
  headerJwt: string,
): Promise<boolean> {
  let kid: string | undefined;
  try {
    const header = decodeProtectedHeader(headerJwt);
    kid = header.kid as string | undefined;
    if (!kid || header.alg !== "ES256") return false;
  } catch {
    return false;
  }

  let key = jwkCache.get(kid);
  if (!key) {
    const res = await plaid.webhookVerificationKeyGet({ key_id: kid });
    const jwk = res.data.key;
    key = await importJWK(
      {
        kty: jwk.kty,
        crv: jwk.crv,
        x: jwk.x,
        y: jwk.y,
        use: jwk.use,
        alg: jwk.alg,
      },
      "ES256",
    );
    jwkCache.set(kid, key);
  }

  let payload: { request_body_sha256?: string; iat?: number };
  try {
    const v = await jwtVerify(headerJwt, key, { algorithms: ["ES256"] });
    payload = v.payload as typeof payload;
  } catch {
    return false;
  }

  // Reject anything older than 5 minutes to block replay.
  if (!payload.iat || Date.now() / 1000 - payload.iat > 5 * 60) return false;

  const bodyHash = crypto
    .createHash("sha256")
    .update(rawBody)
    .digest("hex");
  if (
    !payload.request_body_sha256 ||
    !crypto.timingSafeEqual(
      Buffer.from(payload.request_body_sha256),
      Buffer.from(bodyHash),
    )
  ) {
    return false;
  }

  return true;
}

export async function POST(req: Request) {
  // Read the raw body once — signature verification needs the exact bytes
  // Plaid signed, so we can't reparse via req.json() first.
  const rawBody = await req.text();
  const verificationHeader = req.headers.get("plaid-verification");

  if (verificationHeader) {
    const ok = await verifyPlaidWebhook(rawBody, verificationHeader);
    if (!ok) {
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
  } else if (process.env.PLAID_REQUIRE_WEBHOOK_VERIFICATION === "1") {
    // In production, missing header = reject. Locally we let it through so
    // you can curl the endpoint for testing.
    return NextResponse.json({ error: "missing signature" }, { status: 401 });
  }

  let body: {
    item_id?: string;
    webhook_type?: string;
    webhook_code?: string;
  };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true });
  }

  const { item_id: itemId, webhook_type: webhookType, webhook_code: webhookCode } = body;

  if (
    itemId &&
    webhookType === "TRANSACTIONS" &&
    (webhookCode === "SYNC_UPDATES_AVAILABLE" ||
      webhookCode === "DEFAULT_UPDATE" ||
      webhookCode === "INITIAL_UPDATE" ||
      webhookCode === "HISTORICAL_UPDATE")
  ) {
    const [item] = await db
      .select()
      .from(plaidItems)
      .where(eq(plaidItems.itemId, itemId))
      .limit(1);
    if (item) {
      try {
        await syncItem(item.id);
        revalidatePath("/transactions");
        revalidatePath("/dashboard");
        revalidatePath("/accounts");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await db
          .update(plaidItems)
          .set({ lastError: msg })
          .where(eq(plaidItems.id, item.id));
      }
    }
  }

  return NextResponse.json({ ok: true });
}
