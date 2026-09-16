"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canUsePasswordAccount } from "@/lib/auth-access";
import { setPasswordSchema } from "@/lib/credentials-schema";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";

export async function setPasswordAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const parsed = setPasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword") || undefined,
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    redirect(`/account/password?error=${field === "confirmPassword" ? "Mismatch" : "Password"}`);
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, passwordHash: true },
  });
  if (!user) redirect("/login");

  // Password sign-in is institute-only, so an external administrator would be
  // setting a password they could never use.
  if (!canUsePasswordAccount(user.email)) redirect("/account/password?error=Domain");

  if (user.passwordHash) {
    const current = parsed.data.currentPassword ?? "";
    if (!current || !(await verifyPassword(current, user.passwordHash))) {
      redirect("/account/password?error=Current");
    }
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { passwordHash: await hashPassword(parsed.data.password) },
  });

  redirect("/account/password?status=saved");
}
