import { cn } from "@/lib/utils";

export type StatItem = {
  label: string;
  value: string;
  // Label accent color (a CSS var string). Defaults to muted.
  accent?: string;
  hint?: string;
  // The lead figure — rendered larger and given a little extra width.
  dominant?: boolean;
};

// A slim horizontal band of headline numbers. Replaces the per-page donut
// heroes on the secondary pages (Transactions / Budget / Categories) so they
// stay informative without every page reading as a clone of the dashboard.
export function StatStrip({ items }: { items: StatItem[] }) {
  // Up to three numbers fit on one line from small screens up; four or more
  // wrap two-by-two until there's room for them all.
  const wide = items.length > 3;
  return (
    <section className="rise overflow-hidden rounded-card bg-surface px-6 py-6 md:px-8 md:py-7">
      <div
        className={cn(
          wide
            ? "grid grid-cols-2 gap-6 xl:flex xl:items-center xl:gap-0"
            : "flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-0",
        )}
      >
        {items.map((it, i) => (
          <div
            key={i}
            className={cn(
              "min-w-0",
              wide
                ? cn(it.dominant ? "xl:flex-[1.5]" : "xl:flex-1", i > 0 && "xl:border-l xl:border-border xl:pl-8")
                : cn(it.dominant ? "sm:flex-[1.5]" : "sm:flex-1", i > 0 && "sm:border-l sm:border-border sm:pl-8"),
            )}
          >
            <div
              className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] font-bold"
              style={{ color: it.accent ?? "var(--foreground-muted)" }}
            >
              {it.label}
            </div>
            <div
              className={cn(
                "display leading-none text-foreground",
                it.dominant && !wide
                  ? "text-[2.6rem] md:text-[3.1rem]"
                  : it.dominant
                    ? "text-[1.9rem] md:text-[2.2rem] xl:text-[3.1rem]"
                    : "text-[1.7rem] md:text-[2rem]",
              )}
            >
              {it.value}
            </div>
            {it.hint && (
              <div className="mt-1.5 text-[11px] text-foreground-faint">
                {it.hint}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
