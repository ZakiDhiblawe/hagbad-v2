import { useEffect, useState } from "react";
import RouteLink from "../components/RouteLink";
import { usePageChrome } from "../hooks/usePageChrome";
import { routes } from "../lib/routes";

export default function LoginPage({ auth, navigate, notice = "" }) {
  usePageChrome({
    title: "Sign in | Hagbad",
    page: "login",
    bodyClassName: "portal-body auth-body",
  });

  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(notice);

  useEffect(() => {
    setError(notice || "");
  }, [notice]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await auth.signIn(form.email.trim(), form.password);
      navigate(routes.dashboard, { replace: true });
    } catch (err) {
      setError(err?.message || "Login failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-frame">
        <div className="row g-0">
          <div className="col-lg-5">
            <div className="auth-panel">
              <RouteLink className="portal-brand" to={routes.home} navigate={navigate}>
                <span className="portal-brand-mark">H</span>
                <span className="portal-brand-copy">
                  <span className="portal-brand-name text-white">Hagbad</span>
                  <span className="portal-brand-subtitle text-white-50">Professional savings coordination</span>
                </span>
              </RouteLink>

              <h1>Sign in to your savings workspace.</h1>
              <p>Open your dashboard, review member activity, and move directly into groups, cycles, payments, and payouts.</p>

              <div className="auth-points">
                <div className="auth-point">
                  <i className="ti ti-layout-dashboard"></i>
                  <div>
                    <strong>Structured dashboard access</strong>
                    <span>Authenticated users land directly in the admin workspace.</span>
                  </div>
                </div>
                <div className="auth-point">
                  <i className="ti ti-user-check"></i>
                  <div>
                    <strong>Membership control</strong>
                    <span>Review private join requests and invite flows from one place.</span>
                  </div>
                </div>
                <div className="auth-point">
                  <i className="ti ti-cash-banknote"></i>
                  <div>
                    <strong>Operational discipline</strong>
                    <span>Track contribution and payout progress with clearer visibility.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-7">
            <div className="auth-card">
              <span className="eyebrow">Access your account</span>
              <h2>Welcome back</h2>
              <p>Sign in with your registered email address to continue into the Hagbad workspace.</p>

              <form className="mt-4" onSubmit={handleSubmit} noValidate>
                {error ? (
                  <div className="form-error" role="alert">
                    {error}
                  </div>
                ) : null}

                <div className="mb-3">
                  <div className="form-label-wrap">
                    <label htmlFor="email">Email address</label>
                  </div>
                  <input
                    id="email"
                    name="email"
                    className="form-control portal-input"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="Enter your email address"
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  />
                  <p className="field-hint">Use the email linked to your Hagbad account.</p>
                </div>

                <div className="mb-3">
                  <div className="form-label-wrap">
                    <label htmlFor="password">Password</label>
                  </div>
                  <div className="input-group">
                    <input
                      id="password"
                      name="password"
                      className="form-control portal-input"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      placeholder="Enter your password"
                      value={form.password}
                      onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                    />
                    <button
                      type="button"
                      className="btn portal-toggle"
                      onClick={() => setShowPassword((value) => !value)}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  <p className="field-hint">Your session opens the dashboard immediately after sign-in.</p>
                </div>

                <button className="btn portal-btn-primary w-100 mt-3" type="submit" disabled={submitting}>
                  {submitting ? "Signing in..." : "Sign in"}
                </button>

                <p className="auth-footer">
                  New here? <RouteLink to={routes.register} navigate={navigate}>Create an account</RouteLink>
                </p>
                <p className="auth-footer auth-footer-secondary">
                  Prefer to start from the public site?{" "}
                  <RouteLink to={routes.home} navigate={navigate}>Return to landing page</RouteLink>
                </p>
              </form>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
