-- Upsert superuser for SpotterSpace
-- Run this via AWS Console → RDS → Query Editor
-- Or locally: psql "$DATABASE_URL"
--
-- Dev login credentials:
--   email:    robi_sz@yahoo.com
--   password: superpass123

INSERT INTO "User" (id, "cognitoSub", email, username, role, status, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'dev1-623683303765a52924e16c6e9149bedc',
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
