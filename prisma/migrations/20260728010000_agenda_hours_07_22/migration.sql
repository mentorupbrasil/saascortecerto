-- Align agenda / shop hours defaults to 07:00–22:00
ALTER TABLE "TenantSettings" ALTER COLUMN "openTime" SET DEFAULT '07:00';
ALTER TABLE "TenantSettings" ALTER COLUMN "closeTime" SET DEFAULT '22:00';

UPDATE "TenantSettings"
SET "openTime" = '07:00',
    "closeTime" = '22:00'
WHERE "openTime" = '08:00'
  AND "closeTime" = '20:00';
