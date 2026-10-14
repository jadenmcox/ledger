// Shown the instant you tap a tab, while the page's data loads. Shaped like
// every page (title, a summary card, a list) so the swap-in doesn't jump.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse">
      <div className="px-5 pb-4 pt-6 md:px-12 md:pb-10 md:pt-14">
        <div className="mb-3 h-2.5 w-24 rounded-full bg-foreground/8" />
        <div className="h-9 w-56 rounded-xl bg-foreground/10 md:h-11 md:w-72" />
        <div className="mt-3 h-3.5 w-full max-w-md rounded-full bg-foreground/6" />
      </div>
      <div className="space-y-7 px-5 md:px-12">
        <div className="h-56 rounded-card bg-surface/80 md:h-72" />
        <div className="space-y-px overflow-hidden rounded-card">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-3.5 bg-surface/80 px-5 py-4">
              <div className="size-9 rounded-[10px] bg-foreground/8" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 rounded-full bg-foreground/10" />
                <div className="h-2.5 w-1/4 rounded-full bg-foreground/6" />
              </div>
              <div className="h-3 w-16 rounded-full bg-foreground/10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
