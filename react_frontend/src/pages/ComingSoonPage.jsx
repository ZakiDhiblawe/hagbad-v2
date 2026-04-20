import AppShell from "../components/AppShell";
import RouteLink from "../components/RouteLink";
import { usePageChrome } from "../hooks/usePageChrome";
import { routes } from "../lib/routes";

export default function ComingSoonPage({ auth, navigate, title, description, backTo }) {
  usePageChrome({
    title: `${title} | Hagbad`,
    page: "coming_soon",
    bodyClassName: "portal-body dashboard-body",
  });

  return (
    <AppShell auth={auth} navigate={navigate} miniTitle="Hagbad workspace" title={title}>
      <section className="dashboard-panel card">
        <div className="card-body">
          <div className="dashboard-panel-title">
            <div>
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
            <span className="status-chip status-loading">Port in progress</span>
          </div>

          <p className="dashboard-note mb-4">
            The React frontend now matches the main workspace styling. This page shell is reserved so the
            navigation stays aligned while the remaining workflow logic is ported.
          </p>

          <RouteLink className="btn portal-btn-secondary" to={backTo || routes.dashboard} navigate={navigate}>
            Go back
          </RouteLink>
        </div>
      </section>
    </AppShell>
  );
}
