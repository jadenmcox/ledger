"use client";

import { useRouter } from "next/navigation";
import { formatCents } from "@/lib/utils";
import { HeroStat } from "@/components/hero-stat";
import { ChevronRight } from "lucide-react";

export type AccountSlice = {
  id: number;
  name: string;
  value: number; // positive balance in cents
  color: string;
};

// Accounts hero. Stats on the left; on the right, one bar per account whose
// length is its share of everything you own, so the bar and the percent next
// to it always agree. Tap a row to open that account.
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
  const netWorth = totalAssets - totalDebt;
  const sorted = [...slices].sort((a, b) => b.value - a.value);

  return (
    <section className="rise overflow-hidden rounded-card bg-surface p-6 md:p-8">
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(190px,0.8fr)_1.2fr] lg:gap-14">
        {/* LEFT — headline numbers */}
        <div className="flex flex-col gap-6 md:gap-7">
          <HeroStat
            label="Total assets"
            value={formatCents(totalAssets)}
            accent="var(--blue-deep)"
            dominant
          />
          <HeroStat
            label="Total debt"
            value={formatCents(totalDebt)}
            accent="var(--blush-deep)"
          />
          <HeroStat
            label="Net worth"
            value={formatCents(netWorth, { signed: true })}
            accent={netWorth >= 0 ? "var(--sage-deep)" : "var(--blush-deep)"}
            hint={netWorth >= 0 ? "assets minus debt" : "debt exceeds assets"}
          />
        </div>

        {/* RIGHT — ranked balance bars */}
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="display text-lg tracking-tight md:text-xl">
              Where your assets sit
            </h2>
            <span className="text-[11px] tracking-tight text-foreground-faint">
              share of total
            </span>
          </div>

          {sorted.length === 0 ? (
            <div className="py-12 text-center text-sm text-foreground-faint">
              No accounts with positive balances yet.
            </div>
          ) : (
            <div className="flex flex-col gap-3.5">
              {sorted.map((s) => {
                const exact = totalAssets > 0 ? (s.value / totalAssets) * 100 : 0;
                const shareLabel = exact > 0 && exact < 1 ? "<1%" : `${Math.round(exact)}%`;
                return (
                  <button
                    key={s.id}
                    onClick={() => router.push(`/accounts/${s.id}`)}
                    className="group -mx-2 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-surface-2/60"
                  >
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <span className="truncate text-[13px] tracking-tight text-foreground-muted transition-colors group-hover:text-foreground">
                        {s.name}
                      </span>
                      <span className="shrink-0 text-[13px] tracking-tight text-foreground-faint">
                        <span className="mono tabular text-foreground">
                          {formatCents(s.value)}
                        </span>{" "}
                        · {shareLabel}
                        <ChevronRight className="ml-1 inline size-3.5 align-[-2px]" strokeWidth={2} />
                      </span>
                    </div>
                    <div
                      className="h-2.5 w-full overflow-hidden rounded-full"
                      style={{ background: "var(--surface-2)" }}
                    >
                      <div
                        className="h-full rounded-full transition-all group-hover:brightness-95"
                        style={{ width: `${Math.max(1, exact)}%`, background: s.color }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
