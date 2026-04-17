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

  async function listMembers({ cycle_id, page = 1, size = 20, order = "" }) {
    const params = new URLSearchParams({
      cycle_id: String(cycle_id),
      page: String(page),
      size: String(size),
    });
    if (order !== "" && order !== null && order !== undefined) params.set("order", String(order));

    return await request(`/cycle-members/?${params.toString()}`, {
      headers: { Accept: "application/json", ...authHeaders() },
    });
  }

  async function getMember(memberId) {
    return await request(`/cycle-members/${memberId}`, {
      headers: { Accept: "application/json", ...authHeaders() },
    });
  }

  async function addMember(payload) {
    return await request("/cycle-members/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders() },
      body: JSON.stringify(payload),
    });
  }

  async function fillMembers(payload) {
    return await request("/cycle-members/fill", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders() },
      body: JSON.stringify(payload),
    });
  }

  async function updateMember(memberId, payload) {
    return await request(`/cycle-members/${memberId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders() },
      body: JSON.stringify(payload),
    });
  }

  async function deleteMember(memberId) {
    return await request(`/cycle-members/${memberId}`, {
      method: "DELETE",
      headers: { Accept: "application/json", ...authHeaders() },
    });
  }

  window.CycleMemberAPI = { listMembers, getMember, addMember, fillMembers, updateMember, deleteMember };
})();
