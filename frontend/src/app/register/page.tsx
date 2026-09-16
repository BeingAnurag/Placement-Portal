import { AlertCircle, UserPlus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { studentEmailDomain } from "@/lib/auth-access";
import { MIN_PASSWORD_LENGTH } from "@/lib/credentials-schema";
import { isElevatedRole } from "@/lib/permissions";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { registerAction } from "./actions";

function describeError(code: string | undefined, domain: string) {
  if (!code) return null;
  if (code === "Exists") {
    return {
      title: "This address already has an account",
      body: "Sign in instead. If you have lost the password, ask the placement office to set a new one.",
    };
  }
  if (code === "Domain") {
    return {
      title: `Use your @${domain} address`,
      body: "Password accounts are limited to institute addresses.",
    };
  }
  if (code === "Staff") {
    return {
      title: "Placement office accounts are created by the office",
      body: "Ask the placement cell to create your account and give you its first password. You can change it afterwards.",
    };
  }
  if (code === "Mismatch") {
    return { title: "Passwords do not match", body: "Re-enter the same password in both fields." };
  }
  if (code === "Password") {
    return {
      title: "Choose a stronger password",
      body: `Use at least ${MIN_PASSWORD_LENGTH} characters with at least one letter and one number.`,
    };
  }
  if (code === "Email") {
    return { title: "Enter a valid email address", body: `Your address must end in @${domain}.` };
  }
  return { title: "Enter your full name", body: "We show this name to the placement office." };
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session) redirect(isElevatedRole(session.user.role) ? "/admin/dashboard" : "/dashboard");

  const domain = studentEmailDomain();
  const problem = describeError((await searchParams).error, domain);

  return (
    <main className="login-page">
      <section className="login-story">
        <div className="login-brand">
          <Image src="/iiitl-emblem.png" alt="" width={44} height={35} priority />
          <span>IIIT Lucknow</span>
        </div>
        <div>
          <span className="eyebrow">Training &amp; Placement Cell</span>
          <h1>
            One account for
            <br />
            every opportunity.
          </h1>
          <p>Register once, then track drives, applications, and offers from a single place.</p>
        </div>
        <small>Indian Institute of Information Technology Lucknow</small>
      </section>
      <section className="login-panel">
        <div className="login-top-actions">
          <ThemeToggle />
        </div>
        <div className="login-card">
          <div className="login-icon">
            <UserPlus />
          </div>
          <span className="eyebrow">Student portal</span>
          <h2>Create your account</h2>
          <p>
            Register with your <strong>@{domain}</strong> address. If you used this portal before,
            registering with the same address keeps your profile and applications.
          </p>
          {problem ? (
            <div className="login-alert" role="alert">
              <AlertCircle />
              <span>
                <strong>{problem.title}</strong>
                {problem.body}
              </span>
            </div>
          ) : null}
          <form action={registerAction} className="login-fields">
            <label>
              <span>Full name</span>
              <input type="text" name="name" autoComplete="name" required />
            </label>
            <label>
              <span>Institute email</span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                placeholder={`you@${domain}`}
                required
              />
            </label>
            <label>
              <span>Password</span>
              <input
                type="password"
                name="password"
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                required
              />
            </label>
            <label>
              <span>Confirm password</span>
              <input
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                required
              />
            </label>
            <button type="submit" className="login-submit">
              Create account
            </button>
          </form>
          <p className="login-switch">
            Already registered? <Link href="/login">Sign in</Link>
          </p>
          <div className="login-note">
            Use at least {MIN_PASSWORD_LENGTH} characters with a letter and a number.
            <br />
            Placement office accounts are created by the office, not here.
          </div>
        </div>
      </section>
    </main>
  );
}
