import { CheckCircle2, Clock3, Scissors } from "lucide-react";

const WEEK_DAYS: { label: string; date: string; active?: boolean }[] = [
  { label: "D", date: "22" },
  { label: "S", date: "23" },
  { label: "T", date: "24" },
  { label: "Q", date: "25" },
  { label: "Q", date: "26", active: true },
  { label: "S", date: "27" },
  { label: "S", date: "28" },
];

const AGENDA = [
  { time: "09:00", client: "Marcos Lima", service: "Corte + Barba", status: "done" as const },
  { time: "09:30", client: "Pedro Alves", service: "Corte degradê", status: "done" as const },
  { time: "10:30", client: "Rafael Souza", service: "Barba", status: "current" as const },
  { time: "11:15", client: "João Pereira", service: "Corte + Sobrancelha", status: "upcoming" as const },
] as const;

function StatusIcon({ status }: { status: (typeof AGENDA)[number]["status"] }) {
  if (status === "done") {
    return <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />;
  }
  if (status === "current") {
    return <Clock3 className="h-4 w-4 text-primary animate-pulse" aria-hidden />;
  }
  return <Clock3 className="h-4 w-4 text-muted-foreground" aria-hidden />;
}

export function CortzoDashboardMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[440px] sm:max-w-[560px] lg:max-w-[640px]">
      <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-primary/25 via-primary/5 to-transparent blur-3xl" aria-hidden />

      <div className="card-elevated relative overflow-hidden rounded-3xl bg-card">
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-5 py-3">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
          </div>
          <span className="ml-2 text-[11px] tracking-wide text-muted-foreground">cortzo.app/agenda</span>
          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Ao vivo
          </span>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-primary">Hoje</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">Quinta, 26</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Faturamento do dia</p>
              <p className="text-lg font-semibold tabular-nums text-foreground">R$ 840,00</p>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {WEEK_DAYS.map((d) => (
              <div
                key={d.date}
                className={`flex flex-col items-center gap-1 rounded-xl py-2 text-center transition-colors ${
                  d.active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <span className="text-[9px] uppercase tracking-wide opacity-80">{d.label}</span>
                <span className="text-xs font-semibold">{d.date}</span>
              </div>
            ))}
          </div>

          <div className="space-y-2 rounded-2xl border border-border bg-muted/30 p-3">
            <div className="mb-1 flex items-center justify-between px-1">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Scissors className="h-3.5 w-3.5 text-primary" aria-hidden />
                Agenda de hoje
              </p>
              <span className="text-[10px] text-muted-foreground">4 atendimentos</span>
            </div>

            {AGENDA.map((item) => (
              <div
                key={item.time}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                  item.status === "current"
                    ? "border-primary/30 bg-primary/5"
                    : "border-transparent bg-card"
                }`}
              >
                <span className="w-11 shrink-0 text-xs font-semibold tabular-nums text-foreground">
                  {item.time}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">{item.client}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{item.service}</p>
                </div>
                <StatusIcon status={item.status} />
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <div className="flex-1 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
              <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Clientes hoje</p>
              <p className="text-sm font-semibold text-foreground">12</p>
            </div>
            <div className="flex-1 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
              <p className="text-[9px] uppercase tracking-wide text-primary/80">Retornos</p>
              <p className="text-sm font-semibold text-primary">3 pendentes</p>
            </div>
            <div className="flex-1 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
              <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Equipe ativa</p>
              <p className="text-sm font-semibold text-foreground">3</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
