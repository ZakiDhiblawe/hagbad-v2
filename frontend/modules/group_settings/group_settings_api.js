(function () {
  async function readJson(res) {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return await res.json();
    return null;
  }

  function authHeaders() {
    const t = APP.getToken();
    return t ? { Authorization: `Bearer ${t}` } : {};
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

  async function getSettings(groupId) {
    return await request(`/group-settings/${groupId}`, {
      headers: { Accept: "application/json", ...authHeaders() },
    });
  }

  async function createSettings(payload) {
    return await request("/group-settings/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders() },
      body: JSON.stringify(payload),
    });
  }

  async function updateSettings(groupId, payload) {
    return await request(`/group-settings/${groupId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders() },
      body: JSON.stringify(payload),
    });
  }

  async function deleteSettings(groupId) {
    return await request(`/group-settings/${groupId}`, {
      method: "DELETE",
      headers: { Accept: "application/json", ...authHeaders() },
    });
  }

  window.GroupSettingsAPI = { getSettings, createSettings, updateSettings, deleteSettings };
})();
