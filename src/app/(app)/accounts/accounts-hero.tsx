"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DonutChart, type DonutDatum } from "@/components/charts/DonutChart";
import { formatCents, cn } from "@/lib/utils";

export type AccountSlice = {
  id: number;
  name: string;
  value: number; // positive balance in cents
  color: string;
};


export function AccountsHero({
  slices,
  totalAssets,
  totalDebt,
}: {
  slices: AccountSlice[];
  totalAssets: number;
  totalDebt: number;
}) {
  const router = useRouter();
  const [active, setActive] = useState<AccountSlice | null>(null);

  const netWorth = totalAssets - totalDebt;

  const donutData: DonutDatum[] = slices.map((s) => ({
    name: s.name,
    value: s.value,
    color: s.color,
    href: `/accounts/${s.id}`,
  }));

  const activePct =
    active && totalAssets > 0
      ? Math.round((active.value / totalAssets) * 100)
      : 0;

  return (
    <section className="rise overflow-hidden rounded-[28px] border border-border bg-surface/85 p-6 backdrop-blur-sm shadow-[0_30px_70px_-40px_rgba(34,28,74,0.45)] md:p-9">
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(200px,0.85fr)_auto] lg:gap-14">
        {/* LEFT */}
        <div className="flex flex-col gap-6 md:gap-7">
          <Stat
            label="Total assets"
            value={formatCents(totalAssets)}
            accent="var(--blue-deep)"
            dominant
          />
          <Stat
            label="Total debt"
            value={formatCents(totalDebt)}
            accent="var(--blush-deep)"
          />
          <Stat
            label="Net worth"
            value={formatCents(netWorth, { signed: true })}
            accent={netWorth >= 0 ? "var(--sage-deep)" : "var(--blush-deep)"}
            hint={netWorth >= 0 ? "assets − debt" : "debt exceeds assets"}
          />
        </div>

        {/* RIGHT */}
        <div className="flex flex-col items-center gap-6">
          <div className="flex w-full items-baseline justify-between gap-3">
            <h2 className="display text-lg tracking-tight md:text-xl">
              Where your assets sit
            </h2>
            <span className="text-[11px] tracking-tight text-foreground-faint">
              hover · click to open
            </span>
          </div>

          {slices.length === 0 ? (
            <div className="py-16 text-center text-sm text-foreground-faint">
              No accounts with positive balances yet.
            </div>
          ) : (
            <>
              <div
                className="relative"
                style={{ width: 300, height: 300 }}
                onMouseLeave={() => setActive(null)}
              >
                <DonutChart
                  data={donutData}
                  size={300}
                  thickness={40}
                  formatValue={formatCents}
                  showTooltip={false}
                  onActiveChange={(d) =>
                    setActive(slices.find((s) => s.name === d.name) ?? null)
                  }
                  onSliceClick={(d) => d.href && router.push(d.href)}
                />
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-12 text-center">
                  {active ? (
                    <>
                      <span
                        className="mb-1.5 max-w-full truncate text-[11px] font-semibold uppercase tracking-[0.18em]"
                        style={{ color: active.color }}
                      >
                        {active.name}
                      </span>
                      <span className="display text-[2rem] leading-none">
                        {formatCents(active.value)}
                      </span>
                      <span className="mt-1.5 text-[11px] text-foreground-faint">
                        {activePct}% of assets
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="mb-1 text-[10px] uppercase tracking-[0.28em] text-foreground-faint">
                        net worth
                      </span>
                      <span className="display text-[2.3rem] leading-none">
                        {formatCents(netWorth, { signed: true })}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Legend — colored dot + account name, click navigates */}
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2.5">
                {slices.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => router.push(`/accounts/${s.id}`)}
                    className="rounded-lg px-1 py-0.5 transition-colors hover:text-foreground"
                  >
                    <span className="flex items-center gap-2 text-[13px] tracking-tight">
                      <span
                        className="size-2.5 rounded-full shrink-0"
                        style={{ background: s.color }}
                      />
                      <span className="truncate text-foreground-muted">{s.name}</span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  accent,
  hint,
  dominant = false,
}: {
  label: string;
  value: string;
  accent: string;
  hint?: string;
  dominant?: boolean;
}) {
  return (
    <div className={cn("relative", dominant && "pl-4")}>
      {dominant && (
        <span
          className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full"
          style={{ background: accent }}
        />
      )}
      <div
        className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em]"
        style={{ color: accent }}
      >
        {label}
      </div>
      <div
        className={cn(
          "display leading-none text-foreground",
          dominant ? "text-[2.4rem] md:text-[3rem]" : "text-[1.8rem] md:text-[2.1rem]",
        )}
      >
        {value}
      </div>
      {hint && (
        <div className="mt-1.5 text-[11px] text-foreground-faint">{hint}</div>
      )}
    </div>
  );
}
