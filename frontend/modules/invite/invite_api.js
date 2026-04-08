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

    async function createInvite(payload) {
        return await request("/invites/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                ...authHeaders(),
            },
            body: JSON.stringify(payload),
        });
    }

    async function listInvites(groupId) {
        return await request(`/invites/${groupId}`, {
            method: "GET",
            headers: {
                Accept: "application/json",
                ...authHeaders(),
            },
        });
    }

    async function redeemInvite(code) {
        return await request("/invites/redeem", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                ...authHeaders(),
            },
            body: JSON.stringify({ code }),
        });
    }

    async function deleteInvite(inviteId) {
        return await request(`/invites/${inviteId}`, {
            method: "DELETE",
            headers: {
                Accept: "application/json",
                ...authHeaders(),
            },
        });
    }

    window.InviteAPI = {
        createInvite,
        listInvites,
        redeemInvite,
        deleteInvite,
    };
})();