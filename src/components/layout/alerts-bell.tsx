"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, Calendar, CreditCard, Globe, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TenantAlert } from "@/lib/alerts";

const READ_KEY = "cortzo.alerts.read";

function loadReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>) {
  try {
    const trimmed = [...ids].slice(-80);
    localStorage.setItem(READ_KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore */
  }
}

function KindIcon({ kind }: { kind: TenantAlert["kind"] }) {
  const className = "h-4 w-4 shrink-0";
  switch (kind) {
    case "billing":
      return <CreditCard className={className} />;
    case "pending_pix":
      return <Wallet className={className} />;
    case "online_booking":
      return <Globe className={className} />;
    default:
      return <Calendar className={className} />;
  }
}

export function AlertsBell({
  alerts,
  compact = false,
}: {
  alerts: TenantAlert[];
  /** Icon-only for collapsed sidebar */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setReadIds(loadReadIds());
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unreadCount = useMemo(
    () => alerts.filter((a) => !readIds.has(a.id)).length,
    [alerts, readIds]
  );

  const markAllRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev);
      for (const alert of alerts) next.add(alert.id);
      saveReadIds(next);
      return next;
    });
  }, [alerts]);

  const markOneRead = useCallback((id: string) => {
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      saveReadIds(next);
      return next;
    });
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative flex items-center justify-center rounded-xl border border-border bg-card text-foreground transition-colors hover:bg-zinc-800",
          compact ? "h-10 w-10" : "min-h-[44px] min-w-[44px]"
        )}
        aria-label={
          unreadCount > 0
            ? `Alertas, ${unreadCount} não lidos`
            : "Alertas"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-zinc-950">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Central de alertas"
          className={cn(
            "absolute z-50 mt-2 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-2xl border border-border bg-zinc-950 shadow-xl",
            compact ? "left-0" : "right-0"
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Alertas</p>
              <p className="text-xs text-zinc-500">
                {alerts.length === 0
                  ? "Nada pendente agora"
                  : unreadCount > 0
                    ? `${unreadCount} sem ler`
                    : "Tudo lido"}
              </p>
            </div>
            {alerts.length > 0 && unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-foreground"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Marcar lidas
              </button>
            )}
          </div>

          <ul className="max-h-[min(70vh,24rem)] overflow-y-auto">
            {alerts.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-zinc-500">
                Sem alertas no momento.
              </li>
            ) : (
              alerts.map((alert) => {
                const unread = !readIds.has(alert.id);
                return (
                  <li key={alert.id} className="border-b border-border/60 last:border-0">
                    <Link
                      href={alert.href}
                      onClick={() => {
                        markOneRead(alert.id);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex gap-3 px-4 py-3 transition-colors hover:bg-zinc-900",
                        unread && "bg-amber-500/5"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg",
                          alert.severity === "critical" && "bg-red-500/15 text-red-300",
                          alert.severity === "warning" && "bg-amber-500/15 text-amber-300",
                          alert.severity === "info" && "bg-zinc-800 text-zinc-300"
                        )}
                      >
                        <KindIcon kind={alert.kind} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {alert.title}
                          </span>
                          {unread && (
                            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                          )}
                        </span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-zinc-400">
                          {alert.body}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
