import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed",
          {
            "bg-amber-500 text-zinc-950 hover:bg-amber-400":
              variant === "primary",
            "bg-secondary text-secondary-foreground hover:bg-accent border border-border":
              variant === "secondary",
            "bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground":
              variant === "ghost",
            "bg-destructive text-destructive-foreground hover:opacity-90":
              variant === "danger",
            "px-3 py-1.5 text-sm": size === "sm",
            "px-4 py-2.5 text-sm": size === "md",
            "px-6 py-3.5 text-base": size === "lg",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
