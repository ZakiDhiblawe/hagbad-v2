(function () {
    function qs(sel) {
        return document.querySelector(sel);
    }

    function setFormMessage(kind, message) {
        const err = qs("#form-error");
        const ok = qs("#form-success");

        if (err) {
            err.hidden = !(kind === "error");
            err.textContent = kind === "error" ? message : "";
        }
        if (ok) {
            ok.hidden = !(kind === "success");
            ok.textContent = kind === "success" ? message : "";
        }
    }

    function validateEmail(email) {
        // Basic client-side check; backend remains authoritative.
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function validatePhone(phone) {
        if (!phone) return true;
        return /^[0-9+\-\s()]{6,30}$/.test(phone);
    }

    function clearAllFieldErrors(form) {
        form.querySelectorAll("input").forEach((inp) => window.APP.clearFieldError(inp));
    }

    function bindPasswordToggles(container) {
        container.querySelectorAll("[data-toggle-password]").forEach((btn) => {
            btn.addEventListener("click", () => {
                const targetId = btn.getAttribute("data-toggle-password");
                const input = document.getElementById(targetId);
                if (!input) return;

                const isHidden = input.type === "password";
                input.type = isHidden ? "text" : "password";
                btn.textContent = isHidden ? "Hide" : "Show";
            });
        });
    }

    async function handleRegister() {
        const form = qs("#register-form");
        if (!form) return;

        bindPasswordToggles(form);

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            setFormMessage("", "");
            clearAllFieldErrors(form);

            const fullName = qs("#full_name").value.trim();
            const email = qs("#email").value.trim();
            const phone = qs("#phone").value.trim();
            const password = qs("#password").value;
            const confirm = qs("#confirm_password").value;

            let ok = true;

            if (fullName.length < 2) {
                window.APP.setFieldError(qs("#full_name"), "Please enter your full name.");
                ok = false;
            }

            if (!validateEmail(email)) {
                window.APP.setFieldError(qs("#email"), "Please enter a valid email address.");
                ok = false;
            }

            if (!validatePhone(phone)) {
                window.APP.setFieldError(qs("#phone"), "Phone number looks invalid (optional field).");
                ok = false;
            }

            if (!password || password.length < 6) {
                window.APP.setFieldError(qs("#password"), "Password must be at least 6 characters.");
                ok = false;
            }

            if (password !== confirm) {
                window.APP.setFieldError(qs("#confirm_password"), "Passwords do not match.");
                ok = false;
            }

            if (!ok) {
                setFormMessage("error", "Please fix the highlighted fields.");
                return;
            }

            const submitBtn = qs("#register-submit");
            window.APP.setButtonLoading(submitBtn, true, "Creating account...");

            try {
                await window.UserAPI.registerUser({
                    full_name: fullName,
                    email,
                    password,
                    phone: phone || null,
                });

                // Smooth UX: auto-login after register, then redirect to dashboard.
                const tokenResp = await window.UserAPI.loginUser(email, password);
                window.APP.setToken(tokenResp.access_token);

                window.APP.showToast("Account created successfully", "success");
                const rootPrefix = document.body.dataset.root === "true" ? "" : "../";
                window.APP.navigate(`${rootPrefix}pages/dashboard.html`);
            } catch (err) {
                const msg = err && err.message ? err.message : "Registration failed.";
                setFormMessage("error", msg);
                window.APP.showToast(msg, "error");
            } finally {
                window.APP.setButtonLoading(submitBtn, false);
            }
        });
    }

    async function handleLogin() {
        const form = qs("#login-form");
        if (!form) return;

        bindPasswordToggles(form);

        // Optional: prefill email from query, e.g. /login.html?email=test@mail.com
        const params = new URLSearchParams(window.location.search);
        const prefillEmail = params.get("email");
        if (prefillEmail && qs("#email")) qs("#email").value = prefillEmail;

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            setFormMessage("", "");
            clearAllFieldErrors(form);

            const email = qs("#email").value.trim();
            const password = qs("#password").value;

            let ok = true;

            if (!validateEmail(email)) {
                window.APP.setFieldError(qs("#email"), "Please enter a valid email address.");
                ok = false;
            }

            if (!password) {
                window.APP.setFieldError(qs("#password"), "Please enter your password.");
                ok = false;
            }

            if (!ok) {
                setFormMessage("error", "Please fix the highlighted fields.");
                return;
            }

            const submitBtn = qs("#login-submit");
            window.APP.setButtonLoading(submitBtn, true, "Signing in...");

            try {
                const tokenResp = await window.UserAPI.loginUser(email, password);
                window.APP.setToken(tokenResp.access_token);

                window.APP.showToast("Welcome back", "success");
                const rootPrefix = document.body.dataset.root === "true" ? "" : "../";
                window.APP.navigate(`${rootPrefix}pages/dashboard.html`);
            } catch (err) {
                const msg = err && err.message ? err.message : "Login failed.";
                setFormMessage("error", msg);
                window.APP.showToast(msg, "error");
            } finally {
                window.APP.setButtonLoading(submitBtn, false);
            }
        });
    }

    async function handleDashboard() {
        const token = window.APP.requireAuthOrRedirect();
        if (!token) return;

        const nameEl = qs("#profile-name");
        const grid = qs("#profile-grid");
        const statusEl = qs("#profile-status");

        function setStatus(text, kind = "loading") {
            if (!statusEl) return;
            statusEl.className = `status-pill ${kind}`;
            statusEl.textContent = text;
        }

        setStatus("Loading profile…", "loading");

        try {
            const profile = await window.UserAPI.getProfile(token);

            // Render safely using textContent (avoid innerHTML to reduce XSS exposure). citeturn0search6
            if (nameEl) nameEl.textContent = profile.full_name || "User";

            // Populate fields
            const fields = [
                ["Full name", profile.full_name || "-"],
                ["Email", profile.email || "-"],
                ["Phone", profile.phone || "-"],
                ["Status", profile.status || "-"],
                ["Created", profile.created_at ? new Date(profile.created_at).toLocaleString() : "-"],
            ];

            // Clear existing
            while (grid && grid.firstChild) grid.removeChild(grid.firstChild);

            fields.forEach(([k, v]) => {
                const dt = document.createElement("dt");
                dt.textContent = k;

                const dd = document.createElement("dd");
                dd.textContent = String(v);

                grid.appendChild(dt);
                grid.appendChild(dd);
            });

            setStatus("Profile loaded", "ok");
        } catch (err) {
            const status = err && typeof err.status === "number" ? err.status : 0;

            // If token expired/invalid, backend returns 401. Redirect to login.
            if (status === 401) {
                window.APP.clearToken();
                window.APP.showToast("Session expired. Please log in again.", "info");
                const rootPrefix = document.body.dataset.root === "true" ? "" : "../";
                window.APP.navigate(`${rootPrefix}pages/login.html`);
                return;
            }

            const msg = err && err.message ? err.message : "Failed to load profile.";
            setStatus("Failed to load profile", "down");
            setFormMessage("error", msg);
            window.APP.showToast(msg, "error");
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        const page = document.body.dataset.page || "";

        if (page === "register") handleRegister();
        if (page === "login") handleLogin();
        if (page === "dashboard") handleDashboard();
    });
})();
