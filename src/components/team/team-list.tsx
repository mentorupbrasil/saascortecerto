"use client";

import { Users } from "lucide-react";
import { PageHeader, EmptyState, FixedActionBar } from "@/components/ui/page-chrome";
import { ROLE_LABELS, type UserRole } from "@/lib/auth-utils";
import { cn } from "@/lib/utils";
import { TeamUserForm, EditUserModal, TeamAvatar } from "@/components/team/team-form";
import { ToggleUserButton } from "@/components/team/toggle-user";

const ROLE_BLURBS: Partial<Record<UserRole, string>> = {
  BARBER: "Agenda própria, atendimentos e comandas",
  RECEPTIONIST: "Agenda geral, clientes e recepção",
  MANAGER: "Operação completa, exceto gestão de equipe",
  OWNER: "Acesso total à barbearia",
};

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
};

export function TeamList({
  members,
  tenantName,
  tenantId,
  currentUserId,
}: {
  members: TeamMember[];
  tenantName: string;
  tenantId: string;
  currentUserId: string;
}) {
  return (
    <div className="space-y-4 pb-24 lg:pb-0">
      <PageHeader
        title="Equipe"
        description={`${tenantName} · edite usuários e funções`}
        action={
          <div className="hidden lg:block">
            <TeamUserForm tenantId={tenantId} />
          </div>
        }
      />

      <div className="space-y-2">
        {members.map((member) => {
          const isSelf = member.id === currentUserId;
          const role = member.role as UserRole;

          return (
            <EditUserModal
              key={member.id}
              member={member}
              isSelf={isSelf}
              trigger={
                <button
                  type="button"
                  className={cn(
                    "w-full rounded-2xl border border-border bg-card/80 p-4 text-left transition-colors hover:border-amber-500/30 hover:bg-card active:bg-accent/50",
                    !member.active && "opacity-60"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <TeamAvatar name={member.name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">
                            {member.name}
                            {isSelf && (
                              <span className="ml-2 text-xs font-normal text-muted-foreground">(você)</span>
                            )}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">{member.email}</p>
                        </div>
                        {!isSelf ? (
                          <ToggleUserButton
                            userId={member.id}
                            active={member.active}
                            name={member.name}
                          />
                        ) : (
                          <span className="inline-flex min-h-[44px] items-center rounded-full bg-emerald-500/20 px-3 text-xs font-semibold uppercase tracking-wide text-emerald-400">
                            Ativo
                          </span>
                        )}
                      </div>
                      <span className="mt-2 inline-block rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-medium text-amber-400">
                        {ROLE_LABELS[role]}
                      </span>
                      {ROLE_BLURBS[role] && (
                        <p className="mt-1.5 text-xs text-muted-foreground">{ROLE_BLURBS[role]}</p>
                      )}
                    </div>
                  </div>
                </button>
              }
            />
          );
        })}

        {members.length === 0 && (
          <EmptyState
            title="Nenhum usuário na equipe"
            description="Convide barbeiros, recepcionistas e gerentes."
            icon={<Users className="h-8 w-8" />}
            action={<TeamUserForm tenantId={tenantId} />}
          />
        )}
      </div>

      <FixedActionBar className="lg:hidden">
        <TeamUserForm tenantId={tenantId} className="w-full" />
      </FixedActionBar>
    </div>
  );
}
