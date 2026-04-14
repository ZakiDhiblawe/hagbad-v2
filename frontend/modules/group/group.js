(function () {
  const PAGE_SIZE = 6;

  function qs(sel) { return document.querySelector(sel); }
  function text(el, value) { if (el) el.textContent = value; }

  function getGroupIdFromUrl() {
    const u = new URL(window.location.href);
    return u.searchParams.get("id");
  }

  function getGroupModeFromUrl() {
    const u = new URL(window.location.href);
    return u.searchParams.get("mode");
  }

  function debounce(fn, waitMs) {
    let timeoutId = null;
    return (...args) => {
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => fn(...args), waitMs);
    };
  }

  function getMyGroupsPath() {
    return `${window.APP.getRootPrefix()}pages/my_groups.html`;
  }

  function getExploreGroupsPath() {
    return `${window.APP.getRootPrefix()}pages/explore_groups.html`;
  }

  function getAddGroupPath() {
    return `${window.APP.getRootPrefix()}pages/add_group.html`;
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

  function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function capitalize(value) {
    if (!value) return "";
    return String(value).charAt(0).toUpperCase() + String(value).slice(1);
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

  function getDefaultGroupImage() {
    return `${window.APP.getRootPrefix()}assets/images/logos/favicon.png`;
  }

  function getGroupImageUrl(group) {
    return group && group.group_image ? window.APP.buildApiUrl(group.group_image) : getDefaultGroupImage();
  }

  function getGroupCoverUrl(group) {
    return group && group.cover_image ? window.APP.buildApiUrl(group.cover_image) : "";
  }

  async function ensureProfile() {
    const token = window.APP.requireAuthOrRedirect();
    if (!token) return null;

    try {
      const profile = await window.APP.fetchCurrentUser(true);
      window.APP.setStoredProfile(profile);
      return profile;
    } catch (e) {
      if (e.status === 401) {
        window.APP.clearToken();
        window.APP.showToast("Session expired. Please log in again.", "info");
        window.APP.navigate(`${window.APP.getRootPrefix()}pages/login.html`);
        return null;
      }
      throw e;
    }
  }

  function mountWorkspaceMenu(profile) {
    const mount = qs("#workspace-user-menu");
    if (!mount) return;
    window.APP.mountUserMenu(mount, profile, { compact: false });
  }

  function createBadge(textValue, tone) {
    const badge = document.createElement("span");
    badge.className = `group-card-badge ${tone}`;
    badge.textContent = textValue;
    return badge;
  }

  function createCardLink(label, href, className = "btn portal-btn-secondary group-card-btn") {
    const link = document.createElement("a");
    link.className = className;
    link.href = href;
    link.textContent = label;
    return link;
  }

  function createCardButton(label, onClick, options = {}) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = options.className || "btn portal-btn-primary group-card-btn";
    btn.textContent = label;
    if (options.disabled) btn.disabled = true;
    if (typeof onClick === "function") {
      btn.addEventListener("click", () => onClick(btn));
    }
    return btn;
  }

  function buildGroupCard(group, options = {}) {
    const article = document.createElement("article");
    article.className = "group-card";

    const cover = document.createElement("div");
    cover.className = "group-card-cover";
    const coverUrl = getGroupCoverUrl(group);
    if (coverUrl) {
      cover.style.backgroundImage = `linear-gradient(180deg, rgba(8, 24, 48, 0.08), rgba(8, 24, 48, 0.42)), url("${coverUrl}")`;
      cover.classList.add("has-image");
    } else {
      cover.classList.add("no-image");
      const coverFallback = document.createElement("span");
      coverFallback.className = "group-card-cover-fallback";
      coverFallback.textContent = getInitials(group.name);
      cover.appendChild(coverFallback);
    }

    const avatar = document.createElement("img");
    avatar.className = "group-card-avatar";
    avatar.src = getGroupImageUrl(group);
    avatar.alt = `${group.name} group image`;
    avatar.onerror = () => {
      avatar.onerror = null;
      avatar.src = getDefaultGroupImage();
    };

    const body = document.createElement("div");
    body.className = "group-card-body";

    const top = document.createElement("div");
    top.className = "group-card-top";

    const title = document.createElement("h3");
    title.className = "group-card-title";
    title.textContent = group.name;

    const created = document.createElement("span");
    created.className = "group-card-date";
    created.textContent = `Created ${formatDate(group.created_at)}`;

    top.appendChild(title);
    top.appendChild(created);

    const description = document.createElement("p");
    description.className = "group-card-description";
    description.textContent = group.description || "No description added for this group yet.";

    const badgeRow = document.createElement("div");
    badgeRow.className = "group-card-badges";
    badgeRow.appendChild(createBadge(capitalize(group.privacy), group.privacy === "private" ? "private" : "public"));
    badgeRow.appendChild(createBadge(group.visible ? "Visible" : "Hidden", group.visible ? "visible" : "hidden"));
    badgeRow.appendChild(createBadge(capitalize(group.status), group.status === "closed" ? "closed" : "active"));

    const meta = document.createElement("div");
    meta.className = "group-card-meta";
    meta.textContent = options.metaText || `Creator #${group.created_by}`;

    const actions = document.createElement("div");
    actions.className = "group-card-actions";
    (options.actions || []).forEach((action) => actions.appendChild(action));

    body.appendChild(top);
    body.appendChild(description);
    body.appendChild(badgeRow);
    body.appendChild(meta);
    body.appendChild(actions);

    article.appendChild(cover);
    article.appendChild(avatar);
    article.appendChild(body);
    return article;
  }

  function renderEmpty(mount, title, subtitle, action = null) {
    if (!mount) return;
    mount.innerHTML = "";

    const empty = document.createElement("div");
    empty.className = "group-empty-state";

    const heading = document.createElement("strong");
    heading.textContent = title;

    const note = document.createElement("span");
    note.textContent = subtitle;

    empty.appendChild(heading);
    empty.appendChild(note);

    if (action) {
      empty.appendChild(createCardLink(action.label, action.href, `btn ${action.tone || "portal-btn-primary"} group-empty-action`));
    }

    mount.appendChild(empty);
  }

  async function initGroupListPage(mode) {
    const profile = await ensureProfile();
    if (!profile) return;
    mountWorkspaceMenu(profile);

    let page = 1;
    let pendingRequestGroupIds = new Set();

    const list = qs("#groups-list");
    const status = qs("#groups-status");
    const prevBtn = qs("#groups-prev");
    const nextBtn = qs("#groups-next");
    const pageLabel = qs("#groups-page-label");
    const refreshBtn = qs("#refresh-groups");
    const scopeLabel = qs("#groups-scope-label");
    const countLabel = qs("#groups-loaded-count");
    const filterForm = qs("#groups-filter-form");
    const searchInput = qs("#groups-search");
    const managedToggle = qs("#groups-managed-toggle");
    const clearBtn = qs("#groups-clear");

    function setStatus(message) {
      text(status, message || "");
    }

    function setScopeState(stateClass, label) {
      if (!scopeLabel) return;
      scopeLabel.className = `status-chip ${stateClass}`;
      scopeLabel.textContent = label;
    }

    function setCount(count) {
      if (!countLabel) return;
      const isFiltered = Boolean(searchInput && searchInput.value.trim()) || Boolean(managedToggle && managedToggle.checked);
      countLabel.textContent = count === 0
        ? (isFiltered ? "No matching groups" : "No groups on this page")
        : `${count} ${isFiltered ? "matching " : ""}group${count === 1 ? "" : "s"} on this page`;
    }

    async function loadPendingJoinRequests() {
      if (mode !== "explore" || !window.JoinRequestAPI || typeof window.JoinRequestAPI.listMyJoinRequests !== "function") {
        pendingRequestGroupIds = new Set();
        return;
      }

      try {
        const items = await window.JoinRequestAPI.listMyJoinRequests();
        pendingRequestGroupIds = new Set(
          items
            .filter((item) => item.status === "pending")
            .map((item) => Number(item.group_id))
        );
      } catch {
        pendingRequestGroupIds = new Set();
      }
    }

    function renderMyGroups(items) {
      list.innerHTML = "";

      if (!items.length) {
        renderEmpty(
          list,
          searchInput && searchInput.value.trim()
            ? "No groups match this search."
            : "No groups yet.",
          managedToggle && managedToggle.checked
            ? "Try turning off Mine or changing the search text."
            : "Groups you create or join will appear here."
        );
        return;
      }

      items.forEach((group) => {
        let metaText = "You already belong to this group.";
        if (Number(group.created_by) === Number(profile.id)) {
          metaText = "You created this group and manage it.";
        } else if (managedToggle && managedToggle.checked) {
          metaText = "You manage this group as an admin or moderator.";
        }

        list.appendChild(
          buildGroupCard(group, {
            metaText,
            actions: [
              createCardLink("View", `group_detail.html?id=${group.id}`),
            ],
          })
        );
      });
    }

    function renderExploreGroups(items) {
      list.innerHTML = "";

      if (!items.length) {
        renderEmpty(
          list,
          searchInput && searchInput.value.trim()
            ? "No groups match this search."
            : "No groups to explore.",
          "Visible groups outside your memberships will appear here.",
        );
        return;
      }

      items.forEach((group) => {
        const actions = [];

        if (group.status !== "active") {
          actions.push(
            createCardButton("Closed", null, {
              className: "btn portal-btn-secondary group-card-btn",
              disabled: true,
            })
          );
        } else if (group.privacy === "public") {
          actions.push(
            createCardButton("Join", async (btn) => {
              window.APP.setButtonLoading(btn, true, "Joining...");
              try {
                await window.GroupAPI.joinGroup(group.id);
                window.APP.showToast(`Joined "${group.name}"`, "success");
                if (page > 1 && list.children.length === 1) page -= 1;
                await loadGroups();
              } catch (err) {
                window.APP.showToast(err.message || "Failed to join group.", "error");
              } finally {
                window.APP.setButtonLoading(btn, false);
              }
            })
          );
        } else if (pendingRequestGroupIds.has(Number(group.id))) {
          actions.push(
            createCardButton("Request pending", null, {
              className: "btn portal-btn-secondary group-card-btn",
              disabled: true,
            })
          );
        } else {
          actions.push(
            createCardButton("Request to Join", async (btn) => {
              window.APP.setButtonLoading(btn, true, "Sending...");
              try {
                await window.JoinRequestAPI.createJoinRequest({ group_id: group.id });
                pendingRequestGroupIds.add(Number(group.id));
                window.APP.showToast("Join request sent", "success");
                renderExploreGroups(items);
              } catch (err) {
                window.APP.showToast(err.message || "Failed to send request.", "error");
              } finally {
                window.APP.setButtonLoading(btn, false);
              }
            })
          );
        }

        const metaText = group.privacy === "private"
          ? "Visible private group. Request approval to join."
          : "Visible public group. Join instantly.";

        list.appendChild(
          buildGroupCard(group, {
            metaText,
            actions,
          })
        );
      });
    }

    async function loadGroups() {
      setScopeState("status-loading", mode === "explore" ? "Explore Groups" : "My Groups");
      setStatus(mode === "explore" ? "Loading explore groups..." : "Loading your groups...");

      try {
        await loadPendingJoinRequests();
        const items = await window.GroupAPI.listGroups({
          mine: mode === "mine",
          explore: mode === "explore",
          page,
          size: PAGE_SIZE,
          search: searchInput ? searchInput.value.trim() : "",
          managed: managedToggle ? managedToggle.checked : false,
        });

        if (mode === "explore") renderExploreGroups(items);
        else renderMyGroups(items);

        text(pageLabel, `Page ${page}`);
        if (prevBtn) prevBtn.disabled = page <= 1;
        if (nextBtn) nextBtn.disabled = items.length < PAGE_SIZE;
        setCount(items.length);
        setScopeState("status-ok", mode === "explore" ? "Explore Groups" : "My Groups");
        setStatus(items.length ? `Loaded ${items.length} group${items.length === 1 ? "" : "s"}.` : "Nothing to show on this page.");
      } catch (err) {
        setCount(0);
        setScopeState("status-down", "Unavailable");
        setStatus(err.message || "Failed to load groups.");
        window.APP.showToast(err.message || "Failed to load groups.", "error");
      }
    }

    const debouncedLoadGroups = debounce(() => {
      page = 1;
      loadGroups();
    }, 260);

    if (refreshBtn) refreshBtn.addEventListener("click", () => loadGroups());
    if (filterForm) {
      filterForm.addEventListener("submit", (event) => {
        event.preventDefault();
        page = 1;
        loadGroups();
      });
    }
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        debouncedLoadGroups();
      });
    }
    if (managedToggle) {
      managedToggle.addEventListener("change", () => {
        page = 1;
        loadGroups();
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        if (searchInput) searchInput.value = "";
        if (managedToggle) managedToggle.checked = false;
        page = 1;
        loadGroups();
      });
    }
    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        if (page > 1) {
          page -= 1;
          loadGroups();
        }
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        page += 1;
        loadGroups();
      });
    }

    loadGroups();
  }

  function updatePreviewFileName(mount, file) {
    if (!mount) return;
    mount.textContent = file ? file.name : "No file selected";
  }

  function bindObjectPreview(input, onFile, onEmpty) {
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

  async function initAddGroupPage() {
    const profile = await ensureProfile();
    if (!profile) return;
    mountWorkspaceMenu(profile);

    const form = qs("#create-form");
    const nameInput = qs("#name");
    const privacyInput = qs("#privacy");
    const visibleInput = qs("#visible");
    const descInput = qs("#description");
    const groupImageInput = qs("#group_image");
    const coverImageInput = qs("#cover_image");
    const submitBtn = qs("#create-submit");

    const previewName = qs("#group-preview-name");
    const previewDescription = qs("#group-preview-description");
    const previewPrivacy = qs("#group-preview-privacy");
    const previewVisible = qs("#group-preview-visible");
    const previewMeta = qs("#group-preview-meta");
    const previewInitials = qs("#group-preview-initials");
    const previewImage = qs("#group-preview-image");
    const previewCover = qs("#group-preview-cover");
    const groupImageFileName = qs("#group-image-file-name");
    const coverImageFileName = qs("#cover-image-file-name");

    function syncPreviewText() {
      const name = nameInput.value.trim();
      const description = descInput.value.trim();
      const privacy = privacyInput.value === "private" ? "Private" : "Public";
      const visible = visibleInput.checked;

      text(previewName, name || "New group name");
      text(
        previewDescription,
        description || "Add a short group description to help members understand the purpose."
      );
      text(previewInitials, getInitials(name || "Hagbad Group"));

      previewPrivacy.textContent = privacy;
      previewPrivacy.className = `group-card-badge ${privacyInput.value === "private" ? "private" : "public"}`;

      previewVisible.textContent = visible ? "Visible" : "Hidden";
      previewVisible.className = `group-card-badge ${visible ? "visible" : "hidden"}`;

      if (privacyInput.value === "private" && visible) {
        text(previewMeta, "Visible private group. Members can request access after they discover it.");
      } else if (privacyInput.value === "private") {
        text(previewMeta, "Hidden private group. Only invited or directly managed members can reach it.");
      } else if (visible) {
        text(previewMeta, "Visible public group. Members can join immediately from Explore Groups.");
      } else {
        text(previewMeta, "Hidden public group. It stays out of Explore Groups until you make it visible.");
      }
    }

    function resetAvatarPreview() {
      if (!previewImage) return;
      previewImage.src = getDefaultGroupImage();
    }

    function resetCoverPreview() {
      if (!previewCover) return;
      previewCover.style.backgroundImage = "";
      previewCover.classList.add("no-image");
      previewCover.classList.remove("has-image");
      if (previewInitials) previewInitials.hidden = false;
    }

    const applyGroupImagePreview = bindObjectPreview(
      groupImageInput,
      (url, file) => {
        if (previewImage) previewImage.src = url;
        updatePreviewFileName(groupImageFileName, file);
      },
      () => {
        resetAvatarPreview();
        updatePreviewFileName(groupImageFileName, null);
      }
    );

    const applyCoverPreview = bindObjectPreview(
      coverImageInput,
      (url, file) => {
        if (previewCover) {
          previewCover.style.backgroundImage = `linear-gradient(180deg, rgba(8, 24, 48, 0.08), rgba(8, 24, 48, 0.42)), url("${url}")`;
          previewCover.classList.add("has-image");
          previewCover.classList.remove("no-image");
        }
        if (previewInitials) previewInitials.hidden = true;
        updatePreviewFileName(coverImageFileName, file);
      },
      () => {
        resetCoverPreview();
        updatePreviewFileName(coverImageFileName, null);
      }
    );

    [nameInput, descInput].forEach((input) => {
      input.addEventListener("input", syncPreviewText);
    });
    privacyInput.addEventListener("change", syncPreviewText);
    visibleInput.addEventListener("change", syncPreviewText);

    form.addEventListener("reset", () => {
      window.setTimeout(() => {
        setFormError("");
        setFormSuccess("");
        window.APP.clearFieldError(nameInput);
        applyGroupImagePreview();
        applyCoverPreview();
        syncPreviewText();
      }, 0);
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      setFormError("");
      setFormSuccess("");
      window.APP.clearFieldError(nameInput);

      const name = nameInput.value.trim();
      const privacy = privacyInput.value;
      const visible = visibleInput.checked;
      const description = descInput.value.trim();

      if (name.length < 2) {
        window.APP.setFieldError(nameInput, "Name must be at least 2 characters.");
        setFormError("Please fix the highlighted field.");
        return;
      }

      window.APP.setButtonLoading(submitBtn, true, "Creating...");

      try {
        const created = await window.GroupAPI.createGroup({
          name,
          privacy,
          visible,
          description: description || null,
          groupImageFile: groupImageInput.files && groupImageInput.files[0] ? groupImageInput.files[0] : null,
          coverImageFile: coverImageInput.files && coverImageInput.files[0] ? coverImageInput.files[0] : null,
        });

        setFormSuccess(`"${created.name}" was created. Redirecting to My Groups...`);
        window.APP.showToast("Group created", "success");
        window.setTimeout(() => {
          window.APP.navigate(getMyGroupsPath());
        }, 900);
      } catch (err) {
        setFormError(err.message || "Failed to create group.");
        window.APP.showToast(err.message || "Failed to create group.", "error");
      } finally {
        window.APP.setButtonLoading(submitBtn, false);
      }
    });

    resetAvatarPreview();
    resetCoverPreview();
    updatePreviewFileName(groupImageFileName, null);
    updatePreviewFileName(coverImageFileName, null);
    syncPreviewText();
  }

  async function initGroupDetailPage() {
    if (!window.APP.requireAuthOrRedirect()) return;

    const id = Number(getGroupIdFromUrl() || 0);
    const mode = getGroupModeFromUrl();
    if (!id) {
      window.APP.showToast("Missing group id", "error");
      return;
    }

    const profile = await ensureProfile();
    if (!profile) return;
    mountWorkspaceMenu(profile);

    const group = await window.GroupAPI.getGroup(id);
    const isEditMode = mode === "edit";
    const isCreator = Number(group.created_by) === Number(profile.id);

    function setHref(selector, href) {
      const el = qs(selector);
      if (el) el.href = href;
    }

    function setSummaryValue(selector, value) {
      text(qs(selector), value);
    }

    function createContextBadge(label, tone) {
      return createBadge(label, tone);
    }

    function applyGroupSurface(currentGroup) {
      const hero = qs("#group-hero");
      const heroAvatar = qs("#group-hero-avatar");
      const snapshotImage = qs("#group-snapshot-image");
      const coverUrl = getGroupCoverUrl(currentGroup);
      const groupImageUrl = getGroupImageUrl(currentGroup);

      if (hero) {
        hero.style.backgroundImage = coverUrl
          ? `linear-gradient(120deg, rgba(8, 24, 48, 0.72), rgba(11, 69, 157, 0.68)), url("${coverUrl}")`
          : "";
      }

      [heroAvatar, snapshotImage].forEach((img) => {
        if (!img) return;
        img.src = groupImageUrl;
        img.onerror = () => {
          img.onerror = null;
          img.src = getDefaultGroupImage();
        };
      });
    }

    function renderOverview(currentGroup, membershipRole = null) {
      document.title = `${currentGroup.name} | Group Workspace | Hagbad`;
      text(qs("#g-name"), currentGroup.name);
      text(qs("#page-title"), isEditMode ? "Edit Group" : "Dashboard");
      text(
        qs("#subtitle"),
        isEditMode
          ? "Update the group details and workspace media."
          : currentGroup.description || "View the live summary and management sections for this group."
      );
      text(qs("#group-description-copy"), currentGroup.description || "No description has been added for this group yet.");
      text(qs("#group-snapshot-name"), currentGroup.name);
      text(
        qs("#group-snapshot-meta"),
        `${capitalize(currentGroup.privacy)} group • ${currentGroup.visible ? "Visible" : "Hidden"} • ${capitalize(currentGroup.status)}`
      );

      const badges = qs("#group-context-badges");
      if (badges) {
        badges.innerHTML = "";
        badges.appendChild(createContextBadge(capitalize(currentGroup.privacy), currentGroup.privacy === "private" ? "private" : "public"));
        badges.appendChild(createContextBadge(currentGroup.visible ? "Visible" : "Hidden", currentGroup.visible ? "visible" : "hidden"));
        badges.appendChild(createContextBadge(capitalize(currentGroup.status), currentGroup.status === "closed" ? "closed" : "active"));
        if (membershipRole) {
          badges.appendChild(createContextBadge(`Role: ${capitalize(membershipRole)}`, membershipRole === "admin" ? "visible" : "public"));
        } else if (!isCreator) {
          badges.appendChild(createContextBadge("Viewer", "hidden"));
        }
      }

      const grid = qs("#g-grid");
      if (grid) {
        grid.innerHTML = "";
        [
          ["Group ID", currentGroup.id],
          ["Creator ID", currentGroup.created_by],
          ["Privacy", capitalize(currentGroup.privacy)],
          ["Visible in explore", currentGroup.visible ? "Yes" : "No"],
          ["Status", capitalize(currentGroup.status)],
          ["Created", currentGroup.created_at ? new Date(currentGroup.created_at).toLocaleString() : "-"],
          ["Description", currentGroup.description || "-"],
        ].forEach(([k, v]) => {
          const dt = document.createElement("dt");
          dt.textContent = k;
          const dd = document.createElement("dd");
          dd.textContent = String(v);
          grid.appendChild(dt);
          grid.appendChild(dd);
        });
      }

      const roleChip = qs("#group-role-note");
      if (roleChip) {
        if (isCreator) {
          roleChip.className = "status-chip status-ok";
          roleChip.textContent = "Creator access";
        } else if (membershipRole === "admin") {
          roleChip.className = "status-chip status-ok";
          roleChip.textContent = "Admin access";
        } else if (membershipRole === "moderator") {
          roleChip.className = "status-chip status-ok";
          roleChip.textContent = "Moderator access";
        } else if (membershipRole === "member") {
          roleChip.className = "status-chip status-loading";
          roleChip.textContent = "Member access";
        } else {
          roleChip.className = "status-chip status-down";
          roleChip.textContent = "Viewer access";
        }
      }

      const note = qs("#creator-note");
      if (note) {
        if (isCreator) {
          text(note, isEditMode
            ? "You are editing this group as the creator."
            : "You are the creator of this group. Use edit mode when you need to update the group or close it.");
        } else if (membershipRole) {
          text(note, `You belong to this group as ${membershipRole}. Some management pages may still require creator or admin access.`);
        } else {
          text(note, "You can view this group, but member-only management pages may remain restricted.");
        }
      }

      applyGroupSurface(currentGroup);
    }

    async function loadSummary() {
      let members = [];
      let cycles = [];
      let membershipRole = null;
      let totalPayments = 0;
      let totalPayouts = 0;
      let pendingJoinRequests = null;
      let activeInviteCount = null;

      try {
        members = await window.GroupMemberAPI.listMembers({ group_id: id, page: 1, size: 100 });
        const me = members.find((item) => Number(item.user_id) === Number(profile.id));
        membershipRole = me ? me.role : null;
      } catch {
        members = [];
      }

      try {
        cycles = await window.CycleAPI.listForGroup(id, { page: 1, size: 100 });
      } catch {
        cycles = [];
      }

      if (cycles.length) {
        const paymentSummaries = await Promise.all(
          cycles.map(async (cycle) => {
            try {
              return await window.PaymentAPI.getSummary(cycle.id);
            } catch {
              return null;
            }
          })
        );

        const payoutSummaries = await Promise.all(
          cycles.map(async (cycle) => {
            try {
              return await window.PayoutAPI.getSummary(cycle.id);
            } catch {
              return null;
            }
          })
        );

        totalPayments = paymentSummaries.reduce((sum, item) => {
          if (!item) return sum;
          return sum + Number(item.due_count || 0) + Number(item.paid_count || 0) + Number(item.late_count || 0);
        }, 0);

        totalPayouts = payoutSummaries.reduce((sum, item) => {
          if (!item) return sum;
          return sum
            + Number(item.pending_count || 0)
            + Number(item.approved_count || 0)
            + Number(item.rejected_count || 0)
            + Number(item.paid_count || 0);
        }, 0);
      }

      try {
        const pendingItems = await window.JoinRequestAPI.listGroupJoinRequests(id, "pending");
        pendingJoinRequests = pendingItems.length;
      } catch (err) {
        pendingJoinRequests = err && err.status === 403 ? null : 0;
      }

      try {
        const invites = await window.InviteAPI.listInvites(id);
        activeInviteCount = invites.filter((invite) => {
          if (invite.used) return false;
          if (!invite.expires_at) return true;
          const dt = new Date(invite.expires_at);
          return Number.isFinite(dt.getTime()) && dt.getTime() > Date.now();
        }).length;
      } catch (err) {
        activeInviteCount = err && err.status === 403 ? null : 0;
      }

      const activeCycles = cycles.filter((cycle) => cycle.status === "active");
      const canCreateCycle = isCreator || membershipRole === "admin";
      const workspaceLinks = window.APP.applyGroupWorkspaceNav({
        groupId: id,
        activeKey: isEditMode ? "update" : "dashboard",
        pageTitle: isEditMode ? "Update Group" : "Dashboard",
        canUpdateGroup: isCreator,
        canCreateCycle,
      }) || {};

      setHref("#quick-settings", workspaceLinks.settings || `group_settings.html?group_id=${id}`);
      setHref("#quick-members", workspaceLinks.members || `group_members.html?group_id=${id}`);
      setHref("#quick-requests", workspaceLinks.requests || `group_review.html?group_id=${id}`);
      setHref("#quick-invites", workspaceLinks.invites || `invites.html?group_id=${id}`);
      setHref("#open-cycles", workspaceLinks.cycles || `cycles.html?group_id=${id}`);

      setSummaryValue("#summary-active-cycles", String(activeCycles.length));
      setSummaryValue("#summary-total-members", members.length ? String(members.length) : (isCreator ? "1" : "-"));
      setSummaryValue("#summary-total-payments", String(totalPayments));
      setSummaryValue("#summary-total-payouts", String(totalPayouts));
      setSummaryValue("#summary-join-requests", pendingJoinRequests === null ? "Locked" : String(pendingJoinRequests));
      setSummaryValue("#summary-invites", activeInviteCount === null ? "Locked" : String(activeInviteCount));

      renderOverview(group, membershipRole);
    }

    setHref("#back-to-groups", "my_groups.html");
    setHref("#exit-edit-mode", `group_detail.html?id=${id}`);

    const editArea = qs("#edit-area");
    const editModeLink = qs("#open-edit-mode");
    if (editModeLink) {
      editModeLink.hidden = !isCreator;
      editModeLink.href = `group_detail.html?id=${id}&mode=edit`;
    }

    await loadSummary();

    if (!isCreator) {
      if (editArea) editArea.hidden = true;
      return;
    }

    text(
      qs("#creator-note"),
      isEditMode
        ? "You are editing this group as the creator."
        : "You are the creator of this group. Open edit mode when you need to update the group or close it."
    );

    if (editArea) editArea.hidden = !isEditMode;
    if (!isEditMode) return;

    const nameInput = qs("#name");
    const privacyInput = qs("#privacy");
    const descInput = qs("#description");
    const visibleInput = qs("#visible");
    const groupImageInput = qs("#group_image");
    const coverImageInput = qs("#cover_image");
    const removeGroupImageInput = qs("#remove_group_image");
    const removeCoverImageInput = qs("#remove_cover_image");

    if (nameInput) nameInput.value = group.name;
    if (privacyInput) privacyInput.value = group.privacy;
    if (descInput) descInput.value = group.description || "";
    if (visibleInput) visibleInput.checked = !!group.visible;

    qs("#edit-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      setFormError("");
      setFormSuccess("");

      const name = qs("#name").value.trim();
      const privacy = qs("#privacy").value;
      const description = qs("#description").value.trim();

      if (name.length < 2) {
        window.APP.setFieldError(qs("#name"), "Name must be at least 2 characters.");
        setFormError("Please fix the highlighted fields.");
        return;
      }
      window.APP.clearFieldError(qs("#name"));

      const payload = { name, privacy, description: description || null };
      if (visibleInput) payload.visible = visibleInput.checked;
      if (groupImageInput && groupImageInput.files && groupImageInput.files[0]) payload.groupImageFile = groupImageInput.files[0];
      if (coverImageInput && coverImageInput.files && coverImageInput.files[0]) payload.coverImageFile = coverImageInput.files[0];
      if (removeGroupImageInput) payload.removeGroupImage = removeGroupImageInput.checked;
      if (removeCoverImageInput) payload.removeCoverImage = removeCoverImageInput.checked;

      window.APP.setButtonLoading(qs("#save"), true, "Saving...");
      try {
        const updated = await window.GroupAPI.updateGroup(id, payload);
        setFormSuccess("Saved.");
        window.APP.showToast("Group updated", "success");
        renderOverview(updated, "admin");
      } catch (err) {
        setFormError(err.message || "Update failed.");
        window.APP.showToast(err.message || "Update failed.", "error");
      } finally {
        window.APP.setButtonLoading(qs("#save"), false);
      }
    });

    qs("#close").addEventListener("click", async () => {
      if (!window.confirm("Close this group? This will set status to closed.")) return;

      window.APP.setButtonLoading(qs("#close"), true, "Closing...");
      try {
        const updated = await window.GroupAPI.closeGroup(id);
        window.APP.showToast("Group closed", "success");
        renderOverview(updated, "admin");
      } catch (err) {
        window.APP.showToast(err.message || "Close failed.", "error");
      } finally {
        window.APP.setButtonLoading(qs("#close"), false);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page || "";
    if (page === "my_groups") initGroupListPage("mine");
    if (page === "explore_groups") initGroupListPage("explore");
    if (page === "add_group") initAddGroupPage();
    if (page === "group_detail") initGroupDetailPage();
  });
})();
