"use client";

import { Scissors } from "lucide-react";
import { PageHeader, EmptyState, FixedActionBar } from "@/components/ui/page-chrome";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  ServiceFormModal,
  EditServiceModal,
  ToggleServiceButton,
  type ServiceData,
} from "@/components/services/service-form";

export function ServicesList({ services }: { services: ServiceData[] }) {
  return (
    <div className="space-y-4 pb-24 lg:pb-0">
      <PageHeader
        title="Serviços"
        description="Edite nomes, valores e duração"
        action={
          <div className="hidden lg:block">
            <ServiceFormModal />
          </div>
        }
      />

      <div className="grid gap-2 sm:grid-cols-2">
        {services.map((service) => (
          <EditServiceModal
            key={service.id}
            service={service}
            trigger={
              <button
                type="button"
                className={cn(
                  "w-full rounded-2xl border border-border bg-card/80 p-4 text-left transition-colors hover:border-amber-500/30 hover:bg-card active:bg-accent/50",
                  !service.active && "opacity-60"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">{service.name}</p>
                    <p className="mt-1 text-lg font-bold text-amber-400">
                      {formatCurrency(service.price)}
                    </p>
                    <p className="text-sm text-muted-foreground">{service.duration} min</p>
                  </div>
                  <ToggleServiceButton id={service.id} active={service.active} name={service.name} />
                </div>
              </button>
            }
          />
        ))}

        {services.length === 0 && (
          <div className="sm:col-span-2">
            <EmptyState
              title="Nenhum serviço cadastrado"
              description="Cadastre cortes, barba e outros serviços da barbearia."
              icon={<Scissors className="h-8 w-8" />}
              action={<ServiceFormModal />}
            />
          </div>
        )}
      </div>

      <FixedActionBar className="lg:hidden">
        <ServiceFormModal className="w-full" />
      </FixedActionBar>
    </div>
  );
}
