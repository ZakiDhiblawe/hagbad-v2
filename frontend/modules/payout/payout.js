(function () {
  const PAGE_SIZE = 20;

  function qs(sel) { return document.querySelector(sel); }
  function text(el, value) { if (el) el.textContent = value; }
  function show(el, yes) { if (el) el.hidden = !yes; }

  function mountWorkspaceMenu(profile) {
    const mount = qs("#workspace-user-menu");
    if (!mount || !profile) return;
    APP.mountUserMenu(mount, profile, { compact: false });
  }

  function applyGroupWorkspace(profile, group, role, pageTitle) {
    if (!group) return;
    mountWorkspaceMenu(profile);
    APP.applyGroupWorkspaceNav({
      groupId: group.id,
      activeKey: "cycles",
      pageTitle,
      canUpdateGroup: Number(group.created_by) === Number(profile.id),
      canCreateCycle: Number(group.created_by) === Number(profile.id) || role === "admin",
      canAccessAdministration:
        Number(group.created_by) === Number(profile.id) || role === "admin" || role === "moderator",
      showJoinRequests: group.privacy !== "public",
    });
  }

  function qparam(name) {
    return new URL(window.location.href).searchParams.get(name);
  }

  function setMessage(id, message) {
    const el = qs(id);
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || "";
  }

  function formatMoney(value) {
    return value == null ? "-" : String(value);
  }

  function formatDateTime(value) {
    if (!value) return "-";
    return new Date(value).toLocaleString();
  }

  async function ensureProfile() {
    const token = APP.requireAuthOrRedirect();
    if (!token) return null;
    try {
      return await UserAPI.getProfile(token);
    } catch (e) {
      if (e.status === 401) {
        APP.clearToken();
        APP.showToast("Session expired. Please log in again.", "info");
        APP.navigate("login.html");
        return null;
      }
      throw e;
    }
  }

  async function myRole(groupId, myId) {
    for (let page = 1; page <= 20; page++) {
      const items = await GroupMemberAPI.listMembers({ group_id: groupId, page, size: 100 });
      const me = items.find((member) => Number(member.user_id) === Number(myId));
      if (me) return me.role;
      if (items.length < 100) break;
    }
    return null;
  }

  async function fetchAllCycleMembers(cycleId) {
    const all = [];
    for (let page = 1; page <= 20; page++) {
      const items = await CycleMemberAPI.listMembers({ cycle_id: cycleId, page, size: 100 });
      all.push(...items);
      if (items.length < 100) break;
    }
    return all;
  }

  function payoutBadgeClass(status) {
    if (status === "paid") return "good";
    if (status === "approved") return "warn";
    if (status === "rejected") return "bad";
    return "";
  }

  function renderSummary(summary) {
    const box = qs("#summary-grid");
    box.innerHTML = "";
    const rows = [
      ["Total payouts", summary.total_payouts],
      ["Pending", summary.pending_count],
      ["Approved", summary.approved_count],
      ["Rejected", summary.rejected_count],
      ["Paid", summary.paid_count],
      ["Total amount", formatMoney(summary.total_amount)],
      ["Paid amount", formatMoney(summary.paid_amount)],
      ["Remaining", formatMoney(summary.remaining_amount)],
    ];
    rows.forEach(([k, v]) => {
      const card = document.createElement("div");
      card.className = "stat-card";
      const label = document.createElement("div");
      label.className = "stat-label";
      label.textContent = k;
      const value = document.createElement("div");
      value.className = "stat-value";
      value.textContent = String(v);
      card.appendChild(label);
      card.appendChild(value);
      box.appendChild(card);
    });
  }

  function renderPayouts(items, cycleId, cycleMemberId, canManage) {
    const list = qs("#payouts-list");
    list.innerHTML = "";

    if (!items.length) {
      const li = document.createElement("li");
      li.className = "list-empty";
      li.textContent = "No payout records found for this filter yet.";
      list.appendChild(li);
      return;
    }

    items.forEach((payout) => {
      const li = document.createElement("li");
      li.className = "list-item";

      const left = document.createElement("div");
      left.className = "list-main";

      const title = document.createElement("div");
      title.className = "list-title";
      title.textContent = `Payout #${payout.id}`;

      const meta = document.createElement("div");
      meta.className = "list-meta";
      meta.textContent = `Cycle member #${payout.cycle_member_id} • amount ${formatMoney(payout.amount)} • created ${formatDateTime(payout.created_at)}`;

      const badges = document.createElement("div");
      badges.style.marginTop = "8px";

      const statusBadge = document.createElement("span");
      statusBadge.className = `badge ${payoutBadgeClass(payout.status)}`;
      statusBadge.textContent = payout.status;
      badges.appendChild(statusBadge);

      left.appendChild(title);
      left.appendChild(meta);
      left.appendChild(badges);

      const actions = document.createElement("div");
      actions.className = "list-actions";

      const open = document.createElement("a");
      open.className = "btn btn-secondary";
      open.style.width = "auto";
      open.href = `payout_detail.html?payout_id=${payout.id}&cycle_id=${cycleId}${cycleMemberId ? `&cycle_member_id=${cycleMemberId}` : ""}`;
      open.textContent = canManage ? "Manage" : "View";
      actions.appendChild(open);

      if (canManage && payout.status === "pending") {
        const approve = document.createElement("button");
        approve.className = "btn";
        approve.style.width = "auto";
        approve.type = "button";
        approve.textContent = "Approve";
        approve.addEventListener("click", async () => {
          APP.setButtonLoading(approve, true, "Approving…");
          try {
            await PayoutAPI.approvePayout(payout.id, {});
            APP.showToast("Payout approved", "success");
            await window.__payoutReload();
          } catch (e) {
            APP.showToast(e.message || "Failed to approve payout.", "error");
          } finally {
            APP.setButtonLoading(approve, false);
          }
        });
        actions.appendChild(approve);
      }

      if (canManage && payout.status === "approved") {
        const markPaid = document.createElement("button");
        markPaid.className = "btn";
        markPaid.style.width = "auto";
        markPaid.type = "button";
        markPaid.textContent = "Mark paid";
        markPaid.addEventListener("click", async () => {
          APP.setButtonLoading(markPaid, true, "Paying…");
          try {
            await PayoutAPI.markPaid(payout.id, {});
            APP.showToast("Payout marked paid", "success");
            await window.__payoutReload();
          } catch (e) {
            APP.showToast(e.message || "Failed to mark payout as paid.", "error");
          } finally {
            APP.setButtonLoading(markPaid, false);
          }
        });
        actions.appendChild(markPaid);
      }

      li.appendChild(left);
      li.appendChild(actions);
      list.appendChild(li);
    });
  }

  async function initPayoutsPage() {
    if (!APP.requireAuthOrRedirect()) return;

    const cycleId = Number(qparam("cycle_id"));
    const cycleMemberId = Number(qparam("cycle_member_id") || 0);
    if (!cycleId) {
      setMessage("#page-error", "Missing cycle_id. Open this page like payouts.html?cycle_id=1");
      return;
    }

    const profile = await ensureProfile();
    if (!profile) return;

    const cycle = await CycleAPI.getCycle(cycleId);
    const group = await GroupAPI.getGroup(cycle.group_id);
    const role = await myRole(cycle.group_id, profile.id).catch(() => null);
    const canManage = Number(group.created_by) === Number(profile.id) || role === "admin";
    applyGroupWorkspace(profile, group, role, "Payouts");

    text(qs("#cycle-title"), `Payouts for cycle #${cycle.id}`);
    text(qs("#cycle-subtitle"), `${group.name} • admin approval and payout completion`);
    const permissionsNote = canManage
      ? "Creator/admin can create, approve, reject, and mark payouts paid."
      : "You can view only your own payout records.";
    text(qs("#permissions-note"), permissionsNote);
    text(qs("#permissions-note-main"), permissionsNote);

    qs("#open-cycle").addEventListener("click", () => APP.navigate(`cycle_detail.html?cycle_id=${cycle.id}&group_id=${cycle.group_id}`));
    qs("#open-payments").addEventListener("click", () => APP.navigate(`payments.html?cycle_id=${cycle.id}`));

    let members = [];
    try {
      members = await fetchAllCycleMembers(cycle.id);
    } catch {
      members = [];
    }

    const memberFilter = qs("#cycle_member_id");
    memberFilter.innerHTML = "";
    const allOption = document.createElement("option");
    allOption.value = "";
    allOption.textContent = "All participants";
    memberFilter.appendChild(allOption);
    members.forEach((member) => {
      const option = document.createElement("option");
      option.value = String(member.id);
      option.textContent = `User #${member.user_id} • order ${member.payout_order}`;
      memberFilter.appendChild(option);
    });
    if (cycleMemberId) memberFilter.value = String(cycleMemberId);

    if (canManage) {
      try {
        const summary = await PayoutAPI.getSummary(cycle.id);
        renderSummary(summary);
        show(qs("#summary-card"), true);
      } catch (e) {
        setMessage("#summary-error", e.message || "Could not load payout summary.");
      }
    }

    show(qs("#open-create"), canManage);

    let page = 1;
    let status = "";

    async function refreshSummary() {
      if (!canManage) return;
      try {
        const summary = await PayoutAPI.getSummary(cycle.id);
        renderSummary(summary);
        setMessage("#summary-error", "");
      } catch (e) {
        setMessage("#summary-error", e.message || "Could not load payout summary.");
      }
    }

    async function load() {
      setMessage("#page-error", "");
      text(qs("#list-status"), "Loading…");
      try {
        const items = await PayoutAPI.listPayouts({
          cycle_id: cycle.id,
          cycle_member_id: memberFilter.value || "",
          status,
          page,
          size: PAGE_SIZE,
        });
        renderPayouts(items, cycle.id, Number(memberFilter.value || 0), canManage);
        text(qs("#page-label"), `Page ${page}`);
        qs("#prev").disabled = page <= 1;
        qs("#next").disabled = items.length < PAGE_SIZE;
        text(qs("#list-status"), "");
      } catch (e) {
        const msg = e.message || "Failed to load payouts.";
        setMessage("#page-error", msg);
        text(qs("#list-status"), msg);
      }
    }

    window.__payoutReload = async function reload() {
      await refreshSummary();
      await load();
    };

    qs("#refresh").addEventListener("click", async () => {
      await refreshSummary();
      await load();
    });
    qs("#prev").addEventListener("click", () => { if (page > 1) { page -= 1; load(); } });
    qs("#next").addEventListener("click", () => { page += 1; load(); });
    memberFilter.addEventListener("change", () => { page = 1; load(); });
    qs("#status-filter").addEventListener("change", () => {
      status = qs("#status-filter").value;
      page = 1;
      load();
    });

    const overlay = qs("#modal-overlay");
    const modal = qs("#create-modal");

    function openModal() {
      setMessage("#form-error", "");
      overlay.hidden = false;
      modal.hidden = false;

      const select = qs("#create_cycle_member_id");
      select.innerHTML = "";
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = members.length ? "Select participant" : "No cycle participants";
      select.appendChild(placeholder);
      members.forEach((member) => {
        const option = document.createElement("option");
        option.value = String(member.id);
        option.textContent = `User #${member.user_id} • order ${member.payout_order}`;
        select.appendChild(option);
      });

      if (cycleMemberId) select.value = String(cycleMemberId);
      qs("#create_amount").value = "";
      qs("#create_notes").value = "";
      select.focus();
    }

    function closeModal() {
      overlay.hidden = true;
      modal.hidden = true;
      qs("#create-form").reset();
    }

    if (canManage) {
      qs("#open-create").addEventListener("click", openModal);
      qs("#cancel").addEventListener("click", closeModal);
      overlay.addEventListener("click", closeModal);

      qs("#create-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        setMessage("#form-error", "");

        const memberId = Number(qs("#create_cycle_member_id").value);
        const amount = qs("#create_amount").value.trim();
        if (!memberId) {
          setMessage("#form-error", "Choose a cycle participant first.");
          return;
        }
        if (!amount) {
          setMessage("#form-error", "Amount is required.");
          return;
        }

        const payload = {
          cycle_id: cycle.id,
          cycle_member_id: memberId,
          amount,
          notes: qs("#create_notes").value.trim() || null,
        };

        APP.setButtonLoading(qs("#create-submit"), true, "Creating…");
        try {
          await PayoutAPI.createPayout(payload);
          APP.showToast("Payout created", "success");
          closeModal();
          page = 1;
          await refreshSummary();
          await load();
        } catch (err) {
          setMessage("#form-error", err.message || "Failed to create payout.");
        } finally {
          APP.setButtonLoading(qs("#create-submit"), false);
        }
      });
    }

    await refreshSummary();
    await load();
  }

  async function initPayoutDetailPage() {
    if (!APP.requireAuthOrRedirect()) return;

    const payoutId = Number(qparam("payout_id"));
    if (!payoutId) {
      setMessage("#page-error", "Missing payout_id.");
      return;
    }

    const profile = await ensureProfile();
    if (!profile) return;

    let payout = await PayoutAPI.getPayout(payoutId);
    const cycle = await CycleAPI.getCycle(payout.cycle_id);
    const group = await GroupAPI.getGroup(cycle.group_id);
    const role = await myRole(cycle.group_id, profile.id).catch(() => null);
    const canManage = Number(group.created_by) === Number(profile.id) || role === "admin";
    applyGroupWorkspace(profile, group, role, "Payout Detail");

    qs("#back").addEventListener("click", () => {
      APP.navigate(`payouts.html?cycle_id=${payout.cycle_id}${payout.cycle_member_id ? `&cycle_member_id=${payout.cycle_member_id}` : ""}`);
    });

    async function render() {
      payout = await PayoutAPI.getPayout(payoutId);
      text(qs("#payout-title"), `Payout #${payout.id}`);
      text(qs("#subtitle"), `Cycle #${payout.cycle_id} • ${group.name}`);
      text(qs("#payout-note"), canManage
        ? "Creator/admin can review, approve, reject, or mark this payout as paid."
        : "View only.");

      const statusBadge = qs("#payout-status");
      statusBadge.textContent = payout.status;
      statusBadge.className = `badge ${payoutBadgeClass(payout.status)}`;

      const grid = qs("#payout-grid");
      grid.innerHTML = "";
      [
        ["Cycle member ID", payout.cycle_member_id],
        ["Amount", payout.amount],
        ["Created by", payout.created_by],
        ["Approved by", payout.approved_by || "-"],
        ["Created at", formatDateTime(payout.created_at)],
        ["Approved at", formatDateTime(payout.approved_at)],
        ["Paid at", formatDateTime(payout.paid_at)],
        ["Notes", payout.notes || "-"],
      ].forEach(([k, v]) => {
        const dt = document.createElement("dt");
        dt.textContent = k;
        const dd = document.createElement("dd");
        dd.textContent = String(v);
        grid.appendChild(dt);
        grid.appendChild(dd);
      });

      qs("#amount").value = payout.amount;
      qs("#notes").value = payout.notes || "";
      qs("#decision_notes").value = "";

      show(qs("#manage"), canManage);
      qs("#approve").disabled = !(canManage && payout.status === "pending");
      qs("#reject").disabled = !(canManage && payout.status !== "paid");
      qs("#mark-paid").disabled = !(canManage && payout.status === "approved");
      qs("#delete").disabled = !(canManage && (payout.status === "pending" || payout.status === "rejected"));
      qs("#save").disabled = !(canManage && (payout.status === "pending" || payout.status === "rejected"));
    }

    if (canManage) {
      qs("#edit-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        setMessage("#form-error", "");
        setMessage("#form-success", "");

        const amount = qs("#amount").value.trim();
        if (!amount) {
          setMessage("#form-error", "Amount is required.");
          return;
        }

        APP.setButtonLoading(qs("#save"), true, "Saving…");
        try {
          await PayoutAPI.updatePayout(payout.id, {
            amount,
            notes: qs("#notes").value.trim() || null,
          });
          APP.showToast("Payout updated", "success");
          setMessage("#form-success", "Payout updated.");
          await render();
        } catch (err) {
          setMessage("#form-error", err.message || "Failed to update payout.");
        } finally {
          APP.setButtonLoading(qs("#save"), false);
        }
      });

      qs("#approve").addEventListener("click", async () => {
        APP.setButtonLoading(qs("#approve"), true, "Approving…");
        try {
          await PayoutAPI.approvePayout(payout.id, { notes: qs("#decision_notes").value.trim() || null });
          APP.showToast("Payout approved", "success");
          await render();
        } catch (err) {
          APP.showToast(err.message || "Failed to approve payout.", "error");
        } finally {
          APP.setButtonLoading(qs("#approve"), false);
        }
      });

      qs("#reject").addEventListener("click", async () => {
        APP.setButtonLoading(qs("#reject"), true, "Rejecting…");
        try {
          await PayoutAPI.rejectPayout(payout.id, { notes: qs("#decision_notes").value.trim() || null });
          APP.showToast("Payout rejected", "success");
          await render();
        } catch (err) {
          APP.showToast(err.message || "Failed to reject payout.", "error");
        } finally {
          APP.setButtonLoading(qs("#reject"), false);
        }
      });

      qs("#mark-paid").addEventListener("click", async () => {
        APP.setButtonLoading(qs("#mark-paid"), true, "Paying…");
        try {
          await PayoutAPI.markPaid(payout.id, { notes: qs("#decision_notes").value.trim() || null });
          APP.showToast("Payout marked paid", "success");
          await render();
        } catch (err) {
          APP.showToast(err.message || "Failed to mark payout paid.", "error");
        } finally {
          APP.setButtonLoading(qs("#mark-paid"), false);
        }
      });

      qs("#delete").addEventListener("click", async () => {
        if (!window.confirm("Delete this payout record?")) return;
        APP.setButtonLoading(qs("#delete"), true, "Deleting…");
        try {
          await PayoutAPI.deletePayout(payout.id);
          APP.showToast("Payout deleted", "success");
          APP.navigate(`payouts.html?cycle_id=${payout.cycle_id}`);
        } catch (err) {
          APP.showToast(err.message || "Failed to delete payout.", "error");
        } finally {
          APP.setButtonLoading(qs("#delete"), false);
        }
      });
    }

    await render();
  }

  document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page || "";
    if (page === "payouts") initPayoutsPage();
    if (page === "payout_detail") initPayoutDetailPage();
  });
})();
