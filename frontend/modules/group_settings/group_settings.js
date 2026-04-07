(function () {
  function qs(s) { return document.querySelector(s); }
  function text(el, v) { if (el) el.textContent = v; }
  function show(el, yes) { if (el) el.hidden = !yes; }

  function getParam(name) {
    const u = new URL(window.location.href);
    return u.searchParams.get(name);
  }
  function getGroupId() {
    return Number(getParam("group_id") || getParam("id") || 0);
  }

  async function apiGetGroup(groupId) {
    const res = await fetch(`${APP.getApiBase()}/groups/${groupId}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${APP.getToken()}` },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw { status: res.status, message: (data && data.detail) || `Failed to load group (${res.status})` };
    return data;
  }

  async function apiMyRole(groupId, myUserId) {
    // creator/admin check: try list members and find my row
    try {
      const qsx = new URLSearchParams({ group_id: String(groupId), page: "1", size: "100" }).toString();
      const res = await fetch(`${APP.getApiBase()}/group-members/?${qsx}`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${APP.getToken()}` },
      });
      if (!res.ok) return null;
      const items = await res.json();
      const me = (items || []).find((m) => Number(m.user_id) === Number(myUserId));
      return me ? me.role : null;
    } catch {
      return null;
    }
  }

  function setPageError(msg) {
    const el = qs("#page-error");
    if (!el) return;
    el.hidden = !msg;
    el.textContent = msg || "";
  }
  function setFormError(msg) {
    const el = qs("#form-error");
    if (!el) return;
    el.hidden = !msg;
    el.textContent = msg || "";
  }
  function setFormSuccess(msg) {
    const el = qs("#form-success");
    if (!el) return;
    el.hidden = !msg;
    el.textContent = msg || "";
  }

  function renderGrid(grid, s) {
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

  function bindDynamicFields() {
    const freq = qs("#frequency");
    const cdWrap = qs("#custom-days-wrap");
    const allowLate = qs("#allow_late");
    const lpWrap = qs("#late-penalty-wrap");

    function sync() {
      const f = freq ? freq.value : "";
      show(cdWrap, f === "custom_days");
      show(lpWrap, !!(allowLate && allowLate.checked));
    }
    if (freq) freq.addEventListener("change", sync);
    if (allowLate) allowLate.addEventListener("change", sync);
    sync();
  }

  function validateForm() {
    setFormError(""); setFormSuccess("");

    const amt = qs("#contribution_amount");
    const freq = qs("#frequency");
    const cd = qs("#custom_days");
    const allowLate = qs("#allow_late");
    const lp = qs("#late_penalty");
    const auto = qs("#auto_start_cycle");

    let ok = true;

    const amountVal = Number(amt.value);
    if (!amountVal || amountVal <= 0) {
      APP.setFieldError(amt, "Contribution amount must be > 0.");
      ok = false;
    } else APP.clearFieldError(amt);

    if (freq.value === "custom_days") {
      const cdVal = Number(cd.value);
      if (!cdVal || cdVal < 1) {
        APP.setFieldError(cd, "custom_days is required for custom frequency.");
        ok = false;
      } else APP.clearFieldError(cd);
    } else {
      if (cd) { cd.value = ""; APP.clearFieldError(cd); }
    }

    if (allowLate.checked) {
      if (lp.value.trim() === "") {
        APP.setFieldError(lp, "Set late penalty (0 allowed).");
        ok = false;
      } else APP.clearFieldError(lp);
    } else {
      if (lp) { lp.value = ""; APP.clearFieldError(lp); }
    }

    if (!ok) setFormError("Please fix the highlighted fields.");
    return ok;

    // note: auto checkbox is boolean, always valid
  }

  function buildPayload(groupId, isCreate) {
    const payload = {};
    if (isCreate) payload.group_id = groupId;

    payload.contribution_amount = qs("#contribution_amount").value;
    payload.frequency = qs("#frequency").value;

    if (payload.frequency === "custom_days") payload.custom_days = Number(qs("#custom_days").value);

    payload.allow_late = !!qs("#allow_late").checked;
    if (payload.allow_late) payload.late_penalty = qs("#late_penalty").value;

    payload.auto_start_cycle = !!qs("#auto_start_cycle").checked;

    return payload;
  }

  async function initSettingsPage() {
    if (!APP.requireAuthOrRedirect()) return;

    const groupId = getGroupId();
    const input = qs("#group_id");
    if (input && groupId) input.value = String(groupId);

    qs("#load").addEventListener("click", () => {
      const gid = Number(qs("#group_id").value);
      if (!gid) { text(qs("#select-error"), "Enter a valid group id."); return; }
      APP.navigate(`group_settings.html?group_id=${gid}`);
    });

    if (!groupId) return;

    const profile = await UserAPI.getProfile(APP.getToken());
    const group = await apiGetGroup(groupId);

    text(qs("#group-name"), group.name);

    const role = await apiMyRole(groupId, profile.id);
    const canManage = Number(group.created_by) === Number(profile.id) || role === "admin";

    text(qs("#perm-note"), canManage
      ? "You can manage settings (creator/admin)."
      : "View only (creator/admin required to change settings).");

    bindDynamicFields();

    const view = qs("#settings-view");
    const form = qs("#settings-form");

    let existing = null;
    try {
      existing = await GroupSettingsAPI.getSettings(groupId);
      show(view, true);
      renderGrid(qs("#settings-grid"), existing);
      show(form, false);
      qs("#toggle-edit").disabled = !canManage;
    } catch (e) {
      if (e.status === 404) {
        show(view, false);
        if (canManage) {
          show(form, true);
          text(qs("#perm-note"), "No settings yet. Create them below.");
        } else {
          setPageError("Settings not found for this group.");
        }
      } else {
        setPageError(e.message || "Failed to load settings.");
      }
    }

    qs("#open-detail").addEventListener("click", () => {
      APP.navigate(`group_settings_detail.html?group_id=${groupId}`);
    });

    qs("#toggle-edit").addEventListener("click", () => {
      if (!canManage) return;
      show(form, true);
      show(view, false);

      // prefill from existing
      if (existing) {
        qs("#contribution_amount").value = existing.contribution_amount;
        qs("#frequency").value = existing.frequency;
        qs("#custom_days").value = existing.custom_days ?? "";
        qs("#allow_late").checked = !!existing.allow_late;
        qs("#late_penalty").value = existing.late_penalty ?? "";
        qs("#auto_start_cycle").checked = !!existing.auto_start_cycle;
        bindDynamicFields();
      }
    });

    qs("#cancel").addEventListener("click", () => {
      show(form, false);
      show(view, true);
      setFormError(""); setFormSuccess("");
    });

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      if (!canManage) { setFormError("Not allowed."); return; }
      if (!validateForm()) return;

      const btn = qs("#save");
      APP.setButtonLoading(btn, true, "Saving…");

      try {
        const payload = buildPayload(groupId, !existing);
        const res = existing
          ? await GroupSettingsAPI.updateSettings(groupId, payload)
          : await GroupSettingsAPI.createSettings(payload);

        existing = res;
        setFormSuccess("Saved.");
        APP.showToast("Settings saved", "success");

        renderGrid(qs("#settings-grid"), existing);
        show(form, false);
        show(view, true);
      } catch (e) {
        setFormError(e.message || "Save failed.");
        APP.showToast(e.message || "Save failed.", "error");
      } finally {
        APP.setButtonLoading(btn, false);
      }
    });
  }

  async function initSettingsDetailPage() {
    if (!APP.requireAuthOrRedirect()) return;

    const groupId = getGroupId();
    if (!groupId) { setPageError("Missing group_id."); return; }

    qs("#back").addEventListener("click", () => APP.navigate(`group_settings.html?group_id=${groupId}`));

    const profile = await UserAPI.getProfile(APP.getToken());
    const group = await apiGetGroup(groupId);

    text(qs("#group-name"), group.name);
    text(qs("#subtitle"), `Group #${groupId}`);

    const role = await apiMyRole(groupId, profile.id);
    const canManage = Number(group.created_by) === Number(profile.id) || role === "admin";

    text(qs("#perm-note"), canManage
      ? "You can edit/delete settings (creator/admin)."
      : "View only.");

    let s;
    try {
      s = await GroupSettingsAPI.getSettings(groupId);
      renderGrid(qs("#settings-grid"), s);
    } catch (e) {
      setPageError(e.message || "Failed to load settings.");
      return;
    }

    show(qs("#manage"), canManage);
    if (!canManage) return;

    bindDynamicFields();

    // Prefill
    qs("#contribution_amount").value = s.contribution_amount;
    qs("#frequency").value = s.frequency;
    qs("#custom_days").value = s.custom_days ?? "";
    qs("#allow_late").checked = !!s.allow_late;
    qs("#late_penalty").value = s.late_penalty ?? "";
    qs("#auto_start_cycle").checked = !!s.auto_start_cycle;
    bindDynamicFields();

    qs("#edit-form").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      if (!validateForm()) return;

      APP.setButtonLoading(qs("#save"), true, "Saving…");
      try {
        const payload = buildPayload(groupId, false);
        s = await GroupSettingsAPI.updateSettings(groupId, payload);
        renderGrid(qs("#settings-grid"), s);
        setFormSuccess("Saved.");
        APP.showToast("Settings updated", "success");
      } catch (e) {
        setFormError(e.message || "Update failed.");
        APP.showToast(e.message || "Update failed.", "error");
      } finally {
        APP.setButtonLoading(qs("#save"), false);
      }
    });

    qs("#del").addEventListener("click", async () => {
      if (!confirm("Delete settings for this group?")) return;
      APP.setButtonLoading(qs("#del"), true, "Deleting…");
      try {
        await GroupSettingsAPI.deleteSettings(groupId);
        APP.showToast("Settings deleted", "success");
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
    if (page === "group_settings") initSettingsPage();
    if (page === "group_settings_detail") initSettingsDetailPage();
  });
})();
