import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { usePageChrome } from "../hooks/usePageChrome";
import {
  createInvite,
  decideJoinRequest,
  deleteInvite,
  getGroup,
  listGroupJoinRequests,
  listGroupMembers,
  listInvites,
} from "../lib/api";
import { profileImageUrl } from "../lib/format";
import { buildGroupWorkspaceConfig } from "../lib/groupWorkspace";
import { routes } from "../lib/routes";

const PAGE_SIZE = 100;

function formatDateTime(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
}

function isExpired(expiresAt) {
  if (!expiresAt) return false;
  const parsed = new Date(expiresAt);
  return Number.isFinite(parsed.getTime()) && parsed.getTime() <= Date.now();
}

function isActiveInvite(invite) {
  return Boolean(invite) && !invite.used && !isExpired(invite.expires_at);
}

function activeInvite(invites) {
  return (invites || []).find((invite) => isActiveInvite(invite)) || null;
}

async function fetchAllGroupMembers(token, groupId) {
  const items = [];
  for (let page = 1; page <= 50; page += 1) {
    const batch = await listGroupMembers(token, { groupId, page, size: PAGE_SIZE });
    items.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return items;
}

function SummaryCard({ tone, label, value, description, descriptionId = "" }) {
  return (
    <article className={`members-summary-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p id={descriptionId || undefined}>{description}</p>
    </article>
  );
}

function ContextChip({ label, tone = "neutral" }) {
  return <span className={`member-context-chip ${tone}`}>{label}</span>;
}

export default function GroupReviewPage({ auth, navigate, searchParams }) {
  const groupId = Number(searchParams.get("group_id") || 0);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [busyAction, setBusyAction] = useState("");
  const [state, setState] = useState({
    loading: true,
    error: "",
    group: null,
    membershipRole: null,
    requests: [],
    invites: [],
  });

  const pageTitle = state.group?.name ? `Join Requests | ${state.group.name} | Hagbad` : "Join Requests | Hagbad";

  usePageChrome({
    title: pageTitle,
    page: "group_review",
    bodyClassName: "portal-body dashboard-body",
  });

  useEffect(() => {
    let active = true;

    async function load() {
      if (!groupId) {
        setState({
          loading: false,
          error: "Missing group_id. Open this page from a group workspace.",
          group: null,
          membershipRole: null,
          requests: [],
          invites: [],
        });
        return;
      }

      setState((current) => ({ ...current, loading: true, error: "" }));

      try {
        const group = await getGroup(auth.token, groupId);
        const members = await fetchAllGroupMembers(auth.token, groupId).catch(() => []);
        const membership =
          members.find((item) => Number(item.user_id) === Number(auth.profile?.id)) || null;

        const [requests, invites] = await Promise.all([
          group.privacy === "private" && group.visible
            ? listGroupJoinRequests(auth.token, groupId, "").catch(() => [])
            : Promise.resolve([]),
          group.privacy === "private" && !group.visible
            ? listInvites(auth.token, groupId).catch(() => [])
            : Promise.resolve([]),
        ]);

        if (!active) return;

        setState({
          loading: false,
          error: "",
          group,
          membershipRole: membership?.role || null,
          requests,
          invites,
        });
      } catch (error) {
        if (!active) return;
        setState({
          loading: false,
          error: error?.message || "Failed to load join review.",
          group: null,
          membershipRole: null,
          requests: [],
          invites: [],
        });
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [auth.profile?.id, auth.token, groupId, reloadNonce]);

  const workspace = useMemo(
    () =>
      buildGroupWorkspaceConfig({
        groupId,
        profileId: auth.profile?.id,
        group: state.group,
        membershipRole: state.membershipRole,
        activeKey: "group_requests",
      }),
    [auth.profile?.id, groupId, state.group, state.membershipRole]
  );

  const currentInvite = useMemo(() => activeInvite(state.invites), [state.invites]);
  const isHiddenPrivate = state.group?.privacy === "private" && !state.group?.visible;
  const pendingRequests = useMemo(
    () => state.requests.filter((item) => item.status === "pending"),
    [state.requests]
  );
  const approvedCount = useMemo(
    () => state.requests.filter((item) => item.status === "approved").length,
    [state.requests]
  );
  const isCreator = workspace.isCreator;
  const canApprove = isCreator || workspace.isAdmin || workspace.isModerator;
  const canReject = isCreator || workspace.isAdmin;
  const canGenerateCode = canApprove;
  const canDeactivateCode = isCreator || workspace.isAdmin;

  function reload() {
    setReloadNonce((value) => value + 1);
  }

  async function handleDecision(requestId, action) {
    const actionKey = `${action}-${requestId}`;
    setBusyAction(actionKey);
    try {
      await decideJoinRequest(auth.token, requestId, action);
      reload();
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error?.message || `Failed to ${action} request.`,
      }));
    } finally {
      setBusyAction("");
    }
  }

  async function handleGenerateCode() {
    setBusyAction("generate-code");
    try {
      await createInvite(auth.token, { group_id: groupId });
      reload();
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error?.message || "Failed to generate code.",
      }));
    } finally {
      setBusyAction("");
    }
  }

  async function handleDeactivateCode() {
    if (!currentInvite) return;
    setBusyAction("deactivate-code");
    try {
      await deleteInvite(auth.token, currentInvite.id);
      reload();
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error?.message || "Failed to deactivate code.",
      }));
    } finally {
      setBusyAction("");
    }
  }

  async function handleCopyCode() {
    if (!currentInvite) return;
    try {
      await navigator.clipboard.writeText(currentInvite.code);
    } catch {
      setState((current) => ({
        ...current,
        error: "Clipboard is not available in this browser.",
      }));
    }
  }

  const infoMessage = !state.group
    ? ""
    : state.group.privacy === "public"
      ? "Public groups skip join requests."
      : state.group.visible
        ? "Visible private group: moderators and admins can review join requests here."
        : canDeactivateCode
          ? "Hidden private group: generate, copy, or deactivate the single active invite code."
          : "Hidden private group: moderators can generate a code only when none is active.";

  return (
    <AppShell
      auth={auth}
      navigate={navigate}
      miniTitle="Group workspace"
      title="Join Requests"
      activeSidebarKey={workspace.activeKey}
      sidebarSections={workspace.sidebarSections}
      brandTo={routes.groupDetail(groupId || 0)}
      brandSubtitle="Group workspace"
    >
      <div className="workspace-legacy-stack group-review-page">
        <section className="dashboard-panel card members-overview-panel">
          <div className="card-body">
            <div className="group-inline-meta members-page-heading">
              <div>
                <h2>{state.group?.name || "Loading join requests..."}</h2>
                <p>
                  {state.group
                    ? state.group.privacy === "public"
                      ? "Public groups do not use join requests."
                      : state.group.visible
                        ? "Review incoming requests from visible private groups."
                        : "Manage the active code used to join this hidden private group."
                    : "Preparing the membership review workspace for this group."}
                </p>
              </div>
              <div className="members-header-actions">
                <button className="btn btn-secondary" type="button" onClick={() => navigate(routes.myGroups)}>
                  Back to groups
                </button>
                <button className="btn btn-secondary" type="button" onClick={reload} disabled={state.loading}>
                  Refresh
                </button>
              </div>
            </div>

            <div className="group-context-badges" aria-live="polite">
              {state.group ? <ContextChip label={`Group #${state.group.id}`} /> : null}
              {state.group ? (
                <ContextChip
                  label={state.group.privacy === "private" ? "Private group" : "Public group"}
                  tone={state.group.privacy === "private" ? "private" : "member"}
                />
              ) : null}
              {state.group ? (
                <ContextChip
                  label={state.group.visible ? "Visible" : "Hidden"}
                  tone={state.group.visible ? "active" : "neutral"}
                />
              ) : null}
              {isCreator ? (
                <ContextChip label="Creator view" tone="admin" />
              ) : state.membershipRole ? (
                <ContextChip
                  label={`Your role: ${state.membershipRole === "moderator" ? "Moderator" : "Admin"}`}
                  tone={state.membershipRole}
                />
              ) : null}
            </div>

            {state.error ? <div className="form-error">{state.error}</div> : null}
            <div className="dashboard-note members-status" aria-live="polite">
              {state.loading ? "Loading join review..." : infoMessage}
            </div>

            <div className="members-summary-grid" aria-label="Join request summary">
              <SummaryCard
                tone="total"
                label="Total requests"
                value={String(state.requests.length)}
                description="All requests recorded for this group."
              />
              <SummaryCard
                tone="admin"
                label="Pending"
                value={String(pendingRequests.length)}
                description="Waiting for moderation or admin review."
              />
              <SummaryCard
                tone="moderator"
                label="Approved"
                value={String(approvedCount)}
                description="Requests that already became group members."
              />
              <SummaryCard
                tone="member"
                label="Active code"
                value={currentInvite ? "Ready" : "None"}
                description={
                  !state.group
                    ? "Join-request access depends on group privacy and visibility."
                    : state.group.privacy === "public"
                      ? "Public groups do not use join requests or hidden invite codes."
                      : state.group.visible
                        ? "Visible private groups accept membership requests from discovery."
                        : currentInvite
                          ? "Hidden private group. Share the active code to let members join directly."
                          : "Hidden private group. Generate one active code to allow direct joining."
                }
              />
            </div>
          </div>
        </section>

        <section className="dashboard-panel card member-role-panel">
          <div className="card-body">
            <div className="member-role-header">
              <div>
                <h3>Pending Requests</h3>
                <p>Approve or reject incoming requests from discoverable private groups.</p>
              </div>
              <span className="member-section-count">{pendingRequests.length} pending</span>
            </div>

            <div className="member-role-list" aria-label="Group join requests">
              {!state.group ? null : state.group.privacy === "public" ? (
                <div className="member-empty-state">Public groups do not use join requests.</div>
              ) : !state.group.visible ? (
                <div className="member-empty-state">
                  Hidden private groups do not collect join requests. Use the active code below instead.
                </div>
              ) : pendingRequests.length ? (
                pendingRequests.map((item) => (
                  <article key={item.id} className="group-member-card tone-member">
                    <div className="group-member-main">
                      <div className="group-member-avatar-shell tone-member">
                        <img
                          className="group-member-avatar"
                          src={profileImageUrl({ profile_image: item.profile_image })}
                          alt={`${item.full_name || `User #${item.user_id}`} profile`}
                        />
                      </div>

                      <div className="group-member-copy">
                        <div className="group-member-heading">
                          <h4 className="group-member-name">{item.full_name || `User #${item.user_id}`}</h4>
                          <div className="badge-row">
                            <span className="badge warn">Pending</span>
                            <span className="badge info">{`User #${item.user_id}`}</span>
                          </div>
                        </div>
                        <p className="group-member-meta">Requested {formatDateTime(item.requested_at)}</p>
                      </div>
                    </div>

                    <div className="group-member-actions">
                      {canApprove ? (
                        <button
                          type="button"
                          className="member-action-btn primary"
                          disabled={busyAction === `approve-${item.id}`}
                          onClick={() => handleDecision(item.id, "approve")}
                        >
                          <i className="ti ti-check"></i>
                          <span>{busyAction === `approve-${item.id}` ? "Accepting..." : "Accept"}</span>
                        </button>
                      ) : null}
                      {canReject ? (
                        <button
                          type="button"
                          className="member-action-btn danger"
                          disabled={busyAction === `reject-${item.id}`}
                          onClick={() => handleDecision(item.id, "reject")}
                        >
                          <i className="ti ti-x"></i>
                          <span>{busyAction === `reject-${item.id}` ? "Rejecting..." : "Reject"}</span>
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))
              ) : (
                <div className="member-empty-state">No pending requests right now.</div>
              )}
            </div>
          </div>
        </section>

        {isHiddenPrivate ? (
          <section className="dashboard-panel card member-role-panel">
            <div className="card-body">
              <div className="member-role-header">
                <div>
                  <h3>Active Invite Code</h3>
                  <p>Hidden private groups use one active code instead of join requests.</p>
                </div>
                <span className="member-section-count">{currentInvite ? "Active code ready" : "No active code"}</span>
              </div>

              <div className="invite-code-card">
                <div className="invite-code-copy">
                  <span className="invite-code-label">Current code</span>
                  <strong>{currentInvite ? currentInvite.code : "No active code"}</strong>
                  <p>
                    {currentInvite
                      ? `Created ${formatDateTime(currentInvite.created_at)}${currentInvite.expires_at ? ` • Expires ${formatDateTime(currentInvite.expires_at)}` : " • No expiry"}`
                      : "Generate one reusable code for this hidden private group."}
                  </p>
                </div>

                <div className="group-member-actions invite-code-actions">
                  <button
                    type="button"
                    className="member-action-btn primary"
                    disabled={Boolean(currentInvite) || !canGenerateCode || busyAction === "generate-code"}
                    onClick={handleGenerateCode}
                  >
                    <i className="ti ti-plus"></i>
                    <span>{busyAction === "generate-code" ? "Generating..." : "Generate code"}</span>
                  </button>

                  {currentInvite ? (
                    <button type="button" className="member-action-btn secondary" onClick={handleCopyCode}>
                      <i className="ti ti-copy"></i>
                      <span>Copy</span>
                    </button>
                  ) : null}

                  {currentInvite && canDeactivateCode ? (
                    <button
                      type="button"
                      className="member-action-btn danger"
                      disabled={busyAction === "deactivate-code"}
                      onClick={handleDeactivateCode}
                    >
                      <i className="ti ti-power"></i>
                      <span>{busyAction === "deactivate-code" ? "Deactivating..." : "Deactivate"}</span>
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
