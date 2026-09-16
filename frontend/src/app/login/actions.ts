"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";
import { passwordLoginSchema } from "@/lib/credentials-schema";

export async function passwordSignInAction(formData: FormData) {
  const parsed = passwordLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  // A malformed address and a wrong password report the same thing, so the
  // form never confirms which institute addresses have accounts.
  if (!parsed.success) redirect("/login?error=CredentialsSignin");

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    // A successful sign-in also leaves through this catch: redirects travel
    // as thrown errors in Next, and only an AuthError means a failed attempt.
    if (error instanceof AuthError) redirect("/login?error=CredentialsSignin");
    throw error;
  }
}
