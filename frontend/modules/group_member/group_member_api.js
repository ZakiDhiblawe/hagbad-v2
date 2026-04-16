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

  async function listMembers({ group_id, role = "", page = 1, size = 20 }) {
    const qs = new URLSearchParams({
      group_id: String(group_id),
      page: String(page),
      size: String(size),
    });
    if (role) qs.set("role", role);

    return await request(`/group-members/?${qs.toString()}`, {
      headers: { Accept: "application/json", ...authHeaders() },
    });
  }

  async function addMember(payload) {
    return await request("/group-members/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders() },
      body: JSON.stringify(payload),
    });
  }

  async function updateMember(member_id, role) {
    return await request(`/group-members/${member_id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders() },
      body: JSON.stringify({ role }),
    });
  }

  async function deleteMember(member_id) {
    return await request(`/group-members/${member_id}`, {
      method: "DELETE",
      headers: { Accept: "application/json", ...authHeaders() },
    });
  }

  async function leaveGroup(group_id) {
    const qs = new URLSearchParams({ group_id: String(group_id) });
    return await request(`/group-members/leave?${qs.toString()}`, {
      method: "POST",
      headers: { Accept: "application/json", ...authHeaders() },
    });
  }

  window.GroupMemberAPI = { listMembers, addMember, updateMember, deleteMember, leaveGroup };
})();
