import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { usePageChrome } from "../hooks/usePageChrome";
import {
  deleteGroupMember,
  getGroup,
  leaveGroup,
  listGroupMembers,
  updateGroupMember,
} from "../lib/api";
import { buildGroupWorkspaceConfig } from "../lib/groupWorkspace";
import { profileImageUrl } from "../lib/format";
import { routes } from "../lib/routes";

const PAGE_SIZE = 100;

function roleLabel(role) {
  if (role === "admin") return "Admin";
  if (role === "moderator") return "Moderator";
  return "Member";
}

function formatDateTime(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
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

function sortMembers(items) {
  return [...items].sort((a, b) => {
    const aTime = new Date(a.joined_at).getTime();
    const bTime = new Date(b.joined_at).getTime();
    if (aTime !== bTime) return aTime - bTime;
    return Number(a.id) - Number(b.id);
  });
}

function getSummaryCounts(members) {
  return members.reduce(
    (acc, member) => {
      acc.total += 1;
      if (member.role === "admin") acc.admin += 1;
      else if (member.role === "moderator") acc.moderator += 1;
      else acc.member += 1;
      return acc;
    },
    { total: 0, admin: 0, moderator: 0, member: 0 }
  );
}

function Badge({ children, tone }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function ContextChip({ children, tone }) {
  return <span className={`member-context-chip ${tone}`}>{children}</span>;
}

function MemberCard({
  member,
  auth,
  group,
  canManage,
  busyAction,
  onPromoteAdmin,
  onPromoteModerator,
  onDemoteModerator,
  onDemoteAdmin,
  onRemove,
}) {
  const isCreator = Number(member.user_id) === Number(group.created_by);
  const isCurrentUser = Number(member.user_id) === Number(auth.profile?.id);
  const canManageMember = canManage && !isCreator && !isCurrentUser;

  return (
    <article className={`group-member-card tone-${member.role === "admin" ? "admin" : member.role === "moderator" ? "moderator" : "member"}`}>
      <div className="group-member-main">
        <div className={`group-member-avatar-shell tone-${member.role === "admin" ? "admin" : member.role === "moderator" ? "moderator" : "member"}`}>
          <img
            className="group-member-avatar"
            src={profileImageUrl({ profile_image: member.profile_image })}
            alt={`${member.full_name || `User #${member.user_id}`} profile`}
          />
        </div>

        <div className="group-member-copy">
          <div className="group-member-heading">
            <h4 className="group-member-name">{member.full_name || `User #${member.user_id}`}</h4>
            <div className="badge-row">
              <Badge tone={member.role === "admin" ? "ok" : member.role === "moderator" ? "warn" : "info"}>
                {roleLabel(member.role)}
              </Badge>
              {isCreator ? <Badge tone="ok">Owner</Badge> : null}
              {isCurrentUser ? <Badge tone="info">You</Badge> : null}
            </div>
          </div>
          <p className="group-member-meta">Joined {formatDateTime(member.joined_at)}</p>
        </div>
      </div>

      <div className="group-member-actions">
        {canManageMember ? (
          <>
            {member.role === "admin" ? (
              <>
                <button
                  type="button"
                  className="member-action-btn secondary"
                  disabled={busyAction === `moderator-${member.id}`}
                  onClick={() => onDemoteAdmin(member)}
                >
                  <i className="ti ti-shield"></i>
                  <span>{busyAction === `moderator-${member.id}` ? "Saving..." : "Delegate moderator"}</span>
                </button>
                <button
                  type="button"
                  className="member-action-btn danger"
                  disabled={busyAction === `member-${member.id}`}
                  onClick={() => onDemoteModerator(member)}
                >
                  <i className="ti ti-arrow-down"></i>
                  <span>{busyAction === `member-${member.id}` ? "Saving..." : "Remove admin"}</span>
                </button>
              </>
            ) : null}

            {member.role === "moderator" ? (
              <>
                <button
                  type="button"
                  className="member-action-btn primary"
                  disabled={busyAction === `admin-${member.id}`}
                  onClick={() => onPromoteAdmin(member)}
                >
                  <i className="ti ti-crown"></i>
                  <span>{busyAction === `admin-${member.id}` ? "Saving..." : "Make admin"}</span>
                </button>
                <button
                  type="button"
                  className="member-action-btn secondary"
                  disabled={busyAction === `member-${member.id}`}
                  onClick={() => onDemoteModerator(member)}
                >
                  <i className="ti ti-arrow-down"></i>
                  <span>{busyAction === `member-${member.id}` ? "Saving..." : "Remove moderator"}</span>
                </button>
                <button
                  type="button"
                  className="member-action-btn danger"
                  disabled={busyAction === `remove-${member.id}`}
                  onClick={() => onRemove(member)}
                >
                  <i className="ti ti-user-x"></i>
                  <span>{busyAction === `remove-${member.id}` ? "Removing..." : "Remove"}</span>
                </button>
              </>
            ) : null}

            {member.role === "member" ? (
              <>
                <button
                  type="button"
                  className="member-action-btn primary"
                  disabled={busyAction === `admin-${member.id}`}
                  onClick={() => onPromoteAdmin(member)}
                >
                  <i className="ti ti-crown"></i>
                  <span>{busyAction === `admin-${member.id}` ? "Saving..." : "Make admin"}</span>
                </button>
                <button
                  type="button"
                  className="member-action-btn secondary"
                  disabled={busyAction === `moderator-${member.id}`}
                  onClick={() => onPromoteModerator(member)}
                >
                  <i className="ti ti-shield"></i>
                  <span>{busyAction === `moderator-${member.id}` ? "Saving..." : "Make moderator"}</span>
                </button>
                <button
                  type="button"
                  className="member-action-btn danger"
                  disabled={busyAction === `remove-${member.id}`}
                  onClick={() => onRemove(member)}
                >
                  <i className="ti ti-user-x"></i>
                  <span>{busyAction === `remove-${member.id}` ? "Removing..." : "Remove"}</span>
                </button>
              </>
            ) : null}
          </>
        ) : (
          <span className="member-action-note">
            {isCreator ? "Group owner" : isCurrentUser ? "Current member" : "View only"}
          </span>
        )}
      </div>
    </article>
  );
}

function RoleSection({ title, description, countLabel, items, emptyText, children }) {
  return (
    <section className="dashboard-panel card member-role-panel">
      <div className="card-body">
        <div className="member-role-header">
          <div>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
          <span className="member-section-count">{countLabel}</span>
        </div>

        <div className="member-role-list" aria-label={title}>
          {items.length ? children : <div className="member-empty-state">{emptyText}</div>}
        </div>
      </div>
    </section>
  );
}

export default function GroupMembersPage({ auth, navigate, searchParams }) {
  const groupId = Number(searchParams.get("group_id") || 0);

  usePageChrome({
    title: "Group Members | Hagbad",
    page: "group_members",
    bodyClassName: "portal-body dashboard-body",
  });

  const [state, setState] = useState({
    loading: true,
    error: "",
    group: null,
    membership: null,
    members: [],
  });
  const [busyAction, setBusyAction] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!groupId) {
        setState({
          loading: false,
          error: "Missing group_id. Open this page like: /group-members?group_id=1",
          group: null,
          membership: null,
          members: [],
        });
        return;
      }

      setState((current) => ({ ...current, loading: true, error: "" }));

      try {
        const group = await getGroup(auth.token, groupId);
        const members = await fetchAllGroupMembers(auth.token, groupId);
        const membership =
          members.find((member) => Number(member.user_id) === Number(auth.profile?.id)) || null;

        if (!active) return;
        setState({
          loading: false,
          error: "",
          group,
          membership,
          members,
        });
      } catch (error) {
        if (!active) return;
        setState({
          loading: false,
          error: error?.message || "Failed to load members.",
          group: null,
          membership: null,
          members: [],
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
        membershipRole: state.membership?.role || null,
        activeKey: "group_members",
      }),
    [auth.profile?.id, groupId, state.group, state.membership?.role]
  );

  const counts = useMemo(() => getSummaryCounts(state.members), [state.members]);
  const admins = useMemo(
    () => sortMembers(state.members.filter((member) => member.role === "admin")),
    [state.members]
  );
  const moderators = useMemo(
    () => sortMembers(state.members.filter((member) => member.role === "moderator")),
    [state.members]
  );
  const ordinaryMembers = useMemo(
    () => sortMembers(state.members.filter((member) => member.role === "member")),
    [state.members]
  );

  const roleMessage = state.membership
    ? `You are viewing this group as ${roleLabel(state.membership.role)}.`
    : state.group
      ? "You are viewing this group as the creator."
      : "";

  async function reload() {
    setReloadNonce((value) => value + 1);
  }

  async function handleRoleChange(member, nextRole, actionKey) {
    setBusyAction(actionKey);
    try {
      await updateGroupMember(auth.token, member.id, nextRole);
      await reload();
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error?.message || "Failed to update member.",
      }));
    } finally {
      setBusyAction("");
    }
  }

  async function handleRemove(member) {
    if (!window.confirm(`Remove ${member.full_name || `User #${member.user_id}`} from the group?`)) {
      return;
    }

    const actionKey = `remove-${member.id}`;
    setBusyAction(actionKey);
    try {
      await deleteGroupMember(auth.token, member.id);
      await reload();
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error?.message || "Failed to remove member.",
      }));
    } finally {
      setBusyAction("");
    }
  }

  async function handleExitGroup() {
    if (workspace.isCreator) return;
    if (!window.confirm("Exit this group? If you are the last admin, the earliest moderator or member will be promoted.")) {
      return;
    }

    setBusyAction("exit-group");
    try {
      await leaveGroup(auth.token, groupId);
      navigate(routes.myGroups);
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error?.message || "Failed to exit group.",
      }));
    } finally {
      setBusyAction("");
    }
  }

  return (
    <AppShell
      auth={auth}
      navigate={navigate}
      miniTitle="Group workspace"
      title="Members"
      activeSidebarKey={workspace.activeKey}
      sidebarSections={workspace.sidebarSections}
      brandTo={routes.groupDetail(groupId || 0)}
      brandSubtitle="Group workspace"
    >
      <div className="workspace-legacy-stack group-members-page">
        <section className="dashboard-panel card members-overview-panel">
          <div className="card-body">
            <div className="group-inline-meta members-page-heading">
              <div>
                <h2>{state.group?.name || "Loading members..."}</h2>
                <p>Review roles, manage access, and keep your group leadership organized.</p>
              </div>
              <div className="members-header-actions">
                {state.group && (state.membership || workspace.isCreator) ? (
                  <button
                    className="btn btn-secondary"
                    type="button"
                    disabled={workspace.isCreator || busyAction === "exit-group"}
                    title={workspace.isCreator ? "Group creator cannot leave until ownership transfer is supported." : ""}
                    onClick={handleExitGroup}
                  >
                    {busyAction === "exit-group" ? "Exiting..." : "Exit group"}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="group-context-badges" aria-live="polite">
              {state.group ? <ContextChip tone="neutral">Group #{state.group.id}</ContextChip> : null}
              {state.group ? (
                <ContextChip tone={state.group.privacy === "private" ? "private" : "member"}>
                  {state.group.privacy === "private" ? "Private group" : "Public group"}
                </ContextChip>
              ) : null}
              {state.group ? (
                <ContextChip tone={state.group.status === "closed" ? "closed" : "active"}>
                  {state.group.status === "closed" ? "Closed" : "Active"}
                </ContextChip>
              ) : null}
              {state.membership ? (
                <ContextChip tone={state.membership.role}>Your role: {roleLabel(state.membership.role)}</ContextChip>
              ) : workspace.isCreator ? (
                <ContextChip tone="admin">Creator view</ContextChip>
              ) : null}
            </div>

            {state.error ? <div className="form-error" role="alert">{state.error}</div> : null}
            <div className="dashboard-note members-status" aria-live="polite">
              {state.loading
                ? "Loading members..."
                : `${state.members.length} members loaded. ${roleMessage}`}
            </div>

            <div className="members-summary-grid" aria-label="Membership summary">
              <article className="members-summary-card total">
                <span>Total members</span>
                <strong>{counts.total}</strong>
                <p>Everyone currently inside this group workspace.</p>
              </article>
              <article className="members-summary-card admin">
                <span>Admins</span>
                <strong>{counts.admin}</strong>
                <p>Full control over members, cycles, and group administration.</p>
              </article>
              <article className="members-summary-card moderator">
                <span>Moderators</span>
                <strong>{counts.moderator}</strong>
                <p>Trusted members helping manage day-to-day group work.</p>
              </article>
              <article className="members-summary-card member">
                <span>Ordinary members</span>
                <strong>{counts.member}</strong>
                <p>Regular participants with standard group access.</p>
              </article>
            </div>
          </div>
        </section>

        <RoleSection
          title="Admins"
          description="Leaders with full control over the group and member access."
          countLabel={`${counts.admin} admin${counts.admin === 1 ? "" : "s"}`}
          items={admins}
          emptyText="No admins are currently assigned to this group."
        >
          {admins.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              auth={auth}
              group={state.group}
              canManage={workspace.canManageGroup}
              busyAction={busyAction}
              onPromoteAdmin={(target) => handleRoleChange(target, "admin", `admin-${target.id}`)}
              onPromoteModerator={(target) => handleRoleChange(target, "moderator", `moderator-${target.id}`)}
              onDemoteModerator={(target) => handleRoleChange(target, "member", `member-${target.id}`)}
              onDemoteAdmin={(target) => handleRoleChange(target, "moderator", `moderator-${target.id}`)}
              onRemove={handleRemove}
            />
          ))}
        </RoleSection>

        <RoleSection
          title="Moderators"
          description="Supporting members who can help manage activity inside the group."
          countLabel={`${counts.moderator} moderator${counts.moderator === 1 ? "" : "s"}`}
          items={moderators}
          emptyText="No moderators are currently assigned to this group."
        >
          {moderators.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              auth={auth}
              group={state.group}
              canManage={workspace.canManageGroup}
              busyAction={busyAction}
              onPromoteAdmin={(target) => handleRoleChange(target, "admin", `admin-${target.id}`)}
              onPromoteModerator={(target) => handleRoleChange(target, "moderator", `moderator-${target.id}`)}
              onDemoteModerator={(target) => handleRoleChange(target, "member", `member-${target.id}`)}
              onDemoteAdmin={(target) => handleRoleChange(target, "moderator", `moderator-${target.id}`)}
              onRemove={handleRemove}
            />
          ))}
        </RoleSection>

        <RoleSection
          title="Ordinary Members"
          description="Participants with standard access inside this group."
          countLabel={`${counts.member} member${counts.member === 1 ? "" : "s"}`}
          items={ordinaryMembers}
          emptyText="No ordinary members are currently assigned to this group."
        >
          {ordinaryMembers.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              auth={auth}
              group={state.group}
              canManage={workspace.canManageGroup}
              busyAction={busyAction}
              onPromoteAdmin={(target) => handleRoleChange(target, "admin", `admin-${target.id}`)}
              onPromoteModerator={(target) => handleRoleChange(target, "moderator", `moderator-${target.id}`)}
              onDemoteModerator={(target) => handleRoleChange(target, "member", `member-${target.id}`)}
              onDemoteAdmin={(target) => handleRoleChange(target, "moderator", `moderator-${target.id}`)}
              onRemove={handleRemove}
            />
          ))}
        </RoleSection>
      </div>
    </AppShell>
  );
}
