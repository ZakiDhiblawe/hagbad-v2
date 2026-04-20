import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import RouteLink from "../components/RouteLink";
import { usePageChrome } from "../hooks/usePageChrome";
import {
  addCycleMember,
  fillCycleMembers,
  getCycle,
  getGroup,
  listCycleMembers,
  listGroupMembers,
} from "../lib/api";
import { profileImageUrl } from "../lib/format";
import { buildGroupWorkspaceConfig } from "../lib/groupWorkspace";
import { routes } from "../lib/routes";

const PAGE_SIZE = 20;
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

function profileTone(member) {
  const role = String(member?.role || "").toLowerCase();
  if (role === "admin") return "admin";
  if (role === "moderator") return "moderator";
  return "member";
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

async function fetchAllCycleMembers(token, cycleId) {
  const items = [];
  for (let page = 1; page <= 50; page += 1) {
    const batch = await listCycleMembers(token, { cycleId, page, size: FETCH_SIZE });
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
      profile_image: null,
    });
  }
  return directory;
}

function buildOrderState(members, groupMembers, ownerId) {
  const requiredIds = new Set(
    [Number(ownerId), ...(groupMembers || []).map((item) => Number(item.user_id))].filter(
      (value) => Number.isFinite(value) && value > 0
    )
  );
  const orders = members
    .map((item) => Number(item.payout_order))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  const uniqueOrders = new Set(orders);
  const orderReady =
    members.length > 0 &&
    orders.length === members.length &&
    uniqueOrders.size === orders.length &&
    orders.every((value, index) => value === index + 1);

  return {
    participantsAdded: members.length,
    requiredCount: requiredIds.size || members.length,
    participantsComplete: members.length >= (requiredIds.size || members.length),
    orderReady,
  };
}

