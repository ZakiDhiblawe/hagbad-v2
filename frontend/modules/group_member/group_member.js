(function () {
  const PAGE_SIZE = 20;

  function qs(sel) { return document.querySelector(sel); }
  function text(el, v) { if (el) el.textContent = v; }
  function show(el, yes) { if (!el) return; el.hidden = !yes; }

  function qparam(name) {
    return new URL(window.location.href).searchParams.get(name);
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

  async function fetchGroup(groupId) {
    // Minimal inline fetch to avoid depending on modules/group. Keeps this module standalone.
    const res = await fetch(`${APP.getApiBase()}/groups/${groupId}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${APP.getToken()}` },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = data && typeof data.detail === "string" ? data.detail : `Failed to load group (${res.status})`;
      throw { status: res.status, message: msg };
    }
    return data;
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

  function roleBadge(role) {
    const span = document.createElement("span");
    span.className = "badge";
    span.textContent = role;
    if (role === "admin") span.classList.add("good");
    if (role === "moderator") span.classList.add("warn");
    return span;
  }

  /* ========= List page ========= */
  async function initGroupMembersPage() {
    if (!APP.requireAuthOrRedirect()) return;

    const groupId = Number(qparam("group_id"));
    if (!groupId || groupId < 1) {
      setPageError("Missing group_id. Open this page like: group_members.html?group_id=1");
      return;
    }

    const profile = await ensureProfile();
    if (!profile) return;

    const group = await fetchGroup(groupId);
    text(qs("#group-name"), group.name);
    text(qs("#group-subtitle"), "Members list and management.");
    text(qs("#group-badges"), `Group ID ${group.id} • ${group.privacy} • ${group.status}`);

    let page = 1;
    let role = "";

    const list = qs("#members-list");
    const status = qs("#list-status");
    const pageLabel = qs("#page-label");

    const canCreator = Number(group.created_by) === Number(profile.id);

    function setStatus(msg) { text(status, msg || ""); }

    function render(items, canManage) {
      list.innerHTML = "";
      if (!items.length) {
        const li = document.createElement("li");
        li.className = "list-empty";
        li.textContent = "No members found.";
        list.appendChild(li);
        return;
      }

      items.forEach((m) => {
        const li = document.createElement("li");
        li.className = "list-item";

        const left = document.createElement("div");
        left.className = "list-main";

        const title = document.createElement("div");
        title.className = "list-title";
        title.textContent = `User #${m.user_id}`;

        const meta = document.createElement("div");
        meta.className = "list-meta";
        const b = roleBadge(m.role);
        meta.appendChild(b);
        meta.appendChild(document.createTextNode(` • joined ${new Date(m.joined_at).toLocaleString()}`));

        left.appendChild(title);
        left.appendChild(meta);

        const actions = document.createElement("div");
        actions.style.display = "flex";
        actions.style.gap = "10px";
        actions.style.alignItems = "center";

        const open = document.createElement("a");
        open.className = "btn btn-secondary";
        open.style.width = "auto";
        open.href = `group_member_detail.html?group_id=${groupId}&member_id=${m.id}`;
        open.textContent = canManage ? "Manage" : "View";

        actions.appendChild(open);

        li.appendChild(left);
        li.appendChild(actions);
        list.appendChild(li);
      });
    }

    async function load() {
      setPageError("");
      setStatus("Loading…");

      try {
        const items = await GroupMemberAPI.listMembers({ group_id: groupId, role, page, size: PAGE_SIZE });

        // Determine admin by locating current user membership row in this page (best-effort)
        // If not found on this page, admin may still be true; we handle more robustly in detail page.
        const me = items.find((x) => Number(x.user_id) === Number(profile.id));
        const isAdmin = me && me.role === "admin";

        const canManage = canCreator || isAdmin;

        render(items, canManage);

        text(pageLabel, `Page ${page}`);
        qs("#prev").disabled = page <= 1;
        qs("#next").disabled = items.length < PAGE_SIZE;

        // Add button visible only for creator/admin (best-effort admin)
        show(qs("#open-add"), canManage);

        setStatus("");
      } catch (e) {
        const msg = e.message || "Failed to load members.";
        setStatus(msg);
        APP.showToast(msg, "error");
        if (e.status === 403) {
          setPageError("Not allowed: you must be the group creator or a member of this group.");
        }
      }
    }

    qs("#role-filter").addEventListener("change", () => {
      role = qs("#role-filter").value;
      page = 1;
      load();
    });

    qs("#refresh").addEventListener("click", () => load());
    qs("#prev").addEventListener("click", () => { if (page > 1) { page--; load(); } });
    qs("#next").addEventListener("click", () => { page++; load(); });

    // Modal
    const overlay = qs("#modal-overlay");
    const modal = qs("#add-modal");
    const openBtn = qs("#open-add");
    const cancelBtn = qs("#cancel");
    const form = qs("#add-form");

    function openModal() {
      setFormError("");
      overlay.hidden = false;
      modal.hidden = false;
      qs("#user_id").focus();
    }
    function closeModal() {
      overlay.hidden = true;
      modal.hidden = true;
      form.reset();
    }

    openBtn.addEventListener("click", openModal);
    cancelBtn.addEventListener("click", closeModal);
    overlay.addEventListener("click", closeModal);
    document.addEventListener("keydown", (e) => {
      if (!modal.hidden && e.key === "Escape") closeModal();
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      setFormError("");

      const userId = Number(qs("#user_id").value);
      const roleVal = qs("#role").value;

      if (!userId || userId < 1) {
        APP.setFieldError(qs("#user_id"), "Please enter a valid user id (>= 1).");
        setFormError("Please fix the highlighted fields.");
        return;
      }
      APP.clearFieldError(qs("#user_id"));

      const btn = qs("#add-submit");
      APP.setButtonLoading(btn, true, "Adding…");

      try {
        await GroupMemberAPI.addMember({ group_id: groupId, user_id: userId, role: roleVal });
        APP.showToast("Member added", "success");
        closeModal();
        page = 1;
        await load();
      } catch (err) {
        const msg = err.message || "Failed to add member.";
        setFormError(msg);
        APP.showToast(msg, "error");
      } finally {
        APP.setButtonLoading(btn, false);
      }
    });

    load();
  }

  /* ========= Detail page ========= */
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

    // Find member by paging through list endpoint (no GET /group-members/{id} exists)
    async function findMember() {
      for (let p = 1; p <= 50; p++) {
        const items = await GroupMemberAPI.listMembers({ group_id: groupId, page: p, size: 100 });
        const found = items.find((x) => Number(x.id) === Number(memberId));
        if (found) return found;
        if (items.length < 100) break;
      }
      return null;
    }

    let member;
    try {
      member = await findMember();
    } catch (e) {
      const msg = e.message || "Failed to load member.";
      setPageError(msg);
      APP.showToast(msg, "error");
      return;
    }

    if (!member) {
      setPageError("Member not found in this group.");
      return;
    }

    text(qs("#subtitle"), `Group #${groupId} • ${group.name}`);
    text(qs("#m-title"), `User #${member.user_id}`);
    text(qs("#m-badges"), `Role: ${member.role} • Joined: ${new Date(member.joined_at).toLocaleString()}`);

    const grid = qs("#grid");
    grid.innerHTML = "";
    [
      ["Member ID", member.id],
      ["Group ID", member.group_id],
      ["User ID", member.user_id],
      ["Role", member.role],
      ["Joined", new Date(member.joined_at).toLocaleString()],
    ].forEach(([k, v]) => {
      const dt = document.createElement("dt"); dt.textContent = k;
      const dd = document.createElement("dd"); dd.textContent = String(v);
      grid.appendChild(dt); grid.appendChild(dd);
    });

    // Determine permission: creator OR admin (by checking your own membership role)
    const isCreator = Number(group.created_by) === Number(profile.id);

    let amAdmin = false;
    try {
      // Search for current user membership (pages up to 50)
      for (let p = 1; p <= 50; p++) {
        const items = await GroupMemberAPI.listMembers({ group_id: groupId, page: p, size: 100 });
        const me = items.find((x) => Number(x.user_id) === Number(profile.id));
        if (me) { amAdmin = me.role === "admin"; break; }
        if (items.length < 100) break;
      }
    } catch {
      // If we cannot list, we can't be admin; creator still true if creator.
      amAdmin = false;
    }

    const canManage = isCreator || amAdmin;
    const permNote = qs("#perm-note");
    if (!canManage) {
      text(permNote, "You can view only. Only creator/admin can change roles or remove members.");
      show(qs("#manage"), false);
      return;
    }

    show(qs("#manage"), true);
    text(permNote, isCreator ? "You are the creator. You can manage members." : "You are an admin. You can manage members.");

    // Prevent removing creator (backend will return 400 too)
    const removeBtn = qs("#remove");
    if (Number(member.user_id) === Number(group.created_by)) {
      removeBtn.disabled = true;
      removeBtn.title = "Creator cannot be removed";
    }

    // Prefill role
    qs("#role").value = member.role;

    qs("#role-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      setFormError("");
      setFormSuccess("");

      const newRole = qs("#role").value;
      APP.setButtonLoading(qs("#save"), true, "Saving…");

      try {
        const updated = await GroupMemberAPI.updateMember(member.id, newRole);
        setFormSuccess("Role updated.");
        APP.showToast("Role updated", "success");
        member = updated;
        text(qs("#m-badges"), `Role: ${member.role} • Joined: ${new Date(member.joined_at).toLocaleString()}`);
      } catch (err) {
        const msg = err.message || "Failed to update role.";
        setFormError(msg);
        APP.showToast(msg, "error");
      } finally {
        APP.setButtonLoading(qs("#save"), false);
      }
    });

    removeBtn.addEventListener("click", async () => {
      if (removeBtn.disabled) return;
      if (!confirm("Remove this member from the group?")) return;

      APP.setButtonLoading(removeBtn, true, "Removing…");
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
