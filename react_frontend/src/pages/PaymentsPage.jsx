import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import RouteLink from "../components/RouteLink";
import { usePageChrome } from "../hooks/usePageChrome";
import {
  approvePayment,
  getCycle,
  getGroup,
  getPaymentSummary,
  listCycleMembers,
  listGroupMembers,
  listPayments,
  submitPayment,
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

function formatDate(value) {
  if (!value) return "-";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString();
}

function paymentNeedsApproval(payment) {
  return Number(payment.amount_paid || 0) > 0 && !payment.paid_at;
}

function paymentState(payment) {
  if (paymentNeedsApproval(payment)) return "awaiting approval";
  return payment.status;
}

function paymentBadgeClass(status) {
  if (status === "awaiting approval") return "warn";
  if (status === "paid") return "good";
  if (status === "late") return "bad";
  return "warn";
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

export default function PaymentsPage({ auth, navigate, searchParams }) {
  const cycleId = Number(searchParams.get("cycle_id") || 0);
  const cycleMemberIdFromUrl = Number(searchParams.get("cycle_member_id") || 0);
  const groupIdFromUrl = Number(searchParams.get("group_id") || 0);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [page, setPage] = useState(1);
  const [memberFilter, setMemberFilter] = useState(cycleMemberIdFromUrl ? String(cycleMemberIdFromUrl) : "");
  const [statusFilter, setStatusFilter] = useState("");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
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

  const pageTitle = state.cycle ? `Payments | Cycle #${state.cycle.id} | Hagbad` : "Payments | Hagbad";

  usePageChrome({
    title: pageTitle,
    page: "payments",
    bodyClassName: "portal-body dashboard-body",
  });

  useEffect(() => {
    setPage(1);
  }, [memberFilter, statusFilter, dueFrom, dueTo]);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!cycleId) {
        setState({
          loading: false,
          error: "Missing cycle_id. Open this page like /payments?cycle_id=1",
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
          listPayments(auth.token, {
            cycleId,
            cycleMemberId: memberFilter,
            status: statusFilter,
            dueFrom,
            dueTo,
            page,
            size: PAGE_SIZE,
          }),
          canManage ? getPaymentSummary(auth.token, cycleId).catch(() => null) : Promise.resolve(null),
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
          error: error?.message || "Failed to load payments.",
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
  }, [auth.profile?.id, auth.token, cycleId, dueFrom, dueTo, groupIdFromUrl, memberFilter, page, reloadNonce, statusFilter]);

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
    ? "Round payment records are generated automatically when the cycle starts. Members submit them, then admins and moderators approve them."
    : "Your scheduled contribution records appear here. Use I paid to submit each round for approval.";

  async function reload() {
    setReloadNonce((value) => value + 1);
  }

  async function handleSubmitOwnPayment(paymentId) {
    const actionKey = `submit-${paymentId}`;
    setBusyAction(actionKey);
    try {
      await submitPayment(auth.token, paymentId, {});
      reload();
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error?.message || "Failed to submit payment.",
      }));
    } finally {
      setBusyAction("");
    }
  }

  async function handleApprovePayment(paymentId) {
    const actionKey = `approve-${paymentId}`;
    setBusyAction(actionKey);
    try {
      await approvePayment(auth.token, paymentId, {});
      reload();
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error?.message || "Failed to approve payment.",
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
      title="Payments"
      activeSidebarKey={workspace.activeKey}
      sidebarSections={workspace.sidebarSections}
      brandTo={routes.groupDetail(groupId || 0)}
      brandSubtitle="Group workspace"
    >
      <div className="workspace-legacy-stack">
        {canManage && state.summary ? (
          <section className="dashboard-panel card workspace-legacy-card">
            <div className="card-header">
              <h2>Cycle payment summary</h2>
              <p className="hint">{permissionsNote}</p>
            </div>
            <div className="card-body">
              <div className="stats-grid">
                <StatCard label="Total records" value={state.summary.total_payments} />
                <StatCard label="Due" value={state.summary.due_count} />
                <StatCard label="Paid" value={state.summary.paid_count} />
                <StatCard label="Late" value={state.summary.late_count} />
                <StatCard label="Amount due" value={formatMoney(state.summary.total_amount_due)} />
                <StatCard label="Amount paid" value={formatMoney(state.summary.total_amount_paid)} />
                <StatCard label="Outstanding" value={formatMoney(state.summary.outstanding_amount)} />
              </div>
            </div>
          </section>
        ) : null}

        <section className="dashboard-panel card workspace-legacy-card">
          <div className="card-body">
            <div className="workspace-legacy-intro">
              <div>
                <h2>{state.cycle ? `Payments for cycle #${state.cycle.id}` : "Loading payments..."}</h2>
                <p>{state.group ? `${state.group.name} • round contributions and payment approvals` : "Track due, paid, and late contribution records for this cycle."}</p>
              </div>
            </div>

            <p className="dashboard-note mb-3">{permissionsNote}</p>
            {state.error ? <div className="form-error">{state.error}</div> : null}

            <div className="toolbar" role="group" aria-label="Payment actions">
              <div className="toolbar-left">
                <button className="btn btn-secondary" type="button" onClick={() => navigate(routes.cycleDetail(cycleId, groupId))}>
                  Cycle
                </button>
                <button className="btn btn-secondary" type="button" onClick={() => navigate(routes.cycleMembers(cycleId, groupId))}>
                  Participants
                </button>
                <button className="btn btn-secondary" type="button" onClick={() => navigate(routes.payouts(cycleId, Number(memberFilter || 0) || null, groupId))}>
                  Payouts
                </button>
              </div>
              <div className="toolbar-right">
                <button className="btn btn-secondary" type="button" onClick={reload} disabled={state.loading}>
                  Refresh
                </button>
                <button className="btn" type="button" hidden>
                  Create payment
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
                aria-label="Filter by payment status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">All statuses</option>
                <option value="due">Due</option>
                <option value="paid">Paid</option>
                <option value="late">Late</option>
              </select>
              <input type="date" aria-label="Due from" value={dueFrom} onChange={(event) => setDueFrom(event.target.value)} />
              <input type="date" aria-label="Due to" value={dueTo} onChange={(event) => setDueTo(event.target.value)} />
            </div>

            <div className="dashboard-note mb-3" aria-live="polite">
              {state.loading ? "Loading…" : `${state.items.length} payment${state.items.length === 1 ? "" : "s"} on this page.`}
            </div>

            <ul className="list" aria-label="Payments">
              {state.items.length ? (
                state.items.map((payment) => {
                  const displayState = paymentState(payment);
                  const actionKey = paymentNeedsApproval(payment) ? `approve-${payment.id}` : `submit-${payment.id}`;
                  const isOwnPayment = !canManage;

                  return (
                    <li key={payment.id} className="list-item">
                      <div className="list-main">
                        <div className="list-title">{`Payment #${payment.id}`}</div>
                        <div className="list-meta">
                          {`Cycle member #${payment.cycle_member_id} • due ${formatDate(payment.due_date)} • paid ${formatMoney(payment.amount_paid)} / ${formatMoney(payment.amount_due)}`}
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <span className={`badge ${paymentBadgeClass(displayState)}`}>{displayState}</span>
                        </div>
                      </div>

                      <div className="list-actions">
                        <RouteLink
                          className="btn btn-secondary"
                          to={routes.paymentDetail(payment.id, cycleId, payment.cycle_member_id, groupId)}
                          navigate={navigate}
                        >
                          {canManage ? "Manage" : "View"}
                        </RouteLink>

                        {isOwnPayment && !paymentNeedsApproval(payment) && payment.status !== "paid" ? (
                          <button
                            className="btn"
                            type="button"
                            disabled={busyAction === actionKey}
                            onClick={() => handleSubmitOwnPayment(payment.id)}
                          >
                            {busyAction === actionKey ? "Submitting..." : "I paid"}
                          </button>
                        ) : null}

                        {canManage && paymentNeedsApproval(payment) ? (
                          <button
                            className="btn"
                            type="button"
                            disabled={busyAction === actionKey}
                            onClick={() => handleApprovePayment(payment.id)}
                          >
                            {busyAction === actionKey ? "Approving..." : "Approve"}
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })
              ) : (
                <li className="list-empty">No payments found for this filter yet.</li>
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
