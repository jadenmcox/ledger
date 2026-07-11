"use client";

import { useTransition } from "react";
import { Card } from "@/components/ui";
import { deleteImportBatch } from "./actions";
import { FileText, Trash2 } from "lucide-react";

export type ImportBatch = {
  id: number;
  filename: string | null;
  accountName: string | null;
  rowCount: number;
  importedAt: string; // ISO
};

// The undo button for a bad CSV: every batch is listed with a delete that
// removes exactly the transactions it created.
export function RecentImports({ batches }: { batches: ImportBatch[] }) {
  const [pending, startTransition] = useTransition();
  if (batches.length === 0) return null;
  return (
    <div className="mt-10">
      <div className="flex items-baseline justify-between mb-4 px-1">
        <div className="flex items-baseline gap-3">
          <h3 className="serif text-xl">Past imports</h3>
          <span className="text-[10px] tracking-[0.2em] uppercase text-foreground-faint">
            {batches.length}
          </span>
        </div>
        <span className="text-[11px] text-foreground-faint tracking-tight">
          deleting one removes the transactions it created
        </span>
      </div>
      <Card className="divide-y divide-border">
        {batches.map((b) => (
          <div
            key={b.id}
            className="px-4 md:px-5 py-3.5 flex items-center gap-3 md:gap-4 group"
          >
            <FileText
              className="size-4 text-foreground-faint shrink-0"
              strokeWidth={1.5}
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm tracking-tight truncate">
                {b.filename || "untitled.csv"}
              </div>
              <div className="text-[11px] text-foreground-faint mt-0.5">
                {b.accountName ? `${b.accountName} · ` : ""}
                {new Date(b.importedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            </div>
            <div className="mono tabular text-xs text-foreground-faint shrink-0">
              {b.rowCount} rows
            </div>
            <button
              disabled={pending}
              onClick={() => {
                if (
                  confirm(
                    `Undo this import? The ${b.rowCount} transactions it created will be deleted. Rules and categories stay.`,
                  )
                )
                  startTransition(() => deleteImportBatch(b.id).then(() => undefined));
              }}
              className="size-8 inline-flex items-center justify-center rounded-md hover:bg-surface-2 text-foreground-faint hover:text-blush-deep md:opacity-0 md:group-hover:opacity-100 transition-opacity"
              title="Undo import (delete its transactions)"
            >
              <Trash2 className="size-3.5" strokeWidth={1.5} />
            </button>
          </div>
        ))}
      </Card>
    </div>
  );
}
