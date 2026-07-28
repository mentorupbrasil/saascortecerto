"use client";

import { SessionProvider } from "next-auth/react";
import { PwaInstallPrompt, PwaRegister } from "@/components/pwa/pwa-install";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <PwaRegister />
      <PwaInstallPrompt />
    </SessionProvider>
  );
}
