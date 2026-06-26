export function LandingHeroPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[420px] sm:max-w-[520px] lg:max-w-none">
      <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-[var(--gold)]/20 via-transparent to-transparent blur-3xl opacity-60" />

      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c0c0c]/90 shadow-[0_32px_80px_-20px_rgba(0,0,0,0.8)] backdrop-blur-sm">
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-3">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
          </div>
          <span className="ml-2 text-[11px] text-zinc-600 tracking-wide">cortecerto.app/agenda</span>
        </div>

        <div className="p-4 sm:p-5 space-y-3 sm:space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--gold)]">Hoje</p>
              <p className="font-display text-2xl text-white mt-1">Quinta, 26</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Faturamento</p>
              <p className="text-lg font-medium text-white tabular-nums">R$ 840</p>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
              <div
                key={i}
                className={`text-center text-[9px] py-1 rounded ${
                  i === 4 ? "bg-[var(--gold)]/15 text-[var(--gold)]" : "text-zinc-600"
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          <div className="relative h-36 rounded-xl border border-white/[0.04] bg-[#080808] overflow-hidden">
            <div className="absolute inset-0 landing-grid-lines opacity-40" />
            {[
              { top: "12%", height: "22%", left: "14%", label: "09:00", name: "Marcos" },
              { top: "38%", height: "18%", left: "42%", label: "10:30", name: "Rafa" },
              { top: "20%", height: "28%", left: "70%", label: "09:30", name: "Pedro" },
            ].map((block) => (
              <div
                key={block.name}
                className="absolute w-[22%] rounded-md border border-[var(--gold)]/25 bg-[var(--gold)]/10 px-1.5 py-1"
                style={{ top: block.top, height: block.height, left: block.left }}
              >
                <p className="text-[8px] text-[var(--gold)]">{block.label}</p>
                <p className="text-[9px] text-white truncate">{block.name}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <div className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <p className="text-[9px] text-zinc-600">Clientes hoje</p>
              <p className="text-sm font-medium text-white">12</p>
            </div>
            <div className="flex-1 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
              <p className="text-[9px] text-emerald-600/80">Retornos</p>
              <p className="text-sm font-medium text-emerald-400">3 pendentes</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
