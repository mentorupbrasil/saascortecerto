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
        "rounded-2xl border border-border bg-card/80 p-5 text-card-foreground",
        hover && "transition-colors hover:border-border hover:bg-card",
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
          <p className="text-sm text-muted-foreground">{label}</p>
          <p
            className={cn(
              "mt-1 text-2xl font-bold",
              accent ? "text-amber-400" : "text-foreground"
            )}
          >
            {value}
          </p>
        </div>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
    </Card>
  );
}
