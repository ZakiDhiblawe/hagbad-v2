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

  async function listPayments({ cycle_id, cycle_member_id = "", status = "", due_from = "", due_to = "", page = 1, size = 20 }) {
    const params = new URLSearchParams({
      cycle_id: String(cycle_id),
      page: String(page),
      size: String(size),
    });
    if (cycle_member_id) params.set("cycle_member_id", String(cycle_member_id));
    if (status) params.set("status", status);
    if (due_from) params.set("due_from", due_from);
    if (due_to) params.set("due_to", due_to);

    return await request(`/payments/?${params.toString()}`, {
      headers: { Accept: "application/json", ...authHeaders() },
    });
  }

  async function getPayment(paymentId) {
    return await request(`/payments/${paymentId}`, {
      headers: { Accept: "application/json", ...authHeaders() },
    });
  }

  async function getSummary(cycleId) {
    return await request(`/payments/summary/cycle/${cycleId}`, {
      headers: { Accept: "application/json", ...authHeaders() },
    });
  }

  async function createPayment(payload) {
    return await request("/payments/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders() },
      body: JSON.stringify(payload),
    });
  }

  async function updatePayment(paymentId, payload) {
    return await request(`/payments/${paymentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders() },
      body: JSON.stringify(payload),
    });
  }

  async function submitPayment(paymentId, payload = {}) {
    return await request(`/payments/${paymentId}/submit`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders() },
      body: JSON.stringify(payload),
    });
  }

  async function approvePayment(paymentId, payload = {}) {
    return await request(`/payments/${paymentId}/approve`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders() },
      body: JSON.stringify(payload),
    });
  }

  async function deletePayment(paymentId) {
    return await request(`/payments/${paymentId}`, {
      method: "DELETE",
      headers: { Accept: "application/json", ...authHeaders() },
    });
  }

  window.PaymentAPI = {
    listPayments,
    getPayment,
    getSummary,
    createPayment,
    updatePayment,
    submitPayment,
    approvePayment,
    deletePayment,
  };
})();
