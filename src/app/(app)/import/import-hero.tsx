"use client";

import { Upload, SlidersHorizontal, CheckCircle2 } from "lucide-react";
import { HeroStat } from "@/components/hero-stat";

const STEPS = [
  { icon: Upload, label: "Pick file", hint: "CSV from your bank" },
  { icon: SlidersHorizontal, label: "Map columns", hint: "date · amount · merchant" },
  { icon: CheckCircle2, label: "Done", hint: "deduped & categorized" },
];

export function ImportHero({
  txCount,
  accountCount,
  categoryCount,
}: {
  txCount: number;
  accountCount: number;
  categoryCount: number;
}) {
  return (
    <section className="rise overflow-hidden rounded-[28px] border border-border bg-surface/85 p-6 backdrop-blur-sm shadow-[0_30px_70px_-40px_rgba(34,28,74,0.45)] md:p-8">
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(200px,0.85fr)_auto] lg:gap-14">
        {/* LEFT — what's already loaded */}
        <div className="flex flex-col gap-6 md:gap-7">
          <HeroStat
            label="Transactions loaded"
            value={txCount.toLocaleString()}
            accent="var(--blue-deep)"
            dominant
            hint="more = sharper insights"
          />
          <HeroStat
            label="Accounts"
            value={String(accountCount)}
            accent="var(--sage-deep)"
          />
          <HeroStat
            label="Categories"
            value={String(categoryCount)}
            accent="var(--blush-deep)"
            hint="rules apply automatically"
          />
        </div>

        {/* RIGHT — three-step flow */}
        <div className="flex flex-col items-center gap-6">
          <div className="flex w-full items-baseline justify-between gap-3">
            <h2 className="display text-lg tracking-tight md:text-xl">
              How it works
            </h2>
            <span className="text-[11px] tracking-tight text-foreground-faint">
              drop a CSV below
            </span>
          </div>

          <div className="flex flex-col gap-4 w-full max-w-xs">
            {STEPS.map(({ icon: Icon, label, hint }, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="relative flex flex-col items-center">
                  <div
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      background: i === 0
                        ? "var(--blue-tint)"
                        : i === 1
                          ? "color-mix(in srgb, var(--blush) 18%, transparent)"
                          : "color-mix(in srgb, var(--sage) 18%, transparent)",
                    }}
                  >
                    <Icon
                      className="size-[18px]"
                      strokeWidth={1.75}
                      style={{
                        color: i === 0
                          ? "var(--blue-deep)"
                          : i === 1
                            ? "var(--blush-deep)"
                            : "var(--sage-deep)",
                      }}
                    />
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="mt-1 h-4 w-px bg-border" />
                  )}
                </div>
                <div className="pb-4">
                  <div className="text-sm tracking-tight leading-tight">
                    {label}
                  </div>
                  <div className="text-[11px] text-foreground-faint mt-0.5">
                    {hint}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
