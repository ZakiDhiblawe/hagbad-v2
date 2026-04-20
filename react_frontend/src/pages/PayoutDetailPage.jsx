import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { usePageChrome } from "../hooks/usePageChrome";
import {
  approvePayout,
  deletePayout,
  getCycle,
  getGroup,
  getPayout,
  listGroupMembers,
  payPayout,
  rejectPayout,
  updatePayout,
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

export default function PayoutDetailPage({ auth, navigate, searchParams }) {
  const payoutId = Number(searchParams.get("payout_id") || 0);
  const cycleIdFromUrl = Number(searchParams.get("cycle_id") || 0);
  const cycleMemberIdFromUrl = Number(searchParams.get("cycle_member_id") || 0);
  const groupIdFromUrl = Number(searchParams.get("group_id") || 0);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [busyAction, setBusyAction] = useState("");
  const [formMessage, setFormMessage] = useState({ error: "", success: "" });
  const [form, setForm] = useState({
    amount: "",
    notes: "",
    decision_notes: "",
  });
  const [state, setState] = useState({
    loading: true,
    error: "",
    payout: null,
    cycle: null,
    group: null,
    membershipRole: null,
  });

  const pageTitle = state.payout ? `Payout #${state.payout.id} | Hagbad` : "Payout Detail | Hagbad";

  usePageChrome({
    title: pageTitle,
    page: "payout_detail",
    bodyClassName: "portal-body dashboard-body",
  });

  useEffect(() => {
    let active = true;

    async function load() {
      if (!payoutId) {
        setState({
          loading: false,
          error: "Missing payout_id.",
          payout: null,
          cycle: null,
          group: null,
          membershipRole: null,
        });
        return;
      }

      setState((current) => ({ ...current, loading: true, error: "" }));

      try {
        const payout = await getPayout(auth.token, payoutId);
        const cycle = await getCycle(auth.token, cycleIdFromUrl || Number(payout.cycle_id));
        const group = await getGroup(auth.token, groupIdFromUrl || Number(cycle.group_id));
        const members = await fetchAllGroupMembers(auth.token, group.id).catch(() => []);
        const membership =
          members.find((item) => Number(item.user_id) === Number(auth.profile?.id)) || null;

        if (!active) return;

        setState({
          loading: false,
          error: "",
          payout,
          cycle,
          group,
          membershipRole: membership?.role || null,
        });
        setForm({
          amount: String(payout.amount ?? ""),
          notes: payout.notes || "",
          decision_notes: "",
        });
      } catch (error) {
        if (!active) return;
        setState({
          loading: false,
          error: error?.message || "Failed to load payout.",
          payout: null,
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
  }, [auth.profile?.id, auth.token, cycleIdFromUrl, groupIdFromUrl, payoutId, reloadNonce]);

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
  const payout = state.payout;

  function reload() {
    setReloadNonce((value) => value + 1);
  }

  async function handleSave(event) {
    event.preventDefault();
    setFormMessage({ error: "", success: "" });

    if (!form.amount) {
      setFormMessage({ error: "Amount is required.", success: "" });
      return;
    }

    setBusyAction("save");
    try {
      await updatePayout(auth.token, payoutId, {
        amount: form.amount,
        notes: form.notes.trim() || null,
      });
      setFormMessage({ error: "", success: "Payout updated." });
      reload();
    } catch (error) {
      setFormMessage({ error: error?.message || "Failed to update payout.", success: "" });
    } finally {
      setBusyAction("");
    }
  }

  async function handleApprove() {
    setBusyAction("approve");
    try {
      await approvePayout(auth.token, payoutId, { notes: form.decision_notes.trim() || null });
      reload();
    } catch (error) {
      setFormMessage({ error: error?.message || "Failed to approve payout.", success: "" });
      setBusyAction("");
    }
  }

  async function handleReject() {
    setBusyAction("reject");
    try {
      await rejectPayout(auth.token, payoutId, { notes: form.decision_notes.trim() || null });
      reload();
    } catch (error) {
      setFormMessage({ error: error?.message || "Failed to reject payout.", success: "" });
      setBusyAction("");
    }
  }

  async function handleMarkPaid() {
    setBusyAction("pay");
    try {
      await payPayout(auth.token, payoutId, { notes: form.decision_notes.trim() || null });
      reload();
    } catch (error) {
      setFormMessage({ error: error?.message || "Failed to mark payout paid.", success: "" });
      setBusyAction("");
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this payout record?")) return;
    setBusyAction("delete");
    try {
      await deletePayout(auth.token, payoutId);
      navigate(routes.payouts(payout?.cycle_id || cycleIdFromUrl, null, groupId));
    } catch (error) {
      setFormMessage({ error: error?.message || "Failed to delete payout.", success: "" });
      setBusyAction("");
    }
  }

  return (
    <AppShell
      auth={auth}
      navigate={navigate}
      miniTitle="Group workspace"
      title="Payout Detail"
      activeSidebarKey={workspace.activeKey}
      sidebarSections={workspace.sidebarSections}
      brandTo={routes.groupDetail(groupId || 0)}
      brandSubtitle="Group workspace"
    >
      <section className="dashboard-panel card workspace-legacy-card">
        <div className="card-body">
          <div className="workspace-legacy-intro">
            <div>
              <h2>{payout ? `Payout #${payout.id}` : "Loading payout..."}</h2>
              <p>{state.cycle && state.group ? `Cycle #${state.cycle.id} • ${state.group.name}` : "Preparing payout detail."}</p>
            </div>
            <span className={`badge ${payout ? payoutBadgeClass(payout.status) : ""}`}>{payout?.status || "-"}</span>
          </div>

          <p className="dashboard-note mb-3">
            {canManage
              ? "Approve this payout only after all payments for this round are approved, then mark it paid when the turn holder receives the funds."
              : "View only."}
          </p>

          {state.error ? <div className="form-error">{state.error}</div> : null}

          <dl className="profile-grid">
            <dt>Cycle member ID</dt>
            <dd>{payout?.cycle_member_id || cycleMemberIdFromUrl || "-"}</dd>
            <dt>Amount</dt>
            <dd>{payout?.amount || "-"}</dd>
            <dt>Created by</dt>
            <dd>{payout?.created_by || "-"}</dd>
            <dt>Approved by</dt>
            <dd>{payout?.approved_by || "-"}</dd>
            <dt>Created at</dt>
            <dd>{formatDateTime(payout?.created_at)}</dd>
            <dt>Approved at</dt>
            <dd>{formatDateTime(payout?.approved_at)}</dd>
            <dt>Paid at</dt>
            <dd>{formatDateTime(payout?.paid_at)}</dd>
            <dt>Notes</dt>
            <dd>{payout?.notes || "-"}</dd>
          </dl>

          {canManage ? (
            <div className="mt-3">
              <form className="stack" onSubmit={handleSave} noValidate>
                {formMessage.error ? <div className="form-error">{formMessage.error}</div> : null}
                {formMessage.success ? <div className="form-success">{formMessage.success}</div> : null}

                <div className="workspace-form-grid cols-2">
                  <div className="field">
                    <label htmlFor="amount">Amount</label>
                    <input id="amount" type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} />
                  </div>

                  <div className="field">
                    <label htmlFor="notes">Record notes</label>
                    <textarea id="notes" className="textarea" rows="3" maxLength="2000" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}></textarea>
                  </div>

                  <div className="field">
                    <label htmlFor="decision_notes">Decision notes</label>
                    <textarea id="decision_notes" className="textarea" rows="3" maxLength="2000" value={form.decision_notes} onChange={(event) => setForm((current) => ({ ...current, decision_notes: event.target.value }))}></textarea>
                  </div>
                </div>

                <div className="modal-actions">
                  <button className="btn" type="submit" disabled={busyAction === "save" || !(canManage && (payout?.status === "pending" || payout?.status === "rejected"))}>
                    {busyAction === "save" ? "Saving..." : "Save changes"}
                  </button>
                  <button className="btn btn-secondary" type="button" disabled={busyAction === "approve" || !(canManage && payout?.status === "pending")} onClick={handleApprove}>
                    {busyAction === "approve" ? "Approving..." : "Approve"}
                  </button>
                  <button className="btn btn-secondary" type="button" disabled={busyAction === "reject" || !(canManage && payout?.status !== "paid")} onClick={handleReject}>
                    {busyAction === "reject" ? "Rejecting..." : "Reject"}
                  </button>
                  <button className="btn btn-secondary" type="button" disabled={busyAction === "pay" || !(canManage && payout?.status === "approved")} onClick={handleMarkPaid}>
                    {busyAction === "pay" ? "Paying..." : "Mark paid"}
                  </button>
                  <button className="btn btn-secondary" type="button" disabled={busyAction === "delete" || !(canManage && (payout?.status === "pending" || payout?.status === "rejected"))} onClick={handleDelete}>
                    {busyAction === "delete" ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          <div className="toolbar mt-3">
            <div className="toolbar-right">
              <button className="btn btn-secondary" type="button" onClick={() => navigate(routes.payouts(payout?.cycle_id || cycleIdFromUrl, payout?.cycle_member_id || cycleMemberIdFromUrl, groupId))}>
                Back to payouts
              </button>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
