(function () {
  const PAGE_SIZE = 20;

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
      canCreateCycle: Number(group.created_by) === Number(profile.id) || role === "admin",
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

  function renderCycleList(items, canManage) {
    const list = qs("#cycles-list");
    list.innerHTML = "";

    if (!items.length) {
      const li = document.createElement("li");
      li.className = "list-empty";
      li.textContent = "No cycles found for this group yet.";
      list.appendChild(li);
      return;
    }

    items.forEach((cycle) => {
      const li = document.createElement("li");
      li.className = "list-item";

      const left = document.createElement("div");
      left.className = "list-main";

      const title = document.createElement("div");
      title.className = "list-title";
      title.textContent = `Cycle #${cycle.id}`;

      const meta = document.createElement("div");
      meta.className = "list-meta";
      meta.textContent = `${frequencyLabel(cycle)} • ${formatDate(cycle.start_date)} to ${formatDate(cycle.end_date)} • created by user #${cycle.created_by}`;

      const badges = document.createElement("div");
      badges.style.marginTop = "8px";

      const status = document.createElement("span");
      status.className = `badge ${cycle.status === "active" ? "good" : cycle.status === "completed" ? "bad" : "warn"}`;
      status.textContent = cycle.status;
      badges.appendChild(status);

      left.appendChild(title);
      left.appendChild(meta);
      left.appendChild(badges);

      const actions = document.createElement("div");
      actions.className = "list-actions";

      const open = document.createElement("a");
      open.className = "btn btn-secondary";
      open.style.width = "auto";
      open.href = `cycle_detail.html?cycle_id=${cycle.id}&group_id=${cycle.group_id}`;
      open.textContent = "Open";
      actions.appendChild(open);

      if (canManage && cycle.status !== "active" && cycle.status !== "completed") {
        const start = document.createElement("button");
        start.className = "btn";
        start.style.width = "auto";
        start.type = "button";
        start.textContent = "Start";
        start.addEventListener("click", async () => {
          APP.setButtonLoading(start, true, "Starting…");
          try {
            await CycleAPI.startCycle(cycle.id);
            APP.showToast("Cycle started", "success");
            await window.__cycleReload();
          } catch (e) {
            APP.showToast(e.message || "Failed to start cycle.", "error");
          } finally {
            APP.setButtonLoading(start, false);
          }
        });
        actions.appendChild(start);
      }

      if (canManage && cycle.status === "active") {
        const pause = document.createElement("button");
        pause.className = "btn btn-secondary";
        pause.style.width = "auto";
        pause.type = "button";
        pause.textContent = "Pause";
        pause.addEventListener("click", async () => {
          APP.setButtonLoading(pause, true, "Pausing…");
          try {
            await CycleAPI.stopCycle(cycle.id, "paused");
            APP.showToast("Cycle paused", "success");
            await window.__cycleReload();
          } catch (e) {
            APP.showToast(e.message || "Failed to pause cycle.", "error");
          } finally {
            APP.setButtonLoading(pause, false);
          }
        });

        const complete = document.createElement("button");
        complete.className = "btn btn-secondary";
        complete.style.width = "auto";
        complete.type = "button";
        complete.textContent = "Complete";
        complete.addEventListener("click", async () => {
          if (!window.confirm("Mark this cycle as completed?")) return;
          APP.setButtonLoading(complete, true, "Completing…");
          try {
            await CycleAPI.stopCycle(cycle.id, "completed");
            APP.showToast("Cycle completed", "success");
            await window.__cycleReload();
          } catch (e) {
            APP.showToast(e.message || "Failed to complete cycle.", "error");
          } finally {
            APP.setButtonLoading(complete, false);
          }
        });

        actions.appendChild(pause);
        actions.appendChild(complete);
      }

      li.appendChild(left);
      li.appendChild(actions);
      list.appendChild(li);
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
    const canManage = Number(group.created_by) === Number(profile.id) || role === "admin";
    const openCreateFromMenu = openMode === "create";

    applyGroupWorkspace(
      profile,
      group,
      role,
      openCreateFromMenu ? "add_cycle" : "cycles",
      openCreateFromMenu ? "Add New Cycle" : "My Cycles"
    );

    text(qs("#group-name"), group.name);
    text(qs("#group-subtitle"), `Cycles for group #${groupId}`);
    text(qs("#group-note"), canManage
      ? "Creator/admin can create cycles and change lifecycle."
      : "Members can view cycles. Lifecycle changes are reserved for creator/admin.");

    qs("#open-group").addEventListener("click", () => APP.navigate(`group_detail.html?id=${groupId}`));
    qs("#open-members").addEventListener("click", () => APP.navigate(`group_members.html?group_id=${groupId}`));
    qs("#open-settings").addEventListener("click", () => APP.navigate(`group_settings.html?group_id=${groupId}`));

    let settings = null;
    try {
      settings = await GroupSettingsAPI.get(groupId);
      text(
        qs("#settings-hint"),
        `Default contribution ${settings.contribution_amount} • ${settings.frequency}${settings.custom_days ? ` (${settings.custom_days} days)` : ""} • auto-start ${settings.auto_start_cycle ? "on" : "off"}`
      );
    } catch {
      text(qs("#settings-hint"), "Group settings not found yet. Custom-day cycles may need settings first.");
    }

    show(qs("#open-create"), canManage);

    let page = 1;

    async function load() {
      setMessage("#page-error", "");
      text(qs("#list-status"), "Loading…");
      try {
        const items = await CycleAPI.listForGroup(groupId, { page, size: PAGE_SIZE });
        renderCycleList(items, canManage);
        text(qs("#page-label"), `Page ${page}`);
        qs("#prev").disabled = page <= 1;
        qs("#next").disabled = items.length < PAGE_SIZE;
        text(qs("#list-status"), "");
      } catch (e) {
        const msg = e.message || "Failed to load cycles.";
        setMessage("#page-error", msg);
        text(qs("#list-status"), msg);
      }
    }

    window.__cycleReload = load;

    qs("#refresh").addEventListener("click", () => load());
    qs("#prev").addEventListener("click", () => { if (page > 1) { page -= 1; load(); } });
    qs("#next").addEventListener("click", () => { page += 1; load(); });

    const overlay = qs("#modal-overlay");
    const modal = qs("#create-modal");

    function openModal() {
      setMessage("#form-error", "");
      overlay.hidden = false;
      modal.hidden = false;
      qs("#start_date").value = new Date().toISOString().slice(0, 10);
      if (settings) {
        qs("#frequency").value = settings.frequency;
        qs("#auto_start").checked = !!settings.auto_start_cycle;
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

    qs("#open-create").addEventListener("click", openModal);
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
        auto_start: !!qs("#auto_start").checked,
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
        page = 1;
        await load();
      } catch (err) {
        setMessage("#form-error", err.message || "Failed to create cycle.");
      } finally {
        APP.setButtonLoading(qs("#create-submit"), false);
      }
    });

    if (openCreateFromMenu) {
      if (canManage) {
        openModal();
      } else {
        APP.showToast("Only the group creator or an admin can add a cycle.", "error");
      }
    }

    await load();
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
    const canManage = Number(group.created_by) === Number(profile.id) || role === "admin";

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
        ? "Creator/admin can edit details and change lifecycle."
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
