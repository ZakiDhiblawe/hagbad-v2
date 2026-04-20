import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import RouteLink from "../components/RouteLink";
import { usePageChrome } from "../hooks/usePageChrome";
import {
  createCycle,
  getGroup,
  getGroupSettings,
  getPaymentSummary,
  getPayoutSummary,
  listCycleMembers,
  listCyclesForGroup,
  listGroupMembers,
  startCycle,
  stopCycle,
} from "../lib/api";
import { buildGroupWorkspaceConfig } from "../lib/groupWorkspace";
import { profileImageUrl } from "../lib/format";
import { routes } from "../lib/routes";

const PAGE_SIZE = 100;

function formatDate(value) {
  if (!value) return "-";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString();
}

function formatDateTime(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
}

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "-";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return amount.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function frequencyLabel(cycle) {
  if (!cycle) return "-";
  if (cycle.frequency === "custom_days" && cycle.custom_days) {
    return `custom (${cycle.custom_days} days)`;
  }
  return String(cycle.frequency || "-");
}

function cycleStatusLabel(status) {
  if (status === "pending") return "Pending setup";
  if (status === "paused") return "Paused";
  if (status === "active") return "Active";
  return "Completed";
}

function cycleStatusTone(status) {
  if (status === "active") return "admin";
  if (status === "paused" || status === "pending") return "moderator";
  return "member";
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

async function fetchAllCycles(token, groupId) {
  const items = [];
  for (let page = 1; page <= 50; page += 1) {
    const batch = await listCyclesForGroup(token, groupId, { page, size: PAGE_SIZE });
    items.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return items;
}

async function fetchAllCycleMembers(token, cycleId) {
  const items = [];
  for (let page = 1; page <= 50; page += 1) {
    const batch = await listCycleMembers(token, { cycleId, page, size: PAGE_SIZE });
    items.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return items;
}

function pickCurrentCycle(items) {
  const openCycles = items.filter((cycle) => cycle.status !== "completed");
  if (!openCycles.length) return null;

  const rank = { active: 0, pending: 1, paused: 2 };
  return [...openCycles].sort((a, b) => {
    const rankDelta = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
    if (rankDelta !== 0) return rankDelta;
    return new Date(b.created_at) - new Date(a.created_at);
  })[0];
}

function buildSetupState(group, groupMembers, cycleMembers) {
  const requiredIds = new Set([Number(group.created_by)]);
  groupMembers.forEach((member) => requiredIds.add(Number(member.user_id)));

  const cycleUserIds = new Set(cycleMembers.map((member) => Number(member.user_id)));
  const payoutOrders = cycleMembers.map((member) => Number(member.payout_order)).sort((a, b) => a - b);
  const uniqueOrders = payoutOrders.length === new Set(payoutOrders).size;
  const contiguousOrders = payoutOrders.every((order, index) => order === index + 1);

  return {
    requiredCount: requiredIds.size,
    participantsAdded: cycleMembers.length,
    participantsComplete: cycleUserIds.size === requiredIds.size,
    orderReady: uniqueOrders && contiguousOrders,
    readyToStart: cycleUserIds.size === requiredIds.size && uniqueOrders && contiguousOrders,
  };
}

function SummaryCard({ tone, label, value, description }) {
  return (
    <article className={`members-summary-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{description}</p>
    </article>
  );
}

function ContextChip({ label, tone }) {
  return <span className={`member-context-chip ${tone}`}>{label}</span>;
}

function CycleMemberCard({ member, groupMember }) {
  return (
    <div className="group-member-card tone-member">
      <div className="group-member-main">
        <div className="group-member-avatar-shell tone-member">
          <img
            className="group-member-avatar"
            src={profileImageUrl({ profile_image: groupMember?.profile_image })}
            alt={`${groupMember?.full_name || `User #${member.user_id}`} profile`}
          />
        </div>
        <div className="group-member-copy">
          <div className="group-member-heading">
            <h4 className="group-member-name">{groupMember?.full_name || `User #${member.user_id}`}</h4>
            <div className="group-context-badges">
              <span className="member-context-chip moderator">Order #{member.payout_order}</span>
              <span className={`member-context-chip ${member.received ? "admin" : "member"}`}>
                {member.received ? "Received" : "Awaiting turn"}
              </span>
            </div>
          </div>
          <p className="group-member-meta">Cycle member #{member.id} • joined {formatDateTime(member.created_at)}</p>
        </div>
      </div>
    </div>
  );
}

function HistoryItem({ cycle, groupId, navigate }) {
  return (
    <article className="cycle-history-item">
      <div className="cycle-history-main">
        <div>
          <h4>{cycleStatusLabel(cycle.status)} cycle #{cycle.id}</h4>
          <p>
            Start {formatDate(cycle.start_date)} • End {formatDate(cycle.end_date)} • {frequencyLabel(cycle)}
          </p>
        </div>
        <div className="group-context-badges">
          <span className={`member-context-chip ${cycleStatusTone(cycle.status)}`}>{cycleStatusLabel(cycle.status)}</span>
        </div>
      </div>
      <div className="group-member-actions">
        <RouteLink
          className="member-action-btn secondary"
          to={routes.cycleDetail(cycle.id, groupId)}
          navigate={navigate}
        >
          <i className="ti ti-arrow-up-right"></i>
          <span>Open</span>
        </RouteLink>
      </div>
    </article>
  );
}

export default function CyclesPage({ auth, navigate, searchParams }) {
  const groupId = Number(searchParams.get("group_id") || 0);

  usePageChrome({
    title: "My Cycles | Hagbad",
    page: "cycles",
    bodyClassName: "portal-body dashboard-body",
  });

  const [state, setState] = useState({
    loading: true,
    error: "",
    group: null,
    membershipRole: null,
    groupMembers: [],
    settings: null,
    currentCycle: null,
    cycleMembers: [],
    historyCycles: [],
    paymentSummary: null,
    payoutSummary: null,
  });
  const [busyAction, setBusyAction] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [createOpen, setCreateOpen] = useState(searchParams.get("open") === "create");
  const [createForm, setCreateForm] = useState({
    start_date: new Date().toISOString().slice(0, 10),
    frequency: "weekly",
    custom_days: "",
  });
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      if (!groupId) {
        setState({
          loading: false,
          error: "Missing group_id. Open this page like: /cycles?group_id=1",
          group: null,
          membershipRole: null,
          groupMembers: [],
          settings: null,
          currentCycle: null,
          cycleMembers: [],
          historyCycles: [],
          paymentSummary: null,
          payoutSummary: null,
        });
        return;
      }

      setState((current) => ({ ...current, loading: true, error: "" }));

      try {
        const group = await getGroup(auth.token, groupId);
        const [groupMembers, cycles] = await Promise.all([
          fetchAllGroupMembers(auth.token, groupId).catch(() => []),
          fetchAllCycles(auth.token, groupId),
        ]);

        const membership =
          groupMembers.find((member) => Number(member.user_id) === Number(auth.profile?.id)) || null;
        const currentCycle = pickCurrentCycle(cycles);
        const historyCycles = cycles
          .filter((cycle) => !currentCycle || Number(cycle.id) !== Number(currentCycle.id))
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const [cycleMembers, settings, paymentSummary, payoutSummary] = await Promise.all([
          currentCycle ? fetchAllCycleMembers(auth.token, currentCycle.id).catch(() => []) : Promise.resolve([]),
          getGroupSettings(auth.token, groupId).catch(() => null),
          currentCycle ? getPaymentSummary(auth.token, currentCycle.id).catch(() => null) : Promise.resolve(null),
          currentCycle ? getPayoutSummary(auth.token, currentCycle.id).catch(() => null) : Promise.resolve(null),
        ]);

        if (!active) return;
        setState({
          loading: false,
          error: "",
          group,
          membershipRole: membership?.role || null,
          groupMembers,
          settings,
          currentCycle,
          cycleMembers,
          historyCycles,
          paymentSummary,
          payoutSummary,
        });
      } catch (error) {
        if (!active) return;
        setState((current) => ({
          ...current,
          loading: false,
          error: error?.message || "Failed to load cycles.",
        }));
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
        activeKey: "group_cycles",
      }),
    [auth.profile?.id, groupId, state.group, state.membershipRole]
  );

  const memberDirectory = useMemo(() => {
    const map = new Map(state.groupMembers.map((member) => [Number(member.user_id), member]));
    if (state.group && !map.has(Number(state.group.created_by))) {
      map.set(Number(state.group.created_by), {
        user_id: Number(state.group.created_by),
        full_name: null,
        profile_image: null,
      });
    }
    return map;
  }, [state.group, state.groupMembers]);

  const setup = useMemo(() => {
    if (!state.group || !state.currentCycle || state.currentCycle.status !== "pending") return null;
    return buildSetupState(state.group, state.groupMembers, state.cycleMembers);
  }, [state.group, state.groupMembers, state.currentCycle, state.cycleMembers]);

  const expectedRoundPayout = state.settings
    ? formatMoney(Number(state.settings.contribution_amount) * Math.max(1, setup?.requiredCount || state.groupMembers.length || 1))
    : "Missing";
  const groupParticipantCount = useMemo(() => {
    if (!state.group) return 0;
    const ids = new Set([Number(state.group.created_by)]);
    state.groupMembers.forEach((member) => ids.add(Number(member.user_id)));
    return ids.size;
  }, [state.group, state.groupMembers]);

  async function reload() {
    setReloadNonce((value) => value + 1);
  }

  async function handleCreateCycle(event) {
    event.preventDefault();
    setCreateError("");

    if (!createForm.start_date) {
      setCreateError("Start date is required.");
      return;
    }
    if (createForm.frequency === "custom_days" && !String(createForm.custom_days).trim()) {
      setCreateError("Custom days is required when the frequency is custom days.");
      return;
    }

    setBusyAction("create-cycle");
    try {
      await createCycle(auth.token, {
        group_id: groupId,
        start_date: createForm.start_date,
        frequency: createForm.frequency,
        custom_days:
          createForm.frequency === "custom_days" ? Number(createForm.custom_days) : null,
      });
      setCreateOpen(false);
      setCreateForm((current) => ({ ...current, custom_days: "" }));
      await reload();
    } catch (error) {
      setCreateError(error?.message || "Failed to create cycle.");
    } finally {
      setBusyAction("");
    }
  }

  async function handleStartCycle() {
    if (!state.currentCycle) return;
    setBusyAction("start-cycle");
    try {
      await startCycle(auth.token, state.currentCycle.id);
      await reload();
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error?.message || "Failed to start cycle.",
      }));
    } finally {
      setBusyAction("");
    }
  }

  async function handlePauseCycle() {
    if (!state.currentCycle) return;
    setBusyAction("pause-cycle");
    try {
      await stopCycle(auth.token, state.currentCycle.id, "paused");
      await reload();
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error?.message || "Failed to pause cycle.",
      }));
    } finally {
      setBusyAction("");
    }
  }

  async function handleCompleteCycle() {
    if (!state.currentCycle) return;
    setBusyAction("complete-cycle");
    try {
      await stopCycle(auth.token, state.currentCycle.id, "completed");
      await reload();
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error?.message || "Failed to complete cycle.",
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
      title="My Cycles"
      activeSidebarKey={workspace.activeKey}
      sidebarSections={workspace.sidebarSections}
      brandTo={routes.groupDetail(groupId || 0)}
      brandSubtitle="Group workspace"
    >
      <div className="workspace-legacy-stack cycle-workspace-page">
        <section className="dashboard-panel card members-overview-panel cycle-overview-panel">
          <div className="card-body">
            <div className="group-inline-meta members-page-heading cycle-page-heading">
              <div>
                <h2>{state.group?.name || "Loading group..."}</h2>
                <p>Prepare one cycle at a time, manage the active round, and keep payments and payouts moving in order.</p>
              </div>
              <div className="members-header-actions">
                <button className="btn btn-secondary" type="button" onClick={reload} disabled={state.loading}>
                  Refresh
                </button>
                {workspace.canManageCycles ? (
                  <button className="btn" type="button" onClick={() => setCreateOpen(true)}>
                    Create cycle
                  </button>
                ) : null}
              </div>
            </div>

            <p className="dashboard-note mb-0">
              {state.currentCycle
                ? `Current cycle #${state.currentCycle.id} is ${cycleStatusLabel(state.currentCycle.status).toLowerCase()}.`
                : "This group does not have a pending, paused, or active cycle right now."}
            </p>
            <p className="dashboard-note mb-3">
              {state.settings
                ? `Contribution rule: ${formatMoney(state.settings.contribution_amount)} • ${state.settings.frequency}${state.settings.custom_days ? ` (${state.settings.custom_days} days)` : ""}`
                : "Group payment rules are missing. Open settings before you start a cycle."}
            </p>

            <div className="group-context-badges" aria-live="polite">
              {state.membershipRole ? (
                <ContextChip label={`${state.membershipRole} role`} tone={state.membershipRole} />
              ) : workspace.isCreator ? (
                <ContextChip label="creator role" tone="admin" />
              ) : null}
              {state.group ? (
                <ContextChip
                  label={`${state.group.privacy} group`}
                  tone={state.group.privacy === "private" ? "private" : "member"}
                />
              ) : null}
              <ContextChip
                label={state.currentCycle ? cycleStatusLabel(state.currentCycle.status) : "No current cycle"}
                tone={state.currentCycle ? cycleStatusTone(state.currentCycle.status) : "member"}
              />
            </div>

            {state.error ? <div className="form-error" role="alert">{state.error}</div> : null}
            <div className="dashboard-note members-status" aria-live="polite">
              {state.loading ? "Loading…" : "Cycle workspace ready."}
            </div>

            <div className="members-summary-grid cycle-summary-grid" aria-label="Cycle summary">
              {!state.currentCycle ? (
                <>
                  <SummaryCard
                    tone="total"
                    label="Current cycle"
                    value="None"
                    description="There is no pending, paused, or active cycle at the moment."
                  />
                  <SummaryCard
                    tone={state.settings ? "member" : "admin"}
                    label="Contribution rule"
                    value={state.settings ? formatMoney(state.settings.contribution_amount) : "Missing"}
                    description={
                      state.settings
                        ? "Current contribution amount from group settings."
                        : "Create the group payment rules before starting the next cycle."
                    }
                  />
                  <SummaryCard
                    tone="member"
                    label="Group members"
                    value={String(groupParticipantCount)}
                    description="These members will need to be added to the next cycle before it can start."
                  />
                  <SummaryCard
                    tone={state.historyCycles.length ? "moderator" : "member"}
                    label="History"
                    value={`${state.historyCycles.length}`}
                    description={state.historyCycles.length ? "Older cycles are listed below." : "No cycle history yet."}
                  />
                </>
              ) : state.currentCycle.status === "pending" ? (
                <>
                  <SummaryCard
                    tone={cycleStatusTone(state.currentCycle.status)}
                    label="Current cycle"
                    value={cycleStatusLabel(state.currentCycle.status)}
                    description={`Cycle #${state.currentCycle.id} starts on ${formatDate(state.currentCycle.start_date)}.`}
                  />
                  <SummaryCard
                    tone={setup?.participantsComplete ? "moderator" : "admin"}
                    label="Members added"
                    value={`${setup?.participantsAdded || 0} / ${setup?.requiredCount || 0}`}
                    description={
                      setup?.participantsComplete
                        ? "All required members are already included."
                        : "The cycle cannot start until everyone is added."
                    }
                  />
                  <SummaryCard
                    tone={setup?.orderReady ? "moderator" : "admin"}
                    label="Order state"
                    value={setup?.orderReady ? "Ready" : "Review needed"}
                    description={
                      setup?.orderReady
                        ? "The payout order is consecutive and ready."
                        : "Review the payout order before you start."
                    }
                  />
                  <SummaryCard
                    tone={state.settings ? "member" : "admin"}
                    label="Expected payout"
                    value={expectedRoundPayout}
                    description={
                      state.settings
                        ? "This is the payout pool for each round when all members are included."
                        : "Configure the group rules before starting this cycle."
                    }
                  />
                </>
              ) : (
                <>
                  <SummaryCard
                    tone={cycleStatusTone(state.currentCycle.status)}
                    label="Cycle status"
                    value={cycleStatusLabel(state.currentCycle.status)}
                    description={`Cycle #${state.currentCycle.id} • ${frequencyLabel(state.currentCycle)}`}
                  />
                  <SummaryCard
                    tone="member"
                    label="Participants"
                    value={`${state.cycleMembers.length}`}
                    description="Members currently included in this cycle."
                  />
                  <SummaryCard
                    tone={state.paymentSummary?.outstanding_amount ? "moderator" : "admin"}
                    label="Payments"
                    value={
                      state.paymentSummary
                        ? `${state.paymentSummary.paid_count} / ${state.paymentSummary.total_payments}`
                        : "-"
                    }
                    description="Approved or paid payment records for this cycle."
                  />
                  <SummaryCard
                    tone={state.payoutSummary?.remaining_amount ? "moderator" : "admin"}
                    label="Payouts"
                    value={
                      state.payoutSummary
                        ? `${state.payoutSummary.paid_count} / ${state.payoutSummary.total_payouts}`
                        : "-"
                    }
                    description="Paid payouts out of the total cycle payout records."
                  />
                </>
              )}
            </div>
          </div>
        </section>

        {!state.currentCycle ? (
          <section className="dashboard-panel card member-role-panel">
            <div className="card-body">
              <div className="member-role-header">
                <div>
                  <h3>No current cycle</h3>
                  <p>This group does not have a pending, paused, or active cycle right now.</p>
                </div>
                <div className="group-member-actions">
                  <button className="member-action-btn secondary" type="button" onClick={() => navigate(routes.groupDetail(groupId))}>
                    Dashboard
                  </button>
                  <button className="member-action-btn secondary" type="button" onClick={() => navigate(routes.groupSettings(groupId))}>
                    Settings
                  </button>
                  {workspace.canManageCycles ? (
                    <button className="member-action-btn primary" type="button" onClick={() => setCreateOpen(true)}>
                      Create cycle
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="member-empty-state">
                When a cycle is created, it stays pending until the participants are added, the payout order is reviewed, and the manager chooses to start it.
              </div>
            </div>
          </section>
        ) : null}

        {state.currentCycle?.status === "pending" ? (
          <section className="dashboard-panel card member-role-panel">
            <div className="card-body">
              <div className="member-role-header">
                <div>
                  <h3>Pending cycle setup</h3>
                  <p>Add every group member, review the payout order, confirm the contribution rules, then start the cycle when you are ready.</p>
                </div>
                <div className="group-member-actions">
                  <button className="member-action-btn secondary" type="button" onClick={() => navigate(routes.groupMembers(groupId))}>
                    Manage members
                  </button>
                  <button
                    className="member-action-btn secondary"
                    type="button"
                    onClick={() => navigate(routes.cycleDetail(state.currentCycle.id, groupId))}
                  >
                    Review order
                  </button>
                  <button className="member-action-btn secondary" type="button" onClick={() => navigate(routes.groupSettings(groupId))}>
                    Payment rules
                  </button>
                  {workspace.canManageCycles ? (
                    <button
                      className="member-action-btn primary"
                      type="button"
                      disabled={busyAction === "start-cycle" || !(workspace.canManageCycles && state.settings && setup?.readyToStart)}
                      onClick={handleStartCycle}
                    >
                      {busyAction === "start-cycle" ? "Starting..." : "Start cycle"}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="members-summary-grid cycle-summary-grid" aria-label="Cycle setup status">
                <SummaryCard
                  tone="total"
                  label="Participants"
                  value={`${setup?.participantsAdded || 0} / ${setup?.requiredCount || 0}`}
                  description={
                    setup?.participantsComplete
                      ? "Every visible group member is already in this pending cycle."
                      : "Add every group member before you start the cycle."
                  }
                />
                <SummaryCard
                  tone={setup?.orderReady ? "moderator" : "admin"}
                  label="Payout order"
                  value={setup?.orderReady ? "Ready" : "Needs review"}
                  description={
                    setup?.orderReady
                      ? "Orders are unique and consecutive from first turn to last."
                      : "Review the participant order before you start the cycle."
                  }
                />
                <SummaryCard
                  tone={state.settings ? "member" : "admin"}
                  label="Contribution"
                  value={state.settings ? formatMoney(state.settings.contribution_amount) : "Missing"}
                  description={
                    state.settings
                      ? `Collected each ${state.settings.frequency}${state.settings.custom_days ? ` (${state.settings.custom_days} days)` : ""} from group settings.`
                      : "Group payment rules are missing. Open settings before you start."
                  }
                />
                <SummaryCard
                  tone={state.settings ? "member" : "admin"}
                  label="Expected payout"
                  value={expectedRoundPayout}
                  description={
                    state.settings
                      ? "This is the payout pool for each round when all members are included."
                      : "Payout amount will be ready after contribution rules are configured."
                  }
                />
              </div>

              <div className="cycle-section-block">
                <div className="member-role-header cycle-section-header">
                  <div>
                    <h4>Current payout order</h4>
                    <p>Everyone added to this pending cycle appears below in payout order.</p>
                  </div>
                  <span className="member-section-count neutral">
                    {setup?.participantsAdded || 0} / {setup?.requiredCount || 0} participants
                  </span>
                </div>
                <div className="cycle-order-list" aria-label="Pending cycle payout order">
                  {state.cycleMembers.length ? (
                    [...state.cycleMembers]
                      .sort((a, b) => a.payout_order - b.payout_order)
                      .map((member) => (
                        <CycleMemberCard
                          key={member.id}
                          member={member}
                          groupMember={memberDirectory.get(Number(member.user_id))}
                        />
                      ))
                  ) : (
                    <div className="member-empty-state">
                      No cycle members have been added yet. Start with the member setup screen.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {state.currentCycle && state.currentCycle.status !== "pending" ? (
          <section className="dashboard-panel card member-role-panel">
            <div className="card-body">
              <div className="member-role-header">
                <div>
                  <h3>{state.currentCycle.status === "paused" ? `Cycle #${state.currentCycle.id} is paused` : `Cycle #${state.currentCycle.id} is active`}</h3>
                  <p>
                    {state.currentCycle.status === "paused"
                      ? "This cycle is paused. Resume it when you are ready to reopen the current round."
                      : "Track the current round, the payment state, and the payout progress from one place."}
                  </p>
                </div>
                <div className="group-member-actions">
                  <button
                    className="member-action-btn secondary"
                    type="button"
                    onClick={() => navigate(routes.cycleMembers(state.currentCycle.id, groupId))}
                  >
                    Participants
                  </button>
                  <button
                    className="member-action-btn secondary"
                    type="button"
                    onClick={() => navigate(routes.payments(state.currentCycle.id, null, groupId))}
                  >
                    Payments
                  </button>
                  <button
                    className="member-action-btn secondary"
                    type="button"
                    onClick={() => navigate(routes.payouts(state.currentCycle.id, null, groupId))}
                  >
                    Payouts
                  </button>
                  {workspace.canManageCycles && state.currentCycle.status === "active" ? (
                    <>
                      <button
                        className="member-action-btn secondary"
                        type="button"
                        disabled={busyAction === "pause-cycle"}
                        onClick={handlePauseCycle}
                      >
                        {busyAction === "pause-cycle" ? "Pausing..." : "Cancel cycle"}
                      </button>
                      <button
                        className="member-action-btn primary"
                        type="button"
                        disabled={busyAction === "complete-cycle"}
                        onClick={handleCompleteCycle}
                      >
                        {busyAction === "complete-cycle" ? "Completing..." : "Mark complete"}
                      </button>
                    </>
                  ) : null}
                  {workspace.canManageCycles && state.currentCycle.status === "paused" ? (
                    <button
                      className="member-action-btn primary"
                      type="button"
                      disabled={busyAction === "start-cycle"}
                      onClick={handleStartCycle}
                    >
                      {busyAction === "start-cycle" ? "Resuming..." : "Resume cycle"}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="members-summary-grid cycle-summary-grid" aria-label="Active cycle summary">
                <SummaryCard
                  tone={cycleStatusTone(state.currentCycle.status)}
                  label="Cycle status"
                  value={cycleStatusLabel(state.currentCycle.status)}
                  description="Only one cycle can stay open in this group at a time."
                />
                <SummaryCard
                  tone="member"
                  label="Participants"
                  value={`${state.cycleMembers.length}`}
                  description="Members currently included in this cycle."
                />
                <SummaryCard
                  tone={state.paymentSummary?.outstanding_amount ? "moderator" : "admin"}
                  label="Payment progress"
                  value={
                    state.paymentSummary
                      ? `${state.paymentSummary.paid_count} / ${state.paymentSummary.total_payments}`
                      : "-"
                  }
                  description={
                    state.paymentSummary
                      ? `${formatMoney(state.paymentSummary.total_amount_paid)} collected out of ${formatMoney(state.paymentSummary.total_amount_due)}.`
                      : "Payment summary is unavailable."
                  }
                />
                <SummaryCard
                  tone={state.payoutSummary?.remaining_amount ? "moderator" : "admin"}
                  label="Payout progress"
                  value={
                    state.payoutSummary
                      ? `${state.payoutSummary.paid_count} / ${state.payoutSummary.total_payouts}`
                      : "-"
                  }
                  description={
                    state.payoutSummary
                      ? `${formatMoney(state.payoutSummary.paid_amount)} paid out of ${formatMoney(state.payoutSummary.total_amount)}.`
                      : "Payout summary is unavailable."
                  }
                />
              </div>

              <div className="cycle-section-block">
                <div className="member-role-header cycle-section-header">
                  <div>
                    <h4>Current payout order</h4>
                    <p>Participants stay ordered below so you can review the round sequence quickly.</p>
                  </div>
                  <span className="member-section-count neutral">{state.cycleMembers.length} participants</span>
                </div>
                <div className="cycle-order-list" aria-label="Current cycle payout order">
                  {state.cycleMembers.length ? (
                    [...state.cycleMembers]
                      .sort((a, b) => a.payout_order - b.payout_order)
                      .map((member) => (
                        <CycleMemberCard
                          key={member.id}
                          member={member}
                          groupMember={memberDirectory.get(Number(member.user_id))}
                        />
                      ))
                  ) : (
                    <div className="member-empty-state">
                      No participants are assigned to this cycle yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {state.historyCycles.length ? (
          <section className="dashboard-panel card member-role-panel">
            <div className="card-body">
              <div className="member-role-header">
                <div>
                  <h3>Cycle history</h3>
                  <p>Older completed cycles stay here for review after the current work is done.</p>
                </div>
                <span className="member-section-count neutral">{state.historyCycles.length} cycles</span>
              </div>
              <div className="cycle-history-list" aria-label="Cycle history">
                {state.historyCycles.map((cycle) => (
                  <HistoryItem key={cycle.id} cycle={cycle} groupId={groupId} navigate={navigate} />
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </div>

      {createOpen && workspace.canManageCycles ? (
        <>
          <div className="modal-overlay" onClick={() => setCreateOpen(false)}></div>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="create-title">
            <h3 id="create-title">Create cycle</h3>
            <p className="hint">
              Only group admins or moderators can create a cycle. It will stay pending until the participants are added,
              the payout order is reviewed, and you choose to start it.
            </p>

            <form onSubmit={handleCreateCycle} noValidate>
              {createError ? <div className="form-error" role="alert">{createError}</div> : null}

              <div className="workspace-form-grid cols-2">
                <div className="field">
                  <label htmlFor="start_date">Start date</label>
                  <input
                    id="start_date"
                    type="date"
                    value={createForm.start_date}
                    onChange={(event) => setCreateForm((current) => ({ ...current, start_date: event.target.value }))}
                  />
                </div>

                <div className="field">
                  <label htmlFor="frequency">Frequency</label>
                  <select
                    id="frequency"
                    className="select"
                    value={createForm.frequency}
                    onChange={(event) => setCreateForm((current) => ({ ...current, frequency: event.target.value }))}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="custom_days">Custom days</option>
                  </select>
                </div>

                {createForm.frequency === "custom_days" ? (
                  <div className="field">
                    <label htmlFor="custom_days">Custom days</label>
                    <input
                      id="custom_days"
                      type="number"
                      min="1"
                      step="1"
                      placeholder="e.g. 10"
                      value={createForm.custom_days}
                      onChange={(event) => setCreateForm((current) => ({ ...current, custom_days: event.target.value }))}
                    />
                  </div>
                ) : null}
              </div>

              <div className="modal-actions">
                <button className="btn btn-secondary" type="button" onClick={() => setCreateOpen(false)}>
                  Cancel
                </button>
                <button className="btn" type="submit" disabled={busyAction === "create-cycle"}>
                  {busyAction === "create-cycle" ? "Creating..." : "Create cycle"}
                </button>
              </div>
            </form>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
