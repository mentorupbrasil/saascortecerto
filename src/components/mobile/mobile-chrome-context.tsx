"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type MobileChromeContextValue = {
  tabBarHidden: boolean;
  hideTabBar: () => void;
  showTabBar: () => void;
  moreOpen: boolean;
  setMoreOpen: (open: boolean) => void;
};

const MobileChromeContext = createContext<MobileChromeContextValue | null>(null);

export function MobileChromeProvider({ children }: { children: ReactNode }) {
  const [hideCount, setHideCount] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);

  const hideTabBar = useCallback(() => setHideCount((c) => c + 1), []);
  const showTabBar = useCallback(() => setHideCount((c) => Math.max(0, c - 1)), []);

  const value = useMemo(
    () => ({
      tabBarHidden: hideCount > 0,
      hideTabBar,
      showTabBar,
      moreOpen,
      setMoreOpen,
    }),
    [hideCount, hideTabBar, showTabBar, moreOpen]
  );

  return (
    <MobileChromeContext.Provider value={value}>{children}</MobileChromeContext.Provider>
  );
}

export function useMobileChrome() {
  const ctx = useContext(MobileChromeContext);
  if (!ctx) {
    return {
      tabBarHidden: false,
      hideTabBar: () => {},
      showTabBar: () => {},
      moreOpen: false,
      setMoreOpen: () => {},
    };
  }
  return ctx;
}
