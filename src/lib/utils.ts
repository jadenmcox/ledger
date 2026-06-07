import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCents(cents: number, opts: { signed?: boolean } = {}) {
  const dollars = cents / 100;
  const abs = Math.abs(dollars);
  const formatted = abs.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
  if (opts.signed) {
    return cents < 0 ? `-${formatted}` : cents > 0 ? `+${formatted}` : formatted;
  }
  return cents < 0 ? `-${formatted}` : formatted;
}

export function formatCentsCompact(cents: number) {
  const dollars = cents / 100;
  if (Math.abs(dollars) >= 10_000) {
    return `$${(dollars / 1000).toFixed(1)}k`;
  }
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function parseDollarsToCents(input: string): number {
  const cleaned = input.replace(/[$,\s]/g, "");
  const n = Number(cleaned);
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}
