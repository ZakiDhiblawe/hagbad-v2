import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { usePageChrome } from "../hooks/usePageChrome";
import {
  getCycle,
  getGroup,
  getGroupSettings,
  getPaymentSummary,
  getPayoutSummary,
  listCycleMembers,
  listGroupMembers,
  startCycle,
  stopCycle,
  updateCycle,
} from "../lib/api";
import { buildGroupWorkspaceConfig } from "../lib/groupWorkspace";
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

async function fetchAllCycleMembers(token, cycleId) {
  const items = [];
  for (let page = 1; page <= 50; page += 1) {
    const batch = await listCycleMembers(token, { cycleId, page, size: PAGE_SIZE });
    items.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return items;
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

export default function CycleDetailPage({ auth, navigate, searchParams }) {
  const cycleId = Number(searchParams.get("cycle_id") || 0);
  const groupIdFromUrl = Number(searchParams.get("group_id") || 0);
  const [reloadNonce, setReloadNonce] = useState(0);

  const [state, setState] = useState({
    loading: true,
    error: "",
    cycle: null,
    group: null,
    membershipRole: null,
    cycleMembers: [],
    settings: null,
    paymentSummary: null,
    payoutSummary: null,
  });
  const [form, setForm] = useState({
    frequency: "weekly",
    custom_days: "",
    end_date: "",
  });
  const [formMessage, setFormMessage] = useState({ kind: "", text: "" });
  const [busyAction, setBusyAction] = useState("");

  const pageTitle = state.cycle ? `Cycle #${state.cycle.id} | Hagbad` : "Cycle Detail | Hagbad";

  usePageChrome({
    title: pageTitle,
    page: "cycle_detail",
    bodyClassName: "portal-body dashboard-body",
  });

  useEffect(() => {
    let active = true;

    async function load() {
      if (!cycleId) {
        setState((current) => ({
          ...current,
          loading: false,
          error: "Missing cycle_id.",
        }));
        return;
      }

      setState((current) => ({ ...current, loading: true, error: "" }));

      try {
        const cycle = await getCycle(auth.token, cycleId);
        const groupId = groupIdFromUrl || Number(cycle.group_id);
        const [group, groupMembers, cycleMembers, settings, paymentSummary, payoutSummary] = await Promise.all([
          getGroup(auth.token, groupId),
          fetchAllGroupMembers(auth.token, groupId).catch(() => []),
          fetchAllCycleMembers(auth.token, cycleId).catch(() => []),
          getGroupSettings(auth.token, groupId).catch(() => null),
          getPaymentSummary(auth.token, cycleId).catch(() => null),
          getPayoutSummary(auth.token, cycleId).catch(() => null),
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
          cycleMembers,
          settings,
          paymentSummary,
          payoutSummary,
        });
      } catch (error) {
        if (!active) return;
        setState((current) => ({
          ...current,
          loading: false,
          error: error?.message || "Failed to load cycle.",
        }));
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [auth.profile?.id, auth.token, cycleId, groupIdFromUrl, reloadNonce]);

  useEffect(() => {
    if (!state.cycle) return;
    setForm({
      frequency: state.cycle.frequency || "weekly",
      custom_days: state.cycle.custom_days || "",
      end_date: state.cycle.end_date || "",
    });
  }, [state.cycle]);

  const groupId = state.group?.id || groupIdFromUrl || state.cycle?.group_id || 0;
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

  async function reloadCycle() {
    setReloadNonce((value) => value + 1);
  }

  async function handleStart() {
    setBusyAction("start");
    try {
      await startCycle(auth.token, cycleId);
      await reloadCycle();
    } catch (error) {
      setState((current) => ({ ...current, error: error?.message || "Failed to start cycle." }));
    } finally {
      setBusyAction("");
    }
  }

  async function handlePause() {
    setBusyAction("pause");
    try {
      await stopCycle(auth.token, cycleId, "paused");
      await reloadCycle();
    } catch (error) {
      setState((current) => ({ ...current, error: error?.message || "Failed to pause cycle." }));
    } finally {
      setBusyAction("");
    }
  }

  async function handleComplete() {
    setBusyAction("complete");
    try {
      await stopCycle(auth.token, cycleId, "completed");
      await reloadCycle();
    } catch (error) {
      setState((current) => ({ ...current, error: error?.message || "Failed to complete cycle." }));
    } finally {
      setBusyAction("");
    }
  }

  async function handleSave(event) {
    event.preventDefault();
    setFormMessage({ kind: "", text: "" });

    if (state.cycle?.status !== "pending") {
      setFormMessage({ kind: "error", text: "Only pending cycles can be edited." });
      return;
    }

    if (form.frequency === "custom_days" && !String(form.custom_days).trim()) {
      setFormMessage({ kind: "error", text: "Custom days is required when frequency is custom days." });
      return;
    }

    setBusyAction("save");
    try {
      await updateCycle(auth.token, cycleId, {
        frequency: form.frequency,
        custom_days: form.frequency === "custom_days" ? Number(form.custom_days) : null,
        end_date: form.end_date || null,
      });
      setFormMessage({ kind: "success", text: "Cycle updated successfully." });
      await reloadCycle();
    } catch (error) {
      setFormMessage({ kind: "error", text: error?.message || "Failed to update cycle." });
    } finally {
      setBusyAction("");
    }
  }

  const cycle = state.cycle;

  return (
    <AppShell
      auth={auth}
      navigate={navigate}
      miniTitle="Group workspace"
      title="Cycle Detail"
      activeSidebarKey={workspace.activeKey}
      sidebarSections={workspace.sidebarSections}
      brandTo={routes.groupDetail(groupId || 0)}
      brandSubtitle="Group workspace"
    >
      <section className="dashboard-panel card workspace-legacy-card">
        <div className="card-body">
          <div className="workspace-legacy-intro">
            <div>
              <h2>{cycle ? `Cycle #${cycle.id}` : "Loading cycle..."}</h2>
              <p>
                {cycle
                  ? `Review cycle status, payment rules, and participant totals for ${state.group?.name || "this group"}.`
                  : "Preparing cycle detail."}
              </p>
            </div>
            <span className="badge">{cycle ? cycle.status : "-"}</span>
          </div>

          <p className="dashboard-note">{state.group ? state.group.name : ""}</p>
          <p className="dashboard-note mb-3">
            {cycle
              ? `${frequencyLabel(cycle)} • starts ${formatDate(cycle.start_date)} • ${state.cycleMembers.length} participants`
              : ""}
          </p>

          {state.error ? <div className="form-error" role="alert">{state.error}</div> : null}

          <dl className="profile-grid">
            <dt>Cycle ID</dt>
            <dd>{cycle?.id || "-"}</dd>
            <dt>Group ID</dt>
            <dd>{cycle?.group_id || "-"}</dd>
            <dt>Status</dt>
            <dd>{cycle?.status || "-"}</dd>
            <dt>Start date</dt>
            <dd>{formatDate(cycle?.start_date)}</dd>
            <dt>End date</dt>
            <dd>{formatDate(cycle?.end_date)}</dd>
            <dt>Frequency</dt>
            <dd>{frequencyLabel(cycle)}</dd>
            <dt>Contribution</dt>
            <dd>{state.settings ? formatMoney(state.settings.contribution_amount) : "Missing"}</dd>
            <dt>Participants</dt>
            <dd>{state.cycleMembers.length}</dd>
            <dt>Payments</dt>
            <dd>
              {state.paymentSummary
                ? `${state.paymentSummary.paid_count} / ${state.paymentSummary.total_payments} approved or paid`
                : "-"}
            </dd>
            <dt>Payouts</dt>
            <dd>
              {state.payoutSummary
                ? `${state.payoutSummary.paid_count} / ${state.payoutSummary.total_payouts} paid`
                : "-"}
            </dd>
            <dt>Created</dt>
            <dd>{formatDateTime(cycle?.created_at)}</dd>
          </dl>

          <div className="toolbar mt-3" role="group" aria-label="Cycle links">
            <div className="toolbar-left">
              <button className="btn btn-secondary" type="button" onClick={() => navigate(routes.cycleMembers(cycleId, groupId))}>
                Cycle participants
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => navigate(routes.payments(cycleId, null, groupId))}>
                Payments
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => navigate(routes.payouts(cycleId, null, groupId))}>
                Payouts
              </button>
            </div>
            <div className="toolbar-right">
              <button className="btn btn-secondary" type="button" onClick={() => navigate(routes.cycles(groupId))}>
                Back to cycles
              </button>
            </div>
          </div>

          {workspace.canManageCycles ? (
            <div className="mt-4">
              <div className="toolbar" style={{ marginTop: "1rem" }}>
                <div className="toolbar-left">
                  {(cycle?.status === "pending" || cycle?.status === "paused") ? (
                    <button className="btn" type="button" disabled={busyAction === "start"} onClick={handleStart}>
                      {busyAction === "start" ? "Starting..." : cycle?.status === "paused" ? "Resume" : "Start"}
                    </button>
                  ) : null}
                  {cycle?.status === "active" ? (
                    <>
                      <button className="btn btn-secondary" type="button" disabled={busyAction === "pause"} onClick={handlePause}>
                        {busyAction === "pause" ? "Pausing..." : "Pause"}
                      </button>
                      <button className="btn btn-secondary" type="button" disabled={busyAction === "complete"} onClick={handleComplete}>
                        {busyAction === "complete" ? "Completing..." : "Complete"}
                      </button>
                    </>
                  ) : null}
                </div>
              </div>

              <form className="stack" onSubmit={handleSave} noValidate>
                {formMessage.text ? (
                  <div className={formMessage.kind === "success" ? "form-success" : "form-error"} role="status">
                    {formMessage.text}
                  </div>
                ) : null}

                <div className="workspace-form-grid cols-3">
                  <div className="field">
                    <label htmlFor="edit-frequency">Frequency</label>
                    <select
                      id="edit-frequency"
                      className="select"
                      value={form.frequency}
                      onChange={(event) => setForm((current) => ({ ...current, frequency: event.target.value }))}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="custom_days">Custom days</option>
                    </select>
                  </div>

                  {form.frequency === "custom_days" ? (
                    <div className="field">
                      <label htmlFor="edit-custom_days">Custom days</label>
                      <input
                        id="edit-custom_days"
                        type="number"
                        min="1"
                        step="1"
                        placeholder="e.g. 10"
                        value={form.custom_days}
                        onChange={(event) => setForm((current) => ({ ...current, custom_days: event.target.value }))}
                      />
                    </div>
                  ) : null}

                  <div className="field">
                    <label htmlFor="edit-end_date">End date</label>
                    <input
                      id="edit-end_date"
                      type="date"
                      value={form.end_date}
                      onChange={(event) => setForm((current) => ({ ...current, end_date: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="modal-actions">
                  <button className="btn" type="submit" disabled={busyAction === "save" || cycle?.status !== "pending"}>
                    {busyAction === "save" ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </form>
            </div>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
