"use client";

import { useState, useTransition } from "react";
import {
  Card,
  Label,
  Button,
} from "@/components/ui";
import type { Account } from "@/db/schema";
import { detectColumns, parseCsv } from "@/lib/csv-import";
import { runImport, type ImportResult } from "./actions";
import { Upload, FileText, CheckCircle2 } from "lucide-react";
import { formatCents } from "@/lib/utils";

type Step = "pick" | "map" | "review" | "done";

export function ImportClient({ accounts }: { accounts: Account[] }) {
  const [step, setStep] = useState<Step>("pick");
  const [filename, setFilename] = useState<string | null>(null);
  const [csv, setCsv] = useState<string>("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
  const [accountId, setAccountId] = useState<number | null>(
    accounts[0]?.id ?? null,
  );
  const [cols, setCols] = useState({
    date: "",
    description: "",
    amount: "",
    debit: "",
    credit: "",
  });
  const [amountSign, setAmountSign] = useState<"as-is" | "flip">("as-is");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  function onFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const { headers, rows } = parseCsv(text);
      const detected = detectColumns(headers);
      setCsv(text);
      setFilename(file.name);
      setHeaders(headers);
      setPreviewRows(rows.slice(0, 5));
      setCols({
        date: detected.date ?? "",
        description: detected.description ?? "",
        amount: detected.amount ?? "",
        debit: detected.debit ?? "",
        credit: detected.credit ?? "",
      });
      setStep("map");
    };
    reader.readAsText(file);
  }

  function submit() {
    if (!accountId) return;
    startTransition(async () => {
      const r = await runImport({
        accountId,
        csv,
        filename: filename ?? undefined,
        columns: {
          date: cols.date,
          description: cols.description,
          amount: cols.amount,
          debit: cols.debit || undefined,
          credit: cols.credit || undefined,
        },
        amountSign,
      });
      setResult(r);
      setStep("done");
    });
  }

  if (step === "pick") {
    return (
      <Card className="p-10 md:p-16">
        <label className="block cursor-pointer border-2 border-dashed border-border-strong hover:border-sage hover:bg-sage-tint/30 rounded-2xl p-16 text-center transition-colors group">
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
          <Upload
            className="mx-auto size-8 text-foreground-faint group-hover:text-sage-deep transition-colors mb-4"
            strokeWidth={1.5}
          />
          <div className="serif text-2xl mb-2">Drop a CSV</div>
          <div className="text-foreground-muted text-sm">
            Most banks let you download one from your transaction history. Any
            shape works — we'll map the columns.
          </div>
        </label>
      </Card>
    );
  }

  if (step === "map") {
    const sample = previewRows[0] ?? {};
    return (
      <div className="space-y-6">
        <Card className="p-6 md:p-8">
          <div className="flex items-baseline gap-3 mb-6">
            <FileText
              className="size-4 text-sage-deep"
              strokeWidth={1.75}
            />
            <Label>File</Label>
            <span className="text-sm">{filename}</span>
            <span className="text-xs text-foreground-faint">
              · {headers.length} columns
            </span>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="account">Into account</Label>
              <select
                id="account"
                value={accountId ?? ""}
                onChange={(e) => setAccountId(Number(e.target.value))}
                className="h-10 w-full bg-surface border border-border rounded-xl px-3.5 text-sm focus:border-sage focus:ring-2 focus:ring-sage-tint focus:outline-none transition-all"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id} className="bg-surface">
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Amount convention</Label>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setAmountSign("as-is")}
                  className={`flex-1 h-10 text-xs tracking-tight rounded-xl border transition-colors ${
                    amountSign === "as-is"
                      ? "bg-sage-tint text-sage-deep border-sage"
                      : "border-border bg-surface text-foreground-muted hover:text-foreground"
                  }`}
                >
                  As-is (debits negative)
                </button>
                <button
                  onClick={() => setAmountSign("flip")}
                  className={`flex-1 h-10 text-xs tracking-tight rounded-xl border transition-colors ${
                    amountSign === "flip"
                      ? "bg-sage-tint text-sage-deep border-sage"
                      : "border-border bg-surface text-foreground-muted hover:text-foreground"
                  }`}
                >
                  Flip sign (credit cards)
                </button>
              </div>
            </div>
          </div>

          <div className="hairline my-8" />

          <Label>Column mapping</Label>
          <p className="text-xs text-foreground-faint mt-1 mb-5 leading-relaxed">
            Tell Budgetly which column is which. If your bank uses separate
            debit/credit columns, leave Amount blank.
          </p>
          <div className="grid md:grid-cols-2 gap-5">
            {(
              [
                { key: "date", label: "Date" },
                { key: "description", label: "Description / Merchant" },
                { key: "amount", label: "Amount (single column)" },
                { key: "debit", label: "Debit / Withdrawal (optional)" },
                { key: "credit", label: "Credit / Deposit (optional)" },
              ] as const
            ).map((f) => (
              <div key={f.key}>
                <Label>{f.label}</Label>
                <select
                  value={cols[f.key]}
                  onChange={(e) =>
                    setCols((c) => ({ ...c, [f.key]: e.target.value }))
                  }
                  className="h-10 w-full bg-surface border border-border rounded-xl px-3.5 text-sm focus:border-sage focus:ring-2 focus:ring-sage-tint focus:outline-none transition-all"
                >
                  <option value="" className="bg-surface">
                    — none —
                  </option>
                  {headers.map((h) => (
                    <option key={h} value={h} className="bg-surface">
                      {h}
                    </option>
                  ))}
                </select>
                {cols[f.key] && sample[cols[f.key]] && (
                  <div className="mt-1 text-[10px] text-foreground-faint mono">
                    e.g. {String(sample[cols[f.key]]).slice(0, 40)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 md:p-8">
          <Label>Preview · first 5 rows</Label>
          <div className="mt-4 overflow-x-auto -mx-2">
            <table className="w-full text-xs mono tabular">
              <thead>
                <tr className="text-foreground-faint border-b border-border">
                  {headers.map((h) => (
                    <th
                      key={h}
                      className="text-left font-normal px-2 py-2 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {headers.map((h) => (
                      <td
                        key={h}
                        className="px-2 py-1.5 whitespace-nowrap text-foreground-muted"
                      >
                        {r[h]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setStep("pick")}>
            Start over
          </Button>
          <Button
            variant="primary"
            disabled={
              !cols.date ||
              !cols.description ||
              (!cols.amount && !cols.debit && !cols.credit) ||
              pending
            }
            onClick={submit}
          >
            {pending ? "Importing..." : "Import"}
          </Button>
        </div>
      </div>
    );
  }

  if (step === "done" && result) {
    return (
      <Card className="p-10 md:p-16 text-center">
        <CheckCircle2
          className="mx-auto size-10 text-sage mb-6"
          strokeWidth={1.25}
        />
        <h3 className="serif text-3xl mb-3">
          Imported{" "}
          <span className="serif-italic text-gold">{result.inserted}</span>{" "}
          transactions
        </h3>
        <div className="text-foreground-muted text-sm mb-8 max-w-md mx-auto">
          {result.duplicates > 0 && (
            <span>
              {result.duplicates} duplicate
              {result.duplicates !== 1 ? "s" : ""} skipped.{" "}
            </span>
          )}
          {result.categorized > 0 && (
            <span>
              {result.categorized} auto-categorized by existing rules.
            </span>
          )}
        </div>
        <div className="flex justify-center gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setStep("pick");
              setResult(null);
              setCsv("");
              setFilename(null);
            }}
          >
            Import another
          </Button>
          <a href="/transactions">
            <Button variant="primary">Review transactions</Button>
          </a>
        </div>
      </Card>
    );
  }

  return null;
}
