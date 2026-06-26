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
  const consumption = segments.need + segments.want;
  const saved = segments.savings;
  const totalOut = consumption + saved;
  const leftover = Math.max(0, income - totalOut);
  // Bars run past the income line only when total outflow exceeds income. That
  // usually means heavy *saving* (money moved in from existing cash), not
  // overspending. We only call it an overage when needs + wants alone exceed
  // income.
  const overIncome = totalOut > income;
  const overspent = consumption > income;
  const scale = Math.max(income, totalOut, 1);

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
      label: "Saved",
      value: saved,
      bg: "var(--blue-deep)",
      text: "text-white",
    },
    {
      key: "leftover",
      label: "Leftover",
      value: leftover,
      bg: "var(--surface-2)",
      text: "text-foreground-muted",
    },
  ];

  // Target markers expressed as a fraction of `scale` (0–1). Each marker is
  // labeled with its meaning. The leftover edge always sits at income/scale.
  const markers: { at: number; label: string }[] = [];
  if (income > 0) {
    // Once outflow runs past income, the only marker that matters is where
    // income sits. Showing the 50/30/20 targets there too crowds and collides
    // with the income line, so we drop them in that case.
    if (overIncome) {
      markers.push({ at: income / scale, label: "income line" });
    } else if (framework === "50_30_20") {
      markers.push({ at: 0.5, label: "50% needs target" });
      markers.push({ at: 0.8, label: "80% needs + wants target" });
    } else if (plannedTotal > 0) {
      markers.push({ at: Math.min(1, plannedTotal / scale), label: "planned spend" });
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

      {income > 0 && (overspent || (overIncome && saved > 0)) && (
        <p
          className={cn(
            "text-[11px] mt-5 leading-relaxed",
            overspent ? "text-blush-deep" : "text-foreground-faint",
          )}
        >
          {overspent
            ? `Your needs and wants came to ${formatCentsCompact(consumption - income)} more than your income this month.`
            : `You saved ${formatCentsCompact(saved)} this month, and ${formatCentsCompact(totalOut - income)} of that went beyond this month's income, drawn from existing cash. That is saving, not overspending.`}
        </p>
      )}
    </Card>
  );
}
