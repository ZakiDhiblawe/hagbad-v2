import { Fragment, useState } from "react";
import { routes } from "../lib/routes";
import RouteLink from "./RouteLink";
import UserMenu from "./UserMenu";

const DEFAULT_SIDEBAR = [
  {
    label: "Workspace",
    items: [
      { key: "dashboard", label: "Dashboard", iconClass: "ti ti-layout-dashboard", to: routes.dashboard },
    ],
  },
  {
    label: "Groups",
    items: [
      { key: "my_groups", label: "My Groups", iconClass: "ti ti-layout-grid", to: routes.myGroups },
      { key: "explore_groups", label: "Explore Groups", iconClass: "ti ti-compass", to: routes.exploreGroups },
      { key: "add_group", label: "Add New Group", iconClass: "ti ti-plus", to: routes.addGroup },
    ],
  },
];

function SidebarLink({ item, navigate, onNavigate }) {
  const className = `sidebar-link primary-hover-bg${item.active ? " active" : ""}${item.disabled ? " disabled" : ""}`;
  const content = (
    <>
      <i className={item.iconClass}></i>
      <span className="hide-menu">{item.label}</span>
    </>
  );

  if (item.disabled) {
    return (
      <a
        className={className}
        href={item.to || "#"}
        aria-expanded="false"
        aria-disabled="true"
        onClick={(event) => event.preventDefault()}
      >
        {content}
      </a>
    );
  }

  return (
    <RouteLink
      className={className}
      to={item.to}
      navigate={navigate}
      aria-expanded="false"
      onClick={onNavigate}
    >
      {content}
    </RouteLink>
  );
}

export default function AppShell({
  auth,
  navigate,
  miniTitle,
  title,
  activeSidebarKey = "",
  sidebarSections = DEFAULT_SIDEBAR,
  brandTo = routes.dashboard,
  brandSubtitle = "Member workspace",
  children,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function closeSidebar() {
    setSidebarOpen(false);
  }

  return (
    <div
      className={`page-wrapper react-page-wrapper${sidebarOpen ? " sidebar-open" : ""}`}
      id="main-wrapper"
      data-layout="vertical"
      data-navbarbg="skin6"
      data-sidebartype="full"
      data-sidebar-position="fixed"
      data-header-position="fixed"
    >
      <aside className="left-sidebar">
        <div>
          <div className="brand-logo d-flex align-items-center justify-content-between">
            <RouteLink to={brandTo} navigate={navigate} className="dashboard-brand" onClick={closeSidebar}>
              <span className="dashboard-brand-icon-wrap">
                <img
                  src="/assets/images/logos/favicon.png"
                  alt="Hagbad icon"
                  className="dashboard-brand-icon"
                />
              </span>
              <span className="portal-brand-copy">
                <span className="portal-brand-name">Hagbad</span>
                <span className="portal-brand-subtitle">{brandSubtitle}</span>
              </span>
            </RouteLink>

            <button
              type="button"
              className="close-btn d-xl-none d-block sidebartoggler cursor-pointer sidebar-toggle-button"
              id="sidebarCollapse"
              onClick={closeSidebar}
              aria-label="Close sidebar"
            >
              <i className="ti ti-x fs-6"></i>
            </button>
          </div>

          <nav className="sidebar-nav scroll-sidebar" aria-label="Sidebar">
            <ul id="sidebarnav">
              {sidebarSections.map((section) => (
                <Fragment key={section.label}>
                  <li className="nav-small-cap">
                    <span className="hide-menu">{section.label}</span>
                  </li>
                  {section.items.filter((item) => !item.hidden).map((item) => (
                    <li key={item.key} className="sidebar-item">
                      <SidebarLink
                        item={{ ...item, active: item.active || item.key === activeSidebarKey }}
                        navigate={navigate}
                        onNavigate={closeSidebar}
                      />
                    </li>
                  ))}
                </Fragment>
              ))}
            </ul>
          </nav>
        </div>
      </aside>

      <div className="body-wrapper">
        <header className="app-header">
          <nav className="navbar navbar-expand-lg navbar-light dashboard-topbar">
            <div className="container-fluid p-0">
              <div className="d-flex align-items-center gap-3">
                <button
                  type="button"
                  className="nav-link d-xl-none p-0 sidebartoggler sidebar-toggle-button"
                  aria-label="Toggle sidebar"
                  onClick={() => setSidebarOpen((value) => !value)}
                >
                  <i className="ti ti-menu-2 fs-7"></i>
                </button>

                <div className="workspace-page-copy">
                  <div className="portal-mini-title">{miniTitle}</div>
                  <h1>{title}</h1>
                </div>
              </div>

              <div id="workspace-user-menu" className="ms-auto">
                <UserMenu profile={auth.profile} navigate={navigate} onLogout={auth.signOut} />
              </div>
            </div>
          </nav>
        </header>

        <div className="container-fluid py-4">{children}</div>
      </div>
    </div>
  );
}
