-- College ID card, following the Aadhaar/PAN identity-document pattern:
-- the card number is encrypted at rest and the scan is stored encrypted on
-- disk, with the number acting as the challenge that unlocks it.
--
-- Purely additive and nullable, so existing rows are untouched and no student
-- becomes incomplete by this migration.
ALTER TABLE "User" ADD COLUMN "collegeIdEncrypted" TEXT;
ALTER TABLE "User" ADD COLUMN "collegeIdDocUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "collegeIdDocFileName" TEXT;
