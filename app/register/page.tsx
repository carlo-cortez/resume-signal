import Link from "next/link";
import { AuthShell } from "@/app/auth/auth-shell";
import { register } from "@/app/auth/actions";

type RegisterPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const { error, message } = await searchParams;

  return (
    <AuthShell
      title="Create your account"
      subtitle="Use an email address you can access for confirmation and recovery."
      error={error}
      message={message}
      footer={<p>Already registered? <Link href="/login">Sign in</Link></p>}
    >
      <form action={register} className="auth-form">
        <label>Email address<input name="email" type="email" autoComplete="email" required /></label>
        <label>Password<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
        <label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required /></label>
        <p className="auth-hint">Use at least 8 characters. A password manager is recommended.</p>
        <button type="submit">Create account <span aria-hidden="true">→</span></button>
      </form>
    </AuthShell>
  );
}
