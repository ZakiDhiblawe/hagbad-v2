import { usePageChrome } from "../hooks/usePageChrome";
import { routes } from "../lib/routes";
import RouteLink from "../components/RouteLink";

function statusClass(kind) {
  if (kind === "ok") return "status-ok";
  if (kind === "down") return "status-down";
  return "status-loading";
}

export default function HomePage({ navigate, health, isAuthenticated }) {
  usePageChrome({
    title: "Hagbad | Cooperative Savings Workspace",
    page: "home",
    bodyClassName: "portal-body portal-home",
    root: true,
  });

  return (
    <>
      <header className="site-nav">
        <div className="container py-1">
          <div className="site-nav-shell">
            <RouteLink className="portal-brand" to={routes.home} navigate={navigate}>
              <span className="portal-brand-mark">H</span>
              <span className="portal-brand-copy">
                <span className="portal-brand-name">Hagbad</span>
                <span className="portal-brand-subtitle">Savings workspace for Ayuuto groups</span>
              </span>
            </RouteLink>

            <nav className="site-nav-links" aria-label="Primary">
              <a href="#workspace">Workspace</a>
              <a href="#trust">Controls</a>
              <a href="#flow">How it works</a>
            </nav>

            <div className="site-nav-actions">
              <RouteLink className="btn portal-btn-secondary" to={routes.login} navigate={navigate}>
                Sign in
              </RouteLink>
              <RouteLink className="btn portal-btn-primary" to={routes.register} navigate={navigate}>
                Create account
              </RouteLink>
            </div>
          </div>
        </div>
      </header>

      <main className="hero-shell">
        <div className="container">
          <section className="hero-panel">
            <div className="row align-items-center g-5">
              <div className="col-lg-7">
                <div className="eyebrow">Hagbad operations hub</div>
                <h1 className="hero-title">Run group savings with a cleaner shared workflow.</h1>
                <p className="hero-lead">
                  Bring contribution tracking, payout approvals, invites, join requests, and cycle visibility
                  into one workspace built for cooperative savings groups that need discipline, clarity, and
                  accountability.
                </p>

                <div className="hero-actions">
                  <RouteLink
                    className="btn portal-btn-primary"
                    to={isAuthenticated ? routes.dashboard : routes.register}
                    navigate={navigate}
                  >
                    {isAuthenticated ? "Open dashboard" : "Start a new group"}
                  </RouteLink>
                  <RouteLink
                    className="btn portal-btn-secondary"
                    to={isAuthenticated ? routes.dashboard : routes.login}
                    navigate={navigate}
                  >
                    {isAuthenticated ? "Continue in workspace" : "Sign in to your workspace"}
                  </RouteLink>
                  <span className={`status-chip ${statusClass(health.kind)}`} aria-live="polite">
                    {health.label}
                  </span>
                </div>

                <div className="hero-meta">
                  <div className="hero-metric">
                    <strong>Groups</strong>
                    <span>Create public or private savings circles with controlled access.</span>
                  </div>
                  <div className="hero-metric">
                    <strong>Cycles</strong>
                    <span>Track contribution windows, payment status, and payout completion.</span>
                  </div>
                  <div className="hero-metric">
                    <strong>Decisions</strong>
                    <span>Approve members, payouts, and progress with a clear audit trail.</span>
                  </div>
                </div>
              </div>

              <div className="col-lg-5">
                <div className="workspace-stage" id="workspace">
                  <div className="topline">
                    <div>
                      <h3>Operational snapshot</h3>
                      <p>See your collective savings workflow the moment you sign in.</p>
                    </div>
                    <span className="badge rounded-pill text-bg-light text-primary">Live view</span>
                  </div>

                  <div className="workspace-card-grid">
                    <div className="workspace-mini-card">
                      <strong>5 active groups</strong>
                      <span>Teams segmented by family, staff, and neighborhood circles.</span>
                    </div>
                    <div className="workspace-mini-card">
                      <strong>12 pending actions</strong>
                      <span>Outstanding approvals and payment follow-ups visible in one place.</span>
                    </div>
                  </div>

                  <div className="workspace-wide-card">
                    <strong>Cycle readiness</strong>
                    <span>Confirm contributions are settled before payouts are approved and closed.</span>
                  </div>

                  <div className="workspace-list">
                    <div className="workspace-list-item">
                      <div>
                        <strong>Members and invites</strong>
                        <small>Private groups stay controlled with request review and invite redemption.</small>
                      </div>
                      <span className="badge rounded-pill text-bg-light text-primary">Secure</span>
                    </div>
                    <div className="workspace-list-item">
                      <div>
                        <strong>Payments and payouts</strong>
                        <small>Amounts due, amounts paid, and payout states stay visible to managers.</small>
                      </div>
                      <span className="badge rounded-pill text-bg-light text-primary">Tracked</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="workspace-tile-grid">
              <article className="workspace-tile">
                <i className="ti ti-users-group"></i>
                <h4>Groups</h4>
                <p>Set ownership, privacy, and operational structure for each savings circle.</p>
              </article>
              <article className="workspace-tile">
                <i className="ti ti-user-check"></i>
                <h4>Join review</h4>
                <p>Approve or reject membership requests before private groups expand.</p>
              </article>
              <article className="workspace-tile">
                <i className="ti ti-credit-card-pay"></i>
                <h4>Payments</h4>
                <p>Track due, paid, and late states without leaving the workspace.</p>
              </article>
              <article className="workspace-tile">
                <i className="ti ti-cash-banknote"></i>
                <h4>Payouts</h4>
                <p>Approve only after collection targets are met and paid amounts are available.</p>
              </article>
            </div>
          </section>

          <section className="feature-strip mt-4" id="trust">
            <article className="feature-card">
              <div className="feature-icon">
                <i className="ti ti-shield-lock"></i>
              </div>
              <h3>Role-aware controls</h3>
              <p>Creators, admins, members, and cycle participants see different actions based on permissions already enforced by the API.</p>
            </article>
            <article className="feature-card">
              <div className="feature-icon">
                <i className="ti ti-stack-2"></i>
              </div>
              <h3>One frontend, compatible backends</h3>
              <p>The React frontend now uses the same UI language and shared API contract as the static frontend.</p>
            </article>
            <article className="feature-card">
              <div className="feature-icon">
                <i className="ti ti-checkup-list"></i>
              </div>
              <h3>Cycle closure discipline</h3>
              <p>Completion depends on settled payments and paid payouts, so the platform reinforces operational correctness.</p>
            </article>
          </section>

          <section className="info-band" id="flow">
            <h2 className="section-heading">A public entry point, then a focused dashboard.</h2>
            <p className="section-copy">
              Visitors start on this landing page. Once authenticated, they move directly into the dashboard
              workspace with sidebar navigation, quick actions, and profile visibility.
            </p>
          </section>
        </div>
      </main>

      <footer className="landing-footer">
        <div className="container">
          <div className="landing-footer-shell">
            <div className="landing-footer-grid">
              <div>
                <RouteLink className="portal-brand" to={routes.home} navigate={navigate}>
                  <span className="portal-brand-mark">H</span>
                  <span className="portal-brand-copy">
                    <span className="portal-brand-name">Hagbad</span>
                    <span className="portal-brand-subtitle">Cooperative savings workspace</span>
                  </span>
                </RouteLink>
                <p className="landing-footer-copy">
                  The React frontend now mirrors the static workspace styling while staying compatible with either backend.
                </p>
              </div>

              <div>
                <h3 className="landing-footer-title">Quick links</h3>
                <div className="landing-footer-links">
                  <RouteLink to={routes.login} navigate={navigate}>
                    Sign in
                  </RouteLink>
                  <RouteLink to={routes.register} navigate={navigate}>
                    Create account
                  </RouteLink>
                  <a href="#workspace">Workspace</a>
                  <a href="#flow">How it works</a>
                </div>
              </div>

              <div>
                <h3 className="landing-footer-title">Deployment ready</h3>
                <p className="landing-footer-copy">
                  Public pages stay separate from the authenticated workspace, which keeps the entry flow clean.
                </p>
              </div>
            </div>

            <div className="landing-footer-bottom">
              <span>© 2026 Hagbad</span>
              <span>Built for savings groups, members, cycles, payments, and payouts.</span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
