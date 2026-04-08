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

        try {
            res = await fetch(url, options);
        } catch {
            throw { status: 0, message: "Network/CORS error. Check backend." };
        }

        const data = await readJson(res);

        if (!res.ok) {
            const message =
                data && typeof data.detail === "string"
                    ? data.detail
                    : `Request failed (${res.status})`;
            throw { status: res.status, message, data };
        }

        return data;
    }

    async function createJoinRequest(payload) {
        return await request("/join-requests/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                ...authHeaders(),
            },
            body: JSON.stringify(payload),
        });
    }

    async function listMyJoinRequests() {
        return await request("/join-requests/mine", {
            method: "GET",
            headers: {
                Accept: "application/json",
                ...authHeaders(),
            },
        });
    }

    async function listGroupJoinRequests(groupId, statusValue = "") {
        const qs = new URLSearchParams();
        if (statusValue) qs.set("status", statusValue);

        const suffix = qs.toString() ? `?${qs.toString()}` : "";
        return await request(`/join-requests/group/${groupId}${suffix}`, {
            method: "GET",
            headers: {
                Accept: "application/json",
                ...authHeaders(),
            },
        });
    }

    async function getJoinRequest(requestId) {
        return await request(`/join-requests/${requestId}`, {
            method: "GET",
            headers: {
                Accept: "application/json",
                ...authHeaders(),
            },
        });
    }

    async function decideJoinRequest(requestId, action) {
        return await request(`/join-requests/${requestId}/decision`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                ...authHeaders(),
            },
            body: JSON.stringify({ action }),
        });
    }

    async function cancelJoinRequest(requestId) {
        return await request(`/join-requests/${requestId}`, {
            method: "DELETE",
            headers: {
                Accept: "application/json",
                ...authHeaders(),
            },
        });
    }

    window.JoinRequestAPI = {
        createJoinRequest,
        listMyJoinRequests,
        listGroupJoinRequests,
        getJoinRequest,
        decideJoinRequest,
        cancelJoinRequest,
    };
})();