"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui";

// In-app replacements for the browser's confirm() and alert(), which show an
// unstyled native popup. Call them anywhere in client code:
//
//   if (await confirmDialog({ title: "Delete this rule?", danger: true })) ...
//   await alertDialog({ title: "Sync failed", body: message });
//
// <DialogHost /> is mounted once in the app layout and renders them as our
// Sheet: centered on desktop, a bottom sheet on phones.

type Request = {
  kind: "confirm" | "alert";
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
};

let enqueue: ((r: Request) => void) | null = null;

function ask(r: Omit<Request, "resolve">): Promise<boolean> {
  return new Promise((resolve) => {
    if (!enqueue) {
      console.error("DialogHost is not mounted; treating the dialog as cancelled.");
      resolve(false);
      return;
    }
    enqueue({ ...r, resolve });
  });
}

export function confirmDialog(opts: {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}): Promise<boolean> {
  return ask({ kind: "confirm", ...opts });
}

export function alertDialog(opts: { title: string; body?: string }): Promise<void> {
  return ask({ kind: "alert", ...opts }).then(() => undefined);
}

export function DialogHost() {
  const [queue, setQueue] = useState<Request[]>([]);

  useEffect(() => {
    enqueue = (r) => setQueue((q) => [...q, r]);
    return () => {
      enqueue = null;
    };
  }, []);

  const current = queue[0];
  if (!current) return null;

  const finish = (ok: boolean) => {
    current.resolve(ok);
    setQueue((q) => q.slice(1));
  };

  return (
    <Sheet open onClose={() => finish(false)} className="md:max-w-sm">
      <div role="alertdialog" aria-label={current.title}>
        <h3 className="display text-xl leading-snug">{current.title}</h3>
        {current.body && (
          <p className="mt-2 text-sm leading-relaxed text-foreground-muted">{current.body}</p>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {current.kind === "confirm" && (
            <Button variant="ghost" onClick={() => finish(false)}>
              {current.cancelLabel ?? "Cancel"}
            </Button>
          )}
          <Button
            autoFocus
            variant={current.danger ? "danger" : "primary"}
            onClick={() => finish(true)}
          >
            {current.kind === "alert" ? "OK" : (current.confirmLabel ?? "Continue")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
