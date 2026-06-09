import Link from "next/link";

type Option = {
  id: "geist" | "inter" | "jakarta";
  vibe: string;
  name: string;
  pairing: string;
  pros: string[];
  fontVar: string;
  // Wordmark variants
  wordmarkClass: string;
  wordmarkWeight: number;
};

const OPTIONS: Option[] = [
  {
    id: "geist",
    vibe: "Modern / neutral",
    name: "Geist",
    pairing: "Geist Sans + Geist Mono",
    pros: [
      "Vercel/Linear feel — disciplined, technical",
      "Pairs natively with Geist Mono for numbers",
      "Tight letter-spacing reads dense and modern",
    ],
    fontVar: "var(--font-sans)", // already loaded
    wordmarkClass: "tracking-[-0.04em]",
    wordmarkWeight: 600,
  },
  {
    id: "inter",
    vibe: "Sharp fintech",
    name: "Inter",
    pairing: "Inter Display + Inter",
    pros: [
      "Stripe / Ramp / Linear standard",
      "Extremely tight at display sizes",
      "Most familiar — readers don't 'see' it",
    ],
    fontVar: "var(--font-inter)",
    wordmarkClass: "tracking-[-0.05em]",
    wordmarkWeight: 700,
  },
  {
    id: "jakarta",
    vibe: "Warm / approachable",
    name: "Plus Jakarta Sans",
    pairing: "Plus Jakarta Sans",
    pros: [
      "Cleo / Monzo feel — friendlier, less corporate",
      "Round terminals feel softer next to blush palette",
      "More personality than Inter, less austere than Geist",
    ],
    fontVar: "var(--font-jakarta)",
    wordmarkClass: "tracking-[-0.04em]",
    wordmarkWeight: 700,
  },
];

