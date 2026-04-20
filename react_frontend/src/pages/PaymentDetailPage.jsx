import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { usePageChrome } from "../hooks/usePageChrome";
import {
  approvePayment,
  deletePayment,
  getCycle,
  getGroup,
  getPayment,
  listGroupMembers,
  submitPayment,
  updatePayment,
} from "../lib/api";
import { buildGroupWorkspaceConfig } from "../lib/groupWorkspace";
import { routes } from "../lib/routes";

const FETCH_SIZE = 100;

function formatDateTime(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
}

function datetimeLocalValue(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getDate()).padStart(2, "0");
  const hh = String(parsed.getHours()).padStart(2, "0");
  const mi = String(parsed.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function paymentNeedsApproval(payment) {
  return Number(payment?.amount_paid || 0) > 0 && !payment?.paid_at;
}

function paymentState(payment) {
  if (!payment) return "-";
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

export default function PaymentDetailPage({ auth, navigate, searchParams }) {
  const paymentId = Number(searchParams.get("payment_id") || 0);
  const cycleIdFromUrl = Number(searchParams.get("cycle_id") || 0);
  const cycleMemberIdFromUrl = Number(searchParams.get("cycle_member_id") || 0);
  const groupIdFromUrl = Number(searchParams.get("group_id") || 0);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [busyAction, setBusyAction] = useState("");
  const [formMessage, setFormMessage] = useState({ error: "", success: "" });
  const [workflowError, setWorkflowError] = useState("");
  const [form, setForm] = useState({
    due_date: "",
    amount_due: "",
    amount_paid: "",
    paid_at: "",
    notes: "",
  });
  const [state, setState] = useState({
    loading: true,
    error: "",
    payment: null,
    cycle: null,
    group: null,
    membershipRole: null,
  });

  const pageTitle = state.payment ? `Payment #${state.payment.id} | Hagbad` : "Payment Detail | Hagbad";

  usePageChrome({
    title: pageTitle,
    page: "payment_detail",
    bodyClassName: "portal-body dashboard-body",
  });

  useEffect(() => {
    let active = true;

    async function load() {
      if (!paymentId) {
        setState({
          loading: false,
          error: "Missing payment_id.",
          payment: null,
          cycle: null,
          group: null,
          membershipRole: null,
        });
        return;
      }

      setState((current) => ({ ...current, loading: true, error: "" }));

      try {
        const payment = await getPayment(auth.token, paymentId);
        const cycle = await getCycle(auth.token, cycleIdFromUrl || Number(payment.cycle_id));
        const group = await getGroup(auth.token, groupIdFromUrl || Number(cycle.group_id));
        const members = await fetchAllGroupMembers(auth.token, group.id).catch(() => []);
        const membership =
          members.find((item) => Number(item.user_id) === Number(auth.profile?.id)) || null;

        if (!active) return;

        setState({
          loading: false,
          error: "",
          payment,
          cycle,
          group,
          membershipRole: membership?.role || null,
        });
        setForm({
          due_date: payment.due_date || "",
          amount_due: String(payment.amount_due ?? ""),
          amount_paid: String(payment.amount_paid ?? ""),
          paid_at: datetimeLocalValue(payment.paid_at),
          notes: payment.notes || "",
        });
      } catch (error) {
        if (!active) return;
        setState({
          loading: false,
          error: error?.message || "Failed to load payment.",
          payment: null,
          cycle: null,
          group: null,
          membershipRole: null,
        });
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [auth.profile?.id, auth.token, cycleIdFromUrl, groupIdFromUrl, paymentId, reloadNonce]);

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
  const canSubmitOwn = !canManage && state.payment && !paymentNeedsApproval(state.payment) && state.payment.status !== "paid";
  const canApprove = canManage && state.payment && paymentNeedsApproval(state.payment);
  const payment = state.payment;

  function reload() {
    setReloadNonce((value) => value + 1);
  }

  async function handleSave(event) {
    event.preventDefault();
    setFormMessage({ error: "", success: "" });

    if (!form.due_date || !form.amount_due || !form.amount_paid) {
      setFormMessage({ error: "Due date, amount due, and amount paid are required.", success: "" });
      return;
    }

    setBusyAction("save");
    try {
      await updatePayment(auth.token, paymentId, {
        due_date: form.due_date,
        amount_due: form.amount_due,
        amount_paid: form.amount_paid,
        paid_at: form.paid_at ? new Date(form.paid_at).toISOString() : null,
        notes: form.notes.trim() || null,
      });
      setFormMessage({ error: "", success: "Payment updated." });
      reload();
    } catch (error) {
      setFormMessage({ error: error?.message || "Failed to update payment.", success: "" });
    } finally {
      setBusyAction("");
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this unpaid payment record?")) return;
    setBusyAction("delete");
    try {
      await deletePayment(auth.token, paymentId);
      navigate(routes.payments(payment?.cycle_id || cycleIdFromUrl, null, groupId));
    } catch (error) {
      setFormMessage({ error: error?.message || "Failed to delete payment.", success: "" });
      setBusyAction("");
    }
  }

  async function handleSubmitOwnPayment() {
    setWorkflowError("");
    setBusyAction("submit");
    try {
      await submitPayment(auth.token, paymentId, {});
      reload();
    } catch (error) {
      setWorkflowError(error?.message || "Failed to submit payment.");
    } finally {
      setBusyAction("");
    }
  }

  async function handleApprove() {
    setWorkflowError("");
    setBusyAction("approve");
    try {
      await approvePayment(auth.token, paymentId, {});
      reload();
    } catch (error) {
      setWorkflowError(error?.message || "Failed to approve payment.");
    } finally {
      setBusyAction("");
    }
  }

  return (
    <AppShell
      auth={auth}
      navigate={navigate}
      miniTitle="Group workspace"
      title="Payment Detail"
      activeSidebarKey={workspace.activeKey}
      sidebarSections={workspace.sidebarSections}
      brandTo={routes.groupDetail(groupId || 0)}
      brandSubtitle="Group workspace"
    >
      <section className="dashboard-panel card workspace-legacy-card">
        <div className="card-body">
          <div className="workspace-legacy-intro">
            <div>
              <h2>{payment ? `Payment #${payment.id}` : "Loading payment..."}</h2>
              <p>{state.cycle && state.group ? `Cycle #${state.cycle.id} • ${state.group.name}` : "Preparing payment detail."}</p>
            </div>
            <span className={`badge ${payment ? paymentBadgeClass(paymentState(payment)) : ""}`}>{payment ? paymentState(payment) : "-"}</span>
          </div>

          <p className="dashboard-note mb-3">
            {canManage
              ? "Members submit each round payment here. Admins and moderators approve it after the contribution is confirmed."
              : paymentNeedsApproval(payment)
                ? "Your payment has been submitted and is now waiting for approval."
                : payment?.status === "paid"
                  ? "This round payment has already been approved."
                  : "Use this page to submit your scheduled contribution when you have paid it."}
          </p>

          {state.error ? <div className="form-error">{state.error}</div> : null}

          <dl className="profile-grid">
            <dt>Cycle member ID</dt>
            <dd>{payment?.cycle_member_id || cycleMemberIdFromUrl || "-"}</dd>
            <dt>Due date</dt>
            <dd>{payment?.due_date || "-"}</dd>
            <dt>Amount due</dt>
            <dd>{payment?.amount_due || "-"}</dd>
            <dt>Amount paid</dt>
            <dd>{payment?.amount_paid || "-"}</dd>
            <dt>Approval state</dt>
            <dd>{payment ? paymentState(payment) : "-"}</dd>
            <dt>Paid at</dt>
            <dd>{formatDateTime(payment?.paid_at)}</dd>
            <dt>Created by</dt>
            <dd>{payment?.created_by || "-"}</dd>
            <dt>Created at</dt>
            <dd>{formatDateTime(payment?.created_at)}</dd>
            <dt>Notes</dt>
            <dd>{payment?.notes || "-"}</dd>
          </dl>

          {canManage ? (
            <div className="mt-3">
              <form className="stack" onSubmit={handleSave} noValidate>
                {formMessage.error ? <div className="form-error">{formMessage.error}</div> : null}
                {formMessage.success ? <div className="form-success">{formMessage.success}</div> : null}

                <div className="workspace-form-grid cols-2">
                  <div className="field">
                    <label htmlFor="due_date">Due date</label>
                    <input id="due_date" type="date" value={form.due_date} onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))} />
                  </div>

                  <div className="field">
                    <label htmlFor="amount_due">Amount due</label>
                    <input id="amount_due" type="number" min="0.01" step="0.01" value={form.amount_due} onChange={(event) => setForm((current) => ({ ...current, amount_due: event.target.value }))} />
                  </div>

                  <div className="field">
                    <label htmlFor="amount_paid">Amount paid</label>
                    <input id="amount_paid" type="number" min="0" step="0.01" value={form.amount_paid} onChange={(event) => setForm((current) => ({ ...current, amount_paid: event.target.value }))} />
                  </div>

                  <div className="field">
                    <label htmlFor="paid_at">Paid at</label>
                    <input id="paid_at" type="datetime-local" value={form.paid_at} onChange={(event) => setForm((current) => ({ ...current, paid_at: event.target.value }))} />
                  </div>

                  <div className="field">
                    <label htmlFor="notes">Notes</label>
                    <textarea id="notes" className="textarea" rows="3" maxLength="2000" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}></textarea>
                  </div>
                </div>

                <div className="modal-actions">
                  <button className="btn" type="submit" disabled={busyAction === "save"}>
                    {busyAction === "save" ? "Saving..." : "Save changes"}
                  </button>
                  <button className="btn btn-secondary" type="button" disabled={busyAction === "delete" || !(canManage && Number(payment?.amount_paid || 0) === 0 && payment?.status !== "paid")} onClick={handleDelete}>
                    {busyAction === "delete" ? "Deleting..." : "Delete unpaid record"}
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          {canSubmitOwn || canApprove ? (
            <div className="mt-3">
              <div className="dashboard-note mb-3">
                {canApprove
                  ? "This member marked the payment as paid. Approve it once you confirm the contribution was received."
                  : "When you have paid this round contribution, submit it here so an admin or moderator can approve it."}
              </div>
              {workflowError ? <div className="form-error">{workflowError}</div> : null}
              <div className="modal-actions">
                {canSubmitOwn ? (
                  <button className="btn" type="button" disabled={busyAction === "submit"} onClick={handleSubmitOwnPayment}>
                    {busyAction === "submit" ? "Submitting..." : "Submit as paid"}
                  </button>
                ) : null}
                {canApprove ? (
                  <button className="btn" type="button" disabled={busyAction === "approve"} onClick={handleApprove}>
                    {busyAction === "approve" ? "Approving..." : "Approve payment"}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="toolbar mt-3">
            <div className="toolbar-left">
              <button className="btn btn-secondary" type="button" onClick={() => navigate(routes.payouts(payment?.cycle_id || cycleIdFromUrl, payment?.cycle_member_id || cycleMemberIdFromUrl, groupId))}>
                View payouts
              </button>
            </div>
            <div className="toolbar-right">
              <button className="btn btn-secondary" type="button" onClick={() => navigate(routes.payments(payment?.cycle_id || cycleIdFromUrl, payment?.cycle_member_id || cycleMemberIdFromUrl, groupId))}>
                Back to payments
              </button>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
