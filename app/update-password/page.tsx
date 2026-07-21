import { AuthShell } from "@/app/auth/auth-shell";
import { updatePassword } from "@/app/auth/actions";

type UpdatePasswordPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function UpdatePasswordPage({ searchParams }: UpdatePasswordPageProps) {
  const { error } = await searchParams;

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Complete your recovery with a new password of at least 8 characters."
      error={error}
      footer={<p>This page is available only through a valid recovery session.</p>}
    >
      <form action={updatePassword} className="auth-form">
        <label>New password<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
        <label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required /></label>
        <button type="submit">Update password <span aria-hidden="true">→</span></button>
      </form>
    </AuthShell>
  );
}
