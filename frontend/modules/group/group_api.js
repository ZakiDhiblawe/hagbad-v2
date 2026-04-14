(function () {
  function appendMaybe(body, key, value) {
    if (value === undefined) return;
    if (value === null) {
      body.append(key, "");
      return;
    }
    body.append(key, value);
  }

  function buildGroupFormData(payload = {}) {
    const body = new FormData();
    appendMaybe(body, "name", payload.name);
    appendMaybe(body, "description", payload.description);
    appendMaybe(body, "privacy", payload.privacy);
    if (payload.visible !== undefined) body.append("visible", String(Boolean(payload.visible)));
    if (payload.status !== undefined) appendMaybe(body, "status", payload.status);
    if (payload.groupImageFile) body.append("group_image", payload.groupImageFile);
    if (payload.coverImageFile) body.append("cover_image", payload.coverImageFile);
    if (payload.removeGroupImage) body.append("remove_group_image", "true");
    if (payload.removeCoverImage) body.append("remove_cover_image", "true");
    return body;
  }

  async function readJson(response) {
    const ct = response.headers.get("content-type") || "";
    if (ct.includes("application/json")) return await response.json();
    return null;
  }

  async function request(path, options = {}) {
    const url = `${APP.getApiBase()}${path}`;
    let res;
    try { res = await fetch(url, options); }
    catch { throw { status: 0, message: "Network/CORS error. Check backend." }; }

    const data = await readJson(res);
    if (!res.ok) {
      const msg = data && typeof data.detail === "string" ? data.detail : `Request failed (${res.status})`;
      throw { status: res.status, message: msg, data };
    }
    return data;
  }

  function authHeaders() {
    const token = APP.getToken();
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }

  async function listGroups({ mine = false, explore = false, page = 1, size = 20, search = "", role = "", managed = false } = {}) {
    const params = new URLSearchParams({
      mine: String(mine),
      explore: String(explore),
      managed: String(Boolean(managed)),
      page: String(page),
      size: String(size),
    });
    if (search && String(search).trim()) params.set("search", String(search).trim());
    if (role && String(role).trim()) params.set("role", String(role).trim());
    const qs = params.toString();
    return await request(`/groups/?${qs}`, { headers: { Accept: "application/json", ...authHeaders() } });
  }

  async function createGroup(payload) {
    return await request("/groups/", {
      method: "POST",
      headers: { Accept: "application/json", ...authHeaders() },
      body: buildGroupFormData(payload),
    });
  }

  async function getGroup(groupId) {
    return await request(`/groups/${groupId}`, {
      headers: { Accept: "application/json", ...authHeaders() },
    });
  }

  async function updateGroup(groupId, payload) {
    return await request(`/groups/${groupId}`, {
      method: "PUT",
      headers: { Accept: "application/json", ...authHeaders() },
      body: buildGroupFormData(payload),
    });
  }

  async function closeGroup(groupId) {
    return await request(`/groups/${groupId}/close`, {
      method: "POST",
      headers: { Accept: "application/json", ...authHeaders() },
    });
  }

  async function joinGroup(groupId) {
    return await request(`/groups/${groupId}/join`, {
      method: "POST",
      headers: { Accept: "application/json", ...authHeaders() },
    });
  }

  async function deleteGroup(groupId) {
    return await request(`/groups/${groupId}`, {
      method: "DELETE",
      headers: { Accept: "application/json", ...authHeaders() },
    });
  }

  window.GroupAPI = { listGroups, createGroup, getGroup, updateGroup, closeGroup, joinGroup, deleteGroup };
})();
