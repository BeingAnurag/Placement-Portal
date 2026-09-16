import { AlertCircle, ArrowLeft, CheckCircle2, KeyRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canUsePasswordAccount, studentEmailDomain } from "@/lib/auth-access";
import { MIN_PASSWORD_LENGTH } from "@/lib/credentials-schema";
import { db } from "@/lib/db";
import { isElevatedRole } from "@/lib/permissions";
import { setPasswordAction } from "./actions";

function describeError(code: string | undefined, domain: string) {
  if (!code) return null;
  if (code === "Current") {
    return { title: "That current password is wrong", body: "Re-enter the password you sign in with today." };
  }
  if (code === "Mismatch") {
    return { title: "Passwords do not match", body: "Enter the same new password in both fields." };
  }
  if (code === "Domain") {
    return {
      title: "This account cannot use a password",
      body: `Sign-in is limited to @${domain} addresses and to allowlisted administrator addresses.`,
    };
  }
  return {
    title: "Choose a stronger password",
    body: `Use at least ${MIN_PASSWORD_LENGTH} characters with at least one letter and one number.`,
  };
}

export default async function AccountPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; status?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, passwordHash: true },
  });
  if (!user) redirect("/login");

  const domain = studentEmailDomain();
  const { error, status } = await searchParams;
  const problem = describeError(error, domain);
  const hasPassword = Boolean(user.passwordHash);
  const eligible = canUsePasswordAccount(user.email);
  const homeHref = isElevatedRole(session.user.role) ? "/admin/dashboard" : "/dashboard";

  return (
    <main className="account-page">
      <div className="login-card">
        <div className="login-icon">
          <KeyRound />
        </div>
        <span className="eyebrow">Account security</span>
        <h2>{hasPassword ? "Change your password" : "Set a password"}</h2>
        <p>
          {eligible
            ? "This password is how you sign in. There is no reset email, so ask the placement office if you lose it."
            : `Sign-in is limited to @${domain} addresses and to addresses the placement office has allowlisted, so this account cannot hold a password.`}
        </p>
        {status === "saved" ? (
          <div className="login-alert is-success" role="status">
            <CheckCircle2 />
            <span>
              <strong>Password saved</strong>
              You can now sign in with {user.email} and this password.
            </span>
          </div>
        ) : null}
        {problem ? (
          <div className="login-alert" role="alert">
            <AlertCircle />
            <span>
              <strong>{problem.title}</strong>
              {problem.body}
            </span>
          </div>
        ) : null}
        {eligible ? (
          <form action={setPasswordAction} className="login-fields">
            {hasPassword ? (
              <label>
                <span>Current password</span>
                <input
                  type="password"
                  name="currentPassword"
                  autoComplete="current-password"
                  required
                />
              </label>
            ) : null}
            <label>
              <span>New password</span>
              <input
                type="password"
                name="password"
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                required
              />
            </label>
            <label>
              <span>Confirm new password</span>
              <input
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                required
              />
            </label>
            <button type="submit" className="login-submit">
              {hasPassword ? "Update password" : "Set password"}
            </button>
          </form>
        ) : null}
        <p className="login-switch">
          <Link href={homeHref}>
            <ArrowLeft size={13} /> Back to the portal
          </Link>
        </p>
      </div>
    </main>
  );
}
