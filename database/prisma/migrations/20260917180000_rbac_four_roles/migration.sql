-- Collapses the five-tier role hierarchy into four roles.
--
-- Postgres cannot drop a value from an enum, so the type is rebuilt and the
-- column cast through an explicit mapping. The mapping is written by hand
-- because Prisma's generated cast would drop rows holding a removed value:
--   COORDINATOR -> PLACEMENT_VOLUNTEER
--   OFFICER     -> PLACEMENT_TEAM
--   ADMIN       -> SUPER_ADMIN   (the only ADMIN row is the bootstrap office
--                                 account, already all-powerful via ADMIN_EMAILS)
--
-- customPermissions is left alone: no row holds any at the time of this
-- migration, and the new catalog ignores keys it does not recognise.

BEGIN;

CREATE TYPE "Role_new" AS ENUM ('STUDENT', 'PLACEMENT_VOLUNTEER', 'PLACEMENT_TEAM', 'SUPER_ADMIN');

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING (
  CASE "role"::text
    WHEN 'COORDINATOR' THEN 'PLACEMENT_VOLUNTEER'
    WHEN 'OFFICER' THEN 'PLACEMENT_TEAM'
    WHEN 'ADMIN' THEN 'SUPER_ADMIN'
    ELSE "role"::text
  END
)::"Role_new";

ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";

ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'STUDENT';

COMMIT;
