import AppShell from "../components/AppShell";
import RouteLink from "../components/RouteLink";
import { usePageChrome } from "../hooks/usePageChrome";
import { capitalize, formatDateTime, formatSessionHours } from "../lib/format";
import { routes } from "../lib/routes";

export default function DashboardPage({ auth, navigate }) {
  usePageChrome({
    title: "Dashboard | Hagbad",
    page: "dashboard",
    bodyClassName: "portal-body dashboard-body",
  });

  const profile = auth.profile;

  return (
    <AppShell auth={auth} navigate={navigate} miniTitle="Hagbad workspace" title="Dashboard">
      <section className="dashboard-hero">
        <span className="eyebrow text-white mb-3">Authenticated area</span>
        <h2>
          Hello, <span>{profile?.full_name || "member"}</span>
        </h2>
        <p>Loading your account and preparing your group savings workspace.</p>

        <div className="dashboard-summary-grid">
          <div className="dashboard-summary-card">
            <span>Session state</span>
            <strong>{auth.isAuthenticated ? "Authenticated" : "Checking"}</strong>
          </div>
          <div className="dashboard-summary-card">
            <span>Account email</span>
            <strong>{profile?.email || "Loading..."}</strong>
          </div>
          <div className="dashboard-summary-card">
            <span>Member since</span>
            <strong>{formatDateTime(profile?.created_at)}</strong>
          </div>
        </div>
      </section>

      <div className="row g-4 mt-1">
        <div className="col-xl-7">
          <section className="dashboard-panel card h-100" aria-label="Profile details">
            <div className="card-body">
              <div className="dashboard-panel-title">
                <div>
                  <h3>Profile overview</h3>
                  <p>Your authenticated account data from the active Hagbad backend.</p>
                </div>
                <span className="status-chip status-ok">Profile synced</span>
              </div>

              <dl className="profile-grid">
                <dt>Full name</dt>
                <dd>{profile?.full_name || "-"}</dd>
                <dt>Email address</dt>
                <dd>{profile?.email || "-"}</dd>
                <dt>Phone number</dt>
                <dd>{profile?.phone || "-"}</dd>
                <dt>Session hours</dt>
                <dd>{formatSessionHours(profile?.session_hours)}</dd>
                <dt>Status</dt>
                <dd>{capitalize(profile?.status)}</dd>
                <dt>Created</dt>
                <dd>{formatDateTime(profile?.created_at)}</dd>
              </dl>
            </div>
          </section>
        </div>

        <div className="col-xl-5">
          <section className="dashboard-panel card h-100" aria-label="Quick actions">
            <div className="card-body">
              <div className="dashboard-panel-title">
                <div>
                  <h3>Quick actions</h3>
                  <p>Move straight into the main workflows.</p>
                </div>
              </div>

              <div className="quick-links">
                <RouteLink className="quick-link-card" to={routes.myGroups} navigate={navigate}>
                  <span className="link-copy">
                    <i className="ti ti-users-group"></i>
                    <span>
                      <strong>Manage groups</strong>
                      <span>Create, open, and manage your savings groups.</span>
                    </span>
                  </span>
                  <i className="ti ti-arrow-right"></i>
                </RouteLink>

                <RouteLink className="quick-link-card" to={routes.groupSettings()} navigate={navigate}>
                  <span className="link-copy">
                    <i className="ti ti-adjustments-horizontal"></i>
                    <span>
                      <strong>Review settings</strong>
                      <span>Control contributions, frequency, and operating rules.</span>
                    </span>
                  </span>
                  <i className="ti ti-arrow-right"></i>
                </RouteLink>

                <RouteLink className="quick-link-card" to={routes.joinRequests()} navigate={navigate}>
                  <span className="link-copy">
                    <i className="ti ti-user-question"></i>
                    <span>
                      <strong>Join requests</strong>
                      <span>Approve or reject membership requests for managed groups.</span>
                    </span>
                  </span>
                  <i className="ti ti-arrow-right"></i>
                </RouteLink>

                <RouteLink className="quick-link-card" to={routes.groupReview()} navigate={navigate}>
                  <span className="link-copy">
                    <i className="ti ti-file-search"></i>
                    <span>
                      <strong>Group review</strong>
                      <span>Check operational pages before moving into payment cycles.</span>
                    </span>
                  </span>
                  <i className="ti ti-arrow-right"></i>
                </RouteLink>
              </div>
            </div>
          </section>
        </div>
      </div>

      <p className="dashboard-note mt-4 mb-0">
        If your token expires or becomes invalid, the app will clear the session and return you to the sign-in page.
      </p>
    </AppShell>
  );
}
