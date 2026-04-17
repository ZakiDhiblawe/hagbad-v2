(function () {
  async function readBody(res) {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return await res.json();
    return null;
  }

  function authHeaders() {
    const t = APP.getToken();
    return t ? { Authorization: `Bearer ${t}` } : {};
  }

  async function request(path, options = {}) {
    const url = APP.buildApiUrl(path);
    let res;
    try { res = await fetch(url, options); }
    catch { throw { status: 0, message: "Network error. Is backend running?" }; }

    const data = await readBody(res);
    if (!res.ok) {
      const msg = data && typeof data.detail === "string" ? data.detail : `Request failed (${res.status})`;
      throw { status: res.status, message: msg, data };
    }
    return data;
  }

  async function get(groupId) {
    return await request(`/group-settings/${groupId}`, {
      headers: { Accept: "application/json", ...authHeaders() },
    });
  }

  async function create(payload) {
    return await request("/group-settings/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders() },
      body: JSON.stringify(payload),
    });
  }

  async function update(groupId, payload) {
    return await request(`/group-settings/${groupId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders() },
      body: JSON.stringify(payload),
    });
  }

  async function remove(groupId) {
    return await request(`/group-settings/${groupId}`, {
      method: "DELETE",
      headers: { Accept: "application/json", ...authHeaders() },
    });
  }

  window.GroupSettingsAPI = { get, create, update, remove };
})();
