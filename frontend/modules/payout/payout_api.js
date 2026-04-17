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
    const url = APP.buildApiUrl(path);
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

  async function listPayouts({ cycle_id, cycle_member_id = "", status = "", page = 1, size = 20 }) {
    const params = new URLSearchParams({
      cycle_id: String(cycle_id),
      page: String(page),
      size: String(size),
    });
    if (cycle_member_id) params.set("cycle_member_id", String(cycle_member_id));
    if (status) params.set("status", status);

    return await request(`/payouts/?${params.toString()}`, {
      headers: { Accept: "application/json", ...authHeaders() },
    });
  }

  async function getPayout(payoutId) {
    return await request(`/payouts/${payoutId}`, {
      headers: { Accept: "application/json", ...authHeaders() },
    });
  }

  async function getSummary(cycleId) {
    return await request(`/payouts/summary/cycle/${cycleId}`, {
      headers: { Accept: "application/json", ...authHeaders() },
    });
  }

  async function createPayout(payload) {
    return await request("/payouts/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders() },
      body: JSON.stringify(payload),
    });
  }

  async function updatePayout(payoutId, payload) {
    return await request(`/payouts/${payoutId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders() },
      body: JSON.stringify(payload),
    });
  }

  async function approvePayout(payoutId, payload = {}) {
    return await request(`/payouts/${payoutId}/approve`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders() },
      body: JSON.stringify(payload),
    });
  }

  async function rejectPayout(payoutId, payload = {}) {
    return await request(`/payouts/${payoutId}/reject`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders() },
      body: JSON.stringify(payload),
    });
  }

  async function markPaid(payoutId, payload = {}) {
    return await request(`/payouts/${payoutId}/pay`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders() },
      body: JSON.stringify(payload),
    });
  }

  async function deletePayout(payoutId) {
    return await request(`/payouts/${payoutId}`, {
      method: "DELETE",
      headers: { Accept: "application/json", ...authHeaders() },
    });
  }

  window.PayoutAPI = {
    listPayouts,
    getPayout,
    getSummary,
    createPayout,
    updatePayout,
    approvePayout,
    rejectPayout,
    markPaid,
    deletePayout,
  };
})();