export default function CycleMembersPage({ auth, navigate, searchParams }) {
  const cycleId = Number(searchParams.get("cycle_id") || 0);
  const groupIdFromUrl = Number(searchParams.get("group_id") || 0);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [page, setPage] = useState(1);
  const [orderFilter, setOrderFilter] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [formError, setFormError] = useState("");
  const [addForm, setAddForm] = useState({
    user_id: "",
    payout_order: "",
    order_mode: "manual",
  });
  const [state, setState] = useState({
    loading: true,
    error: "",
    cycle: null,
    group: null,
    membershipRole: null,
    groupMembers: [],
    cycleMembers: [],
  });

  const pageTitle = state.cycle ? `Cycle #${state.cycle.id} Participants | Hagbad` : "Cycle Participants | Hagbad";

  usePageChrome({
    title: pageTitle,
    page: "cycle_members",
    bodyClassName: "portal-body dashboard-body",
  });

  useEffect(() => {
    let active = true;

    async function load() {
      if (!cycleId) {
        setState({
          loading: false,
          error: "Missing cycle_id. Open this page like: /cycle-members?cycle_id=1",
          cycle: null,
          group: null,
          membershipRole: null,
          groupMembers: [],
          cycleMembers: [],
        });
        return;
      }

      setState((current) => ({ ...current, loading: true, error: "" }));

      try {
        const cycle = await getCycle(auth.token, cycleId);
        const groupId = groupIdFromUrl || Number(cycle.group_id);
        const [group, groupMembers, cycleMembers] = await Promise.all([
          getGroup(auth.token, groupId),
          fetchAllGroupMembers(auth.token, groupId).catch(() => []),
          fetchAllCycleMembers(auth.token, cycleId),
        ]);
        const membership =
          groupMembers.find((member) => Number(member.user_id) === Number(auth.profile?.id)) || null;

        if (!active) return;

        setState({
          loading: false,
          error: "",
          cycle,
          group,
          membershipRole: membership?.role || null,
          groupMembers,
          cycleMembers,
        });
      } catch (error) {
        if (!active) return;
        setState({
          loading: false,
          error: error?.message || "Failed to load cycle participants.",
          cycle: null,
          group: null,
          membershipRole: null,
          groupMembers: [],
          cycleMembers: [],
        });
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [auth.profile?.id, auth.token, cycleId, groupIdFromUrl, reloadNonce]);

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
  const canSetupCycle = canManage && state.cycle?.status === "pending";

  const memberDirectory = useMemo(
    () => buildMemberDirectory(state.groupMembers, state.group?.created_by),
    [state.group?.created_by, state.groupMembers]
  );
  const orderState = useMemo(
    () => buildOrderState(state.cycleMembers, state.groupMembers, state.group?.created_by),
    [state.cycleMembers, state.group?.created_by, state.groupMembers]
  );
  const eligibleMembers = useMemo(() => {
    const participantIds = new Set(state.cycleMembers.map((item) => Number(item.user_id)));
    return state.groupMembers.filter((member) => !participantIds.has(Number(member.user_id)));
  }, [state.cycleMembers, state.groupMembers]);
  const filteredMembers = useMemo(() => {
    const normalizedOrder = String(orderFilter).trim();
    const items = [...state.cycleMembers].sort((a, b) => {
      const orderDelta = Number(a.payout_order) - Number(b.payout_order);
      if (orderDelta !== 0) return orderDelta;
      return Number(a.id) - Number(b.id);
    });
    if (!normalizedOrder) return items;
    return items.filter((member) => String(member.payout_order) === normalizedOrder);
  }, [orderFilter, state.cycleMembers]);
  const pagedMembers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredMembers.slice(start, start + PAGE_SIZE);
  }, [filteredMembers, page]);
  const pageCount = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [orderFilter, reloadNonce]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  async function reload() {
    setReloadNonce((value) => value + 1);
  }

  async function handleDoneOrder() {
    if (!orderState.participantsAdded) {
      setState((current) => ({
        ...current,
        error: "Add members to this cycle before finishing the order step.",
      }));
      return;
    }
    if (!orderState.participantsComplete) {
      setState((current) => ({
        ...current,
        error: "Add every group member before marking the order step done.",
      }));
      return;
    }
    if (!orderState.orderReady) {
      setState((current) => ({
        ...current,
        error: "Make the payout order consecutive from 1 to the last member before marking done.",
      }));
      return;
    }

    navigate(routes.cycleDetail(cycleId, groupId));
  }

  async function handleFillGroup() {
    setBusyAction("fill-group");
    try {
      await fillCycleMembers(auth.token, {
        cycle_id: cycleId,
        order_mode: addForm.order_mode,
      });
      await reload();
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error?.message || "Failed to add the remaining group members.",
      }));
    } finally {
      setBusyAction("");
    }
  }

  async function handleAddParticipant(event) {
    event.preventDefault();
    setFormError("");

    if (!addForm.user_id) {
      setFormError("Select a group member to add to this cycle.");
      return;
    }

    setBusyAction("add-member");
    try {
      await addCycleMember(auth.token, {
        cycle_id: cycleId,
        user_id: Number(addForm.user_id),
        payout_order: addForm.payout_order ? Number(addForm.payout_order) : null,
      });
      setAddOpen(false);
      setAddForm((current) => ({ ...current, user_id: "", payout_order: "" }));
      await reload();
    } catch (error) {
      setFormError(error?.message || "Failed to add cycle participant.");
    } finally {
      setBusyAction("");
    }
  }

  return (
    <AppShell
      auth={auth}
      navigate={navigate}
      miniTitle="Group workspace"
      title="Cycle Participants"
      activeSidebarKey={workspace.activeKey}
      sidebarSections={workspace.sidebarSections}
      brandTo={routes.groupDetail(groupId || 0)}
      brandSubtitle="Group workspace"
    >
      <section className="dashboard-panel card workspace-legacy-card">
        <div className="card-body">
          <div className="workspace-legacy-intro">
            <div>
              <h2>{state.cycle ? `Review payout order for cycle #${state.cycle.id}` : "Loading participants..."}</h2>
              <p>
                {state.group
                  ? `${state.group.name} • confirm member names and who gets each payout turn first`
                  : "Participation and payout order setup for the selected cycle."}
              </p>
            </div>
            <p className="dashboard-note mb-0">
              {canSetupCycle
                ? "Admins and moderators can add every group member, confirm the payout order using real member names, then finish this step before starting the cycle."
                : canManage
                  ? "This cycle is no longer pending, so the payout order is locked for review only."
                  : "Participants can view the payout order here. Admins and moderators manage the setup before the cycle starts."}
            </p>
          </div>

          {state.error ? <div className="form-error" role="alert">{state.error}</div> : null}

          <div className="toolbar" role="group" aria-label="Cycle participant actions">
            <div className="toolbar-left">
              <button className="btn btn-secondary" type="button" onClick={() => navigate(routes.cycleDetail(cycleId, groupId))}>
                Back to cycle
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => navigate(routes.groupMembers(groupId))}>
                Group members
              </button>
            </div>

            <div className="toolbar-right">
              {canSetupCycle ? (
                <button className="btn" type="button" onClick={handleDoneOrder}>
                  Done with order
                </button>
              ) : null}

              <input
                type="number"
                min="1"
                step="1"
                placeholder="Filter order"
                aria-label="Filter by payout order"
                value={orderFilter}
                onChange={(event) => setOrderFilter(event.target.value)}
              />

              {canSetupCycle ? (
                <select
                  className="select"
                  aria-label="Fill remaining members order mode"
                  value={addForm.order_mode}
                  onChange={(event) => setAddForm((current) => ({ ...current, order_mode: event.target.value }))}
                >
                  <option value="manual">Fill by joined order</option>
                  <option value="random">Fill randomly</option>
                </select>
              ) : null}

              <button className="btn btn-secondary" type="button" onClick={reload} disabled={state.loading}>
                Refresh
              </button>

              {canSetupCycle ? (
                <button
                  className="btn btn-secondary"
                  type="button"
                  disabled={busyAction === "fill-group"}
                  onClick={handleFillGroup}
                >
                  {busyAction === "fill-group" ? "Adding..." : "Add all remaining"}
                </button>
              ) : null}

              {canSetupCycle ? (
                <button className="btn" type="button" onClick={() => setAddOpen(true)}>
                  Add participant
                </button>
              ) : null}
            </div>
          </div>

          <div className="dashboard-note mb-3" aria-live="polite">
            {state.loading
              ? "Loading…"
              : eligibleMembers.length
                ? `${eligibleMembers.length} group members can still join this cycle.`
                : "All visible group members in this group are already participating in this cycle."}
          </div>

          <ul className="list" aria-label="Cycle participants">
            {pagedMembers.length ? (
              pagedMembers.map((member) => {
                const profileMember = memberDirectory.get(Number(member.user_id)) || null;
                const displayName = resolveDisplayName(profileMember, member.user_id);
                const tone = profileTone(profileMember);

                return (
                  <li key={member.id} className="list-item">
                    <div className="list-main">
                      <div className="group-member-main">
                        <div className={`group-member-avatar-shell tone-${tone}`}>
                          <img
                            className="group-member-avatar"
                            src={profileImageUrl(profileMember)}
                            alt={`${displayName} profile`}
                          />
                        </div>

                        <div className="group-member-copy">
                          <div className="list-title">{displayName}</div>
                          <div className="list-meta">
                            {`Cycle member #${member.id} • ${capitalize(profileMember?.role)} • added ${formatDateTime(member.created_at)}`}
                          </div>
                          <div className="badge-row">
                            <span className="member-context-chip moderator">Order #{member.payout_order}</span>
                            <span className={`member-context-chip ${member.received ? "admin" : "member"}`}>
                              {member.received ? "Received" : "Waiting turn"}
                            </span>
                            {Number(member.user_id) === Number(auth.profile?.id) ? (
                              <span className="member-context-chip admin">You</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="list-actions">
                      <RouteLink
                        className="btn btn-secondary"
                        to={routes.cycleMemberDetail(member.id, cycleId, groupId)}
                        navigate={navigate}
                      >
                        {canManage ? "Manage" : "View"}
                      </RouteLink>
                    </div>
                  </li>
                );
              })
            ) : (
              <li className="list-empty">
                {orderFilter
                  ? "No participants match that payout order."
                  : "No participants yet. Add cycle members before payments or payouts."}
              </li>
            )}
          </ul>

          <div className="pager" aria-label="Pagination">
            <button
              className="btn btn-secondary"
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Prev
            </button>
            <span className="dashboard-note">Page {page}</span>
            <button
              className="btn btn-secondary"
              type="button"
              disabled={page >= pageCount}
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {addOpen && canSetupCycle ? (
        <>
          <div className="modal-overlay" onClick={() => setAddOpen(false)}></div>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="add-title">
            <h3 id="add-title">Add cycle participant</h3>
            <p className="hint">
              {eligibleMembers.length
                ? `${eligibleMembers.length} group members can still join this cycle.`
                : "No available group members remain for this cycle."}
            </p>

            <form onSubmit={handleAddParticipant} noValidate>
              {formError ? <div className="form-error" role="alert">{formError}</div> : null}

              <div className="workspace-form-grid cols-2">
                <div className="field">
                  <label htmlFor="user_id">Group member</label>
                  <select
                    id="user_id"
                    className="select"
                    value={addForm.user_id}
                    onChange={(event) => setAddForm((current) => ({ ...current, user_id: event.target.value }))}
                  >
                    <option value="">{eligibleMembers.length ? "Select group member" : "No available group members"}</option>
                    {eligibleMembers.map((member) => (
                      <option key={member.id} value={member.user_id}>
                        {`${resolveDisplayName(member, member.user_id)} (${capitalize(member.role)})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="payout_order">Payout order (optional)</label>
                  <input
                    id="payout_order"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Leave empty to auto-assign next order"
                    value={addForm.payout_order}
                    onChange={(event) => setAddForm((current) => ({ ...current, payout_order: event.target.value }))}
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button className="btn btn-secondary" type="button" onClick={() => setAddOpen(false)}>
                  Cancel
                </button>
                <button className="btn" type="submit" disabled={busyAction === "add-member" || !eligibleMembers.length}>
                  {busyAction === "add-member" ? "Adding..." : "Add participant"}
                </button>
              </div>
            </form>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
