(function () {
  const PAGE_SIZE = 20;

  function qs(sel) { return document.querySelector(sel); }
  function text(el, v) { if (el) el.textContent = v; }

  function getGroupIdFromUrl() {
    const u = new URL(window.location.href);
    return u.searchParams.get("id");
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
      }
      throw e;
    }
  }

  /* =========================
     Groups list page
  ========================= */
  async function initGroupsPage() {
    if (!APP.requireAuthOrRedirect()) return;

    let page = 1;
    let mine = false;

    const list = qs("#groups-list");
    const status = qs("#list-status");
    const mineBox = qs("#mine");
    const prevBtn = qs("#prev");
    const nextBtn = qs("#next");
    const pageLabel = qs("#page-label");

    function setStatus(msg) { text(status, msg || ""); }

    function renderItems(items) {
      list.innerHTML = "";
      if (!items.length) {
        const li = document.createElement("li");
        li.className = "list-empty";
        li.textContent = "No groups found.";
        list.appendChild(li);
        return;
      }

      items.forEach((g) => {
        const li = document.createElement("li");
        li.className = "list-item";

        const left = document.createElement("div");
        left.className = "list-main";

        const title = document.createElement("div");
        title.className = "list-title";
        title.textContent = g.name;

        const meta = document.createElement("div");
        meta.className = "list-meta";
        meta.textContent = `${g.privacy} • ${g.status}`;

        left.appendChild(title);
        left.appendChild(meta);

        const a = document.createElement("a");
        a.className = "btn btn-secondary";
        a.style.width = "auto";
        a.href = `group_detail.html?id=${g.id}`;
        a.textContent = "Open";

        li.appendChild(left);
        li.appendChild(a);
        list.appendChild(li);
      });
    }

    async function load() {
      setStatus("Loading…");
      try {
        const items = await GroupAPI.listGroups({ mine, page, size: PAGE_SIZE });
        renderItems(items);
        text(pageLabel, `Page ${page}`);
        prevBtn.disabled = page <= 1;
        nextBtn.disabled = items.length < PAGE_SIZE;
        setStatus("");
      } catch (e) {
        setStatus(e.message || "Failed to load groups.");
        APP.showToast(e.message || "Failed to load groups.", "error");
      }
    }

    mineBox.addEventListener("change", () => {
      mine = mineBox.checked;
      page = 1;
      load();
    });

    qs("#refresh").addEventListener("click", () => load());
    prevBtn.addEventListener("click", () => { if (page > 1) { page--; load(); } });
    nextBtn.addEventListener("click", () => { page++; load(); });

    // Create modal logic
    const overlay = qs("#modal-overlay");
    const modal = qs("#create-modal");
    const openBtn = qs("#open-create");
    const cancelBtn = qs("#cancel");
    const form = qs("#create-form");
    const nameInput = qs("#name");
    const privacySel = qs("#privacy");
    const descInput = qs("#description");

    function openModal() {
      setFormError("");
      overlay.hidden = false;
      modal.hidden = false;
      nameInput.focus();
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

      const name = nameInput.value.trim();
      const privacy = privacySel.value;
      const description = descInput.value.trim();

      if (name.length < 2) {
        APP.setFieldError(nameInput, "Name must be at least 2 characters.");
        setFormError("Please fix the highlighted fields.");
        return;
      }
      APP.clearFieldError(nameInput);

      const btn = qs("#create-submit");
      APP.setButtonLoading(btn, true, "Creating…");

      try {
        await GroupAPI.createGroup({
          name,
          privacy,
          description: description || null,
        });
        APP.showToast("Group created", "success");
        closeModal();
        page = 1;
        await load();
      } catch (err) {
        setFormError(err.message || "Failed to create group.");
        APP.showToast(err.message || "Failed to create group.", "error");
      } finally {
        APP.setButtonLoading(btn, false);
      }
    });

    load();
  }

  /* =========================
     Group detail page
  ========================= */
  async function initGroupDetailPage() {
    if (!APP.requireAuthOrRedirect()) return;

    const id = getGroupIdFromUrl();
    if (!id) {
      APP.showToast("Missing group id", "error");
      return;
    }

    const profile = await ensureProfile();
    if (!profile) return;

    const g = await GroupAPI.getGroup(id);

    qs("#open-members").addEventListener("click", () => {
      APP.navigate(`group_members.html?group_id=${id}`);
    });
    qs("#open-settings").addEventListener("click", () => {
      APP.navigate(`group_settings.html?group_id=${id}`);
    });
    qs("#open-cycles").addEventListener("click", () => {
      APP.navigate(`cycles.html?group_id=${id}`);
    });

    text(qs("#page-title"), "Group details");
    text(qs("#subtitle"), "View or manage this group.");
    text(qs("#g-name"), g.name);

    const statusBadge = qs("#g-status");
    statusBadge.textContent = g.status;
    statusBadge.className = `badge ${g.status === "closed" ? "bad" : "good"}`;

    const privacyBadge = qs("#g-privacy");
    privacyBadge.textContent = g.privacy;
    privacyBadge.className = `badge ${g.privacy === "private" ? "warn" : ""}`;

    // Details grid
    const grid = qs("#g-grid");
    grid.innerHTML = "";
    [
      ["ID", g.id],
      ["Creator ID", g.created_by],
      ["Created", g.created_at ? new Date(g.created_at).toLocaleString() : "-"],
      ["Description", g.description || "-"],
    ].forEach(([k, v]) => {
      const dt = document.createElement("dt"); dt.textContent = k;
      const dd = document.createElement("dd"); dd.textContent = String(v);
      grid.appendChild(dt); grid.appendChild(dd);
    });

    const isCreator = Number(g.created_by) === Number(profile.id);
    const note = qs("#creator-note");
    const editArea = qs("#edit-area");

    if (!isCreator) {
      text(note, "Only the creator can edit or close this group (admin checks come later).");
      editArea.hidden = true;
      return;
    }

    text(note, "You are the creator. You can edit or close this group.");
    editArea.hidden = false;

    // Prefill edit form
    qs("#name").value = g.name;
    qs("#privacy").value = g.privacy;
    qs("#description").value = g.description || "";

    qs("#edit-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      setFormError("");
      setFormSuccess("");

      const name = qs("#name").value.trim();
      const privacy = qs("#privacy").value;
      const description = qs("#description").value.trim();

      if (name.length < 2) {
        APP.setFieldError(qs("#name"), "Name must be at least 2 characters.");
        setFormError("Please fix the highlighted fields.");
        return;
      }
      APP.clearFieldError(qs("#name"));

      const payload = { name, privacy, description: description || null };

      APP.setButtonLoading(qs("#save"), true, "Saving…");
      try {
        const updated = await GroupAPI.updateGroup(id, payload);
        setFormSuccess("Saved.");
        APP.showToast("Group updated", "success");
        // refresh badges/title
        text(qs("#g-name"), updated.name);
        qs("#g-status").textContent = updated.status;
        qs("#g-privacy").textContent = updated.privacy;
      } catch (err) {
        setFormError(err.message || "Update failed.");
        APP.showToast(err.message || "Update failed.", "error");
      } finally {
        APP.setButtonLoading(qs("#save"), false);
      }
    });

    qs("#close").addEventListener("click", async () => {
      if (!confirm("Close this group? This will set status to closed.")) return;

      APP.setButtonLoading(qs("#close"), true, "Closing…");
      try {
        const updated = await GroupAPI.closeGroup(id);
        APP.showToast("Group closed", "success");
        qs("#g-status").textContent = updated.status;
        qs("#g-status").className = "badge bad";
      } catch (err) {
        APP.showToast(err.message || "Close failed.", "error");
      } finally {
        APP.setButtonLoading(qs("#close"), false);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page || "";
    if (page === "groups") initGroupsPage();
    if (page === "group_detail") initGroupDetailPage();
  });
})();
