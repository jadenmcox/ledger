import Groq from "groq-sdk";
import { z } from "zod";

// The categories the parser is allowed to assign a line item to.
export type ReceiptCategory = {
  id: number;
  name: string;
  classification: string;
};

// A category's grouped slice of a scanned receipt, ready to seed a split line.
// amountCents is a positive magnitude (the split editor applies the parent sign).
export type ScannedSplit = {
  categoryId: number | null;
  amountCents: number;
  note: string | null;
};

export type ScannedReceipt = {
  merchant: string | null;
  totalCents: number | null;
  splits: ScannedSplit[];
  itemCount: number;
};

// Groq's vision models (Llama 4 Scout here) take base64 images + JSON mode, but
// not strict json_schema constrained decoding (that's gpt-oss text-only). So we
// ask for JSON mode and validate the shape ourselves with Zod below.
const MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

const LineItemSchema = z.object({
  description: z.string().catch(""),
  amount_cents: z.number().catch(0),
  category_id: z.number().nullable().catch(null),
});
const ReceiptSchema = z.object({
  merchant: z.string().nullable().catch(null),
  total_cents: z.number().nullable().catch(null),
  line_items: z.array(LineItemSchema).catch([]),
});

// Sends a downscaled receipt photo (a data: URL) to Groq and returns the parsed
// line items already grouped into per-category split slices. Never throws on a
// bad model response — an unreadable receipt yields an empty result the caller
// can surface. The GROQ_API_KEY check lives in the calling server action.
export async function scanReceiptImage(
  dataUrl: string,
  categories: ReceiptCategory[],
): Promise<ScannedReceipt> {
  const spendCats = categories.filter((c) => c.classification !== "income");
  const catList = spendCats.map((c) => `${c.id} = ${c.name}`).join("\n");
  const validIds = new Set(spendCats.map((c) => c.id));

  const prompt = `Extract the purchased line items from this store receipt photo.
Return ONLY a JSON object of exactly this shape:
{"merchant": string|null, "total_cents": integer|null, "line_items": [{"description": string, "amount_cents": integer, "category_id": integer|null}]}
Rules:
- Amounts are US cents as positive integers ($4.99 -> 499).
- total_cents is the receipt grand total (after tax).
- One entry per purchased item. Do NOT include subtotal, tax, discount, or total rows as line items.
- For each item, choose the single best category_id from this list, or null if none fits:
${catList}
- If the image is unreadable, return {"merchant":null,"total_cents":null,"line_items":[]}.`;

  const groq = new Groq();
  const completion = await groq.chat.completions.create({
    model: MODEL,
    temperature: 0,
    max_completion_tokens: 2048,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed: z.infer<typeof ReceiptSchema>;
  try {
    parsed = ReceiptSchema.parse(JSON.parse(raw));
  } catch {
    parsed = { merchant: null, total_cents: null, line_items: [] };
  }

  // Group items by their validated category so a 20-item basket becomes a few
  // split lines (Groceries, Household), not 20. An unknown category id -> null.
  const byCat = new Map<number | null, { cents: number; count: number }>();
  for (const item of parsed.line_items) {
    const cents = Math.abs(Math.round(item.amount_cents));
    if (cents === 0) continue;
    const catId =
      item.category_id != null && validIds.has(item.category_id)
        ? item.category_id
        : null;
    const cur = byCat.get(catId) ?? { cents: 0, count: 0 };
    cur.cents += cents;
    cur.count += 1;
    byCat.set(catId, cur);
  }

  const splits: ScannedSplit[] = [...byCat.entries()]
    .map(([categoryId, v]) => ({
      categoryId,
      amountCents: v.cents,
      note: v.count > 1 ? `${v.count} items` : null,
    }))
    .sort((a, b) => b.amountCents - a.amountCents);

  return {
    merchant: parsed.merchant,
    totalCents:
      parsed.total_cents != null
        ? Math.abs(Math.round(parsed.total_cents))
        : null,
    splits,
    itemCount: parsed.line_items.length,
  };
}
