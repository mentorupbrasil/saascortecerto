import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
  hover,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5",
        hover && "transition-colors hover:border-zinc-700 hover:bg-zinc-900",
        className
      )}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <Card className={cn(accent && "border-amber-500/30 bg-amber-500/5")}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-zinc-400">{label}</p>
          <p className={cn("mt-1 text-2xl font-bold", accent ? "text-amber-400" : "text-white")}>
            {value}
          </p>
        </div>
        {icon && <div className="text-zinc-500">{icon}</div>}
      </div>
    </Card>
  );
}
