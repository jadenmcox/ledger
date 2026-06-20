"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// Mobile bottom-sheet / desktop modal.
// On <md screens the panel slides up from the bottom with a drag handle and
// safe-area padding. On md+ it sits centered like a regular dialog.
export function Sheet({
  open,
  onClose,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const downOnBackdrop = useRef(false);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex md:items-center justify-center items-end animate-in fade-in duration-150"
      onMouseDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget;
      }}
      onMouseUp={(e) => {
        if (downOnBackdrop.current && e.target === e.currentTarget) onClose();
        downOnBackdrop.current = false;
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className={cn(
          // Mobile: full-width bottom sheet
          "w-full bg-surface border-t md:border border-border",
          "rounded-t-3xl md:rounded-2xl",
          "pb-[max(env(safe-area-inset-bottom),1.25rem)] md:pb-6",
          "pt-2 md:pt-6 px-5 md:px-6",
          "max-h-[92vh] md:max-h-[85vh] md:max-w-md overflow-y-auto",
          "shadow-[0_-12px_40px_-12px] shadow-foreground/20 md:shadow-none",
          "animate-in slide-in-from-bottom-4 md:slide-in-from-bottom-0 md:zoom-in-95 duration-200",
          className,
        )}
      >
        {/* Drag handle (mobile only) */}
        <div className="md:hidden flex justify-center mb-3">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>
        {children}
      </div>
    </div>
  );
}
