import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import RouteLink from "../components/RouteLink";
import { usePageChrome } from "../hooks/usePageChrome";
import {
  approvePayout,
  getCycle,
  getGroup,
  getPayoutSummary,
  listCycleMembers,
  listGroupMembers,
  listPayouts,
  payPayout,
} from "../lib/api";
import { buildGroupWorkspaceConfig } from "../lib/groupWorkspace";
import { routes } from "../lib/routes";

const PAGE_SIZE = 20;
const FETCH_SIZE = 100;

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

function formatDateTime(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
}

function payoutBadgeClass(status) {
  if (status === "paid") return "good";
  if (status === "approved") return "warn";
  if (status === "rejected") return "bad";
  return "";
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

function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{String(value)}</div>
    </div>
  );
}

export default function PayoutsPage({ auth, navigate, searchParams }) {
  const cycleId = Number(searchParams.get("cycle_id") || 0);
  const cycleMemberIdFromUrl = Number(searchParams.get("cycle_member_id") || 0);
  const groupIdFromUrl = Number(searchParams.get("group_id") || 0);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [page, setPage] = useState(1);
  const [memberFilter, setMemberFilter] = useState(cycleMemberIdFromUrl ? String(cycleMemberIdFromUrl) : "");
  const [statusFilter, setStatusFilter] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [state, setState] = useState({
    loading: true,
    error: "",
    cycle: null,
    group: null,
    membershipRole: null,
    cycleMembers: [],
    items: [],
    summary: null,
  });

  const pageTitle = state.cycle ? `Payouts | Cycle #${state.cycle.id} | Hagbad` : "Payouts | Hagbad";

  usePageChrome({
    title: pageTitle,
    page: "payouts",
    bodyClassName: "portal-body dashboard-body",
  });

  useEffect(() => {
    setPage(1);
  }, [memberFilter, statusFilter]);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!cycleId) {
        setState({
          loading: false,
          error: "Missing cycle_id. Open this page like /payouts?cycle_id=1",
          cycle: null,
          group: null,
          membershipRole: null,
          cycleMembers: [],
          items: [],
          summary: null,
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
          fetchAllCycleMembers(auth.token, cycleId).catch(() => []),
        ]);
        const membership =
          groupMembers.find((item) => Number(item.user_id) === Number(auth.profile?.id)) || null;
        const canManage =
          Number(group.created_by) === Number(auth.profile?.id) ||
          membership?.role === "admin" ||
          membership?.role === "moderator";

        const [items, summary] = await Promise.all([
          listPayouts(auth.token, {
            cycleId,
            cycleMemberId: memberFilter,
            status: statusFilter,
            page,
            size: PAGE_SIZE,
          }),
          canManage ? getPayoutSummary(auth.token, cycleId).catch(() => null) : Promise.resolve(null),
        ]);

        if (!active) return;

        setState({
          loading: false,
          error: "",
          cycle,
          group,
          membershipRole: membership?.role || null,
          cycleMembers,
          items,
          summary,
        });
      } catch (error) {
        if (!active) return;
        setState({
          loading: false,
          error: error?.message || "Failed to load payouts.",
          cycle: null,
          group: null,
          membershipRole: null,
          cycleMembers: [],
          items: [],
          summary: null,
        });
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [auth.profile?.id, auth.token, cycleId, groupIdFromUrl, memberFilter, page, reloadNonce, statusFilter]);

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
  const permissionsNote = canManage
    ? "One payout record is generated for each turn when the cycle starts. Admins and moderators approve and pay the active turn after that round's payments are approved."
    : "You can view only your own payout turn and its status.";

  function reload() {
    setReloadNonce((value) => value + 1);
  }

  async function handleApprovePayout(payoutId) {
    const actionKey = `approve-${payoutId}`;
    setBusyAction(actionKey);
    try {
      await approvePayout(auth.token, payoutId, {});
      reload();
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error?.message || "Failed to approve payout.",
      }));
    } finally {
      setBusyAction("");
    }
  }

  async function handleMarkPaid(payoutId) {
    const actionKey = `pay-${payoutId}`;
    setBusyAction(actionKey);
    try {
      await payPayout(auth.token, payoutId, {});
      reload();
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error?.message || "Failed to mark payout as paid.",
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
      title="Payouts"
      activeSidebarKey={workspace.activeKey}
      sidebarSections={workspace.sidebarSections}
      brandTo={routes.groupDetail(groupId || 0)}
      brandSubtitle="Group workspace"
    >
      <div className="workspace-legacy-stack">
        {canManage && state.summary ? (
          <section className="dashboard-panel card workspace-legacy-card">
            <div className="card-header">
              <h2>Cycle payout summary</h2>
              <p className="hint">{permissionsNote}</p>
            </div>
            <div className="card-body">
              <div className="stats-grid">
                <StatCard label="Total payouts" value={state.summary.total_payouts} />
                <StatCard label="Pending" value={state.summary.pending_count} />
                <StatCard label="Approved" value={state.summary.approved_count} />
                <StatCard label="Rejected" value={state.summary.rejected_count} />
                <StatCard label="Paid" value={state.summary.paid_count} />
                <StatCard label="Total amount" value={formatMoney(state.summary.total_amount)} />
                <StatCard label="Paid amount" value={formatMoney(state.summary.paid_amount)} />
                <StatCard label="Remaining" value={formatMoney(state.summary.remaining_amount)} />
              </div>
            </div>
          </section>
        ) : null}

        <section className="dashboard-panel card workspace-legacy-card">
          <div className="card-body">
            <div className="workspace-legacy-intro">
              <div>
                <h2>{state.cycle ? `Payouts for cycle #${state.cycle.id}` : "Loading payouts..."}</h2>
                <p>{state.group ? `${state.group.name} • round turn approval and payout completion` : "Approval and payout completion records for this cycle."}</p>
              </div>
            </div>

            <p className="dashboard-note mb-3">{permissionsNote}</p>
            {state.error ? <div className="form-error">{state.error}</div> : null}

            <div className="toolbar" role="group" aria-label="Payout actions">
              <div className="toolbar-left">
                <button className="btn btn-secondary" type="button" onClick={() => navigate(routes.cycleDetail(cycleId, groupId))}>
                  Cycle
                </button>
                <button className="btn btn-secondary" type="button" onClick={() => navigate(routes.payments(cycleId, null, groupId))}>
                  Payments
                </button>
              </div>
              <div className="toolbar-right">
                <button className="btn btn-secondary" type="button" onClick={reload} disabled={state.loading}>
                  Refresh
                </button>
                <button className="btn" type="button" hidden>
                  Create payout
                </button>
              </div>
            </div>

            <div className="workspace-form-grid cols-2 mb-3">
              <select
                className="select"
                aria-label="Filter by participant"
                value={memberFilter}
                onChange={(event) => setMemberFilter(event.target.value)}
              >
                <option value="">All participants</option>
                {state.cycleMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {`User #${member.user_id} • order ${member.payout_order}`}
                  </option>
                ))}
              </select>
              <select
                className="select"
                aria-label="Filter by payout status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="paid">Paid</option>
              </select>
            </div>

            <div className="dashboard-note mb-3" aria-live="polite">
              {state.loading ? "Loading…" : `${state.items.length} payout${state.items.length === 1 ? "" : "s"} on this page.`}
            </div>

            <ul className="list" aria-label="Payouts">
              {state.items.length ? (
                state.items.map((payout) => (
                  <li key={payout.id} className="list-item">
                    <div className="list-main">
                      <div className="list-title">{`Payout #${payout.id}`}</div>
                      <div className="list-meta">
                        {`Cycle member #${payout.cycle_member_id} • amount ${formatMoney(payout.amount)} • created ${formatDateTime(payout.created_at)}`}
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <span className={`badge ${payoutBadgeClass(payout.status)}`}>{payout.status}</span>
                      </div>
                    </div>

                    <div className="list-actions">
                      <RouteLink
                        className="btn btn-secondary"
                        to={routes.payoutDetail(payout.id, cycleId, payout.cycle_member_id, groupId)}
                        navigate={navigate}
                      >
                        {canManage ? "Manage" : "View"}
                      </RouteLink>

                      {canManage && payout.status === "pending" ? (
                        <button
                          className="btn"
                          type="button"
                          disabled={busyAction === `approve-${payout.id}`}
                          onClick={() => handleApprovePayout(payout.id)}
                        >
                          {busyAction === `approve-${payout.id}` ? "Approving..." : "Approve"}
                        </button>
                      ) : null}

                      {canManage && payout.status === "approved" ? (
                        <button
                          className="btn"
                          type="button"
                          disabled={busyAction === `pay-${payout.id}`}
                          onClick={() => handleMarkPaid(payout.id)}
                        >
                          {busyAction === `pay-${payout.id}` ? "Paying..." : "Mark paid"}
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))
              ) : (
                <li className="list-empty">No payout records found for this filter yet.</li>
              )}
            </ul>

            <div className="pager" aria-label="Pagination">
              <button className="btn btn-secondary" type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                Prev
              </button>
              <span className="dashboard-note">Page {page}</span>
              <button className="btn btn-secondary" type="button" disabled={state.items.length < PAGE_SIZE} onClick={() => setPage((current) => current + 1)}>
                Next
              </button>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
