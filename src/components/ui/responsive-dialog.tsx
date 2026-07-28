"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMobileChrome } from "@/components/mobile/mobile-chrome-context";

type ResponsiveDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** full = mobile fullscreen sheet; sheet = bottom sheet; dialog = centered */
  mobileVariant?: "full" | "sheet";
  dirty?: boolean;
  className?: string;
};

export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  mobileVariant = "full",
  dirty = false,
  className,
}: ResponsiveDialogProps) {
  const titleId = useId();
  const { hideTabBar, showTabBar } = useMobileChrome();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    hideTabBar();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => {
      showTabBar();
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function requestClose() {
    if (dirty) {
      const ok = window.confirm("Descartar alterações não salvas?");
      if (!ok) return;
    }
    onOpenChange(false);
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Fechar"
        onClick={requestClose}
      />

      {/* Desktop dialog */}
      <div
        className={cn(
          "absolute left-1/2 top-1/2 hidden w-[min(100vw-2rem,32rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl lg:flex",
          "max-h-[min(90vh,720px)]",
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panelRef}
        tabIndex={-1}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-foreground">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="shrink-0 border-t border-border px-5 py-4">{footer}</footer>
        )}
      </div>

      {/* Mobile */}
      <div
        className={cn(
          "absolute inset-x-0 flex flex-col bg-card lg:hidden",
          mobileVariant === "full"
            ? "inset-y-0 h-dvh"
            : "bottom-0 max-h-[92dvh] rounded-t-2xl border-t border-border"
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${titleId}-m`}
      >
        <header
          className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3 safe-top"
        >
          <div className="min-w-0">
            <h2 id={`${titleId}-m`} className="truncate text-base font-semibold text-foreground">
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-accent min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && (
          <footer
            className="shrink-0 border-t border-border px-4 py-3"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          >
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body
  );
}

/** Alias used by product specs */
export const MobileSheet = ResponsiveDialog;
