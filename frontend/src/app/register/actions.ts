"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";
import { canSelfRegister, isAdminEmail } from "@/lib/auth-access";
import { registrationSchema } from "@/lib/credentials-schema";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}

export async function registerAction(formData: FormData) {
  const parsed = registrationSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    const code =
      field === "confirmPassword"
        ? "Mismatch"
        : field === "password"
          ? "Password"
          : field === "email"
            ? "Email"
            : "Name";
    redirect(`/register?error=${code}`);
  }

  const { name, email, password } = parsed.data;

  if (!canSelfRegister(email)) redirect("/register?error=Domain");

  // An allowlisted administrator address is provisioned, never self-served:
  // registering one would hand out the ADMIN role that ADMIN_EMAILS grants.
  if (isAdminEmail(email)) redirect("/register?error=Staff");

  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true, role: true, passwordHash: true },
  });

  if (existing) {
    // A row with no password is someone who used to sign in with Google, or
    // an account an administrator pre-provisioned. Students may claim theirs
    // here so they keep their profile, applications, and resumes. Anything
    // privileged is provisioned instead, because claiming it without proof
    // of the mailbox would be handing over the role attached to it.
    if (existing.passwordHash) redirect("/register?error=Exists");
    if (existing.role !== "STUDENT") redirect("/register?error=Staff");

    const teamMember = await db.teamMember.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    if (teamMember) redirect("/register?error=Staff");

    await db.user.update({
      where: { id: existing.id },
      data: { name, passwordHash: await hashPassword(password) },
    });
  } else {
    // A placement team member listed in the directory but without an account
    // is staff-to-be: their permissions come from /admin/users, so they must
    // not arrive as a self-registered student.
    const teamMember = await db.teamMember.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    if (teamMember) redirect("/register?error=Staff");

    try {
      await db.user.create({
        data: { name, email, passwordHash: await hashPassword(password), role: "STUDENT" },
      });
    } catch (error) {
      if (isUniqueViolation(error)) redirect("/register?error=Exists");
      throw error;
    }
  }

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  } catch (error) {
    if (error instanceof AuthError) redirect("/login?error=CredentialsSignin");
    throw error;
  }
}
