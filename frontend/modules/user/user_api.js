(function () {
    async function readJsonSafely(response) {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
            return await response.json();
        }
        return null;
    }

    function extractErrorMessage(data, fallback) {
        if (!data) return fallback;
        if (typeof data.detail === "string") return data.detail;
        return fallback;
    }

    async function request(path, options = {}) {
        const url = `${window.APP.getApiBase()}${path}`;

        let response;
        try {
            response = await fetch(url, options);
        } catch (err) {
            // Network error (server down, DNS, etc.)
            throw { status: 0, message: "Network error. Is the server running?" };
        }

        const data = await readJsonSafely(response);

        if (!response.ok) {
            const msg = extractErrorMessage(data, `Request failed (${response.status})`);
            throw { status: response.status, message: msg, data };
        }

        return data;
    }

    async function registerUser(payload) {
        return await request("/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            body: JSON.stringify(payload),
        });
    }

    async function loginUser(email, password) {
        // FastAPI OAuth2 password flow expects "username" + "password" as form fields. citeturn0search0
        const body = new URLSearchParams({
            username: email,
            password: password,
        }).toString();

        return await request("/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
            },
            body,
        });
    }

    async function getProfile(token) {
        return await request("/profile", {
            method: "GET",
            headers: {
                "Accept": "application/json",
                "Authorization": `Bearer ${token}`,
            },
        });
    }

    window.UserAPI = {
        registerUser,
        loginUser,
        getProfile,
    };
})();
