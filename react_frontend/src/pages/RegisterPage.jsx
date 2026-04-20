import { useState } from "react";
import RouteLink from "../components/RouteLink";
import { usePageChrome } from "../hooks/usePageChrome";
import { routes } from "../lib/routes";

export default function RegisterPage({ auth, navigate }) {
  usePageChrome({
    title: "Create account | Hagbad",
    page: "register",
    bodyClassName: "portal-body auth-body",
  });

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    confirm_password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (form.full_name.trim().length < 2) {
      setError("Full name must be at least 2 characters.");
      return;
    }

    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (form.password !== form.confirm_password) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      await auth.signUp({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        password: form.password,
      });
      navigate(routes.dashboard, { replace: true });
    } catch (err) {
      setError(err?.message || "Registration failed.");
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
                  <span className="portal-brand-subtitle text-white-50">Savings operations for serious groups</span>
                </span>
              </RouteLink>

              <h1>Create the account behind your savings circle.</h1>
              <p>Set up your member profile, then go straight into the workspace to create groups and manage participation.</p>

              <div className="auth-points">
                <div className="auth-point">
                  <i className="ti ti-users-plus"></i>
                  <div>
                    <strong>Create and manage groups</strong>
                    <span>Start public or private circles with a structured ownership model.</span>
                  </div>
                </div>
                <div className="auth-point">
                  <i className="ti ti-calendar-time"></i>
                  <div>
                    <strong>Track cycles clearly</strong>
                    <span>Move from pending to active to completed with visible payment readiness.</span>
                  </div>
                </div>
                <div className="auth-point">
                  <i className="ti ti-checklist"></i>
                  <div>
                    <strong>Stay deployment-ready</strong>
                    <span>The public entry flow and the authenticated dashboard are now separated cleanly.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-7">
            <div className="auth-card">
              <span className="eyebrow">Set up your workspace access</span>
              <h2>Create your account</h2>
              <p>All fields are required except phone.</p>

              <form className="mt-4" onSubmit={handleSubmit} noValidate>
                {error ? (
                  <div className="form-error" role="alert">
                    {error}
                  </div>
                ) : null}

                <div className="mb-3">
                  <div className="form-label-wrap">
                    <label htmlFor="full_name">Full name</label>
                  </div>
                  <input
                    id="full_name"
                    name="full_name"
                    className="form-control portal-input"
                    type="text"
                    autoComplete="name"
                    required
                    placeholder="Enter your full name"
                    value={form.full_name}
                    onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
                  />
                </div>

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
                  <p className="field-hint">This email becomes your login username.</p>
                </div>

                <div className="mb-3">
                  <div className="form-label-wrap">
                    <label htmlFor="phone">Phone number</label>
                    <span className="field-hint">Optional</span>
                  </div>
                  <input
                    id="phone"
                    name="phone"
                    className="form-control portal-input"
                    type="tel"
                    autoComplete="tel"
                    placeholder="Enter your phone number"
                    value={form.phone}
                    onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                  />
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
                      autoComplete="new-password"
                      required
                      placeholder="Create a secure password"
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
                  <p className="field-hint">Choose a password you do not reuse elsewhere.</p>
                </div>

                <div className="mb-3">
                  <div className="form-label-wrap">
                    <label htmlFor="confirm_password">Confirm password</label>
                  </div>
                  <div className="input-group">
                    <input
                      id="confirm_password"
                      name="confirm_password"
                      className="form-control portal-input"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      placeholder="Re-enter your password"
                      value={form.confirm_password}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, confirm_password: event.target.value }))
                      }
                    />
                    <button
                      type="button"
                      className="btn portal-toggle"
                      onClick={() => setShowConfirmPassword((value) => !value)}
                    >
                      {showConfirmPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <button className="btn portal-btn-primary w-100 mt-3" type="submit" disabled={submitting}>
                  {submitting ? "Creating account..." : "Create account"}
                </button>

                <p className="auth-footer">
                  Already have an account? <RouteLink to={routes.login} navigate={navigate}>Sign in</RouteLink>
                </p>
              </form>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
