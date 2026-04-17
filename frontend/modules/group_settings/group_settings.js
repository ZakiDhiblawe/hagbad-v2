(function () {
  const PAGE_SIZE = 100;

  function qs(selector) { return document.querySelector(selector); }
  function show(target, yes) { if (target) target.hidden = !yes; }
  function text(target, value) { if (target) target.textContent = value || ""; }
  function empty(target) { if (target) target.innerHTML = ""; }

  function setMessage(selector, message) {
    const el = qs(selector);
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || "";
  }

  function clearFieldErrors() {
    ["#name", "#contribution_amount", "#custom_days", "#late_penalty"].forEach((selector) => {
      const input = qs(selector);
      if (input) APP.clearFieldError(input);
    });
  }

  function mountWorkspaceMenu(profile) {
    const mount = qs("#workspace-user-menu");
    if (!mount || !profile) return;
    APP.mountUserMenu(mount, profile, { compact: false });
  }

  function getGroupId() {
    const url = new URL(window.location.href);
    return Number(url.searchParams.get("group_id") || url.searchParams.get("id") || 0);
  }

  function getDefaultGroupImage() {
    return `${APP.getRootPrefix()}assets/images/logos/favicon.png`;
  }

  function getInitials(name) {
    const parts = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);
    if (!parts.length) return "HG";
    return parts.map((part) => part.charAt(0).toUpperCase()).join("");
  }

  function roleLabel(role, isCreator = false) {
    if (isCreator) return "Creator";
    if (role === "admin") return "Admin";
    if (role === "moderator") return "Moderator";
    return "Member";
  }

  function formatFrequency(value) {
    if (!value) return "Not set";
    if (value === "custom_days") return "Custom days";
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function formatDate(value) {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleString();
  }

  function createContextChip(label, tone = "neutral") {
    const chip = document.createElement("span");
    chip.className = `member-context-chip ${tone}`;
    chip.textContent = label;
    return chip;
  }

  function setStatusChip(selector, label, tone = "neutral") {
    const chip = qs(selector);
    if (!chip) return;
    chip.textContent = label;
    chip.className = `member-section-count ${tone}`;
  }

  async function ensureProfile() {
    const token = APP.requireAuthOrRedirect();
    if (!token) return null;

    try {
      return await UserAPI.getProfile(token);
    } catch (err) {
      if (err.status === 401) {
        APP.clearToken();
        APP.showToast("Session expired. Please log in again.", "info");
        APP.navigate("login.html");
        return null;
      }
      throw err;
    }
  }

  async function fetchGroup(groupId) {
    const res = await fetch(`${APP.getApiBase()}/groups/${groupId}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${APP.getToken()}` },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw {
        status: res.status,
        message: (data && data.detail) || `Failed to load group (${res.status})`,
      };
    }
    return data;
  }

  async function fetchMyRole(groupId, myId) {
    for (let page = 1; page <= 50; page += 1) {
      const query = new URLSearchParams({
        group_id: String(groupId),
        page: String(page),
        size: String(PAGE_SIZE),
      });

      const res = await fetch(`${APP.getApiBase()}/group-members/?${query.toString()}`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${APP.getToken()}` },
      });

      if (!res.ok) return null;
      const items = await res.json().catch(() => []);
      const me = (items || []).find((item) => Number(item.user_id) === Number(myId));
      if (me) return me.role;
      if (!Array.isArray(items) || items.length < PAGE_SIZE) break;
    }
    return null;
  }

  async function updateGroup(groupId, formData) {
    const res = await fetch(`${APP.getApiBase()}/groups/${groupId}`, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${APP.getToken()}`,
      },
      body: formData,
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw {
        status: res.status,
        message: (data && data.detail) || `Request failed (${res.status})`,
      };
    }
    return data;
  }

  function buildPermissions(group, profile, role) {
    const isCreator = Number(group.created_by) === Number(profile.id);
    const isAdmin = isCreator || role === "admin";
    const isModerator = role === "moderator";

    return {
      isCreator,
      isAdmin,
      isModerator,
      canAccessAdministration: isAdmin || isModerator,
      canEditName: isAdmin,
      canEditDescription: isAdmin || isModerator,
      canEditPrivacy: isAdmin,
      canEditGroupImage: isAdmin,
      canEditCover: isAdmin || isModerator,
      canEditRules: isAdmin || isModerator,
    };
  }

  function applyGroupWorkspace(state) {
    mountWorkspaceMenu(state.profile);
    APP.applyGroupWorkspaceNav({
      groupId: state.group.id,
      activeKey: "settings",
      pageTitle: "Setting",
      canUpdateGroup: false,
      canCreateCycle: state.permissions.isCreator || state.role === "admin",
      canAccessAdministration: state.permissions.canAccessAdministration,
      showJoinRequests: state.group.privacy !== "public",
    });
  }

  function syncRuleFields() {
    const frequency = qs("#frequency")?.value;
    const allowLate = !!qs("#allow_late")?.checked;
    show(qs("#custom-days-wrap"), frequency === "custom_days");
    show(qs("#late-penalty-wrap"), allowLate);
  }

  function updatePreviewFileName(target, file) {
    if (!target) return;
    target.textContent = file ? file.name : "No new file selected";
  }

  function bindObjectPreview(input, onFile, onEmpty) {
    if (!input) return () => {};

    const apply = () => {
      const previousUrl = input.dataset.previewUrl;
      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
        delete input.dataset.previewUrl;
      }

      const file = input.files && input.files[0] ? input.files[0] : null;
      if (!file) {
        onEmpty();
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      input.dataset.previewUrl = objectUrl;
      onFile(objectUrl, file);
    };

    input.addEventListener("change", apply);
    return apply;
  }

  function revokePreviewUrl(input) {
    if (!input || !input.dataset.previewUrl) return;
    URL.revokeObjectURL(input.dataset.previewUrl);
    delete input.dataset.previewUrl;
  }

  function renderBadges(state) {
    const mount = qs("#settings-badges");
    empty(mount);
    if (!mount) return;

    [
      createContextChip(`Group #${state.group.id}`, "neutral"),
      createContextChip(state.group.privacy === "private" ? "Private group" : "Public group", state.group.privacy),
      createContextChip(state.group.visible ? "Visible" : "Hidden", state.group.visible ? "active" : "private"),
      createContextChip(state.group.status === "closed" ? "Closed" : "Active", state.group.status === "closed" ? "closed" : "active"),
      createContextChip(`Your role: ${roleLabel(state.role, state.permissions.isCreator)}`, state.permissions.isAdmin ? "admin" : (state.permissions.isModerator ? "moderator" : "member")),
    ].forEach((chip) => mount.appendChild(chip));
  }

  function renderSummary(state) {
    text(qs("#summary-role"), roleLabel(state.role, state.permissions.isCreator));

    if (state.permissions.isAdmin) {
      text(qs("#summary-role-note"), "You can manage every group field on this page.");
    } else if (state.permissions.isModerator) {
      text(qs("#summary-role-note"), "You can update description, cover image, and group rules.");
    } else {
      text(qs("#summary-role-note"), "This page is read only for your current role.");
    }

    text(qs("#summary-name-access"), state.permissions.canEditName ? "Editable" : "Read only");

    if (state.permissions.canEditGroupImage) {
      text(qs("#summary-media-access"), "Full");
    } else if (state.permissions.canEditCover) {
      text(qs("#summary-media-access"), "Cover only");
    } else {
      text(qs("#summary-media-access"), "Read only");
    }

    text(qs("#summary-rules-status"), state.settings ? "Configured" : "Not set");
    if (state.settings) {
      text(
        qs("#summary-rules-note"),
        `${formatFrequency(state.settings.frequency)} contributions at ${state.settings.contribution_amount}.`
      );
    } else {
      text(qs("#summary-rules-note"), "No recurring group rules have been saved yet.");
    }

    setStatusChip(
      "#identity-access-chip",
      state.permissions.canEditName ? "Admin access" : (state.permissions.canEditDescription ? "Description only" : "Read only"),
      state.permissions.canEditName ? "success" : (state.permissions.canEditDescription ? "warn" : "neutral")
    );
    setStatusChip(
      "#privacy-access-chip",
      state.permissions.canEditPrivacy ? "Admin access" : "Read only",
      state.permissions.canEditPrivacy ? "success" : "neutral"
    );
    setStatusChip(
      "#media-access-chip",
      state.permissions.canEditGroupImage ? "Full access" : (state.permissions.canEditCover ? "Cover only" : "Read only"),
      state.permissions.canEditGroupImage ? "success" : (state.permissions.canEditCover ? "warn" : "neutral")
    );
    setStatusChip(
      "#rules-access-chip",
      state.permissions.canEditRules ? "Can manage" : "Read only",
      state.permissions.canEditRules ? "success" : "neutral"
    );
  }

  function renderIntro(state) {
    text(qs("#settings-group-name"), state.group.name);
    text(
      qs("#settings-group-subtitle"),
      "Manage the group profile, privacy, media, and recurring group rules from one page."
    );
    text(
      qs("#page-info"),
      `Created ${formatDate(state.group.created_at)}. Admins can rename, change privacy, and update the main photo. Moderators can update the description, cover image, and group rules.`
    );
    qs("#back-to-group-dashboard").href = `group_detail.html?id=${state.group.id}`;

    renderBadges(state);
    renderSummary(state);
  }

  function fillIdentityForm(state) {
    const nameInput = qs("#name");
    const descriptionInput = qs("#description");
    if (nameInput) nameInput.value = state.group.name || "";
    if (descriptionInput) descriptionInput.value = state.group.description || "";
  }

  function fillPrivacyForm(state) {
    const privacyInput = qs("#privacy");
    const visibleInput = qs("#visible");
    if (privacyInput) privacyInput.value = state.group.privacy || "public";
    if (visibleInput) visibleInput.checked = !!state.group.visible;
  }

  function fillRulesForm(state) {
    const settings = state.settings;
    qs("#contribution_amount").value = settings?.contribution_amount ?? "";
    qs("#frequency").value = settings?.frequency ?? "weekly";
    qs("#custom_days").value = settings?.custom_days ?? "";
    qs("#allow_late").checked = !!settings?.allow_late;
    qs("#late_penalty").value = settings?.late_penalty ?? "";
    qs("#auto_start_cycle").checked = !!settings?.auto_start_cycle;
    syncRuleFields();
  }

  function refreshGroupImagePreview(state) {
    const preview = qs("#group-image-preview");
    if (!preview) return;
    preview.src = state.group.group_image ? APP.buildApiUrl(state.group.group_image) : getDefaultGroupImage();
  }

  function refreshCoverPreview(state) {
    const preview = qs("#cover-image-preview");
    const initials = qs("#cover-image-initials");
    if (!preview) return;

    if (state.group.cover_image) {
      preview.style.backgroundImage = `linear-gradient(180deg, rgba(8, 24, 48, 0.08), rgba(8, 24, 48, 0.42)), url("${APP.buildApiUrl(state.group.cover_image)}")`;
      preview.classList.add("has-image");
      preview.classList.remove("no-image");
      if (initials) initials.hidden = true;
    } else {
      preview.style.backgroundImage = "";
      preview.classList.add("no-image");
      preview.classList.remove("has-image");
      if (initials) {
        initials.hidden = false;
        initials.textContent = getInitials(state.group.name);
      }
    }
  }

  function resetMediaFileInputs() {
    const groupImageInput = qs("#group_image");
    const coverImageInput = qs("#cover_image");
    revokePreviewUrl(groupImageInput);
    revokePreviewUrl(coverImageInput);
    if (groupImageInput) groupImageInput.value = "";
    if (coverImageInput) coverImageInput.value = "";
    updatePreviewFileName(qs("#group-image-file-name"), null);
    updatePreviewFileName(qs("#cover-image-file-name"), null);
  }

  function applyAccessState(state) {
    const perms = state.permissions;

    qs("#name").disabled = !perms.canEditName;
    qs("#description").disabled = !perms.canEditDescription;
    show(qs("#identity-submit"), perms.canEditName || perms.canEditDescription);

    qs("#privacy").disabled = !perms.canEditPrivacy;
    qs("#visible").disabled = !perms.canEditPrivacy;
    show(qs("#privacy-submit"), perms.canEditPrivacy);

    qs("#group_image").disabled = !perms.canEditGroupImage;
    qs("#cover_image").disabled = !perms.canEditCover;
    show(qs("#media-submit"), perms.canEditGroupImage || perms.canEditCover);

    ["#contribution_amount", "#frequency", "#custom_days", "#allow_late", "#late_penalty", "#auto_start_cycle"]
      .map((selector) => qs(selector))
      .filter(Boolean)
      .forEach((input) => { input.disabled = !perms.canEditRules; });
    show(qs("#rules-submit"), perms.canEditRules);
  }

  function renderPage(state) {
    applyGroupWorkspace(state);
    renderIntro(state);
    fillIdentityForm(state);
    fillPrivacyForm(state);
    fillRulesForm(state);
    refreshGroupImagePreview(state);
    refreshCoverPreview(state);
    applyAccessState(state);
  }

  function validateIdentity(state) {
    clearFieldErrors();

    const nameInput = qs("#name");
    const nextName = nameInput.value.trim();
    if (state.permissions.canEditName && nextName.length < 2) {
      APP.setFieldError(nameInput, "Group name must be at least 2 characters.");
      return false;
    }

    APP.clearFieldError(nameInput);
    return true;
  }

  function validateRules(state) {
    clearFieldErrors();
    if (!state.permissions.canEditRules) return false;

    const amountInput = qs("#contribution_amount");
    const frequencyInput = qs("#frequency");
    const customDaysInput = qs("#custom_days");
    const allowLateInput = qs("#allow_late");
    const latePenaltyInput = qs("#late_penalty");

    let ok = true;
    const amountValue = Number(amountInput.value);
    if (!amountValue || amountValue <= 0) {
      APP.setFieldError(amountInput, "Contribution must be greater than 0.");
      ok = false;
    }

    if (frequencyInput.value === "custom_days") {
      const customValue = Number(customDaysInput.value);
      if (!customValue || customValue < 1) {
        APP.setFieldError(customDaysInput, "Enter a valid custom day count.");
        ok = false;
      }
    } else {
      APP.clearFieldError(customDaysInput);
    }

    if (allowLateInput.checked) {
      if (latePenaltyInput.value.trim() === "") {
        APP.setFieldError(latePenaltyInput, "Late penalty is required when late payments are allowed.");
        ok = false;
      }
    } else {
      APP.clearFieldError(latePenaltyInput);
    }

    if (ok) {
      APP.clearFieldError(amountInput);
      APP.clearFieldError(customDaysInput);
      APP.clearFieldError(latePenaltyInput);
    }

    return ok;
  }

  function buildRulesPayload(state) {
    const payload = {
      contribution_amount: qs("#contribution_amount").value.trim(),
      frequency: qs("#frequency").value,
      allow_late: !!qs("#allow_late").checked,
      auto_start_cycle: !!qs("#auto_start_cycle").checked,
    };

    if (!state.settings) payload.group_id = state.group.id;
    if (payload.frequency === "custom_days") payload.custom_days = Number(qs("#custom_days").value);
    if (payload.allow_late) payload.late_penalty = qs("#late_penalty").value.trim();

    return payload;
  }

  async function initGroupSettingsPage() {
    const groupId = getGroupId();
    if (!groupId) {
      setMessage("#page-error", "Missing group_id. Open this page with group_settings.html?group_id=1");
      return;
    }

    const profile = await ensureProfile();
    if (!profile) return;

    const state = {
      profile,
      group: null,
      role: null,
      permissions: null,
      settings: null,
    };

    try {
      state.group = await fetchGroup(groupId);
      state.role = await fetchMyRole(groupId, profile.id);
      state.permissions = buildPermissions(state.group, profile, state.role);

      try {
        state.settings = await GroupSettingsAPI.get(groupId);
      } catch (err) {
        if (err.status !== 404) throw err;
        state.settings = null;
      }
    } catch (err) {
      setMessage("#page-error", err.message || "Failed to load the group settings page.");
      return;
    }

    renderPage(state);

    const groupImageInput = qs("#group_image");
    const coverImageInput = qs("#cover_image");

    bindObjectPreview(
      groupImageInput,
      (url, file) => {
        const preview = qs("#group-image-preview");
        if (preview) preview.src = url;
        updatePreviewFileName(qs("#group-image-file-name"), file);
      },
      () => {
        refreshGroupImagePreview(state);
        updatePreviewFileName(qs("#group-image-file-name"), null);
      }
    );

    bindObjectPreview(
      coverImageInput,
      (url, file) => {
        const preview = qs("#cover-image-preview");
        const initials = qs("#cover-image-initials");
        if (preview) {
          preview.style.backgroundImage = `linear-gradient(180deg, rgba(8, 24, 48, 0.08), rgba(8, 24, 48, 0.42)), url("${url}")`;
          preview.classList.add("has-image");
          preview.classList.remove("no-image");
        }
        if (initials) initials.hidden = true;
        updatePreviewFileName(qs("#cover-image-file-name"), file);
      },
      () => {
        refreshCoverPreview(state);
        updatePreviewFileName(qs("#cover-image-file-name"), null);
      }
    );

    qs("#frequency").addEventListener("change", syncRuleFields);
    qs("#allow_late").addEventListener("change", syncRuleFields);

    qs("#identity-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      setMessage("#identity-error", "");
      setMessage("#identity-success", "");

      if (!(state.permissions.canEditName || state.permissions.canEditDescription)) {
        setMessage("#identity-error", "You do not have permission to update this card.");
        return;
      }

      if (!validateIdentity(state)) {
        setMessage("#identity-error", "Please fix the highlighted fields.");
        return;
      }

      const formData = new FormData();
      if (state.permissions.canEditName) {
        formData.append("name", qs("#name").value.trim());
      }
      if (state.permissions.canEditDescription) {
        formData.append("description", qs("#description").value.trim());
      }

      APP.setButtonLoading(qs("#identity-submit"), true, "Saving...");
      try {
        state.group = await updateGroup(groupId, formData);
        state.permissions = buildPermissions(state.group, state.profile, state.role);
        renderPage(state);
        setMessage("#identity-success", "Group name and description saved.");
        APP.showToast("Group details updated", "success");
      } catch (err) {
        setMessage("#identity-error", err.message || "Failed to save group details.");
        APP.showToast(err.message || "Failed to save group details.", "error");
      } finally {
        APP.setButtonLoading(qs("#identity-submit"), false);
      }
    });

    qs("#privacy-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      setMessage("#privacy-error", "");
      setMessage("#privacy-success", "");

      if (!state.permissions.canEditPrivacy) {
        setMessage("#privacy-error", "Only admins can update privacy and visibility.");
        return;
      }

      const formData = new FormData();
      formData.append("privacy", qs("#privacy").value);
      formData.append("visible", String(qs("#visible").checked));

      APP.setButtonLoading(qs("#privacy-submit"), true, "Saving...");
      try {
        state.group = await updateGroup(groupId, formData);
        state.permissions = buildPermissions(state.group, state.profile, state.role);
        renderPage(state);
        setMessage("#privacy-success", "Privacy and visibility updated.");
        APP.showToast("Group privacy updated", "success");
      } catch (err) {
        setMessage("#privacy-error", err.message || "Failed to update privacy.");
        APP.showToast(err.message || "Failed to update privacy.", "error");
      } finally {
        APP.setButtonLoading(qs("#privacy-submit"), false);
      }
    });

    qs("#media-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      setMessage("#media-error", "");
      setMessage("#media-success", "");

      const formData = new FormData();
      const groupFile = groupImageInput.files && groupImageInput.files[0] ? groupImageInput.files[0] : null;
      const coverFile = coverImageInput.files && coverImageInput.files[0] ? coverImageInput.files[0] : null;

      if (state.permissions.canEditGroupImage && groupFile) {
        formData.append("group_image", groupFile);
      }
      if (state.permissions.canEditCover && coverFile) {
        formData.append("cover_image", coverFile);
      }

      if (!formData.has("group_image") && !formData.has("cover_image")) {
        setMessage("#media-error", "Choose at least one new image to upload.");
        return;
      }

      APP.setButtonLoading(qs("#media-submit"), true, "Saving...");
      try {
        state.group = await updateGroup(groupId, formData);
        state.permissions = buildPermissions(state.group, state.profile, state.role);
        renderPage(state);
        resetMediaFileInputs();
        refreshGroupImagePreview(state);
        refreshCoverPreview(state);
        setMessage("#media-success", "Group images updated.");
        APP.showToast("Group images updated", "success");
      } catch (err) {
        setMessage("#media-error", err.message || "Failed to update images.");
        APP.showToast(err.message || "Failed to update images.", "error");
      } finally {
        APP.setButtonLoading(qs("#media-submit"), false);
      }
    });

    qs("#rules-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      setMessage("#rules-error", "");
      setMessage("#rules-success", "");

      if (!state.permissions.canEditRules) {
        setMessage("#rules-error", "Only admins and moderators can update group rules.");
        return;
      }

      if (!validateRules(state)) {
        setMessage("#rules-error", "Please fix the highlighted fields.");
        return;
      }

      APP.setButtonLoading(qs("#rules-submit"), true, "Saving...");
      try {
        const payload = buildRulesPayload(state);
        state.settings = state.settings
          ? await GroupSettingsAPI.update(groupId, payload)
          : await GroupSettingsAPI.create(payload);
        renderPage(state);
        setMessage("#rules-success", "Group rules saved.");
        APP.showToast("Group rules updated", "success");
      } catch (err) {
        setMessage("#rules-error", err.message || "Failed to save group rules.");
        APP.showToast(err.message || "Failed to save group rules.", "error");
      } finally {
        APP.setButtonLoading(qs("#rules-submit"), false);
      }
    });
  }

  function redirectLegacyDetailPage() {
    const groupId = getGroupId();
    APP.navigate(groupId ? `group_settings.html?group_id=${groupId}` : "my_groups.html");
  }

  document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page || "";
    if (page === "group_settings") initGroupSettingsPage();
    if (page === "group_settings_detail") redirectLegacyDetailPage();
  });
})();
