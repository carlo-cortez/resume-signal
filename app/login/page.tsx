import Link from "next/link";
import { AuthShell } from "@/app/auth/auth-shell";
import { login } from "@/app/auth/actions";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, message } = await searchParams;

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to open your private ATS workspace."
      error={error}
      message={message}
      footer={<p>New to Resume Signal? <Link href="/register">Create an account</Link></p>}
    >
      <form action={login} className="auth-form">
        <label>Email address<input name="email" type="email" autoComplete="email" required /></label>
        <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
        <div className="auth-form-meta"><Link href="/forgot-password">Forgot password?</Link></div>
        <button type="submit">Sign in <span aria-hidden="true">→</span></button>
      </form>
    </AuthShell>
  );
}
