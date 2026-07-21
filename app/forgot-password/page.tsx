import Link from "next/link";
import { AuthShell } from "@/app/auth/auth-shell";
import { requestPasswordReset } from "@/app/auth/actions";

type ForgotPasswordPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const { error, message } = await searchParams;

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We’ll email a secure link if an account exists for this address."
      error={error}
      message={message}
      footer={<p>Remembered it? <Link href="/login">Return to sign in</Link></p>}
    >
      <form action={requestPasswordReset} className="auth-form">
        <label>Email address<input name="email" type="email" autoComplete="email" required /></label>
        <button type="submit">Send reset link <span aria-hidden="true">→</span></button>
      </form>
    </AuthShell>
  );
}
