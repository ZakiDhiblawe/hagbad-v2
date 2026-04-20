import { profileImageUrl } from "../lib/format";
import { routes } from "../lib/routes";
import RouteLink from "./RouteLink";

export default function UserMenu({ profile, navigate, onLogout, compact = false }) {
  return (
    <details className={`user-menu${compact ? " compact" : ""}`}>
      <summary className="user-menu-toggle">
        <img
          className="user-menu-avatar"
          src={profileImageUrl(profile)}
          alt={`${profile?.full_name || "User"} profile`}
        />
        {!compact ? (
          <span className="user-menu-copy">
            <span className="user-menu-name">{profile?.full_name || "User"}</span>
            <span className="user-menu-meta">Workspace member</span>
          </span>
        ) : null}
        <span className="user-menu-chevron">&#9662;</span>
      </summary>

      <div className="user-menu-panel">
        <div className="user-menu-label">{profile?.full_name || "User"}</div>
        <RouteLink className="user-menu-link" to={routes.profile} navigate={navigate}>
          My Profile
        </RouteLink>
        <button type="button" className="user-menu-link primary-action" onClick={onLogout}>
          Logout
        </button>
      </div>
    </details>
  );
}
