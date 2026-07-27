/**
 * Test data factories — stubs for unit/integration tests.
 * Expand as integration tests are implemented.
 */

export type FactoryOverrides<T> = Partial<T>;

export function buildTenant(overrides: Record<string, unknown> = {}) {
  return {
    id: "tenant-test-1",
    name: "Barbearia Teste",
    slug: "barbearia-teste",
    plan: "PRO" as const,
    active: true,
    ...overrides,
  };
}

export function buildUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-test-1",
    email: "owner@test.com",
    name: "Owner Test",
    role: "OWNER" as const,
    active: true,
    tenantId: "tenant-test-1",
    ...overrides,
  };
}

export function buildTenantSettings(overrides: Record<string, unknown> = {}) {
  return {
    id: "settings-test-1",
    tenantId: "tenant-test-1",
    whatsappEnabled: false,
    publicBookingEnabled: true,
    ...overrides,
  };
}
