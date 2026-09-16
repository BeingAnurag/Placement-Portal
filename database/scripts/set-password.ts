/**
 * Sets a sign-in password for one account, from the server shell.
 *
 * Passwords are the only way into the portal, and the accounts seeded from
 * ADMIN_EMAILS start without one, so this is the bootstrap: it gives the
 * first administrator a password, after which everyone else can be
 * provisioned from /admin/users. Shell access to the deployment is the root
 * of trust here, which is why the script is not reachable over HTTP.
 *
 *   npm run db:set-password -- someone@iiitl.ac.in
 *
 * The password is read from stdin rather than argv so it does not land in
 * shell history or in the process list.
 */
import { createInterface } from "node:readline/promises";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { loadRootEnv } from "../src/load-root-env";

loadRootEnv();

const BCRYPT_COST = 10;
const MIN_LENGTH = 10;

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: npm run db:set-password -- <email>");
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    if (!user) {
      console.error(`No account exists for ${email}. Seed it or create it from /admin/users first.`);
      process.exitCode = 1;
      return;
    }

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const password = (await rl.question(`New password for ${email}: `)).trim();
    const confirm = (await rl.question("Confirm password: ")).trim();
    rl.close();

    if (password !== confirm) {
      console.error("Passwords do not match.");
      process.exitCode = 1;
      return;
    }
    if (password.length < MIN_LENGTH || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      console.error(
        `Use at least ${MIN_LENGTH} characters with at least one letter and one number.`,
      );
      process.exitCode = 1;
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hash(password, BCRYPT_COST) },
    });

    console.log(`Password set for ${user.email} (role ${user.role}).`);
    if (!user.isActive) {
      console.log("Note: this account is suspended and cannot sign in until it is reactivated.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
