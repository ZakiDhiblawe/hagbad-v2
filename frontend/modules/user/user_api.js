(function () {
    function authHeaders(token) {
        return {
            "Accept": "application/json",
            "Authorization": `Bearer ${token}`,
        };
    }

    async function readBodySafely(response) {
        const contentType = response.headers.get("content-type") || "";
        try {
            if (contentType.includes("application/json")) {
                return { kind: "json", data: await response.json() };
            }
            return { kind: "text", data: await response.text() };
        } catch {
            return { kind: "none", data: null };
        }
    }

    function extractMessage(status, body) {
        if (!body || body.kind === "none") {
            if (status === 500) return "Server error (500). Please try again.";
            return `Request failed (${status}).`;
        }

        if (body.kind === "json") {
            const d = body.data;

            // FastAPI often returns {"detail": "..."} for HTTP errors
            if (d && typeof d.detail === "string") return d.detail;

            // For validation errors, detail may be an array
            if (d && Array.isArray(d.detail)) return "Validation error. Please check your input.";

            return `Request failed (${status}).`;
        }

        // text fallback – keep it short and safe
        const text = String(body.data || "").trim();
        if (status === 500) return "Server error (500). Please try again.";
        if (text) return text.slice(0, 160);
        return `Request failed (${status}).`;
    }

    async function request(path, options = {}) {
        const url = `${window.APP.getApiBase()}${path}`;

        let response;
        try {
            response = await fetch(url, options);
        } catch {
            // Browser treats CORS-blocked responses and some server crashes as “network errors”. citeturn0search9
            throw {
                status: 0,
                message:
                    "Request blocked or network error. Backend may be down or returned an internal error. Check backend logs.",
            };
        }

        const body = await readBodySafely(response);

        if (!response.ok) {
            throw {
                status: response.status,
                message: extractMessage(response.status, body),
                data: body.kind === "json" ? body.data : null,
            };
        }

        // Successful responses are expected to be JSON in our APIs
        if (body.kind === "json") return body.data;
        return null;
    }

    async function registerUser(payload) {
        return await request("/register", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify(payload),
        });
    }

    async function loginUser(email, password) {
        // OAuth2 password flow expects form fields "username" and "password". citeturn0search24turn1search5
        const body = new URLSearchParams({ username: email, password }).toString();

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
            headers: authHeaders(token),
        });
    }

    async function updateProfile(token, { fullName, phone = null, imageFile = null, removeImage = false }) {
        const body = new FormData();
        body.append("full_name", fullName);
        body.append("phone", phone || "");
        if (imageFile) body.append("image", imageFile);
        if (removeImage) body.append("remove_image", "true");

        return await request("/profile", {
            method: "PUT",
            headers: authHeaders(token),
            body,
        });
    }

    async function updatePassword(token, payload) {
        return await request("/profile/password", {
            method: "PUT",
            headers: {
                ...authHeaders(token),
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });
    }

    window.UserAPI = { registerUser, loginUser, getProfile, updateProfile, updatePassword };
})();
