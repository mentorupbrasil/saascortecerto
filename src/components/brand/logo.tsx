import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type LogoProps = {
  variant?: "full" | "compact" | "icon";
  href?: string | null;
  className?: string;
  priority?: boolean;
};

const variantStyles = {
  full: "h-10 sm:h-11 w-auto",
  compact: "h-8 w-auto",
  icon: "h-9 w-9 sm:h-10 sm:w-10 rounded-lg object-cover object-left",
};

export function Logo({ variant = "full", href = "/", className, priority }: LogoProps) {
  const image = (
    <Image
      src="/logo.png"
      alt="CorteCerto"
      width={variant === "icon" ? 40 : 220}
      height={variant === "icon" ? 40 : 56}
      priority={priority}
      className={cn(variantStyles[variant], className)}
    />
  );

  if (href === null) return image;

  return (
    <Link href={href} className="inline-flex shrink-0 items-center">
      {image}
    </Link>
  );
}
