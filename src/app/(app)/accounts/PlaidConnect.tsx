"use client";

import { useCallback, useEffect, useState } from "react";
import {
  usePlaidLink,
  type PlaidLinkOnSuccessMetadata,
} from "react-plaid-link";
import { Button, Card, Label, Pill } from "@/components/ui";
import { Banknote, RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

export type PlaidItemRow = {
  id: number;
  institutionName: string | null;
  lastSyncedAt: Date | null;
  lastError: string | null;
  accountCount: number;
};

export function PlaidConnectButton() {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const fetchLinkToken = useCallback(async () => {
    const res = await fetch("/api/plaid/link-token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) return;
    const data = await res.json().catch(() => ({}));
    if (data.link_token) setLinkToken(data.link_token);
  }, []);

  useEffect(() => {
    fetchLinkToken();
  }, [fetchLinkToken]);

  const onSuccess = useCallback(
    async (public_token: string, metadata: PlaidLinkOnSuccessMetadata) => {
      setBusy("Linking...");
      try {
        const res = await fetch("/api/plaid/exchange", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            public_token,
            institution: metadata.institution,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert("Plaid exchange failed: " + (err.error ?? res.statusText));
        }
        router.refresh();
        fetchLinkToken();
      } finally {
        setBusy(null);
      }
    },
    [router, fetchLinkToken],
  );

  const { open, ready } = usePlaidLink({ token: linkToken, onSuccess });

  return (
    <div className="flex justify-end">
      <Button
        type="button"
        variant="primary"
        onClick={() => open()}
        disabled={!ready || !linkToken || !!busy}
      >
        <Banknote className="size-4" strokeWidth={1.5} />
        {busy ?? "Connect bank"}
      </Button>
    </div>
  );
}

export function PlaidItemsList({ items }: { items: PlaidItemRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const sync = async (itemRowId?: number) => {
    setBusy(itemRowId ? `Syncing ${itemRowId}...` : "Syncing all...");
    try {
      const res = await fetch("/api/plaid/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(itemRowId ? { itemRowId } : {}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert("Sync failed: " + (err.error ?? res.statusText));
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  if (items.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <Label>Linked banks</Label>
          <span className="text-[10px] tracking-[0.2em] uppercase text-foreground-faint">
            {items.length}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => sync()}
          disabled={!!busy}
        >
          <RefreshCw className="size-4" strokeWidth={1.5} />
          Sync all
        </Button>
      </div>

      <Card className="divide-y divide-border">
        {items.map((it) => (
          <div
            key={it.id}
            className="px-5 py-4 flex items-center gap-4 group"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-3 mb-1">
                <span className="tracking-tight">
                  {it.institutionName ?? "Unknown institution"}
                </span>
                <Pill>{it.accountCount} accounts</Pill>
                {it.lastError && <Pill>error</Pill>}
              </div>
              <div className="text-xs text-foreground-faint">
                {it.lastSyncedAt
                  ? `Last sync ${format(new Date(it.lastSyncedAt), "MMM d, h:mm a")}`
                  : "Not synced yet"}
                {it.lastError ? ` — ${it.lastError}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => sync(it.id)}
                className="size-8 inline-flex items-center justify-center text-foreground-faint hover:text-foreground rounded-md hover:bg-surface-2"
                title="Sync now"
                disabled={!!busy}
              >
                <RefreshCw className="size-3.5" strokeWidth={1.5} />
              </button>
              <button
                onClick={async () => {
                  if (
                    !confirm(
                      "Disconnect this bank? Linked accounts and synced transactions stay; future syncs stop.",
                    )
                  )
                    return;
                  setBusy("Disconnecting...");
                  try {
                    const res = await fetch(`/api/plaid/items/${it.id}`, {
                      method: "DELETE",
                    });
                    if (!res.ok) alert("Disconnect failed");
                    router.refresh();
                  } finally {
                    setBusy(null);
                  }
                }}
                className="size-8 inline-flex items-center justify-center text-foreground-faint hover:text-blush-deep rounded-md hover:bg-surface-2"
                title="Disconnect"
                disabled={!!busy}
              >
                <Trash2 className="size-3.5" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
