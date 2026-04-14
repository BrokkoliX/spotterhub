-- Upsert superuser for SpotterSpace
-- Run this via AWS Console → RDS → Query Editor
-- Or locally: psql "$DATABASE_URL"

INSERT INTO "User" (id, "cognitoSub", email, username, role, status, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'dev1-23a88ce7ff3f54deb36926bdc3b8e3a6',
  'robi_sz@yahoo.com',
  'robi_sz',
  'superuser',
  'active',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE
  SET "cognitoSub" = EXCLUDED."cognitoSub",
      role = EXCLUDED.role,
      "updatedAt" = NOW();
