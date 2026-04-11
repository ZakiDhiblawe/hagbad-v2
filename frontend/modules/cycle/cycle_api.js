(function () {
  async function readJson(res) {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return await res.json();
    return null;
  }

  function authHeaders() {
    const token = APP.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
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

  async function listForGroup(groupId, { page = 1, size = 20 } = {}) {
    return await request(`/cycles/group/${groupId}?page=${page}&size=${size}`, {
      headers: { Accept: "application/json", ...authHeaders() },
    });
  }

  async function getCycle(cycleId) {
    return await request(`/cycles/${cycleId}`, {
      headers: { Accept: "application/json", ...authHeaders() },
    });
  }

  async function createCycle(payload) {
    return await request("/cycles/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders() },
      body: JSON.stringify(payload),
    });
  }

  async function updateCycle(cycleId, payload) {
    return await request(`/cycles/${cycleId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders() },
      body: JSON.stringify(payload),
    });
  }

  async function startCycle(cycleId) {
    return await request(`/cycles/${cycleId}/start`, {
      method: "PUT",
      headers: { Accept: "application/json", ...authHeaders() },
    });
  }

  async function stopCycle(cycleId, status) {
    return await request(`/cycles/${cycleId}/stop?status=${encodeURIComponent(status)}`, {
      method: "PUT",
      headers: { Accept: "application/json", ...authHeaders() },
    });
  }

  window.CycleAPI = { listForGroup, getCycle, createCycle, updateCycle, startCycle, stopCycle };
})();
