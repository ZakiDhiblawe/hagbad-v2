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

  function capitalize(value) {
    if (!value) return "Member";
    return String(value).charAt(0).toUpperCase() + String(value).slice(1);
  }

  function resolveDisplayName(member, userId) {
    if (member && member.full_name) return member.full_name;
    return `Member #${userId}`;
  }

  function profileTone(member) {
    const role = String(member?.role || "").toLowerCase();
    if (role === "admin") return "admin";
    if (role === "moderator") return "moderator";
    return "member";
  }

  function buildMemberDirectory(groupMembers, ownerId) {
    const directory = new Map(
      (groupMembers || []).map((member) => [Number(member.user_id), member])
    );
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

  function createContextChip(label, tone = "") {
    const chip = document.createElement("span");
    chip.className = `member-context-chip ${tone}`.trim();
    chip.textContent = label;
    return chip;
  }

  function buildOrderState(members, groupMembers, ownerId) {
    const requiredMemberIds = new Set(
      [Number(ownerId), ...(groupMembers || []).map((item) => Number(item.user_id))]
        .filter((value) => Number.isFinite(value) && value > 0)
    );
    const orders = members
      .map((item) => Number(item.payout_order))
      .filter((value) => Number.isFinite(value) && value > 0)
      .sort((a, b) => a - b);

    const uniqueOrders = new Set(orders);
    const orderReady = members.length > 0
      && orders.length === members.length
      && uniqueOrders.size === orders.length
      && orders.every((value, index) => value === index + 1);

    return {
      participantsAdded: members.length,
      requiredCount: requiredMemberIds.size || members.length,
      participantsComplete: members.length >= (requiredMemberIds.size || members.length),
      orderReady,
    };
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

  function renderMembers(items, cycleId, groupId, canManage, memberDirectory, profileId) {
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
      const profileMember = memberDirectory.get(Number(member.user_id)) || null;
      const displayName = resolveDisplayName(profileMember, member.user_id);
      const tone = profileTone(profileMember);
      const li = document.createElement("li");
      li.className = "list-item";

      const left = document.createElement("div");
      left.className = "list-main";

      const profileWrap = document.createElement("div");
      profileWrap.className = "group-member-main";

      const avatarShell = document.createElement("div");
      avatarShell.className = `group-member-avatar-shell tone-${tone}`;

      const avatar = document.createElement("img");
      avatar.className = "group-member-avatar";
      avatar.alt = `${displayName} profile image`;
      avatar.src = APP.getProfileImageUrl(profileMember);
      avatar.onerror = () => {
        avatar.onerror = null;
        avatar.src = APP.getDefaultProfileImage();
      };
      avatarShell.appendChild(avatar);

      const copy = document.createElement("div");
      copy.className = "group-member-copy";

      const title = document.createElement("div");
      title.className = "list-title";
      title.textContent = displayName;

      const meta = document.createElement("div");
      meta.className = "list-meta";
      meta.textContent = `Cycle member #${member.id} • ${capitalize(profileMember?.role)} • added ${new Date(member.created_at).toLocaleString()}`;

      const badges = document.createElement("div");
      badges.className = "badge-row";
      badges.appendChild(createContextChip(`Order #${member.payout_order}`, "moderator"));
      badges.appendChild(createContextChip(member.received ? "Received" : "Waiting turn", member.received ? "admin" : "member"));
      if (Number(member.user_id) === Number(profileId)) {
        badges.appendChild(createContextChip("You", "admin"));
      }

      copy.appendChild(title);
      copy.appendChild(meta);
      copy.appendChild(badges);

      profileWrap.appendChild(avatarShell);
      profileWrap.appendChild(copy);

      left.appendChild(profileWrap);

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
    const canManage =
      Number(group.created_by) === Number(profile.id) || role === "admin" || role === "moderator";
    const canSetupCycle = canManage && cycle.status === "pending";
    applyGroupWorkspace(profile, group, role, "Cycle Order");

    text(qs("#cycle-title"), `Review payout order for cycle #${cycle.id}`);
    text(qs("#cycle-subtitle"), `${group.name} • confirm member names and who gets each payout turn first`);
    text(qs("#permissions-note"), canSetupCycle
      ? "Admins and moderators can add every group member, confirm the payout order using real member names, then finish this step before starting the cycle."
      : canManage
        ? "This cycle is no longer pending, so the payout order is locked for review only."
        : "Participants can view the payout order here. Admins and moderators manage the setup before the cycle starts.");

    qs("#open-cycle").addEventListener("click", () => APP.navigate(`cycle_detail.html?cycle_id=${cycle.id}&group_id=${cycle.group_id}`));
    qs("#open-group-members").addEventListener("click", () => APP.navigate(`group_members.html?group_id=${cycle.group_id}`));

    let page = 1;
    let orderFilter = "";
    let allGroupMembers = [];
    let memberDirectory = buildMemberDirectory([], group.created_by);

    const doneOrderBtn = qs("#done-order");
    show(doneOrderBtn, canSetupCycle);
    if (doneOrderBtn) {
      doneOrderBtn.addEventListener("click", async () => {
        try {
          const participants = await fetchAllCycleMembers(cycle.id);
          const orderState = buildOrderState(participants, allGroupMembers, group.created_by);
          if (!orderState.participantsAdded) {
            APP.showToast("Add members to this cycle before finishing the order step.", "info");
            return;
          }
          if (!orderState.participantsComplete) {
            APP.showToast("Add every group member before marking the order step done.", "info");
            return;
          }
          if (!orderState.orderReady) {
            APP.showToast("Make the payout order consecutive from 1 to the last member before marking done.", "info");
            return;
          }
          APP.navigate(`cycle_detail.html?cycle_id=${cycle.id}&group_id=${cycle.group_id}`);
        } catch (e) {
          APP.showToast(e.message || "Could not confirm the payout order yet.", "error");
        }
      });
    }

    async function loadEligibleOptions() {
      try {
        allGroupMembers = await fetchAllGroupMembers(cycle.group_id);
        memberDirectory = buildMemberDirectory(allGroupMembers, group.created_by);
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
          option.textContent = `${resolveDisplayName(item, item.user_id)} (${capitalize(item.role)})`;
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
        renderMembers(items, cycle.id, cycle.group_id, canManage, memberDirectory, profile.id);
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

    show(qs("#open-add"), canSetupCycle);
    show(qs("#fill-group"), canSetupCycle);

    const overlay = qs("#modal-overlay");
    const modal = qs("#add-modal");
    const fillGroupBtn = qs("#fill-group");
    const fillOrderMode = qs("#fill-order-mode");

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

    if (canSetupCycle) {
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

      if (fillGroupBtn) {
        fillGroupBtn.addEventListener("click", async () => {
          APP.setButtonLoading(fillGroupBtn, true, "Adding...");
          try {
            await CycleMemberAPI.fillMembers({
              cycle_id: cycle.id,
              order_mode: fillOrderMode ? fillOrderMode.value : "manual",
            });
            APP.showToast("Remaining group members added to the cycle", "success");
            page = 1;
            await loadEligibleOptions();
            await load();
          } catch (err) {
            APP.showToast(err.message || "Failed to add the remaining group members.", "error");
          } finally {
            APP.setButtonLoading(fillGroupBtn, false);
          }
        });
      }
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
    const canManage =
      Number(group.created_by) === Number(profile.id) || role === "admin" || role === "moderator";
    const canManageSetup = canManage && cycle.status === "pending";
    const memberDirectory = buildMemberDirectory(
      await fetchAllGroupMembers(cycle.group_id).catch(() => []),
      group.created_by
    );
    applyGroupWorkspace(profile, group, role, "Cycle Participant");

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
      const profileMember = memberDirectory.get(Number(member.user_id)) || null;
      const displayName = resolveDisplayName(profileMember, member.user_id);
      text(qs("#subtitle"), `Order #${member.payout_order} • Cycle #${cycle.id} • ${group.name}`);
      text(qs("#participant-title"), displayName);
      text(qs("#participant-note"), canManage
        ? (canManageSetup
          ? "Admins and moderators can change payout order or remove participation while the cycle is pending."
          : "This cycle is already active, paused, or completed, so the participant setup is locked. The received state is now set automatically when the payout is marked paid.")
        : Number(member.user_id) === Number(profile.id)
          ? "You can review your participation record here. Your payout receipt is confirmed automatically when your turn is paid."
          : "View only.");

      const grid = qs("#participant-grid");
      grid.innerHTML = "";
      [
        ["Member name", displayName],
        ["Group role", capitalize(profileMember?.role)],
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
      show(qs("#manage-order"), canManageSetup);
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

    await render();
  }

  document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page || "";
    if (page === "cycle_members") initCycleMembersPage();
    if (page === "cycle_member_detail") initCycleMemberDetailPage();
  });
})();
