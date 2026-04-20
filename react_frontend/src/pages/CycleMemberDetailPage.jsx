import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { usePageChrome } from "../hooks/usePageChrome";
import {
  deleteCycleMember,
  getCycle,
  getCycleMember,
  getGroup,
  listGroupMembers,
  updateCycleMember,
} from "../lib/api";
import { buildGroupWorkspaceConfig } from "../lib/groupWorkspace";
import { routes } from "../lib/routes";

const FETCH_SIZE = 100;

function resolveDisplayName(member, userId) {
  if (member?.full_name) return member.full_name;
  return `Member #${userId}`;
}

function capitalize(value) {
  const text = String(value || "").trim();
  if (!text) return "Member";
  return text.charAt(0).toUpperCase() + text.slice(1);
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
    const batch = await listGroupMembers(token, { groupId, page, size: FETCH_SIZE });
    items.push(...batch);
    if (batch.length < FETCH_SIZE) break;
  }
  return items;
}

function buildMemberDirectory(groupMembers, ownerId) {
  const directory = new Map((groupMembers || []).map((member) => [Number(member.user_id), member]));
  if (ownerId && !directory.has(Number(ownerId))) {
    directory.set(Number(ownerId), {
      user_id: Number(ownerId),
      role: "admin",
      full_name: null,
    });
  }
  return directory;
}

