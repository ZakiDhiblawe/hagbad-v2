(function () {
  function qs(s) { return document.querySelector(s); }
  function show(el, yes) { if (el) el.hidden = !yes; }
  function text(el, v) { if (el) el.textContent = v; }

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
      activeKey: "settings",
      pageTitle,
      canUpdateGroup: Number(group.created_by) === Number(profile.id),
      canCreateCycle: Number(group.created_by) === Number(profile.id) || role === "admin",
    });
  }

  function getGroupId() {
    const u = new URL(window.location.href);
    return Number(u.searchParams.get("group_id") || u.searchParams.get("id") || 0);
  }

  function setErr(id, msg) {
    const el = qs(id);
    if (!el) return;
    el.hidden = !msg;
    el.textContent = msg || "";
  }

  async function fetchGroup(groupId) {
    const res = await fetch(`${APP.getApiBase()}/groups/${groupId}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${APP.getToken()}` },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw { status: res.status, message: (data && data.detail) || `Failed to load group (${res.status})` };
    return data;
  }

  async function myAdminRole(groupId, myId) {
    // Optional: check admin for accurate UI. If it fails, fall back to creator-only.
    try {
      const qsx = new URLSearchParams({ group_id: String(groupId), page: "1", size: "100" }).toString();
      const res = await fetch(`${APP.getApiBase()}/group-members/?${qsx}`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${APP.getToken()}` },
      });
      if (!res.ok) return null;
      const items = await res.json();
      const me = (items || []).find((m) => Number(m.user_id) === Number(myId));
      return me ? me.role : null;
    } catch { return null; }
  }

  function syncDynamicFields() {
    const f = qs("#frequency")?.value;
    show(qs("#custom-days-wrap"), f === "custom_days");
    const allow = !!qs("#allow_late")?.checked;
    show(qs("#late-penalty-wrap"), allow);
  }

  function renderGrid(s) {
    const grid = qs("#settings-grid");
    if (!grid) return;
    while (grid.firstChild) grid.removeChild(grid.firstChild);

    const rows = [
      ["Contribution", s.contribution_amount],
      ["Frequency", s.frequency],
      ["Custom days", s.custom_days ?? "-"],
      ["Allow late", String(s.allow_late)],
      ["Late penalty", s.late_penalty ?? "-"],
      ["Auto-start", String(s.auto_start_cycle)],
      ["Created", s.created_at ? new Date(s.created_at).toLocaleString() : "-"],
    ];

    rows.forEach(([k, v]) => {
      const dt = document.createElement("dt"); dt.textContent = k;
      const dd = document.createElement("dd"); dd.textContent = String(v);
      grid.appendChild(dt); grid.appendChild(dd);
    });
  }

  function fillForm(s) {
    qs("#contribution_amount").value = s?.contribution_amount ?? "";
    qs("#frequency").value = s?.frequency ?? "weekly";
    qs("#custom_days").value = s?.custom_days ?? "";
    qs("#allow_late").checked = !!s?.allow_late;
    qs("#late_penalty").value = s?.late_penalty ?? "";
    qs("#auto_start_cycle").checked = !!s?.auto_start_cycle;
    syncDynamicFields();
  }

  function validate() {
    setErr("#form-error", "");
    setErr("#form-success", "");

    const amt = qs("#contribution_amount");
    const freq = qs("#frequency").value;
    const cd = qs("#custom_days");
    const allowLate = qs("#allow_late").checked;
    const lp = qs("#late_penalty");

    let ok = true;

    const amountVal = Number(amt.value);
    if (!amountVal || amountVal <= 0) {
      APP.setFieldError(amt, "Contribution must be > 0.");
      ok = false;
    } else APP.clearFieldError(amt);

    if (freq === "custom_days") {
      const cdVal = Number(cd.value);
      if (!cdVal || cdVal < 1) {
        APP.setFieldError(cd, "custom_days required for custom_days frequency.");
        ok = false;
      } else APP.clearFieldError(cd);
    } else {
      APP.clearFieldError(cd);
      cd.value = "";
    }

    if (allowLate) {
      if (lp.value.trim() === "") {
        APP.setFieldError(lp, "Late penalty required (0 allowed).");
        ok = false;
      } else APP.clearFieldError(lp);
    } else {
      APP.clearFieldError(lp);
      lp.value = "";
    }

    if (!ok) setErr("#form-error", "Please fix the highlighted fields.");
    return ok;
  }

  function payload(groupId, creating) {
    const p = {};
    if (creating) p.group_id = groupId;

    // Send as strings for Decimal-friendly backend parsing
    p.contribution_amount = qs("#contribution_amount").value;
    p.frequency = qs("#frequency").value;

    if (p.frequency === "custom_days") p.custom_days = Number(qs("#custom_days").value);

    p.allow_late = !!qs("#allow_late").checked;
    if (p.allow_late) p.late_penalty = qs("#late_penalty").value;

    p.auto_start_cycle = !!qs("#auto_start_cycle").checked;
    return p;
  }

  async function initMainPage() {
    const token = APP.requireAuthOrRedirect();
    if (!token) return;

    const groupId = getGroupId();
    if (groupId) qs("#group_id").value = String(groupId);

    qs("#load").addEventListener("click", () => {
      const gid = Number(qs("#group_id").value);
      if (!gid) { text(qs("#select-error"), "Enter a valid group id."); return; }
      APP.navigate(`group_settings.html?group_id=${gid}`);
    });

    if (!groupId) return;

    const me = await UserAPI.getProfile(token);
    const group = await fetchGroup(groupId);
    text(qs("#group-name"), group.name);

    const role = await myAdminRole(groupId, me.id);
    const canManage = Number(group.created_by) === Number(me.id) || role === "admin";
    applyGroupWorkspace(me, group, role, "Settings");

    text(qs("#perm-note"), canManage
      ? "You can manage settings (creator/admin)."
      : "View only (creator/admin required).");

    qs("#frequency").addEventListener("change", syncDynamicFields);
    qs("#allow_late").addEventListener("change", syncDynamicFields);

    let existing = null;

    try {
      existing = await GroupSettingsAPI.get(groupId);
      renderGrid(existing);
      show(qs("#settings-view"), true);
      show(qs("#settings-form"), false);
    } catch (e) {
      if (e.status === 404) {
        show(qs("#settings-view"), false);
        if (canManage) {
          fillForm(null);
          show(qs("#settings-form"), true);
        } else {
          setErr("#page-error", "Settings not found for this group.");
        }
      } else {
        setErr("#page-error", e.message || "Failed to load settings.");
      }
    }

    qs("#open-detail").addEventListener("click", () => {
      APP.navigate(`group_settings_detail.html?group_id=${groupId}`);
    });

    qs("#edit-btn").addEventListener("click", () => {
      if (!canManage) { APP.showToast("Not allowed", "error"); return; }
      fillForm(existing);
      show(qs("#settings-form"), true);
      show(qs("#settings-view"), false);
    });

    qs("#cancel").addEventListener("click", () => {
      show(qs("#settings-form"), false);
      show(qs("#settings-view"), !!existing);
      setErr("#form-error", "");
      setErr("#form-success", "");
    });

    qs("#settings-form").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      if (!canManage) { setErr("#form-error", "Not allowed."); return; }
      if (!validate()) return;

      APP.setButtonLoading(qs("#save"), true, "Saving…");
      try {
        const p = payload(groupId, !existing);
        existing = existing
          ? await GroupSettingsAPI.update(groupId, p)
          : await GroupSettingsAPI.create(p);

        renderGrid(existing);
        setErr("#form-success", "Saved.");
        APP.showToast("Settings saved", "success");
        show(qs("#settings-form"), false);
        show(qs("#settings-view"), true);
      } catch (e) {
        setErr("#form-error", e.message || "Save failed.");
        APP.showToast(e.message || "Save failed.", "error");
      } finally {
        APP.setButtonLoading(qs("#save"), false);
      }
    });
  }

  async function initDetailPage() {
    const token = APP.requireAuthOrRedirect();
    if (!token) return;

    const groupId = getGroupId();
    if (!groupId) { setErr("#page-error", "Missing group_id."); return; }

    qs("#back").addEventListener("click", () => {
      APP.navigate(`group_settings.html?group_id=${groupId}`);
    });

    const me = await UserAPI.getProfile(token);
    const group = await fetchGroup(groupId);
    text(qs("#group-name"), group.name);
    text(qs("#subtitle"), `Group #${groupId}`);

    const role = await myAdminRole(groupId, me.id);
    const canManage = Number(group.created_by) === Number(me.id) || role === "admin";
    applyGroupWorkspace(me, group, role, "Settings Detail");

    text(qs("#perm-note"), canManage ? "Creator/admin: you can edit/delete." : "View only.");

    qs("#frequency").addEventListener("change", syncDynamicFields);
    qs("#allow_late").addEventListener("change", syncDynamicFields);

    let s;
    try {
      s = await GroupSettingsAPI.get(groupId);
      renderGrid(s);
      fillForm(s);
    } catch (e) {
      setErr("#page-error", e.message || "Failed to load settings.");
      return;
    }

    show(qs("#manage"), canManage);
    if (!canManage) return;

    qs("#edit-form").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      if (!validate()) return;

      APP.setButtonLoading(qs("#save"), true, "Saving…");
      try {
        s = await GroupSettingsAPI.update(groupId, payload(groupId, false));
        renderGrid(s);
        setErr("#form-success", "Saved.");
        APP.showToast("Updated", "success");
      } catch (e) {
        setErr("#form-error", e.message || "Update failed.");
        APP.showToast(e.message || "Update failed.", "error");
      } finally {
        APP.setButtonLoading(qs("#save"), false);
      }
    });

    qs("#del").addEventListener("click", async () => {
      if (!confirm("Delete settings for this group?")) return;
      APP.setButtonLoading(qs("#del"), true, "Deleting…");
      try {
        await GroupSettingsAPI.remove(groupId);
        APP.showToast("Deleted", "success");
        APP.navigate(`group_settings.html?group_id=${groupId}`);
      } catch (e) {
        APP.showToast(e.message || "Delete failed.", "error");
      } finally {
        APP.setButtonLoading(qs("#del"), false);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page || "";
    if (page === "group_settings") initMainPage();
    if (page === "group_settings_detail") initDetailPage();
  });
})();
