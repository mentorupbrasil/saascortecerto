"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { Download, Share, X } from "lucide-react";

const DISMISS_KEY = "cortzo.pwa.dismissed";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-expect-error iOS Safari
    window.navigator.standalone === true
  );
}

function isIosSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua);
  const notChrome = !/CriOS|FxiOS|EdgiOS/.test(ua);
  return iOS && webkit && notChrome;
}

export function PwaRegister() {
  const [updateReady, setUpdateReady] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let reg: ServiceWorkerRegistration | null = null;
    navigator.serviceWorker
      .register("/sw.js")
      .then((r) => {
        reg = r;
        r.addEventListener("updatefound", () => {
          const worker = r.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateReady(r);
            }
          });
        });
      })
      .catch(() => {});

    return () => {
      void reg;
    };
  }, []);

  if (!updateReady) return null;

  return (
    <div
      className="fixed inset-x-0 z-[90] flex justify-center px-4"
      style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="flex w-full max-w-sm items-center gap-2 rounded-xl border border-border bg-card px-3 py-3 shadow-lg">
        <p className="flex-1 text-sm text-foreground">Nova versão disponível.</p>
        <Button
          size="sm"
          className="min-h-[40px]"
          onClick={() => {
            updateReady.waiting?.postMessage("SKIP_WAITING");
            window.location.reload();
          }}
        >
          Atualizar
        </Button>
      </div>
    </div>
  );
}

export function PwaInstallPrompt() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [deferred, setDeferred] = useState<Event | null>(null);
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      return;
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
    };
    window.addEventListener("beforeinstallprompt", onBip);

    const visits = Number(sessionStorage.getItem("cc.visits") || "0") + 1;
    sessionStorage.setItem("cc.visits", String(visits));

    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return;
    if (isStandalone()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      return;
    }
    if (pathname === "/login") return;

    const visits = Number(sessionStorage.getItem("cc.visits") || "0");
    const timer = window.setTimeout(() => {
      if (deferred) setShow(true);
      else if (isIosSafari() && visits >= 2) setIosHint(true);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [status, session, pathname, deferred]);

  function dismiss() {
    setShow(false);
    setIosHint(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  async function install() {
    const ev = deferred as unknown as {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string }>;
    };
    if (!ev?.prompt) return;
    await ev.prompt();
    const choice = await ev.userChoice;
    setShow(false);
    if (choice.outcome !== "accepted") dismiss();
    else {
      try {
        localStorage.setItem(DISMISS_KEY, "1");
      } catch {
        /* ignore */
      }
    }
  }

  if (!show && !iosHint) return null;

  return (
    <div
      className="fixed inset-x-0 z-[85] flex justify-center px-4 lg:justify-end lg:pr-6"
      style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-xl">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-foreground">Instalar {brand.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {iosHint
                ? "No iPhone/iPad: toque em Compartilhar e depois em “Adicionar à Tela de Início”."
                : "Acesse a agenda e as comandas como um app, direto da tela inicial."}
            </p>
          </div>
          <button
            type="button"
            className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-muted-foreground"
            aria-label="Dispensar"
            onClick={dismiss}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {iosHint ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Share className="h-4 w-4" /> Não há instalação automática no iOS.
          </p>
        ) : (
          <Button className="mt-2 w-full min-h-[44px]" onClick={install}>
            <Download className="h-4 w-4" /> Instalar app
          </Button>
        )}
      </div>
    </div>
  );
}
