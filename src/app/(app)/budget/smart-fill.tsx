"use client";

import { useState } from "react";
import { Card, Button } from "@/components/ui";
import { formatCentsCompact, cn } from "@/lib/utils";
import { Sparkles, RotateCcw } from "lucide-react";
import type { BudgetFramework, Classification } from "@/db/schema";

export type SmartFillRow = {
  id: number;
  name: string;
  color: string;
  icon: string;
  classification: Classification;
  currentLimitCents: number | null;
  avgCents: number;
  scaledCents: number;
};

const frameworkLabel: Record<BudgetFramework, string> = {
  "50_30_20": "50 / 30 / 20",
  zero_based: "zero-based",
  custom: "custom",
};

// A pre-fill assist that sits above the single limits editor. It holds no
// limits and no Save button of its own: "Smart-fill" pushes suggested values up
// into the editor's drafts, which the user reviews and saves in one place. This
// replaces the old parallel editor that could silently revert a save.
export function SmartFillBar({
  rows,
  framework,
  incomeBasis,
  basisMonths,
  onApply,
  onReset,
  disabled = false,
}: {
  rows: SmartFillRow[];
  framework: BudgetFramework;
  incomeBasis: number;
  basisMonths: number;
  onApply: (values: Record<number, string>) => void;
  onReset: () => void;
  disabled?: boolean;
}) {
  const canScale = framework !== "custom" && incomeBasis > 0;
  const [scale, setScale] = useState(canScale);
  const hasHistory = rows.some((r) => r.avgCents > 0);

  const suggestionFor = (r: SmartFillRow) =>
    scale && canScale ? r.scaledCents : r.avgCents;

  const apply = () => {
    const values: Record<number, string> = {};
    for (const r of rows) {
      const s = suggestionFor(r);
      if (s > 0) values[r.id] = (s / 100).toFixed(0);
    }
    onApply(values);
  };

  return (
    <Card className="p-5 md:p-6 mb-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm tracking-tight">
            {hasHistory
              ? "Pre-fill every limit from your typical spend, then review and save your changes."
              : "No spending history yet to suggest limits from."}
          </div>
          {hasHistory && (
            <div className="text-[12px] text-foreground-muted mt-1">
              {canScale && scale ? (
                <>
                  Suggested from your last {basisMonths}{" "}
                  {basisMonths === 1 ? "month" : "months"}, scaled to your{" "}
                  <span className="text-foreground">
                    {frameworkLabel[framework]}
                  </span>{" "}
                  split against {formatCentsCompact(incomeBasis)} income.
                </>
              ) : (
                <>
                  Suggested from your last {basisMonths}{" "}
                  {basisMonths === 1 ? "month" : "months"} of spending
                  {canScale ? " (raw averages, not scaled)." : "."}
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canScale && (
            <button
              onClick={() => setScale((s) => !s)}
              className={cn(
                "text-[12px] rounded-full border px-3 py-1.5 transition-colors tracking-tight",
                scale
                  ? "border-blush bg-blush-tint/40 text-foreground"
                  : "border-border bg-surface text-foreground-muted hover:border-border-strong",
              )}
            >
              Scale to {frameworkLabel[framework]}
            </button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={onReset}
            disabled={disabled}
          >
            <RotateCcw className="size-3.5" strokeWidth={1.75} />
            Reset
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={apply}
            disabled={disabled || !hasHistory}
          >
            <Sparkles className="size-3.5" strokeWidth={1.75} />
            Smart-fill
          </Button>
        </div>
      </div>
    </Card>
  );
}
