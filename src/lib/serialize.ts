export function toNumber(value: { toString(): string } | number | string) {
  return typeof value === "number" ? value : Number(value);
}

export function serializeService(service: {
  id: string;
  name: string;
  price: { toString(): string } | number;
  duration: number;
}) {
  return {
    id: service.id,
    name: service.name,
    price: toNumber(service.price),
    duration: service.duration,
  };
}

export function serializeServices(
  services: Parameters<typeof serializeService>[0][]
) {
  return services.map(serializeService);
}

export function serializeClientForForm(client: {
  id: string;
  name: string;
  phone: string;
  birthday: Date | null;
  notes: string | null;
  returnDays: number;
  photoUrl?: string | null;
}) {
  return {
    id: client.id,
    name: client.name,
    phone: client.phone,
    birthday: client.birthday ? client.birthday.toISOString() : null,
    notes: client.notes,
    returnDays: client.returnDays,
    photoUrl: client.photoUrl ?? null,
  };
}

export function serializePlanForClient(plan: {
  id: string;
  name: string;
  description: string | null;
  price: { toString(): string } | number;
  billingCycle: string;
  planType: string;
  maxVisitsPerMonth: number | null;
  totalVisits: number | null;
  allowedWeekdays: string;
  bonusAfterVisits: number | null;
  bonusDescription: string | null;
  active: boolean;
  _count?: { memberships: number };
}) {
  return {
    ...plan,
    price: toNumber(plan.price),
  };
}

export function serializeMembershipForClient(m: {
  id: string;
  status: string;
  startedAt: Date;
  expiresAt: Date | null;
  visitsUsedThisPeriod: number;
  totalVisitsUsed: number;
  bonusEarned: number;
  client: { id: string; name: string; phone: string; photoUrl: string | null };
  plan: Parameters<typeof serializePlanForClient>[0];
}) {
  return {
    id: m.id,
    status: m.status,
    startedAt: m.startedAt.toISOString(),
    expiresAt: m.expiresAt?.toISOString() ?? null,
    visitsUsedThisPeriod: m.visitsUsedThisPeriod,
    totalVisitsUsed: m.totalVisitsUsed,
    bonusEarned: m.bonusEarned,
    client: m.client,
    plan: serializePlanForClient(m.plan),
  };
}
