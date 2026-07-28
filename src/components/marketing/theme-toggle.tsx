"use client";

import * as React from "react";
import { Moon, Settings, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

type ThemeChoice = "light" | "dark" | "system";

interface ThemeToggleProps {
  className?: string;
  /** Icon-only — good for compact headers and mobile menus */
  compact?: boolean;
}

function ThemeButton({
  active,
  onClick,
  label,
  icon: Icon,
  position,
  compact,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: typeof Sun;
  position: "first" | "middle" | "last";
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "group flex items-center gap-1.5 transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        compact ? "px-2 py-1.5" : "px-2 py-1.5 sm:px-2.5",
        position === "first" && "rounded-l-md border-r border-border/80",
        position === "middle" && "border-r border-border/80",
        position === "last" && "rounded-r-md",
        active
          ? "bg-accent text-foreground shadow-sm"
          : "bg-transparent text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      )}
    >
      <Icon
        className="h-3.5 w-3.5 shrink-0 transition-transform duration-300 group-hover:scale-110"
        aria-hidden
      />
      {!compact && <span className="hidden select-none text-xs font-medium sm:inline">{label}</span>}
    </button>
  );
}

export function ThemeToggle({ className, compact = false }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div
        className={cn(
          "inline-flex animate-pulse rounded-md border border-border bg-muted/40",
          compact ? "h-8 w-[6.25rem]" : "h-8 w-28 sm:w-[7.75rem]",
          className
        )}
        aria-hidden
      />
    );
  }

  const current = (theme ?? "system") as ThemeChoice;

  const items: { id: ThemeChoice; label: string; icon: typeof Sun; position: "first" | "middle" | "last" }[] = [
    { id: "light", label: "Claro", icon: Sun, position: "first" },
    { id: "dark", label: "Escuro", icon: Moon, position: "middle" },
    { id: "system", label: "Sistema", icon: Settings, position: "last" },
  ];

  return (
    <div
      className={cn(
        "relative inline-flex overflow-hidden rounded-md border border-border/80 bg-card/60 shadow-sm shadow-black/5 backdrop-blur-md transition-colors duration-500 dark:bg-card/40 dark:shadow-black/20",
        className
      )}
      role="group"
      aria-label="Tema da interface"
    >
      {items.map((item) => (
        <ThemeButton
          key={item.id}
          active={current === item.id}
          onClick={() => setTheme(item.id)}
          label={item.label}
          icon={item.icon}
          position={item.position}
          compact={compact}
        />
      ))}
    </div>
  );
}
