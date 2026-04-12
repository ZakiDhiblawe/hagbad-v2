(function () {
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

  async function listGroups({ mine = false, page = 1, size = 20 } = {}) {
    const qs = new URLSearchParams({
      mine: String(mine),
      page: String(page),
      size: String(size),
    }).toString();
    return await request(`/groups/?${qs}`, { headers: { Accept: "application/json", ...authHeaders() } });
  }

  async function createGroup(payload) {
    return await request("/groups/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders() },
      body: JSON.stringify(payload),
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
      headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders() },
      body: JSON.stringify(payload),
    });
  }

  async function closeGroup(groupId) {
    return await request(`/groups/${groupId}/close`, {
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

  window.GroupAPI = { listGroups, createGroup, getGroup, updateGroup, closeGroup, deleteGroup };
})();
