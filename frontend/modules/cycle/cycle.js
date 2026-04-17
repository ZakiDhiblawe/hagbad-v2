(function () {
  function qs(sel) { return document.querySelector(sel); }
  function text(el, value) { if (el) el.textContent = value; }
  function show(el, yes) { if (el) el.hidden = !yes; }

  function qparam(name) {
    return new URL(window.location.href).searchParams.get(name);
  }

  function formatDate(value) {
    if (!value) return "-";
    return new Date(`${value}T00:00:00`).toLocaleDateString();
  }

  function frequencyLabel(cycle) {
    if (cycle.frequency === "custom_days" && cycle.custom_days) {
      return `custom (${cycle.custom_days} days)`;
    }
    return cycle.frequency;
  }

  function setMessage(id, message) {
    const el = qs(id);
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || "";
  }

  function mountWorkspaceMenu(profile) {
    const mount = qs("#workspace-user-menu");
    if (!mount || !profile) return;
    APP.mountUserMenu(mount, profile, { compact: false });
  }

  function applyGroupWorkspace(profile, group, role, activeKey, pageTitle) {
    if (!group) return;
    mountWorkspaceMenu(profile);
    APP.applyGroupWorkspaceNav({
      groupId: group.id,
      activeKey,
      pageTitle,
      canUpdateGroup: Number(group.created_by) === Number(profile.id),
      canCreateCycle:
        Number(group.created_by) === Number(profile.id) || role === "admin" || role === "moderator",
      canAccessAdministration:
        Number(group.created_by) === Number(profile.id) || role === "admin" || role === "moderator",
      showJoinRequests: group.privacy !== "public",
    });
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

  function syncCreateFields() {
    show(qs("#custom-days-wrap"), qs("#frequency")?.value === "custom_days");
  }

  function syncEditFields() {
    show(qs("#edit-custom-days-wrap"), qs("#edit-frequency")?.value === "custom_days");
  }

  function formatDateTime(value) {
    if (!value) return "-";
    return new Date(value).toLocaleString();
  }

  function formatMoney(value) {
    return value == null ? "-" : String(value);
  }

  function cycleStatusLabel(status) {
    if (status === "pending") return "Pending setup";
    if (status === "paused") return "Paused";
    if (status === "active") return "Active";
    return "Completed";
  }

  function cycleStatusCardTone(status) {
    if (status === "active") return "admin";
    if (status === "paused" || status === "pending") return "moderator";
    return "member";
  }

  function paymentNeedsApproval(payment) {
    return Number(payment.amount_paid || 0) > 0 && !payment.paid_at;
  }

  function paymentState(payment) {
    return paymentNeedsApproval(payment) ? "awaiting approval" : payment.status;
  }

  function makeSummaryCard({ tone = "member", label, value, description }) {
    const card = document.createElement("article");
    card.className = `members-summary-card ${tone}`;

    const labelNode = document.createElement("span");
    labelNode.textContent = label;

    const valueNode = document.createElement("strong");
    valueNode.textContent = value;

    const descriptionNode = document.createElement("p");
    descriptionNode.textContent = description;

    card.appendChild(labelNode);
    card.appendChild(valueNode);
    card.appendChild(descriptionNode);
    return card;
  }

  function renderSummaryCards(container, cards) {
    if (!container) return;
    container.innerHTML = "";
    cards.forEach((card) => container.appendChild(makeSummaryCard(card)));
  }

  function renderContextBadges(container, chips) {
    if (!container) return;
    container.innerHTML = "";
    chips.forEach((chip) => {
      const node = document.createElement("span");
      node.className = `member-context-chip ${chip.tone || ""}`.trim();
      node.textContent = chip.label;
      container.appendChild(node);
    });
  }

  function resolveDisplayName(member, userId) {
    if (member && member.full_name) return member.full_name;
    return `User #${userId}`;
  }

  function createActionNode(action) {
    const node = document.createElement(action.href ? "a" : "button");
    node.className = `member-action-btn ${action.tone || "secondary"}`;
    if (action.href) {
      node.href = action.href;
    } else {
      node.type = "button";
    }
    if (action.disabled) node.disabled = true;

    if (action.icon) {
      const icon = document.createElement("i");
      icon.className = action.icon;
      node.appendChild(icon);
    }

    const label = document.createElement("span");
    label.textContent = action.label;
    node.appendChild(label);

    if (typeof action.onClick === "function") {
      node.addEventListener("click", action.onClick);
    }

    return node;
  }

  function createMemberLikeCard({ tone = "member", profile = null, userId = 0, name, meta, badges = [], actions = [] }) {
    const card = document.createElement("div");
    card.className = `group-member-card tone-${tone}`;

    const main = document.createElement("div");
    main.className = "group-member-main";

    const avatarShell = document.createElement("div");
    avatarShell.className = `group-member-avatar-shell tone-${tone}`;

    const avatar = document.createElement("img");
    avatar.className = "group-member-avatar";
    avatar.alt = `${name} profile image`;
    avatar.src = APP.getProfileImageUrl(profile);
    avatarShell.appendChild(avatar);

    const copy = document.createElement("div");
    copy.className = "group-member-copy";

    const heading = document.createElement("div");
    heading.className = "group-member-heading";

    const title = document.createElement("h4");
    title.className = "group-member-name";
    title.textContent = name;
    heading.appendChild(title);

    const chips = document.createElement("div");
    chips.className = "group-context-badges";
    badges.forEach((badge) => {
      const chip = document.createElement("span");
      chip.className = `member-context-chip ${badge.tone || ""}`.trim();
      chip.textContent = badge.label;
      chips.appendChild(chip);
    });

    const metaNode = document.createElement("p");
    metaNode.className = "group-member-meta";
    metaNode.textContent = meta || `User #${userId}`;

    copy.appendChild(heading);
    if (badges.length) copy.appendChild(chips);
    copy.appendChild(metaNode);

    main.appendChild(avatarShell);
    main.appendChild(copy);
    card.appendChild(main);

    const actionsWrap = document.createElement("div");
    actionsWrap.className = "group-member-actions";
    actions.forEach((action) => actionsWrap.appendChild(createActionNode(action)));
    if (actions.length) card.appendChild(actionsWrap);

    return card;
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

  async function fetchAllPayments(cycleId, extra = {}) {
    const all = [];
    for (let page = 1; page <= 20; page++) {
      const items = await PaymentAPI.listPayments({ cycle_id: cycleId, page, size: 100, ...extra });
      all.push(...items);
      if (items.length < 100) break;
    }
    return all;
  }

  async function fetchAllPayouts(cycleId) {
    const all = [];
    for (let page = 1; page <= 20; page++) {
      const items = await PayoutAPI.listPayouts({ cycle_id: cycleId, page, size: 100 });
      all.push(...items);
      if (items.length < 100) break;
    }
    return all;
  }

  function frequencyDaysFromCycle(cycle, settings) {
    if (cycle.frequency === "daily") return 1;
    if (cycle.frequency === "weekly") return 7;
    if (cycle.frequency === "monthly") return 30;
    const customDays = Number(cycle.custom_days || settings?.custom_days || 0);
    return customDays || 1;
  }

  function addDays(dateValue, days) {
    const [year, month, day] = String(dateValue).split("-").map(Number);
    const utcDate = new Date(Date.UTC(year, month - 1, day));
    utcDate.setUTCDate(utcDate.getUTCDate() + days);
    return utcDate.toISOString().slice(0, 10);
  }

  function computeRoundDate(cycle, settings, zeroIndex) {
    return addDays(cycle.start_date, frequencyDaysFromCycle(cycle, settings) * zeroIndex);
  }

  function pickCurrentCycle(items) {
    const openCycles = items.filter((cycle) => cycle.status !== "completed");
    if (!openCycles.length) return null;

    const rank = { active: 0, pending: 1, paused: 2 };
    return openCycles
      .sort((a, b) => {
        const rankDelta = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
        if (rankDelta !== 0) return rankDelta;
        return new Date(b.created_at) - new Date(a.created_at);
      })[0];
  }

  function buildSetupState(group, groupMembers, cycleMembers) {
    const requiredIds = new Set([Number(group.created_by)]);
    groupMembers.forEach((member) => requiredIds.add(Number(member.user_id)));

    const payoutOrders = cycleMembers.map((member) => Number(member.payout_order)).sort((a, b) => a - b);
    const contiguousOrders = payoutOrders.every((order, index) => order === index + 1);
    const uniqueOrders = payoutOrders.length === new Set(payoutOrders).size;

    return {
      requiredCount: requiredIds.size,
      participantsAdded: cycleMembers.length,
      participantsComplete: cycleMembers.length === requiredIds.size && requiredIds.size > 0,
      orderReady: cycleMembers.length > 0 && uniqueOrders && contiguousOrders,
      readyToStart: cycleMembers.length === requiredIds.size && requiredIds.size > 0 && uniqueOrders && contiguousOrders,
    };
  }

  function renderHistoryList(container, items) {
    if (!container) return;
    container.innerHTML = "";

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "member-empty-state";
      empty.textContent = "Completed cycles will appear here once this group has any past cycle history.";
      container.appendChild(empty);
      return;
    }

    items.forEach((cycle) => {
      const card = document.createElement("div");
      card.className = "cycle-history-item";

      const main = document.createElement("div");
      main.className = "cycle-history-main";

      const title = document.createElement("h4");
      title.textContent = `Cycle #${cycle.id}`;

      const meta = document.createElement("p");
      meta.textContent = `${frequencyLabel(cycle)} • starts ${formatDate(cycle.start_date)} • ends ${formatDate(cycle.end_date)} • created ${formatDateTime(cycle.created_at)}`;

      const badges = document.createElement("div");
      badges.className = "group-context-badges";

      const statusChip = document.createElement("span");
      statusChip.className = `member-context-chip ${cycle.status === "completed" ? "closed" : "moderator"}`;
      statusChip.textContent = cycleStatusLabel(cycle.status);
      badges.appendChild(statusChip);

      main.appendChild(title);
      main.appendChild(meta);
      main.appendChild(badges);

      const actions = document.createElement("div");
      actions.className = "group-member-actions";
      actions.appendChild(createActionNode({
        href: `cycle_detail.html?cycle_id=${cycle.id}&group_id=${cycle.group_id}`,
        label: "Open detail",
        tone: "secondary",
        icon: "ti ti-arrow-up-right",
      }));

      card.appendChild(main);
      card.appendChild(actions);
      container.appendChild(card);
    });
  }

  async function initCyclesPage() {
    if (!APP.requireAuthOrRedirect()) return;

    const groupId = Number(qparam("group_id"));
    const openMode = qparam("open");
    if (!groupId) {
      setMessage("#page-error", "Missing group_id. Open this page like cycles.html?group_id=1");
      return;
    }

    const profile = await ensureProfile();
    if (!profile) return;

    const group = await GroupAPI.getGroup(groupId);
    const role = await myRole(groupId, profile.id).catch(() => null);
    const canManage =
      Number(group.created_by) === Number(profile.id) || role === "admin" || role === "moderator";
    const openCreateFromMenu = openMode === "create";

    show(qs("#open-create"), canManage);
    show(qs("#empty-create"), canManage);

    applyGroupWorkspace(
      profile,
      group,
      role,
      openCreateFromMenu ? "add_cycle" : "cycles",
      openCreateFromMenu ? "Add New Cycle" : "My Cycles"
    );

    text(qs("#group-name"), group.name);
    text(qs("#group-note"), canManage
      ? "This page keeps one current cycle in focus: create it, finish the setup, then manage the active round here."
      : "This page shows the current cycle, your next payment date, and the state of the active round.");

    let settings = null;
    try {
      settings = await GroupSettingsAPI.get(groupId);
      text(
        qs("#settings-hint"),
        `Contribution ${settings.contribution_amount} • default rule ${settings.frequency}${settings.custom_days ? ` (${settings.custom_days} days)` : ""} • configure payment rules before you start the cycle`
      );
    } catch {
      text(qs("#settings-hint"), "Group rules are not configured yet. Add contribution settings before you start the next cycle.");
    }

    const overlay = qs("#modal-overlay");
    const modal = qs("#create-modal");
    const currentState = {
      cycle: null,
      setup: null,
      groupMembers: [],
      cycleMembers: [],
      settings,
      currentRoundDue: null,
    };

    function openMembersForCurrentCycle() {
      if (!currentState.cycle) return;
      APP.navigate(`cycle_members.html?cycle_id=${currentState.cycle.id}&group_id=${groupId}`);
    }

    function openPaymentsForCurrentCycle() {
      if (!currentState.cycle) return;
      APP.navigate(`payments.html?cycle_id=${currentState.cycle.id}`);
    }

    function openPayoutsForCurrentCycle() {
      if (!currentState.cycle) return;
      APP.navigate(`payouts.html?cycle_id=${currentState.cycle.id}`);
    }

    function openRulesPage() {
      APP.navigate(`group_settings.html?group_id=${groupId}`);
    }

    function openGroupDashboard() {
      APP.navigate(`group_detail.html?id=${groupId}`);
    }

    function openModal() {
      if (!canManage) {
        APP.showToast("Only a group admin or moderator can create a cycle.", "error");
        return;
      }

      setMessage("#form-error", "");
      overlay.hidden = false;
      modal.hidden = false;
      qs("#start_date").value = new Date().toISOString().slice(0, 10);
      if (settings) {
        qs("#frequency").value = settings.frequency;
        qs("#custom_days").value = settings.custom_days || "";
      }
      syncCreateFields();
      qs("#start_date").focus();
    }

    function closeModal() {
      overlay.hidden = true;
      modal.hidden = true;
      qs("#create-form").reset();
      syncCreateFields();
    }

    function renderEmptyState(historyCount) {
      show(qs("#cycle-empty-panel"), true);
      show(qs("#pending-cycle-panel"), false);
      show(qs("#active-cycle-panel"), false);

      show(qs("#open-create"), canManage);
      show(qs("#empty-create"), canManage);
      text(qs("#empty-copy"), canManage
        ? "No cycle is open right now. Create one when the group is ready, then add members and review the setup before starting."
        : "There is no pending or active cycle in this group right now. An admin or moderator will open the next cycle.");
      text(qs("#empty-note"), historyCount
        ? "This group has cycle history below, but there is no current cycle open right now."
        : "This group has not started its first cycle yet.");
    }

    function renderPendingPanel(memberDirectory) {
      const cycle = currentState.cycle;
      const setup = currentState.setup;
      const cycleMembers = [...currentState.cycleMembers].sort((a, b) => a.payout_order - b.payout_order);
      const contribution = settings ? formatMoney(settings.contribution_amount) : "Missing";
      const expectedRoundPayout = settings
        ? formatMoney((Number(settings.contribution_amount) * setup.requiredCount).toFixed(2))
        : "Missing";

      show(qs("#cycle-empty-panel"), false);
      show(qs("#pending-cycle-panel"), true);
      show(qs("#active-cycle-panel"), false);
      show(qs("#open-create"), false);

      text(qs("#pending-title"), `Cycle #${cycle.id} is pending setup`);
      text(qs("#pending-copy"), setup.readyToStart
        ? "The member list and payout order look ready. Start the cycle when you want the first round to open."
        : "Finish the setup before the first round can open. Every group member must be added and the payout order must be complete.");
      text(qs("#pending-order-count"), `${setup.participantsAdded} / ${setup.requiredCount} participants`);

      renderSummaryCards(qs("#pending-setup-grid"), [
        {
          tone: "total",
          label: "Participants",
          value: `${setup.participantsAdded} / ${setup.requiredCount}`,
          description: setup.participantsComplete
            ? "Every visible group member is already in this pending cycle."
            : "Add every group member before you start the cycle.",
        },
        {
          tone: setup.orderReady ? "moderator" : "admin",
          label: "Payout order",
          value: setup.orderReady ? "Ready" : "Needs review",
          description: setup.orderReady
            ? "Orders are unique and consecutive from first turn to last."
            : "Review the participant order before you start the cycle.",
        },
        {
          tone: settings ? "member" : "admin",
          label: "Contribution",
          value: contribution,
          description: settings
            ? `Collected each ${settings.frequency}${settings.custom_days ? ` (${settings.custom_days} days)` : ""} from group settings.`
            : "Group payment rules are missing. Open settings before you start.",
        },
        {
          tone: settings ? "member" : "admin",
          label: "Expected payout",
          value: expectedRoundPayout,
          description: settings
            ? "This is the payout pool for each round when all members are included."
            : "Payout amount will be ready after contribution rules are configured.",
        },
      ]);

      const orderList = qs("#pending-order-list");
      orderList.innerHTML = "";
      if (!cycleMembers.length) {
        const empty = document.createElement("div");
        empty.className = "member-empty-state";
        empty.textContent = "No cycle members have been added yet. Start with the member setup screen.";
        orderList.appendChild(empty);
      } else {
        cycleMembers.forEach((member) => {
          const profileMember = memberDirectory.get(Number(member.user_id)) || { profile_image: null, full_name: null };
          orderList.appendChild(createMemberLikeCard({
            tone: "member",
            profile: profileMember,
            userId: member.user_id,
            name: resolveDisplayName(profileMember, member.user_id),
            meta: `Cycle member #${member.id} • joined the cycle ${formatDateTime(member.created_at)}`,
            badges: [
              { label: `Order #${member.payout_order}`, tone: "moderator" },
              { label: member.received ? "Received" : "Awaiting turn", tone: member.received ? "admin" : "member" },
            ],
            actions: [
              {
                href: `cycle_member_detail.html?cycle_id=${cycle.id}&group_id=${groupId}&member_id=${member.id}`,
                label: "Open",
                tone: "secondary",
                icon: "ti ti-arrow-up-right",
              },
            ],
          }));
        });
      }

      show(qs("#pending-open-members"), canManage);
      show(qs("#pending-open-order"), canManage);
      show(qs("#pending-open-rules"), canManage);
      show(qs("#pending-start"), canManage);
      qs("#pending-start").disabled = !(canManage && settings && setup.readyToStart);
    }

    function renderCurrentPayoutCard(payout, dueDate, cycleMemberById, memberDirectory) {
      const payoutWrap = qs("#current-payout-card");
      payoutWrap.innerHTML = "";
      if (!payout) {
        const empty = document.createElement("div");
        empty.className = "member-empty-state";
        empty.textContent = "No open payout turn remains for this cycle right now.";
        payoutWrap.appendChild(empty);
        return;
      }

      const cycleMember = cycleMemberById.get(Number(payout.cycle_member_id));
      const profileMember = cycleMember ? memberDirectory.get(Number(cycleMember.user_id)) : null;
      const actions = [
        {
          href: `payout_detail.html?payout_id=${payout.id}&cycle_id=${payout.cycle_id}&cycle_member_id=${payout.cycle_member_id}`,
          label: "Open",
          tone: "secondary",
          icon: "ti ti-arrow-up-right",
        },
      ];

      if (payout.status === "pending") {
        actions.unshift({
          label: "Approve",
          tone: "primary",
          icon: "ti ti-check",
          onClick: async (event) => {
            APP.setButtonLoading(event.currentTarget, true, "Approving…");
            try {
              await PayoutAPI.approvePayout(payout.id, {});
              APP.showToast("Payout approved", "success");
              await window.__cycleReload();
            } catch (e) {
              APP.showToast(e.message || "Failed to approve payout.", "error");
            } finally {
              APP.setButtonLoading(event.currentTarget, false);
            }
          },
        });
      }

      if (payout.status === "approved") {
        actions.unshift({
          label: "Mark paid",
          tone: "primary",
          icon: "ti ti-cash",
          onClick: async (event) => {
            APP.setButtonLoading(event.currentTarget, true, "Paying…");
            try {
              await PayoutAPI.markPaid(payout.id, {});
              APP.showToast("Payout marked paid", "success");
              await window.__cycleReload();
            } catch (e) {
              APP.showToast(e.message || "Failed to mark payout as paid.", "error");
            } finally {
              APP.setButtonLoading(event.currentTarget, false);
            }
          },
        });
      }

      payoutWrap.appendChild(createMemberLikeCard({
        tone: "moderator",
        profile: profileMember,
        userId: cycleMember ? cycleMember.user_id : 0,
        name: resolveDisplayName(profileMember, cycleMember ? cycleMember.user_id : 0),
        meta: `Turn due ${formatDate(dueDate)} • payout ${formatMoney(payout.amount)} • created ${formatDateTime(payout.created_at)}`,
        badges: [
          { label: cycleMember ? `Order #${cycleMember.payout_order}` : "Current turn", tone: "moderator" },
          { label: payout.status, tone: payout.status === "paid" ? "admin" : payout.status === "approved" ? "moderator" : payout.status === "rejected" ? "private" : "member" },
        ],
        actions,
      }));
    }

    function renderCurrentPaymentsList({ cycle, payments, cycleMemberById, memberDirectory, canManageCurrent, myUserId }) {
      const list = qs("#current-payments-list");
      list.innerHTML = "";

      if (!payments.length) {
        const empty = document.createElement("div");
        empty.className = "member-empty-state";
        empty.textContent = canManageCurrent
          ? "No payment records are open for the current round right now."
          : "Your next payment record will appear here when the round is ready.";
        list.appendChild(empty);
        return;
      }

      payments.forEach((payment) => {
        const cycleMember = cycleMemberById.get(Number(payment.cycle_member_id));
        const userId = cycleMember ? Number(cycleMember.user_id) : 0;
        const profileMember = memberDirectory.get(userId) || null;
        const state = paymentState(payment);
        const ownPayment = Number(userId) === Number(myUserId);
        const actions = [
          {
            href: `payment_detail.html?payment_id=${payment.id}&cycle_id=${cycle.id}&cycle_member_id=${payment.cycle_member_id}`,
            label: canManageCurrent ? "Manage" : "Open",
            tone: "secondary",
            icon: "ti ti-arrow-up-right",
          },
        ];

        if (ownPayment && state !== "awaiting approval" && payment.status !== "paid") {
          actions.unshift({
            label: "I paid",
            tone: "primary",
            icon: "ti ti-check",
            onClick: async (event) => {
              APP.setButtonLoading(event.currentTarget, true, "Submitting…");
              try {
                await PaymentAPI.submitPayment(payment.id, {});
                APP.showToast("Payment submitted for approval", "success");
                await window.__cycleReload();
              } catch (e) {
                APP.showToast(e.message || "Failed to submit payment.", "error");
              } finally {
                APP.setButtonLoading(event.currentTarget, false);
              }
            },
          });
        }

        if (canManageCurrent && paymentNeedsApproval(payment)) {
          actions.unshift({
            label: "Approve",
            tone: "primary",
            icon: "ti ti-checks",
            onClick: async (event) => {
              APP.setButtonLoading(event.currentTarget, true, "Approving…");
              try {
                await PaymentAPI.approvePayment(payment.id, {});
                APP.showToast("Payment approved", "success");
                await window.__cycleReload();
              } catch (e) {
                APP.showToast(e.message || "Failed to approve payment.", "error");
              } finally {
                APP.setButtonLoading(event.currentTarget, false);
              }
            },
          });
        }

        list.appendChild(createMemberLikeCard({
          tone: ownPayment ? "moderator" : "member",
          profile: profileMember,
          userId,
          name: ownPayment ? `${resolveDisplayName(profileMember, userId)}${canManageCurrent ? " (You)" : ""}` : resolveDisplayName(profileMember, userId),
          meta: `Due ${formatDate(payment.due_date)} • paid ${formatMoney(payment.amount_paid)} / ${formatMoney(payment.amount_due)} • payment #${payment.id}`,
          badges: [
            { label: state, tone: payment.status === "paid" ? "admin" : paymentNeedsApproval(payment) ? "moderator" : payment.status === "late" ? "private" : "member" },
          ],
          actions,
        }));
      });
    }

    async function renderActivePanel(memberDirectory) {
      const cycle = currentState.cycle;
      const cycleMembers = [...currentState.cycleMembers].sort((a, b) => a.payout_order - b.payout_order);
      const cycleMemberById = new Map(cycleMembers.map((member) => [Number(member.id), member]));
      const myCycleMember = cycleMembers.find((member) => Number(member.user_id) === Number(profile.id)) || null;

      show(qs("#cycle-empty-panel"), false);
      show(qs("#pending-cycle-panel"), false);
      show(qs("#active-cycle-panel"), true);
      show(qs("#open-create"), false);

      text(qs("#active-title"), cycle.status === "paused" ? `Cycle #${cycle.id} is paused` : `Cycle #${cycle.id} is active`);
      text(qs("#active-copy"), cycle.status === "paused"
        ? "This cycle is paused. Resume it when you are ready to reopen the current round."
        : "The current round stays open until all payments are approved and the turn payout is marked paid.");
      show(qs("#active-resume"), canManage && cycle.status === "paused");

      let allPayments = [];
      let currentPayout = null;
      let currentRoundDue = null;
      let currentRoundPayments = [];

      if (canManage) {
        const payouts = await fetchAllPayouts(cycle.id);
        const payoutOrderByMemberId = new Map(cycleMembers.map((member, index) => [Number(member.id), index]));
        currentPayout = payouts
          .sort((a, b) => (payoutOrderByMemberId.get(Number(a.cycle_member_id)) ?? 999) - (payoutOrderByMemberId.get(Number(b.cycle_member_id)) ?? 999))
          .find((payout) => payout.status !== "paid") || null;

        if (currentPayout) {
          currentRoundDue = computeRoundDate(
            cycle,
            settings,
            payoutOrderByMemberId.get(Number(currentPayout.cycle_member_id)) ?? 0
          );
        }

        allPayments = await fetchAllPayments(cycle.id);
        currentRoundPayments = currentRoundDue
          ? allPayments.filter((payment) => payment.due_date === currentRoundDue)
          : [];
      } else {
        allPayments = await fetchAllPayments(cycle.id);
        const remainingPayments = allPayments
          .filter((payment) => paymentState(payment) !== "paid")
          .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
        currentRoundDue = remainingPayments[0]?.due_date || null;
        currentRoundPayments = remainingPayments.length ? [remainingPayments[0]] : [];
      }

      currentState.currentRoundDue = currentRoundDue;

      const myPayments = myCycleMember
        ? allPayments
          .filter((payment) => Number(payment.cycle_member_id) === Number(myCycleMember.id))
          .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))
        : [];
      const nextPayment = myPayments.find((payment) => paymentState(payment) !== "paid") || null;
      const approvedCount = currentRoundPayments.filter((payment) => paymentState(payment) === "paid").length;

      renderSummaryCards(qs("#active-round-grid"), [
        {
          tone: cycle.status === "paused" ? "moderator" : "admin",
          label: "Cycle status",
          value: cycleStatusLabel(cycle.status),
          description: cycle.status === "paused"
            ? "Resume the cycle to reopen the current round."
            : "Only one cycle can stay open in this group at a time.",
        },
        {
          tone: nextPayment ? "member" : "total",
          label: "Next payment for you",
          value: nextPayment ? formatDate(nextPayment.due_date) : "All clear",
          description: nextPayment
            ? `${paymentState(nextPayment)} • amount ${formatMoney(nextPayment.amount_due)}`
            : "You do not have another unpaid round queued right now.",
        },
        {
          tone: currentRoundDue ? "moderator" : "member",
          label: "Current round due",
          value: currentRoundDue ? formatDate(currentRoundDue) : "Waiting",
          description: currentRoundDue
            ? "The current round stays open until payment approvals and payout completion are done."
            : "No open round is waiting right now.",
        },
        {
          tone: currentRoundPayments.length && approvedCount === currentRoundPayments.length ? "admin" : "member",
          label: "Round approvals",
          value: currentRoundPayments.length ? `${approvedCount} / ${currentRoundPayments.length}` : "0 / 0",
          description: currentRoundPayments.length
            ? "Approved payments for the current round."
            : "Payment records for the open round will appear here.",
        },
      ]);

      if (canManage) {
        show(qs("#current-payout-panel"), !!currentPayout);
        text(qs("#current-payout-state"), currentPayout ? currentPayout.status : "No open payout");
        text(qs("#current-payout-copy"), currentPayout
          ? "Approve the payout after every current-round payment is approved, then mark it paid when the funds are given."
          : "Every payout record in this cycle has already been marked paid.");
        if (currentPayout) {
          renderCurrentPayoutCard(currentPayout, currentRoundDue, cycleMemberById, memberDirectory);
        }
      } else {
        show(qs("#current-payout-panel"), false);
      }

      text(qs("#current-payments-title"), canManage ? "Current round payments" : "Your next payment");
      text(qs("#current-payments-copy"), canManage
        ? "Members can submit the current round here, and admins or moderators approve each payment."
        : "Submit this payment when it is due. A manager will approve it after confirming the contribution.");
      text(qs("#current-payments-count"), `${currentRoundPayments.length} payment${currentRoundPayments.length === 1 ? "" : "s"}`);
      renderCurrentPaymentsList({
        cycle,
        payments: currentRoundPayments,
        cycleMemberById,
        memberDirectory,
        canManageCurrent: canManage,
        myUserId: profile.id,
      });
    }

    async function load() {
      setMessage("#page-error", "");
      text(qs("#list-status"), "Loading…");
      try {
        const items = await CycleAPI.listForGroup(groupId, { page: 1, size: 100 });
        const groupMembers = await fetchAllGroupMembers(groupId).catch(() => []);
        const currentCycle = pickCurrentCycle(items);
        const historyCycles = items
          .filter((cycle) => !currentCycle || Number(cycle.id) !== Number(currentCycle.id))
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        currentState.cycle = currentCycle;
        currentState.groupMembers = groupMembers;
        currentState.cycleMembers = currentCycle ? await fetchAllCycleMembers(currentCycle.id).catch(() => []) : [];
        currentState.setup = currentCycle ? buildSetupState(group, groupMembers, currentState.cycleMembers) : null;

        const memberDirectory = new Map(
          groupMembers.map((member) => [Number(member.user_id), member])
        );
        if (!memberDirectory.has(Number(group.created_by))) {
          memberDirectory.set(Number(group.created_by), {
            user_id: Number(group.created_by),
            role: "admin",
            full_name: null,
            profile_image: null,
          });
        }

        renderContextBadges(qs("#cycle-badges"), [
          { label: `${role || "member"} role`, tone: role || "member" },
          { label: `${group.privacy} group`, tone: group.privacy === "private" ? "private" : "member" },
          { label: currentCycle ? cycleStatusLabel(currentCycle.status) : "No current cycle", tone: currentCycle ? cycleStatusCardTone(currentCycle.status) : "member" },
        ]);

        if (!currentCycle) {
          text(qs("#group-subtitle"), "This group has no current cycle open. Create the next one when the group is ready.");
          text(qs("#group-note"), canManage
            ? "Create the next cycle when you are ready, then add members and start it later after the setup is complete."
            : "There is no pending or active cycle right now. Watch this page for the next cycle window.");
          renderSummaryCards(qs("#cycle-summary-grid"), [
            {
              tone: "total",
              label: "Current cycle",
              value: "None",
              description: "There is no pending, paused, or active cycle at the moment.",
            },
            {
              tone: settings ? "member" : "admin",
              label: "Contribution rule",
              value: settings ? formatMoney(settings.contribution_amount) : "Missing",
              description: settings ? "Current contribution amount from group settings." : "Create the group payment rules before starting the next cycle.",
            },
            {
              tone: "member",
              label: "Group members",
              value: String(new Set([Number(group.created_by), ...groupMembers.map((member) => Number(member.user_id))]).size),
              description: "These members will need to be added to the next cycle before it can start.",
            },
            {
              tone: historyCycles.length ? "moderator" : "member",
              label: "History",
              value: `${historyCycles.length}`,
              description: historyCycles.length ? "Older cycles are listed below." : "No cycle history yet.",
            },
          ]);
          renderEmptyState(historyCycles.length);
        } else if (currentCycle.status === "pending") {
          text(qs("#group-subtitle"), `Pending setup for cycle #${currentCycle.id}`);
          text(qs("#group-note"), canManage
            ? "Finish the member list, confirm the payout order, and check the contribution rules before you start the cycle."
            : "This cycle is being prepared. You will see the active round here after an admin or moderator starts it.");
          renderSummaryCards(qs("#cycle-summary-grid"), [
            {
              tone: cycleStatusCardTone(currentCycle.status),
              label: "Current cycle",
              value: cycleStatusLabel(currentCycle.status),
              description: `Cycle #${currentCycle.id} starts on ${formatDate(currentCycle.start_date)}.`,
            },
            {
              tone: currentState.setup.participantsComplete ? "moderator" : "admin",
              label: "Members added",
              value: `${currentState.setup.participantsAdded} / ${currentState.setup.requiredCount}`,
              description: currentState.setup.participantsComplete ? "All required members are already included." : "The cycle cannot start until everyone is added.",
            },
            {
              tone: currentState.setup.orderReady ? "moderator" : "admin",
              label: "Order state",
              value: currentState.setup.orderReady ? "Ready" : "Review needed",
              description: currentState.setup.orderReady ? "The payout order is consecutive and ready." : "Review the payout order before you start.",
            },
            {
              tone: settings ? "member" : "admin",
              label: "Contribution rule",
              value: settings ? formatMoney(settings.contribution_amount) : "Missing",
              description: settings ? "Payment amount used when the round records are generated." : "Configure the group rules before starting this cycle.",
            },
          ]);
          renderPendingPanel(memberDirectory);
        } else {
          text(qs("#group-subtitle"), `${cycleStatusLabel(currentCycle.status)} cycle #${currentCycle.id}`);
          text(qs("#group-note"), currentCycle.status === "paused"
            ? "This cycle is paused. Resume it when you want to reopen the current round."
            : "This page shows the next payment date, the current round records, and the payout turn that closes the round.");
          await renderActivePanel(memberDirectory);
        }

        show(qs("#cycle-history-panel"), historyCycles.length > 0);
        text(qs("#history-count"), `${historyCycles.length} cycle${historyCycles.length === 1 ? "" : "s"}`);
        renderHistoryList(qs("#cycle-history-list"), historyCycles);
        text(qs("#list-status"), "");
      } catch (e) {
        const msg = e.message || "Failed to load cycles.";
        setMessage("#page-error", msg);
        text(qs("#list-status"), msg);
        show(qs("#open-create"), canManage);
        if (openCreateFromMenu && canManage) {
          window.requestAnimationFrame(openModal);
        }
      }
    }

    window.__cycleReload = load;

    qs("#refresh").addEventListener("click", () => load());
    qs("#open-create").addEventListener("click", openModal);
    qs("#empty-create").addEventListener("click", openModal);
    qs("#empty-open-group").addEventListener("click", openGroupDashboard);
    qs("#empty-open-settings").addEventListener("click", openRulesPage);
    qs("#pending-open-members").addEventListener("click", openMembersForCurrentCycle);
    qs("#pending-open-order").addEventListener("click", openMembersForCurrentCycle);
    qs("#pending-open-rules").addEventListener("click", openRulesPage);
    qs("#active-open-members").addEventListener("click", openMembersForCurrentCycle);
    qs("#active-open-payments").addEventListener("click", openPaymentsForCurrentCycle);
    qs("#active-open-payouts").addEventListener("click", openPayoutsForCurrentCycle);
    qs("#active-resume").addEventListener("click", async () => {
      if (!currentState.cycle) return;
      APP.setButtonLoading(qs("#active-resume"), true, "Resuming…");
      try {
        await CycleAPI.startCycle(currentState.cycle.id);
        APP.showToast("Cycle resumed", "success");
        await load();
      } catch (e) {
        APP.showToast(e.message || "Failed to resume cycle.", "error");
      } finally {
        APP.setButtonLoading(qs("#active-resume"), false);
      }
    });
    qs("#pending-start").addEventListener("click", async () => {
      if (!currentState.cycle) return;
      APP.setButtonLoading(qs("#pending-start"), true, "Starting…");
      try {
        await CycleAPI.startCycle(currentState.cycle.id);
        APP.showToast("Cycle started", "success");
        await load();
      } catch (e) {
        APP.showToast(e.message || "Failed to start cycle.", "error");
      } finally {
        APP.setButtonLoading(qs("#pending-start"), false);
      }
    });

    qs("#cancel").addEventListener("click", closeModal);
    overlay.addEventListener("click", closeModal);
    qs("#frequency").addEventListener("change", syncCreateFields);

    qs("#create-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      setMessage("#form-error", "");

      const payload = {
        group_id: groupId,
        start_date: qs("#start_date").value,
        frequency: qs("#frequency").value,
        auto_start: false,
      };

      if (!payload.start_date) {
        setMessage("#form-error", "Start date is required.");
        return;
      }

      if (payload.frequency === "custom_days") {
        const customDays = Number(qs("#custom_days").value);
        if (!customDays) {
          setMessage("#form-error", "Custom days is required for custom frequency.");
          return;
        }
        payload.custom_days = customDays;
      }

      APP.setButtonLoading(qs("#create-submit"), true, "Creating…");
      try {
        await CycleAPI.createCycle(payload);
        APP.showToast("Cycle created", "success");
        closeModal();
        await load();
      } catch (err) {
        setMessage("#form-error", err.message || "Failed to create cycle.");
      } finally {
        APP.setButtonLoading(qs("#create-submit"), false);
      }
    });

    await load();

    if (openCreateFromMenu) {
      if (canManage && !currentState.cycle) {
        window.requestAnimationFrame(openModal);
      } else if (!canManage) {
        APP.showToast("Only a group admin or moderator can add a cycle.", "error");
      } else {
        APP.showToast("A current cycle is already open for this group.", "info");
      }
    }
  }

  async function initCycleDetailPage() {
    if (!APP.requireAuthOrRedirect()) return;

    const cycleId = Number(qparam("cycle_id"));
    if (!cycleId) {
      setMessage("#page-error", "Missing cycle_id.");
      return;
    }

    const profile = await ensureProfile();
    if (!profile) return;

    let cycle = await CycleAPI.getCycle(cycleId);
    const group = await GroupAPI.getGroup(cycle.group_id);
    const role = await myRole(cycle.group_id, profile.id).catch(() => null);
    const canManage =
      Number(group.created_by) === Number(profile.id) || role === "admin" || role === "moderator";

    applyGroupWorkspace(profile, group, role, "cycles", "Cycle Detail");

    qs("#back").addEventListener("click", () => APP.navigate(`cycles.html?group_id=${cycle.group_id}`));
    qs("#open-participants").addEventListener("click", () => {
      APP.navigate(`cycle_members.html?cycle_id=${cycle.id}&group_id=${cycle.group_id}`);
    });
    qs("#open-payments").addEventListener("click", () => {
      APP.navigate(`payments.html?cycle_id=${cycle.id}`);
    });
    qs("#open-payouts").addEventListener("click", () => {
      APP.navigate(`payouts.html?cycle_id=${cycle.id}`);
    });

    async function render() {
      cycle = await CycleAPI.getCycle(cycleId);
      text(qs("#group-name"), group.name);
      text(qs("#subtitle"), `Cycle #${cycle.id} in group #${cycle.group_id}`);
      text(qs("#cycle-title"), `Cycle #${cycle.id}`);
      text(qs("#cycle-note"), canManage
        ? "Admins and moderators can adjust pending-cycle details and control lifecycle."
        : "View only. Lifecycle changes are restricted.");

      const grid = qs("#cycle-grid");
      grid.innerHTML = "";
      [
        ["Status", cycle.status],
        ["Frequency", frequencyLabel(cycle)],
        ["Start date", cycle.start_date],
        ["End date", cycle.end_date || "-"],
        ["Created by", cycle.created_by],
        ["Created at", new Date(cycle.created_at).toLocaleString()],
      ].forEach(([k, v]) => {
        const dt = document.createElement("dt");
        dt.textContent = k;
        const dd = document.createElement("dd");
        dd.textContent = String(v);
        grid.appendChild(dt);
        grid.appendChild(dd);
      });

      const statusBadge = qs("#cycle-status");
      statusBadge.textContent = cycle.status;
      statusBadge.className = `badge ${cycle.status === "active" ? "good" : cycle.status === "completed" ? "bad" : "warn"}`;

      qs("#edit-frequency").value = cycle.frequency;
      qs("#edit-custom_days").value = cycle.custom_days || "";
      qs("#edit-end_date").value = cycle.end_date || "";
      syncEditFields();

      show(qs("#manage"), canManage);
      qs("#start").disabled = !(canManage && cycle.status !== "active" && cycle.status !== "completed");
      qs("#pause").disabled = !(canManage && cycle.status === "active");
      qs("#complete").disabled = !(canManage && cycle.status === "active");
    }

    qs("#edit-frequency").addEventListener("change", syncEditFields);

    if (canManage) {
      qs("#edit-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        setMessage("#form-error", "");
        setMessage("#form-success", "");

        const payload = {
          frequency: qs("#edit-frequency").value,
          end_date: qs("#edit-end_date").value || null,
        };

        if (payload.frequency === "custom_days") {
          const customDays = Number(qs("#edit-custom_days").value);
          if (!customDays) {
            setMessage("#form-error", "Custom days is required for custom frequency.");
            return;
          }
          payload.custom_days = customDays;
        }

        APP.setButtonLoading(qs("#save"), true, "Saving…");
        try {
          await CycleAPI.updateCycle(cycleId, payload);
          setMessage("#form-success", "Cycle updated.");
          APP.showToast("Cycle updated", "success");
          await render();
        } catch (err) {
          setMessage("#form-error", err.message || "Failed to update cycle.");
        } finally {
          APP.setButtonLoading(qs("#save"), false);
        }
      });

      qs("#start").addEventListener("click", async () => {
        APP.setButtonLoading(qs("#start"), true, "Starting…");
        try {
          await CycleAPI.startCycle(cycleId);
          APP.showToast("Cycle started", "success");
          await render();
        } catch (e) {
          APP.showToast(e.message || "Failed to start cycle.", "error");
        } finally {
          APP.setButtonLoading(qs("#start"), false);
        }
      });

      qs("#pause").addEventListener("click", async () => {
        APP.setButtonLoading(qs("#pause"), true, "Pausing…");
        try {
          await CycleAPI.stopCycle(cycleId, "paused");
          APP.showToast("Cycle paused", "success");
          await render();
        } catch (e) {
          APP.showToast(e.message || "Failed to pause cycle.", "error");
        } finally {
          APP.setButtonLoading(qs("#pause"), false);
        }
      });

      qs("#complete").addEventListener("click", async () => {
        if (!window.confirm("Complete this cycle?")) return;
        APP.setButtonLoading(qs("#complete"), true, "Completing…");
        try {
          await CycleAPI.stopCycle(cycleId, "completed");
          APP.showToast("Cycle completed", "success");
          await render();
        } catch (e) {
          APP.showToast(e.message || "Failed to complete cycle.", "error");
        } finally {
          APP.setButtonLoading(qs("#complete"), false);
        }
      });
    }

    await render();
  }

  document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page || "";
    if (page === "cycles") initCyclesPage();
    if (page === "cycle_detail") initCycleDetailPage();
  });
})();