export default function CycleMemberDetailPage({ auth, navigate, searchParams }) {
  const memberId = Number(searchParams.get("member_id") || 0);
  const cycleId = Number(searchParams.get("cycle_id") || 0);
  const groupIdFromUrl = Number(searchParams.get("group_id") || 0);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [busyAction, setBusyAction] = useState("");
  const [formMessage, setFormMessage] = useState({ kind: "", text: "" });
  const [form, setForm] = useState({ payout_order: "" });
  const [state, setState] = useState({
    loading: true,
    error: "",
    cycle: null,
    group: null,
    membershipRole: null,
    member: null,
    groupMembers: [],
  });

  const pageTitle = state.member ? `Cycle Participant #${state.member.id} | Hagbad` : "Cycle Participant | Hagbad";

  usePageChrome({
    title: pageTitle,
    page: "cycle_member_detail",
    bodyClassName: "portal-body dashboard-body",
  });

  useEffect(() => {
    let active = true;

    async function load() {
      if (!memberId || !cycleId) {
        setState({
          loading: false,
          error: "Missing cycle_id or member_id.",
          cycle: null,
          group: null,
          membershipRole: null,
          member: null,
          groupMembers: [],
        });
        return;
      }

      setState((current) => ({ ...current, loading: true, error: "" }));

      try {
        const [cycleMember, cycle] = await Promise.all([
          getCycleMember(auth.token, memberId),
          getCycle(auth.token, cycleId),
        ]);
        const groupId = groupIdFromUrl || Number(cycle.group_id);
        const [group, groupMembers] = await Promise.all([
          getGroup(auth.token, groupId),
          fetchAllGroupMembers(auth.token, groupId).catch(() => []),
        ]);
        const membership =
          groupMembers.find((item) => Number(item.user_id) === Number(auth.profile?.id)) || null;

        if (!active) return;
        setState({
          loading: false,
          error: "",
          cycle,
          group,
          membershipRole: membership?.role || null,
          member: cycleMember,
          groupMembers,
        });
      } catch (error) {
        if (!active) return;
        setState({
          loading: false,
          error: error?.message || "Failed to load cycle participant.",
          cycle: null,
          group: null,
          membershipRole: null,
          member: null,
          groupMembers: [],
        });
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [auth.profile?.id, auth.token, cycleId, groupIdFromUrl, memberId, reloadNonce]);

  useEffect(() => {
    if (!state.member) return;
    setForm({ payout_order: String(state.member.payout_order || "") });
  }, [state.member]);

  const groupId = state.group?.id || state.cycle?.group_id || groupIdFromUrl || 0;
  const workspace = useMemo(
    () =>
      buildGroupWorkspaceConfig({
        groupId,
        profileId: auth.profile?.id,
        group: state.group,
        membershipRole: state.membershipRole,
        activeKey: "group_cycles",
      }),
    [auth.profile?.id, groupId, state.group, state.membershipRole]
  );
  const canManage = workspace.canManageCycles;
  const canManageSetup = canManage && state.cycle?.status === "pending";
  const memberDirectory = useMemo(
    () => buildMemberDirectory(state.groupMembers, state.group?.created_by),
    [state.group?.created_by, state.groupMembers]
  );
  const profileMember = state.member ? memberDirectory.get(Number(state.member.user_id)) || null : null;
  const displayName = state.member ? resolveDisplayName(profileMember, state.member.user_id) : "Loading participant...";

  async function reload() {
    setReloadNonce((value) => value + 1);
  }

  async function handleSave(event) {
    event.preventDefault();
    setFormMessage({ kind: "", text: "" });

    const payoutOrder = Number(form.payout_order);
    if (!payoutOrder) {
      setFormMessage({ kind: "error", text: "Payout order must be at least 1." });
      return;
    }

    setBusyAction("save");
    try {
      await updateCycleMember(auth.token, memberId, { payout_order: payoutOrder });
      setFormMessage({ kind: "success", text: "Payout order updated." });
      await reload();
    } catch (error) {
      setFormMessage({ kind: "error", text: error?.message || "Failed to update payout order." });
    } finally {
      setBusyAction("");
    }
  }

  async function handleRemove() {
    if (!window.confirm("Remove this participant from the cycle?")) return;

    setBusyAction("remove");
    try {
      await deleteCycleMember(auth.token, memberId);
      navigate(routes.cycleMembers(cycleId, groupId));
    } catch (error) {
      setFormMessage({ kind: "error", text: error?.message || "Failed to remove participant." });
      setBusyAction("");
    }
  }

  return (
    <AppShell
      auth={auth}
      navigate={navigate}
      miniTitle="Group workspace"
      title="Cycle Participant"
      activeSidebarKey={workspace.activeKey}
      sidebarSections={workspace.sidebarSections}
      brandTo={routes.groupDetail(groupId || 0)}
      brandSubtitle="Group workspace"
    >
      <section className="dashboard-panel card workspace-legacy-card">
        <div className="card-body">
          <div className="workspace-legacy-intro">
            <div>
              <h2>{displayName}</h2>
              <p>
                {state.member && state.cycle && state.group
                  ? `Order #${state.member.payout_order} • Cycle #${state.cycle.id} • ${state.group.name}`
                  : "Preparing cycle participant detail."}
              </p>
            </div>
            <p className="dashboard-note mb-0">
              {canManage
                ? canManageSetup
                  ? "Admins and moderators can change payout order or remove participation while the cycle is pending."
                  : "This cycle is already active, paused, or completed, so the participant setup is locked."
                : Number(state.member?.user_id) === Number(auth.profile?.id)
                  ? "You can review your participation record here."
                  : "View only."}
            </p>
          </div>

          {state.error ? <div className="form-error" role="alert">{state.error}</div> : null}

          <dl className="profile-grid">
            <dt>Member name</dt>
            <dd>{displayName}</dd>
            <dt>Group role</dt>
            <dd>{capitalize(profileMember?.role)}</dd>
            <dt>Cycle member ID</dt>
            <dd>{state.member?.id || "-"}</dd>
            <dt>Cycle ID</dt>
            <dd>{state.member?.cycle_id || cycleId || "-"}</dd>
            <dt>User ID</dt>
            <dd>{state.member?.user_id || "-"}</dd>
            <dt>Payout order</dt>
            <dd>{state.member?.payout_order || "-"}</dd>
            <dt>Received</dt>
            <dd>{state.member?.received ? "Yes" : "No"}</dd>
            <dt>Added</dt>
            <dd>{formatDateTime(state.member?.created_at)}</dd>
          </dl>

          {canManageSetup ? (
            <div className="mt-3">
              <form className="stack" onSubmit={handleSave} noValidate>
                {formMessage.text ? (
                  <div className={formMessage.kind === "success" ? "form-success" : "form-error"} role="status">
                    {formMessage.text}
                  </div>
                ) : null}

                <div className="field">
                  <label htmlFor="payout_order">Payout order</label>
                  <input
                    id="payout_order"
                    type="number"
                    min="1"
                    step="1"
                    value={form.payout_order}
                    onChange={(event) => setForm({ payout_order: event.target.value })}
                  />
                </div>

                <div className="modal-actions">
                  <button className="btn" type="submit" disabled={busyAction === "save"}>
                    {busyAction === "save" ? "Saving..." : "Save payout order"}
                  </button>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    disabled={busyAction === "remove"}
                    onClick={handleRemove}
                  >
                    {busyAction === "remove" ? "Removing..." : "Remove participant"}
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          <div className="toolbar mt-3" role="group" aria-label="Participant detail links">
            <div className="toolbar-left">
              <button className="btn btn-secondary" type="button" onClick={() => navigate(routes.payments(cycleId, memberId, groupId))}>
                View payments
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => navigate(routes.payouts(cycleId, memberId, groupId))}>
                View payouts
              </button>
            </div>
            <div className="toolbar-right">
              <button className="btn btn-secondary" type="button" onClick={() => navigate(routes.cycleMembers(cycleId, groupId))}>
                Back to participants
              </button>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
