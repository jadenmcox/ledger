import { formatCents, formatCentsCompact, cn } from "@/lib/utils";
import { Card, SectionHeader } from "@/components/ui";
import type { BudgetFramework } from "@/db/schema";

type Segments = {
  need: number;
  want: number;
  savings: number;
};

// Renders one horizontal "where the month went" bar.
//
// Total width = income (cents). Segments stack left-to-right: needs, wants,
// savings contributions, then leftover. If actual spend has already blown
// past income, the bar is sized to total spend instead and an "over income"
// flag tints the leftover region.
//
// Target markers above the bar show the framework's ideal allocation
// boundaries (50/30/20 = 50% and 80% lines). For zero-based / custom, we
// instead mark where the user's *planned* spend would land on the income
// scale, giving them a "you planned to use this much" sightline.
export function CompositionBar({
  income,
  segments,
  framework,
  plannedTotal,
}: {
  income: number;
  segments: Segments;
  framework: BudgetFramework;
  plannedTotal: number;
}) {
  const totalSpent = segments.need + segments.want + segments.savings;
  const leftover = Math.max(0, income - totalSpent);
  const over = totalSpent > income;
  const scale = over ? totalSpent : Math.max(income, 1);

  const segs = [
    {
      key: "need",
      label: "Needs",
      value: segments.need,
      bg: "var(--blush-deep)",
      text: "text-white",
    },
    {
      key: "want",
      label: "Wants",
      value: segments.want,
      bg: "var(--peach-deep)",
      text: "text-white",
    },
    {
      key: "savings",
      label: "Savings",
      value: segments.savings,
      bg: "var(--blue-deep)",
      text: "text-white",
    },
    {
      key: "leftover",
      label: over ? "Over income" : "Leftover",
      value: over ? totalSpent - income : leftover,
      bg: over ? "var(--blush)" : "var(--surface-2)",
      text: over ? "text-white" : "text-foreground-muted",
    },
  ];

  // Target markers expressed as a fraction of `scale` (0–1). Each marker is
  // labeled with its meaning. The leftover edge always sits at income/scale.
  const markers: { at: number; label: string }[] = [];
  if (income > 0) {
    if (framework === "50_30_20") {
      markers.push({ at: 0.5 * (income / scale), label: "50% needs target" });
      markers.push({ at: 0.8 * (income / scale), label: "80% needs + wants target" });
    } else if (plannedTotal > 0) {
      const plannedFrac = Math.min(1, plannedTotal / scale);
      markers.push({ at: plannedFrac, label: "planned spend" });
    }
    if (over) {
      markers.push({ at: income / scale, label: "income line" });
    }
  }

  const pctOf = (v: number) => (income > 0 ? (v / income) * 100 : 0);

  return (
    <Card className="p-6 md:p-7">
      <SectionHeader
        title="Where the month went"
        hint={
          income > 0
            ? framework === "50_30_20"
              ? "income split vs. 50 / 30 / 20"
              : framework === "zero_based"
                ? "income split vs. what you planned"
                : "income split this month"
            : "no income tracked yet this month"
        }
      />

      {/* Marker rail */}
      <div className="relative h-5">
        {markers.map((m, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 flex flex-col items-center"
            style={{ left: `${m.at * 100}%`, transform: "translateX(-50%)" }}
          >
            <div className="text-[9px] tracking-[0.18em] uppercase text-foreground-faint whitespace-nowrap mb-1">
              {m.label}
            </div>
            <div className="w-px flex-1 bg-foreground-faint/40" />
          </div>
        ))}
      </div>

      {/* Bar */}
      <div className="relative h-12 md:h-14 rounded-2xl overflow-hidden bg-surface-2 border border-border flex">
        {segs.map((s) => {
          const w = (s.value / scale) * 100;
          if (w <= 0) return null;
          return (
            <div
              key={s.key}
              className={cn(
                "h-full flex items-center justify-center text-[11px] tracking-tight transition-all",
                s.text,
              )}
              style={{ width: `${w}%`, background: s.bg, minWidth: w > 0 ? 2 : 0 }}
              title={`${s.label}: ${formatCents(s.value)}`}
            >
              {w >= 8 && (
                <span className="mono tabular font-medium px-1 truncate">
                  {formatCentsCompact(s.value)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5 mt-5">
        {segs.map((s) => (
          <div key={s.key} className="flex items-start gap-2.5 min-w-0">
            <span
              className="size-2.5 rounded-full mt-1.5 shrink-0"
              style={{ background: s.bg }}
            />
            <div className="min-w-0">
              <div className="text-[10px] tracking-[0.2em] uppercase text-foreground-faint truncate">
                {s.label}
              </div>
              <div className="mono tabular text-sm mt-1">
                {formatCents(s.value)}
              </div>
              {income > 0 && (
                <div className="text-[10px] text-foreground-faint mono tabular">
                  {pctOf(s.value).toFixed(0)}%
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
