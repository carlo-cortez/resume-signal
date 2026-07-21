import Link from "next/link";

type AuthShellProps = {
  title: string;
  subtitle: string;
  error?: string;
  message?: string;
  children: React.ReactNode;
  footer: React.ReactNode;
};

export function AuthShell({ title, subtitle, error, message, children, footer }: AuthShellProps) {
  return (
    <main className="auth-page">
      <section className="auth-intro">
        <Link className="auth-brand" href="/login" aria-label="Resume Signal authentication">
          <span>RS</span>
          <strong>Resume Signal</strong>
        </Link>
        <div>
          <p className="eyebrow">Private resume workspace</p>
          <h1>Your job search deserves a secure home.</h1>
          <p>Keep saved job descriptions and resume decisions separated by account, with Supabase-backed authentication and row-level privacy.</p>
        </div>
        <p className="auth-principle">Your password is handled by Supabase Auth. Resume Signal never stores it in the application database.</p>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-card">
          <p className="auth-kicker">Resume Signal account</p>
          <h2>{title}</h2>
          <p className="auth-subtitle">{subtitle}</p>
          {error && <p className="auth-alert error" role="alert">{error}</p>}
          {message && <p className="auth-alert success" role="status">{message}</p>}
          {children}
          <div className="auth-footer">{footer}</div>
        </div>
      </section>
    </main>
  );
}
