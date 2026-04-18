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
      canCreateCycle:
        Number(group.created_by) === Number(profile.id) || role === "admin" || role === "moderator",
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

  function formatDate(value) {
    if (!value) return "-";
    return new Date(`${value}T00:00:00`).toLocaleDateString();
  }

  function formatDateTime(value) {
    if (!value) return "-";
    return new Date(value).toLocaleString();
  }

  function datetimeLocalValue(value) {
    if (!value) return "";
    const d = new Date(value);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
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

  function renderSummary(summary) {
    const box = qs("#summary-grid");
    box.innerHTML = "";
    const rows = [
      ["Total records", summary.total_payments],
      ["Due", summary.due_count],
      ["Paid", summary.paid_count],
      ["Late", summary.late_count],
      ["Amount due", formatMoney(summary.total_amount_due)],
      ["Amount paid", formatMoney(summary.total_amount_paid)],
      ["Outstanding", formatMoney(summary.outstanding_amount)],
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

  function renderPayments(items, cycleId, cycleMemberId, canManage) {
    const list = qs("#payments-list");
    list.innerHTML = "";

    if (!items.length) {
      const li = document.createElement("li");
      li.className = "list-empty";
      li.textContent = "No payments found for this filter yet.";
      list.appendChild(li);
      return;
    }

    items.forEach((payment) => {
      const li = document.createElement("li");
      li.className = "list-item";

      const left = document.createElement("div");
      left.className = "list-main";

      const title = document.createElement("div");
      title.className = "list-title";
      title.textContent = `Payment #${payment.id}`;

      const meta = document.createElement("div");
      meta.className = "list-meta";
      meta.textContent = `Cycle member #${payment.cycle_member_id} • due ${formatDate(payment.due_date)} • paid ${formatMoney(payment.amount_paid)} / ${formatMoney(payment.amount_due)}`;

      const badges = document.createElement("div");
      badges.style.marginTop = "8px";

      const statusBadge = document.createElement("span");
      statusBadge.className = `badge ${paymentBadgeClass(paymentState(payment))}`;
      statusBadge.textContent = paymentState(payment);
      badges.appendChild(statusBadge);

      left.appendChild(title);
      left.appendChild(meta);
      left.appendChild(badges);

      const actions = document.createElement("div");
      actions.className = "list-actions";

      const open = document.createElement("a");
      open.className = "btn btn-secondary";
      open.style.width = "auto";
      open.href = `payment_detail.html?payment_id=${payment.id}&cycle_id=${cycleId}${cycleMemberId ? `&cycle_member_id=${cycleMemberId}` : ""}`;
      open.textContent = canManage ? "Manage" : "View";
      actions.appendChild(open);

      const isOwnPayment = !canManage;
      if (isOwnPayment && !paymentNeedsApproval(payment) && payment.status !== "paid") {
        const submit = document.createElement("button");
        submit.className = "btn";
        submit.style.width = "auto";
        submit.type = "button";
        submit.textContent = "I paid";
        submit.addEventListener("click", async () => {
          APP.setButtonLoading(submit, true, "Submitting…", true);
          try {
            await PaymentAPI.submitPayment(payment.id, {});
            APP.showToast("Payment submitted for approval", "success");
            await window.__paymentReload();
          } catch (e) {
            APP.showToast(e.message || "Failed to submit payment.", "error");
          } finally {
            APP.setButtonLoading(submit, false);
          }
        });
        actions.appendChild(submit);
      }

      if (canManage && paymentNeedsApproval(payment)) {
        const approve = document.createElement("button");
        approve.className = "btn";
        approve.style.width = "auto";
        approve.type = "button";
        approve.textContent = "Approve";
        approve.addEventListener("click", async () => {
          APP.setButtonLoading(approve, true, "Approving…", true);
          try {
            await PaymentAPI.approvePayment(payment.id, {});
            APP.showToast("Payment approved", "success");
            await window.__paymentReload();
          } catch (e) {
            APP.showToast(e.message || "Failed to approve payment.", "error");
          } finally {
            APP.setButtonLoading(approve, false);
          }
        });
        actions.appendChild(approve);
      }

      li.appendChild(left);
      li.appendChild(actions);
      list.appendChild(li);
    });
  }

  async function initPaymentsPage() {
    if (!APP.requireAuthOrRedirect()) return;

    const cycleId = Number(qparam("cycle_id"));
    const cycleMemberId = Number(qparam("cycle_member_id") || 0);
    if (!cycleId) {
      setMessage("#page-error", "Missing cycle_id. Open this page like payments.html?cycle_id=1");
      return;
    }

    const profile = await ensureProfile();
    if (!profile) return;

    const cycle = await CycleAPI.getCycle(cycleId);
    const group = await GroupAPI.getGroup(cycle.group_id);
    const role = await myRole(cycle.group_id, profile.id).catch(() => null);
    const canManage =
      Number(group.created_by) === Number(profile.id) || role === "admin" || role === "moderator";
    applyGroupWorkspace(profile, group, role, "Payments");

    text(qs("#cycle-title"), `Payments for cycle #${cycle.id}`);
    text(qs("#cycle-subtitle"), `${group.name} • round contributions and payment approvals`);
    const permissionsNote = canManage
      ? "Round payment records are generated automatically when the cycle starts. Members submit them, then admins and moderators approve them."
      : "Your scheduled contribution records appear here. Use I paid to submit each round for approval.";
    text(qs("#permissions-note"), permissionsNote);
    text(qs("#permissions-note-main"), permissionsNote);

    qs("#open-cycle").addEventListener("click", () => APP.navigate(`cycle_detail.html?cycle_id=${cycle.id}&group_id=${cycle.group_id}`));
    qs("#open-participants").addEventListener("click", () => APP.navigate(`cycle_members.html?cycle_id=${cycle.id}&group_id=${cycle.group_id}`));
    qs("#open-payouts").addEventListener("click", () => APP.navigate(`payouts.html?cycle_id=${cycle.id}`));

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
        const summary = await PaymentAPI.getSummary(cycle.id);
        renderSummary(summary);
        show(qs("#summary-card"), true);
      } catch (e) {
        setMessage("#summary-error", e.message || "Could not load payment summary.");
      }
    }

    show(qs("#open-create"), false);

    let page = 1;
    let status = "";
    let dueFrom = "";
    let dueTo = "";

    async function refreshSummary() {
      if (!canManage) return;
      try {
        const summary = await PaymentAPI.getSummary(cycle.id);
        renderSummary(summary);
        setMessage("#summary-error", "");
      } catch (e) {
        setMessage("#summary-error", e.message || "Could not load payment summary.");
      }
    }

    async function load() {
      setMessage("#page-error", "");
      text(qs("#list-status"), "Loading…");
      try {
        const items = await PaymentAPI.listPayments({
          cycle_id: cycle.id,
          cycle_member_id: memberFilter.value || "",
          status,
          due_from: dueFrom,
          due_to: dueTo,
          page,
          size: PAGE_SIZE,
        });
        renderPayments(items, cycle.id, Number(memberFilter.value || 0), canManage);
        text(qs("#page-label"), `Page ${page}`);
        qs("#prev").disabled = page <= 1;
        qs("#next").disabled = items.length < PAGE_SIZE;
        text(qs("#list-status"), "");
      } catch (e) {
        const msg = e.message || "Failed to load payments.";
        setMessage("#page-error", msg);
        text(qs("#list-status"), msg);
      }
    }

    window.__paymentReload = async function reload() {
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
    qs("#due_from").addEventListener("change", () => {
      dueFrom = qs("#due_from").value;
      page = 1;
      load();
    });
    qs("#due_to").addEventListener("change", () => {
      dueTo = qs("#due_to").value;
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
      qs("#create_due_date").value = new Date().toISOString().slice(0, 10);
      qs("#create_amount_due").value = "";
      qs("#create_amount_paid").value = "0.00";
      qs("#create_paid_at").value = "";
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
        if (!memberId) {
          setMessage("#form-error", "Choose a cycle participant first.");
          return;
        }

        const payload = {
          cycle_id: cycle.id,
          cycle_member_id: memberId,
          due_date: qs("#create_due_date").value,
          amount_paid: qs("#create_amount_paid").value || "0.00",
          notes: qs("#create_notes").value.trim() || null,
        };

        if (!payload.due_date) {
          setMessage("#form-error", "Due date is required.");
          return;
        }
        if (qs("#create_amount_due").value.trim()) payload.amount_due = qs("#create_amount_due").value.trim();
        if (qs("#create_paid_at").value) payload.paid_at = new Date(qs("#create_paid_at").value).toISOString();

        APP.setButtonLoading(qs("#create-submit"), true, "Creating…");
        try {
          await PaymentAPI.createPayment(payload);
          APP.showToast("Payment created", "success");
          closeModal();
          page = 1;
          await refreshSummary();
          await load();
        } catch (err) {
          setMessage("#form-error", err.message || "Failed to create payment.");
        } finally {
          APP.setButtonLoading(qs("#create-submit"), false);
        }
      });
    }

    await refreshSummary();
    await load();
  }

  async function initPaymentDetailPage() {
    if (!APP.requireAuthOrRedirect()) return;

    const paymentId = Number(qparam("payment_id"));
    if (!paymentId) {
      setMessage("#page-error", "Missing payment_id.");
      return;
    }

    const profile = await ensureProfile();
    if (!profile) return;

    let payment = await PaymentAPI.getPayment(paymentId);
    const cycle = await CycleAPI.getCycle(payment.cycle_id);
    const group = await GroupAPI.getGroup(cycle.group_id);
    const role = await myRole(cycle.group_id, profile.id).catch(() => null);
    const canManage =
      Number(group.created_by) === Number(profile.id) || role === "admin" || role === "moderator";
    applyGroupWorkspace(profile, group, role, "Payment Detail");

    qs("#back").addEventListener("click", () => {
      APP.navigate(`payments.html?cycle_id=${payment.cycle_id}${payment.cycle_member_id ? `&cycle_member_id=${payment.cycle_member_id}` : ""}`);
    });
    qs("#open-payouts").addEventListener("click", () => {
      APP.navigate(`payouts.html?cycle_id=${payment.cycle_id}&cycle_member_id=${payment.cycle_member_id}`);
    });

    async function render() {
      payment = await PaymentAPI.getPayment(paymentId);
      const displayState = paymentState(payment);
      const canSubmitOwn = !canManage && !paymentNeedsApproval(payment) && payment.status !== "paid";
      const canApprove = canManage && paymentNeedsApproval(payment);

      text(qs("#payment-title"), `Payment #${payment.id}`);
      text(qs("#subtitle"), `Cycle #${payment.cycle_id} • ${group.name}`);
      text(qs("#payment-note"), canManage
        ? "Members submit each round payment here. Admins and moderators approve it after the contribution is confirmed."
        : paymentNeedsApproval(payment)
          ? "Your payment has been submitted and is now waiting for approval."
          : payment.status === "paid"
            ? "This round payment has already been approved."
            : "Use this page to submit your scheduled contribution when you have paid it.");

      const statusBadge = qs("#payment-status");
      statusBadge.textContent = displayState;
      statusBadge.className = `badge ${paymentBadgeClass(displayState)}`;

      const grid = qs("#payment-grid");
      grid.innerHTML = "";
      [
        ["Cycle member ID", payment.cycle_member_id],
        ["Due date", payment.due_date],
        ["Amount due", payment.amount_due],
        ["Amount paid", payment.amount_paid],
        ["Approval state", displayState],
        ["Paid at", formatDateTime(payment.paid_at)],
        ["Created by", payment.created_by],
        ["Created at", formatDateTime(payment.created_at)],
        ["Notes", payment.notes || "-"],
      ].forEach(([k, v]) => {
        const dt = document.createElement("dt");
        dt.textContent = k;
        const dd = document.createElement("dd");
        dd.textContent = String(v);
        grid.appendChild(dt);
        grid.appendChild(dd);
      });

      qs("#due_date").value = payment.due_date || "";
      qs("#amount_due").value = payment.amount_due;
      qs("#amount_paid").value = payment.amount_paid;
      qs("#paid_at").value = datetimeLocalValue(payment.paid_at);
      qs("#notes").value = payment.notes || "";

      show(qs("#manage"), canManage);
      show(qs("#workflow-actions"), canSubmitOwn || canApprove);
      show(qs("#submit-payment"), canSubmitOwn);
      show(qs("#approve-payment"), canApprove);
      text(qs("#workflow-note"), canApprove
        ? "This member marked the payment as paid. Approve it once you confirm the contribution was received."
        : canSubmitOwn
          ? "When you have paid this round contribution, submit it here so an admin or moderator can approve it."
          : paymentNeedsApproval(payment)
            ? "This payment is waiting for approval."
            : payment.status === "paid"
              ? "This payment has already been approved."
              : "No action is available on this payment right now.");
      setMessage("#workflow-error", "");
      qs("#delete").disabled = !(canManage && Number(payment.amount_paid) === 0 && payment.status !== "paid");
    }

    if (canManage) {
      qs("#edit-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        setMessage("#form-error", "");
        setMessage("#form-success", "");

        const payload = {
          due_date: qs("#due_date").value || null,
          amount_due: qs("#amount_due").value.trim(),
          amount_paid: qs("#amount_paid").value.trim(),
          notes: qs("#notes").value.trim() || null,
        };

        if (!payload.due_date) {
          setMessage("#form-error", "Due date is required.");
          return;
        }
        if (!payload.amount_due) {
          setMessage("#form-error", "Amount due is required.");
          return;
        }
        if (!payload.amount_paid) {
          setMessage("#form-error", "Amount paid is required.");
          return;
        }
        if (qs("#paid_at").value) payload.paid_at = new Date(qs("#paid_at").value).toISOString();

        APP.setButtonLoading(qs("#save"), true, "Saving…");
        try {
          await PaymentAPI.updatePayment(payment.id, payload);
          APP.showToast("Payment updated", "success");
          setMessage("#form-success", "Payment updated.");
          await render();
        } catch (err) {
          setMessage("#form-error", err.message || "Failed to update payment.");
        } finally {
          APP.setButtonLoading(qs("#save"), false);
        }
      });

      qs("#delete").addEventListener("click", async () => {
        if (!window.confirm("Delete this unpaid payment record?")) return;
        APP.setButtonLoading(qs("#delete"), true, "Deleting…");
        try {
          await PaymentAPI.deletePayment(payment.id);
          APP.showToast("Payment deleted", "success");
          APP.navigate(`payments.html?cycle_id=${payment.cycle_id}`);
        } catch (err) {
          APP.showToast(err.message || "Failed to delete payment.", "error");
        } finally {
          APP.setButtonLoading(qs("#delete"), false);
        }
      });
    }

    if (qs("#submit-payment")) {
      qs("#submit-payment").addEventListener("click", async () => {
        setMessage("#workflow-error", "");
        APP.setButtonLoading(qs("#submit-payment"), true, "Submitting…", true);
        try {
          await PaymentAPI.submitPayment(payment.id, {});
          APP.showToast("Payment submitted for approval", "success");
          await render();
        } catch (err) {
          setMessage("#workflow-error", err.message || "Failed to submit payment.");
        } finally {
          APP.setButtonLoading(qs("#submit-payment"), false);
        }
      });
    }

    if (qs("#approve-payment")) {
      qs("#approve-payment").addEventListener("click", async () => {
        setMessage("#workflow-error", "");
        APP.setButtonLoading(qs("#approve-payment"), true, "Approving…", true);
        try {
          await PaymentAPI.approvePayment(payment.id, {});
          APP.showToast("Payment approved", "success");
          await render();
        } catch (err) {
          setMessage("#workflow-error", err.message || "Failed to approve payment.");
        } finally {
          APP.setButtonLoading(qs("#approve-payment"), false);
        }
      });
    }

    await render();
  }

  document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page || "";
    if (page === "payments") initPaymentsPage();
    if (page === "payment_detail") initPaymentDetailPage();
  });
})();
