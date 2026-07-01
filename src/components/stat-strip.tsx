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
  return (
    <section className="rise overflow-hidden rounded-[28px] border border-border bg-surface/85 px-6 py-6 backdrop-blur-sm shadow-[0_30px_70px_-40px_rgba(34,28,74,0.45)] md:px-8 md:py-7">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-0">
        {items.map((it, i) => (
          <div
            key={i}
            className={cn(
              it.dominant ? "sm:flex-[1.5]" : "sm:flex-1",
              i > 0 && "sm:border-l sm:border-border sm:pl-8",
            )}
          >
            <div
              className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: it.accent ?? "var(--foreground-muted)" }}
            >
              {it.label}
            </div>
            <div
              className={cn(
                "display leading-none text-foreground",
                it.dominant
                  ? "text-[2.6rem] md:text-[3.1rem]"
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
