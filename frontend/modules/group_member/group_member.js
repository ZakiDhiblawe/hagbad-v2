(function () {
  const PAGE_SIZE = 100;

  function qs(sel) { return document.querySelector(sel); }
  function text(el, value) { if (el) el.textContent = value || ""; }
  function show(el, yes) { if (el) el.hidden = !yes; }
  function empty(el) { if (el) el.innerHTML = ""; }

  function mountWorkspaceMenu(profile) {
    const mount = qs("#workspace-user-menu");
    if (!mount || !profile) return;
    APP.mountUserMenu(mount, profile, { compact: false });
  }

  function applyGroupWorkspace(profile, group, role, pageTitle) {
    if (!group || !profile) return;
    mountWorkspaceMenu(profile);
    APP.applyGroupWorkspaceNav({
      groupId: group.id,
      activeKey: "members",
      pageTitle,
      canUpdateGroup: Number(group.created_by) === Number(profile.id),
      canCreateCycle: Number(group.created_by) === Number(profile.id) || role === "admin",
    });
  }

  function qparam(name) {
    return new URL(window.location.href).searchParams.get(name);
  }

  function setPageError(message) {
    const el = qs("#page-error");
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || "";
  }

  function setFormError(message) {
    const el = qs("#form-error");
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || "";
  }

  function setFormSuccess(message) {
    const el = qs("#form-success");
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || "";
  }

  function setInlineButtonLoading(btn, loading, label) {
    if (!btn) return;
    if (loading) {
      btn.dataset.originalHtml = btn.innerHTML;
      btn.innerHTML = `<span>${label}</span>`;
      btn.disabled = true;
      return;
    }
    btn.innerHTML = btn.dataset.originalHtml || btn.innerHTML;
    btn.disabled = false;
  }

  async function fetchGroup(groupId) {
    const res = await fetch(`${APP.getApiBase()}/groups/${groupId}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${APP.getToken()}` },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const message = data && typeof data.detail === "string"
        ? data.detail
        : `Failed to load group (${res.status})`;
      throw { status: res.status, message };
    }
    return data;
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

  async function myRole(groupId, myId) {
    for (let page = 1; page <= 50; page += 1) {
      const items = await GroupMemberAPI.listMembers({ group_id: groupId, page, size: PAGE_SIZE });
      const me = items.find((member) => Number(member.user_id) === Number(myId));
      if (me) return me.role;
      if (items.length < PAGE_SIZE) break;
    }
    return null;
  }

  async function fetchAllMembers(groupId) {
    const members = [];
    for (let page = 1; page <= 50; page += 1) {
      const batch = await GroupMemberAPI.listMembers({ group_id: groupId, page, size: PAGE_SIZE });
      members.push(...batch);
      if (batch.length < PAGE_SIZE) break;
    }
    return members;
  }

  function formatDate(value) {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleString();
  }

  function roleLabel(role) {
    if (role === "admin") return "Admin";
    if (role === "moderator") return "Moderator";
    return "Member";
  }

  function sortMembers(items) {
    return [...items].sort((a, b) => {
      const aTime = new Date(a.joined_at).getTime();
      const bTime = new Date(b.joined_at).getTime();
      if (aTime !== bTime) return aTime - bTime;
      return Number(a.id) - Number(b.id);
    });
  }

  function createBadge(label, tone = "info") {
    const badge = document.createElement("span");
    badge.className = `badge ${tone}`;
    badge.textContent = label;
    return badge;
  }

  function createContextChip(label, tone = "neutral") {
    const chip = document.createElement("span");
    chip.className = `member-context-chip ${tone}`;
    chip.textContent = label;
    return chip;
  }

  function getSummaryCounts(members) {
    return members.reduce((acc, member) => {
      acc.total += 1;
      if (member.role === "admin") acc.admin += 1;
      else if (member.role === "moderator") acc.moderator += 1;
      else acc.member += 1;
      return acc;
    }, { total: 0, admin: 0, moderator: 0, member: 0 });
  }

  function canManageMember(state, member) {
    if (!state.canManage) return false;
    if (Number(member.user_id) === Number(state.profile.id)) return false;
    if (Number(member.user_id) === Number(state.group.created_by)) return false;
    return true;
  }

  function makeActionButton(iconClass, label, tone, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `member-action-btn ${tone}`;
    button.innerHTML = `<i class="${iconClass}"></i><span>${label}</span>`;
    button.addEventListener("click", () => onClick(button));
    return button;
  }

  function memberImageUrl(member) {
    return APP.getProfileImageUrl({ profile_image: member.profile_image });
  }

  function renderTopMeta(state, membership) {
    text(qs("#group-name"), state.group.name);
    text(qs("#group-subtitle"), "Manage who leads, moderates, and participates in this group.");

    const mount = qs("#group-badges");
    empty(mount);
    if (!mount) return;

    const items = [
      createContextChip(`Group #${state.group.id}`, "neutral"),
      createContextChip(state.group.privacy === "private" ? "Private group" : "Public group", state.group.privacy),
      createContextChip(state.group.status === "closed" ? "Closed" : "Active", state.group.status),
    ];

    if (membership) {
      items.push(createContextChip(`Your role: ${roleLabel(membership.role)}`, membership.role));
    } else if (Number(state.group.created_by) === Number(state.profile.id)) {
      items.push(createContextChip("Creator view", "admin"));
    }

    items.forEach((item) => mount.appendChild(item));
  }

  function renderSummary(members) {
    const counts = getSummaryCounts(members);
    text(qs("#summary-total"), String(counts.total));
    text(qs("#summary-admins"), String(counts.admin));
    text(qs("#summary-moderators"), String(counts.moderator));
    text(qs("#summary-members"), String(counts.member));
    text(qs("#admins-count"), `${counts.admin} admin${counts.admin === 1 ? "" : "s"}`);
    text(qs("#moderators-count"), `${counts.moderator} moderator${counts.moderator === 1 ? "" : "s"}`);
    text(qs("#members-count"), `${counts.member} member${counts.member === 1 ? "" : "s"}`);
  }

  function renderRoleSection(targetSelector, items, state, config, onChange) {
    const mount = qs(targetSelector);
    empty(mount);
    if (!mount) return;

    if (!items.length) {
      const emptyState = document.createElement("div");
      emptyState.className = "member-empty-state";
      emptyState.textContent = config.emptyText;
      mount.appendChild(emptyState);
      return;
    }

    items.forEach((member) => {
      const article = document.createElement("article");
      article.className = `group-member-card tone-${config.tone}`;

      const main = document.createElement("div");
      main.className = "group-member-main";

      const avatarShell = document.createElement("div");
      avatarShell.className = `group-member-avatar-shell tone-${config.tone}`;

      const avatar = document.createElement("img");
      avatar.className = "group-member-avatar";
      avatar.src = memberImageUrl(member);
      avatar.alt = `${member.full_name || `User #${member.user_id}`} profile image`;
      avatar.onerror = () => {
        avatar.onerror = null;
        avatar.src = APP.getDefaultProfileImage();
      };

      avatarShell.appendChild(avatar);

      const copy = document.createElement("div");
      copy.className = "group-member-copy";

      const heading = document.createElement("div");
      heading.className = "group-member-heading";

      const title = document.createElement("h4");
      title.className = "group-member-name";
      title.textContent = member.full_name || `User #${member.user_id}`;

      const badges = document.createElement("div");
      badges.className = "badge-row";
      badges.appendChild(createBadge(roleLabel(member.role), config.badgeTone));
      if (Number(member.user_id) === Number(state.group.created_by)) {
        badges.appendChild(createBadge("Owner", "ok"));
      }
      if (Number(member.user_id) === Number(state.profile.id)) {
        badges.appendChild(createBadge("You", "info"));
      }

      const meta = document.createElement("p");
      meta.className = "group-member-meta";
      meta.textContent = `Joined ${formatDate(member.joined_at)}`;

      heading.appendChild(title);
      heading.appendChild(badges);
      copy.appendChild(heading);
      copy.appendChild(meta);

      main.appendChild(avatarShell);
      main.appendChild(copy);

      article.appendChild(main);

      const actions = document.createElement("div");
      actions.className = "group-member-actions";

      if (canManageMember(state, member)) {
        if (member.role === "admin") {
          actions.appendChild(makeActionButton("ti ti-shield", "Delegate moderator", "secondary", async (button) => {
            setInlineButtonLoading(button, true, "Saving...");
            try {
              await GroupMemberAPI.updateMember(member.id, "moderator");
              APP.showToast("Admin delegated to moderator", "success");
              await onChange();
            } catch (err) {
              APP.showToast(err.message || "Failed to update member.", "error");
            } finally {
              setInlineButtonLoading(button, false);
            }
          }));

          actions.appendChild(makeActionButton("ti ti-arrow-down", "Remove admin", "danger", async (button) => {
            setInlineButtonLoading(button, true, "Saving...");
            try {
              await GroupMemberAPI.updateMember(member.id, "member");
              APP.showToast("Admin role removed", "success");
              await onChange();
            } catch (err) {
              APP.showToast(err.message || "Failed to update member.", "error");
            } finally {
              setInlineButtonLoading(button, false);
            }
          }));
        } else if (member.role === "moderator") {
          actions.appendChild(makeActionButton("ti ti-crown", "Make admin", "primary", async (button) => {
            setInlineButtonLoading(button, true, "Saving...");
            try {
              await GroupMemberAPI.updateMember(member.id, "admin");
              APP.showToast("Moderator promoted to admin", "success");
              await onChange();
            } catch (err) {
              APP.showToast(err.message || "Failed to update member.", "error");
            } finally {
              setInlineButtonLoading(button, false);
            }
          }));

          actions.appendChild(makeActionButton("ti ti-arrow-down", "Remove moderator", "secondary", async (button) => {
            setInlineButtonLoading(button, true, "Saving...");
            try {
              await GroupMemberAPI.updateMember(member.id, "member");
              APP.showToast("Moderator role removed", "success");
              await onChange();
            } catch (err) {
              APP.showToast(err.message || "Failed to update member.", "error");
            } finally {
              setInlineButtonLoading(button, false);
            }
          }));

          actions.appendChild(makeActionButton("ti ti-user-x", "Remove", "danger", async (button) => {
            if (!window.confirm(`Remove ${member.full_name || `User #${member.user_id}`} from the group?`)) return;
            setInlineButtonLoading(button, true, "Removing...");
            try {
              await GroupMemberAPI.deleteMember(member.id);
              APP.showToast("Member removed", "success");
              await onChange();
            } catch (err) {
              APP.showToast(err.message || "Failed to remove member.", "error");
            } finally {
              setInlineButtonLoading(button, false);
            }
          }));
        } else {
          actions.appendChild(makeActionButton("ti ti-crown", "Make admin", "primary", async (button) => {
            setInlineButtonLoading(button, true, "Saving...");
            try {
              await GroupMemberAPI.updateMember(member.id, "admin");
              APP.showToast("Member promoted to admin", "success");
              await onChange();
            } catch (err) {
              APP.showToast(err.message || "Failed to update member.", "error");
            } finally {
              setInlineButtonLoading(button, false);
            }
          }));

          actions.appendChild(makeActionButton("ti ti-shield", "Make moderator", "secondary", async (button) => {
            setInlineButtonLoading(button, true, "Saving...");
            try {
              await GroupMemberAPI.updateMember(member.id, "moderator");
              APP.showToast("Member promoted to moderator", "success");
              await onChange();
            } catch (err) {
              APP.showToast(err.message || "Failed to update member.", "error");
            } finally {
              setInlineButtonLoading(button, false);
            }
          }));

          actions.appendChild(makeActionButton("ti ti-user-x", "Remove", "danger", async (button) => {
            if (!window.confirm(`Remove ${member.full_name || `User #${member.user_id}`} from the group?`)) return;
            setInlineButtonLoading(button, true, "Removing...");
            try {
              await GroupMemberAPI.deleteMember(member.id);
              APP.showToast("Member removed", "success");
              await onChange();
            } catch (err) {
              APP.showToast(err.message || "Failed to remove member.", "error");
            } finally {
              setInlineButtonLoading(button, false);
            }
          }));
        }
      } else {
        const note = document.createElement("span");
        note.className = "member-action-note";
        if (Number(member.user_id) === Number(state.group.created_by)) {
          note.textContent = "Group owner";
        } else if (Number(member.user_id) === Number(state.profile.id)) {
          note.textContent = "Current member";
        } else {
          note.textContent = "View only";
        }
        actions.appendChild(note);
      }

      article.appendChild(actions);
      mount.appendChild(article);
    });
  }

  async function initGroupMembersPage() {
    if (!APP.requireAuthOrRedirect()) return;

    const groupId = Number(qparam("group_id"));
    if (!groupId || groupId < 1) {
      setPageError("Missing group_id. Open this page like: group_members.html?group_id=1");
      return;
    }

    const profile = await ensureProfile();
    if (!profile) return;

    let group;
    try {
      group = await fetchGroup(groupId);
    } catch (err) {
      setPageError(err.message || "Failed to load group.");
      return;
    }

    const state = {
      profile,
      group,
      canManage: false,
      membership: null,
      members: [],
    };

    const overlay = qs("#modal-overlay");
    const modal = qs("#add-modal");
    const openBtn = qs("#open-add");
    const cancelBtn = qs("#cancel");
    const form = qs("#add-form");
    const exitBtn = qs("#exit-group");

    function openModal() {
      setFormError("");
      overlay.hidden = false;
      modal.hidden = false;
      const userInput = qs("#user_id");
      if (userInput) userInput.focus();
    }

    function closeModal() {
      overlay.hidden = true;
      modal.hidden = true;
      form.reset();
    }

    async function loadMembers() {
      setPageError("");
      text(qs("#list-status"), "Loading members...");

      try {
        const members = await fetchAllMembers(groupId);
        const membership = members.find((member) => Number(member.user_id) === Number(profile.id)) || null;

        state.members = members;
        state.membership = membership;
        state.canManage = Number(group.created_by) === Number(profile.id) || (membership && membership.role === "admin");

        applyGroupWorkspace(profile, group, membership ? membership.role : null, "Members");
        renderTopMeta(state, membership);
        renderSummary(members);

        const admins = sortMembers(members.filter((member) => member.role === "admin"));
        const moderators = sortMembers(members.filter((member) => member.role === "moderator"));
        const ordinary = sortMembers(members.filter((member) => member.role === "member"));

        renderRoleSection("#admins-list", admins, state, {
          tone: "admin",
          badgeTone: "ok",
          emptyText: "No admins are currently assigned to this group.",
        }, loadMembers);
        renderRoleSection("#moderators-list", moderators, state, {
          tone: "moderator",
          badgeTone: "warn",
          emptyText: "No moderators are currently assigned to this group.",
        }, loadMembers);
        renderRoleSection("#members-list", ordinary, state, {
          tone: "member",
          badgeTone: "info",
          emptyText: "No ordinary members are currently assigned to this group.",
        }, loadMembers);

        show(openBtn, state.canManage);

        if (exitBtn) {
          exitBtn.hidden = !membership && Number(group.created_by) !== Number(profile.id);
          exitBtn.disabled = Number(group.created_by) === Number(profile.id);
          exitBtn.title = exitBtn.disabled
            ? "Group creator cannot leave until ownership transfer is supported."
            : "";
        }

        const roleMessage = membership
          ? `You are viewing this group as ${roleLabel(membership.role)}.`
          : "You are viewing this group as the creator.";
        text(qs("#list-status"), `${members.length} members loaded. ${roleMessage}`);
      } catch (err) {
        const message = err.message || "Failed to load members.";
        text(qs("#list-status"), message);
        APP.showToast(message, "error");
        if (err.status === 403) {
          setPageError("Not allowed: you must be the group creator or a member of this group.");
        } else {
          setPageError(message);
        }
      }
    }

    if (openBtn) openBtn.addEventListener("click", openModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
    if (overlay) overlay.addEventListener("click", closeModal);

    document.addEventListener("keydown", (event) => {
      if (!modal.hidden && event.key === "Escape") closeModal();
    });

    if (exitBtn) {
      exitBtn.addEventListener("click", async () => {
        if (exitBtn.disabled) {
          APP.showToast("The group creator cannot leave until ownership transfer is supported.", "info");
          return;
        }
        if (!window.confirm("Exit this group? If you are the last admin, the earliest moderator or member will be promoted.")) {
          return;
        }

        APP.setButtonLoading(exitBtn, true, "Exiting...");
        try {
          await GroupMemberAPI.leaveGroup(groupId);
          APP.showToast("You exited the group", "success");
          APP.navigate("my_groups.html");
        } catch (err) {
          APP.showToast(err.message || "Failed to exit group.", "error");
        } finally {
          APP.setButtonLoading(exitBtn, false);
        }
      });
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setFormError("");

      const userId = Number(qs("#user_id").value);
      const roleVal = qs("#role").value;

      if (!userId || userId < 1) {
        APP.setFieldError(qs("#user_id"), "Please enter a valid user id (>= 1).");
        setFormError("Please fix the highlighted fields.");
        return;
      }

      APP.clearFieldError(qs("#user_id"));
      const submitBtn = qs("#add-submit");
      APP.setButtonLoading(submitBtn, true, "Adding...");

      try {
        await GroupMemberAPI.addMember({ group_id: groupId, user_id: userId, role: roleVal });
        APP.showToast("Member added", "success");
        closeModal();
        await loadMembers();
      } catch (err) {
        const message = err.message || "Failed to add member.";
        setFormError(message);
        APP.showToast(message, "error");
      } finally {
        APP.setButtonLoading(submitBtn, false);
      }
    });

    await loadMembers();
  }

  async function initGroupMemberDetailPage() {
    if (!APP.requireAuthOrRedirect()) return;

    const groupId = Number(qparam("group_id"));
    const memberId = Number(qparam("member_id"));

    if (!groupId || !memberId) {
      setPageError("Missing group_id or member_id.");
      return;
    }

    qs("#back").addEventListener("click", () => APP.navigate(`group_members.html?group_id=${groupId}`));

    const profile = await ensureProfile();
    if (!profile) return;

    const group = await fetchGroup(groupId);
    const role = await myRole(groupId, profile.id).catch(() => null);
    applyGroupWorkspace(profile, group, role, "Member Detail");

    async function findMember() {
      for (let page = 1; page <= 50; page += 1) {
        const items = await GroupMemberAPI.listMembers({ group_id: groupId, page, size: PAGE_SIZE });
        const found = items.find((item) => Number(item.id) === Number(memberId));
        if (found) return found;
        if (items.length < PAGE_SIZE) break;
      }
      return null;
    }

    let member;
    try {
      member = await findMember();
    } catch (err) {
      const message = err.message || "Failed to load member.";
      setPageError(message);
      APP.showToast(message, "error");
      return;
    }

    if (!member) {
      setPageError("Member not found in this group.");
      return;
    }

    text(qs("#subtitle"), `Group #${groupId} • ${group.name}`);
    text(qs("#m-title"), member.full_name || `User #${member.user_id}`);
    text(qs("#m-badges"), `Role: ${member.role} • Joined: ${formatDate(member.joined_at)}`);

    const grid = qs("#grid");
    empty(grid);
    [
      ["Member ID", member.id],
      ["Group ID", member.group_id],
      ["User ID", member.user_id],
      ["Role", member.role],
      ["Joined", formatDate(member.joined_at)],
      ["Full name", member.full_name || "-"],
    ].forEach(([key, value]) => {
      const dt = document.createElement("dt");
      dt.textContent = key;
      const dd = document.createElement("dd");
      dd.textContent = String(value);
      grid.appendChild(dt);
      grid.appendChild(dd);
    });

    const isCreator = Number(group.created_by) === Number(profile.id);
    const amAdmin = role === "admin";
    const canManage = isCreator || amAdmin;
    const permNote = qs("#perm-note");

    if (!canManage) {
      text(permNote, "You can view only. Only creator/admin can change roles or remove members.");
      show(qs("#manage"), false);
      return;
    }

    show(qs("#manage"), true);
    text(permNote, isCreator ? "You are the creator. You can manage members." : "You are an admin. You can manage members.");

    const removeBtn = qs("#remove");
    if (Number(member.user_id) === Number(group.created_by)) {
      removeBtn.disabled = true;
      removeBtn.title = "Creator cannot be removed";
    }

    qs("#role").value = member.role;

    qs("#role-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      setFormError("");
      setFormSuccess("");

      const newRole = qs("#role").value;
      APP.setButtonLoading(qs("#save"), true, "Saving...");

      try {
        const updated = await GroupMemberAPI.updateMember(member.id, newRole);
        setFormSuccess("Role updated.");
        APP.showToast("Role updated", "success");
        member = updated;
        text(qs("#m-badges"), `Role: ${member.role} • Joined: ${formatDate(member.joined_at)}`);
      } catch (err) {
        const message = err.message || "Failed to update role.";
        setFormError(message);
        APP.showToast(message, "error");
      } finally {
        APP.setButtonLoading(qs("#save"), false);
      }
    });

    removeBtn.addEventListener("click", async () => {
      if (removeBtn.disabled) return;
      if (!window.confirm("Remove this member from the group?")) return;

      APP.setButtonLoading(removeBtn, true, "Removing...");
      try {
        await GroupMemberAPI.deleteMember(member.id);
        APP.showToast("Member removed", "success");
        APP.navigate(`group_members.html?group_id=${groupId}`);
      } catch (err) {
        APP.showToast(err.message || "Remove failed.", "error");
      } finally {
        APP.setButtonLoading(removeBtn, false);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page || "";
    if (page === "group_members") initGroupMembersPage();
    if (page === "group_member_detail") initGroupMemberDetailPage();
  });
})();
