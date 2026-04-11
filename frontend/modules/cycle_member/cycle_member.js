(function () {
  const PAGE_SIZE = 20;

  function qs(sel) { return document.querySelector(sel); }
  function text(el, value) { if (el) el.textContent = value; }
  function show(el, yes) { if (el) el.hidden = !yes; }

  function qparam(name) {
    return new URL(window.location.href).searchParams.get(name);
  }

  function setMessage(id, message) {
    const el = qs(id);
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || "";
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

  async function fetchAllGroupMembers(groupId) {
    const all = [];
    for (let page = 1; page <= 20; page++) {
      const items = await GroupMemberAPI.listMembers({ group_id: groupId, page, size: 100 });
      all.push(...items);
      if (items.length < 100) break;
    }
    return all;
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

  function renderMembers(items, cycleId, groupId, canManage) {
    const list = qs("#participants-list");
    list.innerHTML = "";

    if (!items.length) {
      const li = document.createElement("li");
      li.className = "list-empty";
      li.textContent = "No participants yet. Add cycle members before payments or payouts.";
      list.appendChild(li);
      return;
    }

    items.forEach((member) => {
      const li = document.createElement("li");
      li.className = "list-item";

      const left = document.createElement("div");
      left.className = "list-main";

      const title = document.createElement("div");
      title.className = "list-title";
      title.textContent = `User #${member.user_id}`;

      const meta = document.createElement("div");
      meta.className = "list-meta";
      meta.textContent = `Payout order #${member.payout_order} • added ${new Date(member.created_at).toLocaleString()}`;

      const badges = document.createElement("div");
      badges.style.marginTop = "8px";

      const payoutBadge = document.createElement("span");
      payoutBadge.className = "badge warn";
      payoutBadge.textContent = `order ${member.payout_order}`;
      badges.appendChild(payoutBadge);

      const receivedBadge = document.createElement("span");
      receivedBadge.className = `badge ${member.received ? "good" : ""}`;
      receivedBadge.textContent = member.received ? "received" : "pending";
      badges.appendChild(receivedBadge);

      left.appendChild(title);
      left.appendChild(meta);
      left.appendChild(badges);

      const actions = document.createElement("div");
      actions.className = "list-actions";

      const open = document.createElement("a");
      open.className = "btn btn-secondary";
      open.style.width = "auto";
      open.href = `cycle_member_detail.html?cycle_id=${cycleId}&group_id=${groupId}&member_id=${member.id}`;
      open.textContent = canManage ? "Manage" : "View";
      actions.appendChild(open);

      li.appendChild(left);
      li.appendChild(actions);
      list.appendChild(li);
    });
  }

  async function initCycleMembersPage() {
    if (!APP.requireAuthOrRedirect()) return;

    const cycleId = Number(qparam("cycle_id"));
    if (!cycleId) {
      setMessage("#page-error", "Missing cycle_id. Open this page like cycle_members.html?cycle_id=1");
      return;
    }

    const profile = await ensureProfile();
    if (!profile) return;

    const cycle = await CycleAPI.getCycle(cycleId);
    const group = await GroupAPI.getGroup(cycle.group_id);
    const role = await myRole(cycle.group_id, profile.id).catch(() => null);
    const canManage = Number(group.created_by) === Number(profile.id) || role === "admin";

    text(qs("#cycle-title"), `Cycle #${cycle.id}`);
    text(qs("#cycle-subtitle"), `${group.name} • payout order defines who gets paid first`);
    text(qs("#permissions-note"), canManage
      ? "Creator/admin can add participants, set payout order, and remove entries."
      : "Participants can view the payout order. Creator/admin manage the order.");

    qs("#open-cycle").addEventListener("click", () => APP.navigate(`cycle_detail.html?cycle_id=${cycle.id}&group_id=${cycle.group_id}`));
    qs("#open-group-members").addEventListener("click", () => APP.navigate(`group_members.html?group_id=${cycle.group_id}`));

    let page = 1;
    let orderFilter = "";
    let allGroupMembers = [];

    async function loadEligibleOptions() {
      try {
        allGroupMembers = await fetchAllGroupMembers(cycle.group_id);
        const participants = await fetchAllCycleMembers(cycle.id);
        const participantIds = new Set(participants.map((item) => Number(item.user_id)));
        const eligible = allGroupMembers.filter((item) => !participantIds.has(Number(item.user_id)));

        const select = qs("#user_id");
        select.innerHTML = "";
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = eligible.length ? "Select group member" : "No available group members";
        select.appendChild(placeholder);

        eligible.forEach((item) => {
          const option = document.createElement("option");
          option.value = String(item.user_id);
          option.textContent = `User #${item.user_id} (${item.role})`;
          select.appendChild(option);
        });

        text(qs("#eligibility-note"), eligible.length
          ? `${eligible.length} group members can still join this cycle.`
          : "All visible group members in this group are already participating in this cycle.");
      } catch (e) {
        text(qs("#eligibility-note"), e.message || "Could not load eligible group members.");
      }
    }

    async function load() {
      setMessage("#page-error", "");
      text(qs("#list-status"), "Loading…");
      try {
        const items = await CycleMemberAPI.listMembers({
          cycle_id: cycle.id,
          page,
          size: PAGE_SIZE,
          order: orderFilter || "",
        });
        renderMembers(items, cycle.id, cycle.group_id, canManage);
        text(qs("#page-label"), `Page ${page}`);
        qs("#prev").disabled = page <= 1;
        qs("#next").disabled = items.length < PAGE_SIZE;
        text(qs("#list-status"), "");
      } catch (e) {
        const msg = e.message || "Failed to load cycle members.";
        setMessage("#page-error", msg);
        text(qs("#list-status"), msg);
      }
    }

    qs("#refresh").addEventListener("click", async () => {
      await loadEligibleOptions();
      await load();
    });
    qs("#prev").addEventListener("click", () => { if (page > 1) { page -= 1; load(); } });
    qs("#next").addEventListener("click", () => { page += 1; load(); });
    qs("#order-filter").addEventListener("input", () => {
      orderFilter = qs("#order-filter").value.trim();
      page = 1;
      load();
    });

    show(qs("#open-add"), canManage);

    const overlay = qs("#modal-overlay");
    const modal = qs("#add-modal");

    function openModal() {
      setMessage("#form-error", "");
      overlay.hidden = false;
      modal.hidden = false;
      qs("#user_id").focus();
    }

    function closeModal() {
      overlay.hidden = true;
      modal.hidden = true;
      qs("#add-form").reset();
    }

    if (canManage) {
      qs("#open-add").addEventListener("click", openModal);
      qs("#cancel").addEventListener("click", closeModal);
      overlay.addEventListener("click", closeModal);

      qs("#add-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        setMessage("#form-error", "");

        const userId = Number(qs("#user_id").value);
        const payoutOrderRaw = qs("#payout_order").value.trim();
        if (!userId) {
          setMessage("#form-error", "Select a group member to add to this cycle.");
          return;
        }

        const payload = {
          cycle_id: cycle.id,
          user_id: userId,
        };
        if (payoutOrderRaw) payload.payout_order = Number(payoutOrderRaw);

        APP.setButtonLoading(qs("#add-submit"), true, "Adding…");
        try {
          await CycleMemberAPI.addMember(payload);
          APP.showToast("Cycle participant added", "success");
          closeModal();
          page = 1;
          await loadEligibleOptions();
          await load();
        } catch (err) {
          setMessage("#form-error", err.message || "Failed to add cycle participant.");
        } finally {
          APP.setButtonLoading(qs("#add-submit"), false);
        }
      });
    }

    await loadEligibleOptions();
    await load();
  }

  async function initCycleMemberDetailPage() {
    if (!APP.requireAuthOrRedirect()) return;

    const cycleId = Number(qparam("cycle_id"));
    const memberId = Number(qparam("member_id"));
    if (!cycleId || !memberId) {
      setMessage("#page-error", "Missing cycle_id or member_id.");
      return;
    }

    const profile = await ensureProfile();
    if (!profile) return;

    const cycle = await CycleAPI.getCycle(cycleId);
    const group = await GroupAPI.getGroup(cycle.group_id);
    const role = await myRole(cycle.group_id, profile.id).catch(() => null);
    const canManage = Number(group.created_by) === Number(profile.id) || role === "admin";

    qs("#back").addEventListener("click", () => APP.navigate(`cycle_members.html?cycle_id=${cycleId}&group_id=${cycle.group_id}`));
    qs("#open-payments").addEventListener("click", () => {
      APP.navigate(`payments.html?cycle_id=${cycle.id}&cycle_member_id=${memberId}`);
    });
    qs("#open-payouts").addEventListener("click", () => {
      APP.navigate(`payouts.html?cycle_id=${cycle.id}&cycle_member_id=${memberId}`);
    });

    let member;
    async function render() {
      member = await CycleMemberAPI.getMember(memberId);
      text(qs("#subtitle"), `Cycle #${cycle.id} • ${group.name}`);
      text(qs("#participant-title"), `User #${member.user_id}`);
      text(qs("#participant-note"), canManage
        ? "Creator/admin can change payout order or remove participation."
        : Number(member.user_id) === Number(profile.id)
          ? "You can review your participation record here."
          : "View only.");

      const grid = qs("#participant-grid");
      grid.innerHTML = "";
      [
        ["Cycle member ID", member.id],
        ["Cycle ID", member.cycle_id],
        ["User ID", member.user_id],
        ["Payout order", member.payout_order],
        ["Received", member.received ? "Yes" : "No"],
        ["Added", new Date(member.created_at).toLocaleString()],
      ].forEach(([k, v]) => {
        const dt = document.createElement("dt");
        dt.textContent = k;
        const dd = document.createElement("dd");
        dd.textContent = String(v);
        grid.appendChild(dt);
        grid.appendChild(dd);
      });

      qs("#payout_order").value = member.payout_order;
      qs("#received").checked = !!member.received;

      show(qs("#manage-order"), canManage);
      show(qs("#manage-received"), canManage || Number(member.user_id) === Number(profile.id));
    }

    if (canManage) {
      qs("#order-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        setMessage("#form-error", "");
        setMessage("#form-success", "");

        const payoutOrder = Number(qs("#payout_order").value);
        if (!payoutOrder) {
          setMessage("#form-error", "Payout order must be at least 1.");
          return;
        }

        APP.setButtonLoading(qs("#save-order"), true, "Saving…");
        try {
          await CycleMemberAPI.updateMember(member.id, { payout_order: payoutOrder });
          setMessage("#form-success", "Payout order updated.");
          APP.showToast("Payout order updated", "success");
          await render();
        } catch (err) {
          setMessage("#form-error", err.message || "Failed to update payout order.");
        } finally {
          APP.setButtonLoading(qs("#save-order"), false);
        }
      });

      qs("#remove").addEventListener("click", async () => {
        if (!window.confirm("Remove this participant from the cycle?")) return;
        APP.setButtonLoading(qs("#remove"), true, "Removing…");
        try {
          await CycleMemberAPI.deleteMember(member.id);
          APP.showToast("Participant removed", "success");
          APP.navigate(`cycle_members.html?cycle_id=${cycle.id}&group_id=${cycle.group_id}`);
        } catch (err) {
          APP.showToast(err.message || "Failed to remove participant.", "error");
        } finally {
          APP.setButtonLoading(qs("#remove"), false);
        }
      });
    }

    if (qs("#received-form")) {
      qs("#received-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        setMessage("#received-error", "");
        setMessage("#received-success", "");

        APP.setButtonLoading(qs("#save-received"), true, "Saving…");
        try {
          await CycleMemberAPI.updateMember(member.id, { received: !!qs("#received").checked });
          setMessage("#received-success", "Received status updated.");
          APP.showToast("Received status updated", "success");
          await render();
        } catch (err) {
          setMessage("#received-error", err.message || "Failed to update received status.");
        } finally {
          APP.setButtonLoading(qs("#save-received"), false);
        }
      });
    }

    await render();
  }

  document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page || "";
    if (page === "cycle_members") initCycleMembersPage();
    if (page === "cycle_member_detail") initCycleMemberDetailPage();
  });
})();