export default function FontsPreviewPage() {
  return (
    <div className="min-h-screen bg-background relative">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-24 size-[28rem] rounded-full blur-3xl opacity-50"
        style={{ background: "var(--blush-soft)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-32 size-[32rem] rounded-full blur-3xl opacity-40"
        style={{ background: "var(--blue-tint)" }}
      />

      <div className="relative max-w-7xl mx-auto px-5 md:px-10 py-12 md:py-16">
        <div className="mb-12 md:mb-16 max-w-2xl">
          <div className="inline-flex items-center gap-2 text-foreground-muted text-[10px] tracking-[0.3em] uppercase mb-5 bg-surface/80 backdrop-blur-sm border border-border px-3 py-1 rounded-full">
            <span className="size-1 rounded-full bg-blush" />
            Font picker
          </div>
          <h1
            className="text-4xl md:text-5xl leading-[1.05] tracking-[-0.03em] mb-4"
            style={{ fontFamily: "var(--font-sans)", fontWeight: 600 }}
          >
            Three modern directions for Budgetly.
          </h1>
          <p
            className="text-foreground-muted text-base leading-relaxed"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Each card shows the same wordmark, hero stat, headline, and CTA in a
            different font system. All-sans, no editorial serifs, no decorative
            dot. Tell me which lands and I&apos;ll wire it through the whole app.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {OPTIONS.map((opt, i) => (
            <FontCard key={opt.id} option={opt} letter={String.fromCharCode(65 + i)} />
          ))}
        </div>

        <div className="mt-16 max-w-2xl">
          <h2
            className="text-xl mb-3 tracking-[-0.02em]"
            style={{ fontFamily: "var(--font-sans)", fontWeight: 600 }}
          >
            Notes
          </h2>
          <ul
            className="text-sm text-foreground-muted space-y-2 leading-relaxed"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            <li>• Numbers use a mono ({"Geist Mono"}) in every option — chart axes and
              currency lock-up are the same regardless of the body font choice.</li>
            <li>• The wordmark drops the italic <code className="font-mono text-foreground">d</code> and the trailing dot in all three.</li>
            <li>• Once you pick one, the full app (dashboard, nav, charts, drill-downs, login) all swap.</li>
          </ul>
          <div className="mt-8 flex gap-3">
            <Link
              href="/login"
              className="inline-flex items-center justify-center h-10 px-5 rounded-full text-sm bg-sage-deep text-surface tracking-tight"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              Back to login
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center h-10 px-5 rounded-full text-sm border border-border-strong bg-surface text-foreground tracking-tight"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              Open dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function FontCard({ option, letter }: { option: Option; letter: string }) {
  const ff = option.fontVar;
  return (
    <div className="bg-surface/95 backdrop-blur-sm border border-border rounded-3xl p-6 md:p-8 relative overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <div className="text-[10px] tracking-[0.25em] uppercase text-foreground-faint">
          Option {letter} · {option.vibe}
        </div>
        <div className="size-7 rounded-full bg-surface-2 border border-border flex items-center justify-center text-[11px] mono text-foreground-muted">
          {letter}
        </div>
      </div>

      {/* Wordmark */}
      <div className="pb-6 border-b border-border">
        <div
          className={`text-3xl ${option.wordmarkClass}`}
          style={{ fontFamily: ff, fontWeight: option.wordmarkWeight }}
        >
          Budgetly
        </div>
        <div
          className="text-[11px] text-foreground-faint mt-1.5 tracking-tight"
          style={{ fontFamily: ff }}
        >
          {option.pairing}
        </div>
      </div>

      {/* Hero stat */}
      <div className="py-7 border-b border-border">
        <div
          className="text-[10px] tracking-[0.25em] uppercase text-foreground-faint mb-3"
          style={{ fontFamily: ff }}
        >
          Spent this month
        </div>
        <div
          className="mono tabular text-5xl leading-none tracking-[-0.04em] text-foreground"
        >
          $4,287
          <span className="text-foreground-faint text-3xl">.50</span>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <span
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blush-tint text-blush-deep"
            style={{ fontFamily: ff, fontWeight: 500 }}
          >
            ↑ 12%
          </span>
          <span
            className="text-xs text-foreground-muted"
            style={{ fontFamily: ff }}
          >
            vs. last month pace
          </span>
        </div>
      </div>

      {/* Headline */}
      <div className="py-7 border-b border-border">
        <div
          className="text-xl leading-tight tracking-[-0.02em] mb-2"
          style={{ fontFamily: ff, fontWeight: 600 }}
        >
          A quiet month, so far.
        </div>
        <p
          className="text-sm text-foreground-muted leading-relaxed"
          style={{ fontFamily: ff }}
        >
          21 days remain in June. Here&apos;s where the money has gone.
        </p>
      </div>

      {/* Sample row + button */}
      <div className="py-7 border-b border-border">
        <div className="flex items-center gap-3 mb-4">
          <span
            className="size-2 rounded-full"
            style={{ background: "var(--blush)" }}
          />
          <div className="flex-1 min-w-0">
            <div
              className="text-sm tracking-tight"
              style={{ fontFamily: ff, fontWeight: 500 }}
            >
              Groceries
            </div>
            <div
              className="text-[11px] text-foreground-faint mt-0.5"
              style={{ fontFamily: ff }}
            >
              Whole Foods · Trader Joe&apos;s
            </div>
          </div>
          <div className="mono tabular text-sm text-foreground">$487.20</div>
        </div>
        <button
          className="w-full h-10 rounded-full bg-sage-deep text-surface text-sm tracking-tight"
          style={{ fontFamily: ff, fontWeight: 500 }}
        >
          Add an account
        </button>
      </div>

      {/* Pros */}
      <div className="pt-6">
        <ul
          className="text-xs text-foreground-muted space-y-1.5"
          style={{ fontFamily: ff }}
        >
          {option.pros.map((p) => (
            <li key={p} className="flex gap-2">
              <span className="text-blush-deep mt-1">›</span>
              <span className="leading-relaxed">{p}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
