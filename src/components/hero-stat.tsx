import { cn } from "@/lib/utils";

// A large accent-colored headline figure used in the left column of the
// page heroes (Accounts, Import). The `dominant` variant adds a thin accent
// bar on the left and bumps the size, marking the lead number in a stack.
export function HeroStat({
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
