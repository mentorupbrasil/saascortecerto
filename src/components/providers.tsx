"use client";

import { SessionProvider } from "next-auth/react";
import { PwaInstallPrompt, PwaRegister } from "@/components/pwa/pwa-install";
import { ThemeProvider } from "@/components/theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <SessionProvider>
        {children}
        <PwaRegister />
        <PwaInstallPrompt />
      </SessionProvider>
    </ThemeProvider>
  );
}
