INSERT INTO "Tenant" (id, name, slug, plan, active, "subscribedAt", "createdAt", "updatedAt")
VALUES ('tenant_legacy_1', 'Barbearia Legacy', 'legacy-shop', 'PRO', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO "TenantSettings" (id, "tenantId") VALUES ('settings_legacy_1', 'tenant_legacy_1');
INSERT INTO "User" (id, email, "passwordHash", name, role, active, "tenantId", "createdAt", "updatedAt")
VALUES ('user_legacy_1', 'owner@legacy.test', 'hash', 'Owner Legacy', 'OWNER', true, 'tenant_legacy_1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO "Client" (id, "tenantId", name, phone, "returnDays", "whatsappOptIn", "createdAt", "updatedAt")
VALUES ('client_legacy_1', 'tenant_legacy_1', 'Cliente Legacy', '11999990000', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO "Service" (id, "tenantId", name, price, duration, active, "sortOrder", "createdAt")
VALUES ('service_legacy_1', 'tenant_legacy_1', 'Corte Legacy', 40.00, 30, true, 0, CURRENT_TIMESTAMP);
INSERT INTO "Appointment" (id, "tenantId", "clientId", "serviceId", "barberId", "scheduledAt", duration, price, status, "bookedOnline", "createdAt", "updatedAt")
VALUES ('appt_legacy_1', 'tenant_legacy_1', 'client_legacy_1', 'service_legacy_1', 'user_legacy_1', CURRENT_TIMESTAMP + INTERVAL '1 day', 30, 40.00, 'SCHEDULED', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
