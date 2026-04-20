import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import RouteLink from "../components/RouteLink";
import { usePageChrome } from "../hooks/usePageChrome";
import { buildGroupWorkspaceConfig } from "../lib/groupWorkspace";
import {
  getGroup,
  getPaymentSummary,
  getPayoutSummary,
  listCyclesForGroup,
  listGroupJoinRequests,
  listGroupMembers,
  listInvites,
} from "../lib/api";
import { capitalize, formatDateTime, groupCoverUrl, groupImageUrl } from "../lib/format";
import { routes } from "../lib/routes";

function contextBadge(label, tone) {
  return <span className={`group-card-badge ${tone}`}>{label}</span>;
}

export default function GroupDetailPage({ auth, navigate, searchParams }) {
  const groupId = Number(searchParams.get("id") || 0);
  const [state, setState] = useState({
    loading: true,
    error: "",
    group: null,
    membershipRole: null,
    totalMembers: "-",
    activeCycles: "0",
    totalPayments: "0",
    totalPayouts: "0",
    pendingJoinRequests: "N/A",
    invites: "N/A",
  });

  const pageTitle = state.group?.name ? `${state.group.name} | Group Workspace | Hagbad` : "Group Workspace | Hagbad";

  usePageChrome({
    title: pageTitle,
    page: "group_detail",
    bodyClassName: "portal-body dashboard-body",
  });

  useEffect(() => {
    let active = true;

    async function loadGroup() {
      if (!groupId) {
        setState((current) => ({
          ...current,
          loading: false,
          error: "Missing group id.",
        }));
        return;
      }

      setState((current) => ({ ...current, loading: true, error: "" }));

      try {
        const group = await getGroup(auth.token, groupId);
        const isCreator = Number(group.created_by) === Number(auth.profile?.id);

        let members = [];
        let membershipRole = null;
        try {
          members = await listGroupMembers(auth.token, { groupId, page: 1, size: 100 });
          const me = members.find((item) => Number(item.user_id) === Number(auth.profile?.id));
          membershipRole = me?.role || null;
        } catch {
          members = [];
        }

        let cycles = [];
        try {
          cycles = await listCyclesForGroup(auth.token, groupId, { page: 1, size: 100 });
        } catch {
          cycles = [];
        }

        const paymentSummaries = await Promise.all(
          cycles.map(async (cycle) => {
            try {
              return await getPaymentSummary(auth.token, cycle.id);
            } catch {
              return null;
            }
          })
        );

        const payoutSummaries = await Promise.all(
          cycles.map(async (cycle) => {
            try {
              return await getPayoutSummary(auth.token, cycle.id);
            } catch {
              return null;
            }
          })
        );

        const totalPayments = paymentSummaries.reduce((sum, item) => {
          if (!item) return sum;
          return sum + Number(item.due_count || 0) + Number(item.paid_count || 0) + Number(item.late_count || 0);
        }, 0);

        const totalPayouts = payoutSummaries.reduce((sum, item) => {
          if (!item) return sum;
          return (
            sum +
            Number(item.pending_count || 0) +
            Number(item.approved_count || 0) +
            Number(item.rejected_count || 0) +
            Number(item.paid_count || 0)
          );
        }, 0);

        let pendingJoinRequests = "N/A";
        if (group.privacy !== "public") {
          try {
            const items = await listGroupJoinRequests(auth.token, groupId, "pending");
            pendingJoinRequests = String(items.length);
          } catch (error) {
            pendingJoinRequests = error?.status === 403 ? "Locked" : "0";
          }
        }

        let invites = "N/A";
        if (group.privacy === "private" && !group.visible) {
          try {
            const items = await listInvites(auth.token, groupId);
            const activeInvites = items.filter((item) => {
              if (item.used) return false;
              if (!item.expires_at) return true;
              const expiry = new Date(item.expires_at);
              return Number.isFinite(expiry.getTime()) && expiry.getTime() > Date.now();
            });
            invites = String(activeInvites.length);
          } catch (error) {
            invites = error?.status === 403 ? "Locked" : "0";
          }
        }

        if (!active) return;
        setState({
          loading: false,
          error: "",
          group,
          membershipRole,
          totalMembers: members.length ? String(members.length) : isCreator ? "1" : "-",
          activeCycles: String(cycles.filter((cycle) => cycle.status === "active").length),
          totalPayments: String(totalPayments),
          totalPayouts: String(totalPayouts),
          pendingJoinRequests,
          invites,
        });
      } catch (error) {
        if (!active) return;
        setState((current) => ({
          ...current,
          loading: false,
          error: error?.message || "Failed to load group.",
        }));
      }
    }

    loadGroup();
    return () => {
      active = false;
    };
  }, [auth.profile?.id, auth.token, groupId]);

  const group = state.group;
  const isCreator = Number(group?.created_by) === Number(auth.profile?.id);
  const workspace = useMemo(
    () =>
      buildGroupWorkspaceConfig({
        groupId,
        profileId: auth.profile?.id,
        group,
        membershipRole: state.membershipRole,
        activeKey: "group_dashboard",
      }),
    [auth.profile?.id, group, groupId, state.membershipRole]
  );
  const isAdmin = workspace.isAdmin;
  const isModerator = workspace.isModerator;
  const showJoinRequests = workspace.showJoinRequests;

  const heroStyle = groupCoverUrl(group)
    ? {
        backgroundImage: `linear-gradient(120deg, rgba(8, 24, 48, 0.72), rgba(11, 69, 157, 0.68)), url("${groupCoverUrl(group)}")`,
      }
    : undefined;

  return (
    <AppShell
      auth={auth}
      navigate={navigate}
      miniTitle="Group workspace"
      title="Dashboard"
      activeSidebarKey={workspace.activeKey}
      sidebarSections={workspace.sidebarSections}
      brandTo={routes.groupDetail(groupId || 0)}
      brandSubtitle="Group workspace"
    >
      {state.error ? (
        <section className="dashboard-panel card">
          <div className="card-body">
            <div className="form-error">{state.error}</div>
          </div>
        </section>
      ) : null}

      <section className="dashboard-hero group-workspace-hero" style={heroStyle}>
        <div className="group-hero-top">
          <div className="group-hero-copy">
            <span className="eyebrow text-white mb-3">Group dashboard</span>
            <h2>{group?.name || "Loading group..."}</h2>
            <p>{group?.description || "Preparing your group workspace summary."}</p>
            <div className="group-context-badges">
              {group ? contextBadge(capitalize(group.privacy), group.privacy === "private" ? "private" : "public") : null}
              {group ? contextBadge(group.visible ? "Visible" : "Hidden", group.visible ? "visible" : "hidden") : null}
              {group ? contextBadge(capitalize(group.status), group.status === "closed" ? "closed" : "active") : null}
              {state.membershipRole ? contextBadge(`Role: ${capitalize(state.membershipRole)}`, "visible") : null}
            </div>
          </div>

          <div className="group-hero-aside">
            <img className="group-hero-avatar" src={groupImageUrl(group || {})} alt="Group image" />
            <div className="group-hero-actions">
              {isCreator ? (
                <RouteLink className="btn portal-btn-secondary" to={routes.groupSettings(groupId)} navigate={navigate}>
                  Edit group
                </RouteLink>
              ) : null}
              <RouteLink className="btn portal-btn-secondary" to={routes.myGroups} navigate={navigate}>
                Back to groups
              </RouteLink>
              <RouteLink className="btn portal-btn-secondary" to={routes.cycles(groupId)} navigate={navigate}>
                My Cycles
              </RouteLink>
            </div>
          </div>
        </div>

        <div className="dashboard-summary-grid group-summary-grid">
          <div className="dashboard-summary-card">
            <span>Active cycles</span>
            <strong>{state.activeCycles}</strong>
          </div>
          <div className="dashboard-summary-card">
            <span>Total members</span>
            <strong>{state.totalMembers}</strong>
          </div>
          <div className="dashboard-summary-card">
            <span>Payments</span>
            <strong>{state.totalPayments}</strong>
          </div>
          <div className="dashboard-summary-card">
            <span>Payouts</span>
            <strong>{state.totalPayouts}</strong>
          </div>
          <div className="dashboard-summary-card">
            <span>Pending join requests</span>
            <strong>{state.pendingJoinRequests}</strong>
          </div>
          <div className="dashboard-summary-card">
            <span>Invites</span>
            <strong>{state.invites}</strong>
          </div>
        </div>
      </section>

      <div className="row g-4 mt-1">
        <div className="col-xl-8">
          <section className="dashboard-panel card h-100" aria-label="Group overview">
            <div className="card-body">
              <div className="dashboard-panel-title">
                <div>
                  <h3>Group Overview</h3>
                  <p>{group?.description || "No description has been added for this group yet."}</p>
                </div>
                <span className={`status-chip ${isCreator || isAdmin || isModerator ? "status-ok" : "status-loading"}`}>
                  {isCreator
                    ? "Creator access"
                    : isAdmin
                      ? "Admin access"
                      : isModerator
                        ? "Moderator access"
                        : state.membershipRole
                          ? "Member access"
                          : "Viewer access"}
                </span>
              </div>

              <dl className="profile-grid">
                <dt>Group ID</dt>
                <dd>{group?.id || "-"}</dd>
                <dt>Creator ID</dt>
                <dd>{group?.created_by || "-"}</dd>
                <dt>Privacy</dt>
                <dd>{capitalize(group?.privacy)}</dd>
                <dt>Visible in explore</dt>
                <dd>{group?.visible ? "Yes" : "No"}</dd>
                <dt>Status</dt>
                <dd>{capitalize(group?.status)}</dd>
                <dt>Created</dt>
                <dd>{formatDateTime(group?.created_at)}</dd>
                <dt>Description</dt>
                <dd>{group?.description || "-"}</dd>
              </dl>

              <p className="dashboard-note mt-4 mb-0">
                {isCreator
                  ? "You are the creator of this group. Open edit mode when you need to update the group or close it."
                  : state.membershipRole
                    ? `You belong to this group as ${state.membershipRole}. Some management pages still depend on creator, admin, or moderator access.`
                    : "You can view this group, but member-only management pages may remain restricted."}
              </p>
            </div>
          </section>
        </div>

        <div className="col-xl-4">
          <section className="dashboard-panel card mb-4" aria-label="Group quick links">
            <div className="card-body">
              <div className="dashboard-panel-title">
                <div>
                  <h3>Group Sections</h3>
                  <p>Move into the pages used to manage this specific group.</p>
                </div>
              </div>

              <div className="quick-links">
                <RouteLink className="quick-link-card" to={routes.groupSettings(groupId)} navigate={navigate}>
                  <span className="link-copy">
                    <i className="ti ti-adjustments-horizontal"></i>
                    <span>
                      <strong>Settings</strong>
                      <span>Contribution rules, frequency, and automation.</span>
                    </span>
                  </span>
                  <i className="ti ti-arrow-right"></i>
                </RouteLink>

                <RouteLink className="quick-link-card" to={routes.groupMembers(groupId)} navigate={navigate}>
                  <span className="link-copy">
                    <i className="ti ti-users"></i>
                    <span>
                      <strong>Members</strong>
                      <span>Review current members and manage roles.</span>
                    </span>
                  </span>
                  <i className="ti ti-arrow-right"></i>
                </RouteLink>

                {showJoinRequests ? (
                  <RouteLink className="quick-link-card" to={routes.groupReview(groupId)} navigate={navigate}>
                    <span className="link-copy">
                      <i className="ti ti-user-question"></i>
                      <span>
                        <strong>Join Requests</strong>
                        <span>Approve or reject membership requests for this group.</span>
                      </span>
                    </span>
                    <i className="ti ti-arrow-right"></i>
                  </RouteLink>
                ) : null}
              </div>
            </div>
          </section>

          <section className="dashboard-panel card" aria-label="Group media and status">
            <div className="card-body">
              <div className="dashboard-panel-title">
                <div>
                  <h3>Group Snapshot</h3>
                  <p>Current visibility, privacy, and media at a glance.</p>
                </div>
              </div>

              <div className="group-snapshot-panel">
                <img className="group-snapshot-image" src={groupImageUrl(group || {})} alt="Group image preview" />
                <div className="group-snapshot-copy">
                  <strong>{group?.name || "Loading..."}</strong>
                  <span>
                    {group
                      ? `${capitalize(group.privacy)} group • ${group.visible ? "Visible" : "Hidden"} • ${capitalize(group.status)}`
                      : "Preparing group summary."}
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
