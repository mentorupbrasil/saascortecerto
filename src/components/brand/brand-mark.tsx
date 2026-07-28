import { cn } from "@/lib/utils";

/** Vector brand mark — scissors/cut stylized with Supabase green */
export function BrandMark({
  className,
  title = "CorteCerto",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-2xl bg-[#72e3ad] text-[#1e2723]",
        className
      )}
      role="img"
      aria-label={title}
    >
      <svg
        viewBox="0 0 48 48"
        className="h-[60%] w-[60%]"
        fill="none"
        aria-hidden
      >
        <path
          d="M14 12a6 6 0 1 1-4.2 10.2L24 30l14.2-7.8A6 6 0 1 1 34 12L24 22 14 12Z"
          fill="currentColor"
          opacity="0.95"
        />
        <circle cx="12" cy="14" r="5" stroke="currentColor" strokeWidth="2.5" fill="none" />
        <circle cx="36" cy="14" r="5" stroke="currentColor" strokeWidth="2.5" fill="none" />
        <path
          d="M24 22v16"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
