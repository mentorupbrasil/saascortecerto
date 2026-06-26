import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    SCHEDULED: { label: "Agendado", className: "bg-zinc-700 text-zinc-300" },
    CONFIRMED: { label: "Confirmado", className: "bg-blue-500/20 text-blue-400" },
    COMPLETED: { label: "Concluído", className: "bg-green-500/20 text-green-400" },
    CANCELLED: { label: "Cancelado", className: "bg-red-500/20 text-red-400" },
    NO_SHOW: { label: "Faltou", className: "bg-orange-500/20 text-orange-400" },
  };

  const c = config[status] ?? config.SCHEDULED;

  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", c.className)}>
      {c.label}
    </span>
  );
}
