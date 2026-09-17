import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient, Role } from "@prisma/client";
import { loadRootEnv } from "../src/load-root-env";

loadRootEnv();

const db = new PrismaClient();

// Matches STUDENT_EMAIL_DOMAIN's default (frontend/backend .env), which is
// what self-registration checks against. Roll numbers in the roster already
// use this domain for every row that has an institute address.
const STUDENT_EMAIL_DOMAIN = process.env.STUDENT_EMAIL_DOMAIN || "iiitl.ac.in";

type RosterRow = {
  email_id: string;
  full_name: string;
  roll_number: string;
  graduation_year: string;
  branch: string;
};

async function main() {
  const file = path.resolve(__dirname, "..", "..", "students_data.json");
  const raw = readFileSync(file, "utf8");
  const rows: RosterRow[] = JSON.parse(raw);

  const byRollNumber = new Map<string, RosterRow>();
  let duplicates = 0;
  for (const row of rows) {
    const rollNumber = row.roll_number.trim().toUpperCase();
    if (byRollNumber.has(rollNumber)) {
      duplicates++;
      continue;
    }
    byRollNumber.set(rollNumber, row);
  }

  let created = 0;
  let updated = 0;
  let derivedEmail = 0;

  for (const [rollNumber, row] of byRollNumber) {
    const givenEmail = row.email_id.trim().toLowerCase();
    const isInstituteEmail = givenEmail.endsWith(`@${STUDENT_EMAIL_DOMAIN.toLowerCase()}`);
    const email = isInstituteEmail ? givenEmail : `${rollNumber.toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`;
    const personalEmail = isInstituteEmail ? null : givenEmail;
    if (!isInstituteEmail) derivedEmail++;

    const data = {
      name: row.full_name.trim(),
      branch: row.branch.trim(),
      batch: Number.parseInt(row.graduation_year, 10),
      personalEmail,
    };

    const existing = await db.user.findUnique({ where: { rollNumber }, select: { id: true } });

    await db.user.upsert({
      where: { rollNumber },
      update: data,
      create: {
        ...data,
        email,
        rollNumber,
        role: Role.STUDENT,
        degree: "B.Tech",
        semGPAs: [],
      },
    });

    if (existing) updated++;
    else created++;
  }

  console.log(`Roster rows: ${rows.length} (${duplicates} duplicate row(s) skipped).`);
  console.log(`Institute accounts derived from roll number: ${derivedEmail}.`);
  console.log(`Created ${created}, updated ${updated} student account(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
