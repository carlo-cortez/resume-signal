import { AuthShell } from "@/app/auth/auth-shell";
import { signInWithGoogle } from "@/app/auth/actions";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, next = "/" } = await searchParams;

  return (
    <AuthShell
      title="Sign in or get started"
      subtitle="Continue to your private resume workspace."
      error={error}
      footer={<p>New here? Continuing with Google sets up your workspace automatically.</p>}
    >
      <form action={signInWithGoogle} className="auth-form">
        <input name="next" type="hidden" value={next} />
        <button className="google-auth-button" type="submit">
          <span className="google-mark" aria-hidden="true">G</span>
          <span>Continue with Google</span>
          <span aria-hidden="true">→</span>
        </button>
      </form>
    </AuthShell>
  );
}
