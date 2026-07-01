"use client";

import { useRouter } from "next/navigation";
import { formatCents, cn } from "@/lib/utils";

export type AccountSlice = {
  id: number;
  name: string;
  value: number; // positive balance in cents
  color: string;
};

// Accounts hero. Stats on the left; on the right, a ranked set of horizontal
// balance bars (one per account, scaled to the largest) instead of a donut —
// so you can actually compare which accounts hold the most at a glance. Click a
// bar to open that account.
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
  const max = sorted[0]?.value ?? 1;

  return (
    <section className="rise overflow-hidden rounded-[28px] border border-border bg-surface/85 p-6 backdrop-blur-sm shadow-[0_30px_70px_-40px_rgba(34,28,74,0.45)] md:p-9">
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(190px,0.8fr)_1.2fr] lg:gap-14">
        {/* LEFT — headline numbers */}
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

        {/* RIGHT — ranked balance bars */}
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="display text-lg tracking-tight md:text-xl">
              Where your assets sit
            </h2>
            <span className="text-[11px] tracking-tight text-foreground-faint">
              click to open
            </span>
          </div>

          {sorted.length === 0 ? (
            <div className="py-12 text-center text-sm text-foreground-faint">
              No accounts with positive balances yet.
            </div>
          ) : (
            <div className="flex flex-col gap-3.5">
              {sorted.map((s) => {
                const pct = Math.max(4, Math.round((s.value / max) * 100));
                const share =
                  totalAssets > 0
                    ? Math.round((s.value / totalAssets) * 100)
                    : 0;
                return (
                  <button
                    key={s.id}
                    onClick={() => router.push(`/accounts/${s.id}`)}
                    className="group text-left"
                  >
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <span className="truncate text-[13px] tracking-tight text-foreground-muted transition-colors group-hover:text-foreground">
                        {s.name}
                      </span>
                      <span className="shrink-0 text-[13px] tracking-tight text-foreground-faint">
                        <span className="mono tabular text-foreground">
                          {formatCents(s.value)}
                        </span>{" "}
                        · {share}%
                      </span>
                    </div>
                    <div
                      className="h-2.5 w-full overflow-hidden rounded-full"
                      style={{ background: "var(--surface-2)" }}
                    >
                      <div
                        className="h-full rounded-full transition-all group-hover:brightness-95"
                        style={{ width: `${pct}%`, background: s.color }}
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
