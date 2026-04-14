(function () {
    function qs(sel) {
        return document.querySelector(sel);
    }

    function dashboardPath() {
        return `${window.APP.getRootPrefix()}pages/dashboard.html`;
    }

    function loginPath() {
        return `${window.APP.getRootPrefix()}pages/login.html`;
    }

    function profilePath() {
        return `${window.APP.getRootPrefix()}pages/my_profile.html`;
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

    function validateSessionHours(rawValue) {
        const value = String(rawValue || "").trim();
        if (!value) return { ok: true, parsed: null };
        if (!/^\d+$/.test(value)) return { ok: false, parsed: null };

        const hours = Number(value);
        if (!Number.isInteger(hours) || hours < 1 || hours > 720) {
            return { ok: false, parsed: null };
        }

        return { ok: true, parsed: hours };
    }

    function clearAllFieldErrors(form) {
        form.querySelectorAll("input").forEach((inp) => window.APP.clearFieldError(inp));
    }

    function renderWorkspaceMenu(profile) {
        const mount = qs("#workspace-user-menu");
        if (!mount) return;
        window.APP.mountUserMenu(mount, profile, { compact: false });
    }

    function syncProfileCache(profile) {
        window.APP.setStoredProfile(profile);
        renderWorkspaceMenu(profile);
    }

    function renderKeyValueGrid(grid, fields) {
        if (!grid) return;
        while (grid.firstChild) grid.removeChild(grid.firstChild);

        fields.forEach(([k, v]) => {
            const dt = document.createElement("dt");
            dt.textContent = k;

            const dd = document.createElement("dd");
            dd.textContent = String(v);

            grid.appendChild(dt);
            grid.appendChild(dd);
        });
    }

    function formatCreatedAt(value) {
        if (!value) return "-";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "-";
        return date.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    }

    function formatStatus(value) {
        if (!value) return "Unknown";
        return String(value).charAt(0).toUpperCase() + String(value).slice(1);
    }

    function formatSessionHours(value) {
        if (value === null || value === undefined || value === "") {
            return "Never expires automatically";
        }
        const hours = Number(value);
        if (!Number.isFinite(hours)) return "Never expires automatically";
        return `${hours} hour${hours === 1 ? "" : "s"}`;
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

        if (window.APP.isAuthed()) {
            window.APP.navigate(dashboardPath());
            return;
        }

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
                window.APP.setStoredProfile(null);

                window.APP.showToast("Account created successfully", "success");
                window.APP.navigate(dashboardPath());
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

        if (window.APP.isAuthed()) {
            window.APP.navigate(dashboardPath());
            return;
        }

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
                window.APP.setStoredProfile(null);

                window.APP.showToast("Welcome back", "success");
                window.APP.navigate(dashboardPath());
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
        const statusChipEl = qs("#profile-status-chip");
        const emailHeroEl = qs("#profile-email-hero");
        const createdEl = qs("#profile-created");
        const summaryEl = qs("#profile-summary");

        function setStatus(text, kind = "status-loading") {
            if (!statusEl) return;
            statusEl.textContent = text;
            if (statusChipEl) {
                statusChipEl.textContent = text;
                statusChipEl.className = `status-chip ${kind}`;
            }
        }

        setStatus("Loading profile...", "status-loading");

        try {
            const profile = await window.UserAPI.getProfile(token);
            syncProfileCache(profile);

            // Render safely using textContent (avoid innerHTML to reduce XSS exposure). citeturn0search6
            if (nameEl) nameEl.textContent = profile.full_name || "User";
            if (emailHeroEl) emailHeroEl.textContent = profile.email || "-";
            if (createdEl) {
                createdEl.textContent = profile.created_at
                    ? new Date(profile.created_at).toLocaleDateString()
                    : "-";
            }
            if (summaryEl) {
                summaryEl.textContent = `Your account is signed in and ready to manage groups, review members, and move through payment and payout workflows.`;
            }

            renderKeyValueGrid(grid, [
                ["Full name", profile.full_name || "-"],
                ["Email", profile.email || "-"],
                ["Phone", profile.phone || "-"],
                ["Session", formatSessionHours(profile.session_hours)],
                ["Status", profile.status || "-"],
                ["Created", profile.created_at ? new Date(profile.created_at).toLocaleString() : "-"],
            ]);

            setStatus("Profile loaded", "status-ok");
        } catch (err) {
            const status = err && typeof err.status === "number" ? err.status : 0;

            // If token expired/invalid, backend returns 401. Redirect to login.
            if (status === 401) {
                window.APP.clearToken();
                window.APP.showToast("Session expired. Please log in again.", "info");
                window.APP.navigate(loginPath());
                return;
            }

            const msg = err && err.message ? err.message : "Failed to load profile.";
            setStatus("Profile unavailable", "status-down");
            if (summaryEl) summaryEl.textContent = msg;
            setFormMessage("error", msg);
            window.APP.showToast(msg, "error");
        }
    }

    async function handleMyProfile() {
        const token = window.APP.requireAuthOrRedirect();
        if (!token) return;

        const profileForm = qs("#profile-update-form");
        const passwordForm = qs("#password-form");
        if (!profileForm || !passwordForm) return;

        bindPasswordToggles(passwordForm);

        const nameInput = qs("#profile_full_name");
        const emailInput = qs("#profile_email");
        const phoneInput = qs("#profile_phone");
        const sessionHoursInput = qs("#profile_session_hours");
        const avatarImg = qs("#profile-avatar-preview");
        const imageInput = qs("#profile_image");
        const removeImageInput = qs("#remove_profile_image");
        const profileError = qs("#profile-form-error");
        const profileSuccess = qs("#profile-form-success");
        const passwordError = qs("#password-form-error");
        const passwordSuccess = qs("#password-form-success");
        const cardName = qs("#profile-card-name");
        const cardEmail = qs("#profile-card-email");
        const cardStatus = qs("#profile-card-status");
        const cardCreated = qs("#profile-card-created");

        function showProfileMessage(kind, message) {
            if (profileError) {
                profileError.hidden = kind !== "error";
                profileError.textContent = kind === "error" ? message : "";
            }
            if (profileSuccess) {
                profileSuccess.hidden = kind !== "success";
                profileSuccess.textContent = kind === "success" ? message : "";
            }
        }

        function showPasswordMessage(kind, message) {
            if (passwordError) {
                passwordError.hidden = kind !== "error";
                passwordError.textContent = kind === "error" ? message : "";
            }
            if (passwordSuccess) {
                passwordSuccess.hidden = kind !== "success";
                passwordSuccess.textContent = kind === "success" ? message : "";
            }
        }

        function paintProfile(profile) {
            syncProfileCache(profile);
            if (nameInput) nameInput.value = profile.full_name || "";
            if (emailInput) emailInput.value = profile.email || "";
            if (phoneInput) phoneInput.value = profile.phone || "";
            if (sessionHoursInput) sessionHoursInput.value = profile.session_hours ?? "";
            if (cardName) cardName.textContent = profile.full_name || "User";
            if (cardEmail) cardEmail.textContent = profile.email || "-";
            if (cardStatus) {
                cardStatus.textContent = formatStatus(profile.status);
                cardStatus.className = `profile-status-badge status-${profile.status || "unknown"}`;
            }
            if (cardCreated) cardCreated.textContent = formatCreatedAt(profile.created_at);
            if (avatarImg) avatarImg.src = window.APP.getProfileImageUrl(profile);
        }

        try {
            const profile = await window.UserAPI.getProfile(token);
            paintProfile(profile);
        } catch (err) {
            const status = err && typeof err.status === "number" ? err.status : 0;
            if (status === 401) {
                window.APP.clearToken();
                window.APP.showToast("Session expired. Please log in again.", "info");
                window.APP.navigate(loginPath());
                return;
            }
            window.APP.showToast(err.message || "Failed to load profile.", "error");
            return;
        }

        if (imageInput && avatarImg) {
            imageInput.addEventListener("change", () => {
                const file = imageInput.files && imageInput.files[0];
                if (!file) return;
                const objectUrl = URL.createObjectURL(file);
                avatarImg.src = objectUrl;
                removeImageInput.checked = false;
            });
        }

        if (removeImageInput && avatarImg) {
            removeImageInput.addEventListener("change", () => {
                if (!removeImageInput.checked) return;
                avatarImg.src = window.APP.getDefaultProfileImage();
                if (imageInput) imageInput.value = "";
            });
        }

        profileForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            showProfileMessage("", "");
            window.APP.clearFieldError(nameInput);
            window.APP.clearFieldError(phoneInput);
            window.APP.clearFieldError(sessionHoursInput);

            const fullName = nameInput.value.trim();
            const phone = phoneInput.value.trim();
            const sessionHoursState = validateSessionHours(sessionHoursInput ? sessionHoursInput.value : "");
            if (fullName.length < 2) {
                window.APP.setFieldError(nameInput, "Please enter your full name.");
                showProfileMessage("error", "Please fix the highlighted field.");
                return;
            }
            if (!validatePhone(phone)) {
                window.APP.setFieldError(phoneInput, "Please enter a valid phone number.");
                showProfileMessage("error", "Please fix the highlighted field.");
                return;
            }
            if (!sessionHoursState.ok) {
                window.APP.setFieldError(sessionHoursInput, "Enter a whole number from 1 to 720, or leave it blank.");
                showProfileMessage("error", "Please fix the highlighted field.");
                return;
            }

            const submitBtn = qs("#profile-save-btn");
            window.APP.setButtonLoading(submitBtn, true, "Saving...");

            try {
                const updated = await window.UserAPI.updateProfile(token, {
                    fullName,
                    phone: phone || null,
                    sessionHours: sessionHoursState.parsed,
                    imageFile: imageInput.files && imageInput.files[0] ? imageInput.files[0] : null,
                    removeImage: removeImageInput.checked,
                });
                paintProfile(updated);
                if (imageInput) imageInput.value = "";
                if (removeImageInput) removeImageInput.checked = false;
                showProfileMessage("success", "Profile updated successfully.");
                window.APP.showToast("Profile updated", "success");
            } catch (err) {
                const msg = err && err.message ? err.message : "Failed to update profile.";
                showProfileMessage("error", msg);
                window.APP.showToast(msg, "error");
            } finally {
                window.APP.setButtonLoading(submitBtn, false);
            }
        });

        passwordForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            showPasswordMessage("", "");
            clearAllFieldErrors(passwordForm);

            const currentPassword = qs("#current_password").value;
            const newPassword = qs("#new_password").value;
            const confirmPassword = qs("#confirm_new_password").value;

            let valid = true;
            if (!currentPassword) {
                window.APP.setFieldError(qs("#current_password"), "Enter your current password.");
                valid = false;
            }
            if (!newPassword || newPassword.length < 6) {
                window.APP.setFieldError(qs("#new_password"), "Password must be at least 6 characters.");
                valid = false;
            }
            if (newPassword !== confirmPassword) {
                window.APP.setFieldError(qs("#confirm_new_password"), "Passwords do not match.");
                valid = false;
            }

            if (!valid) {
                showPasswordMessage("error", "Please fix the highlighted fields.");
                return;
            }

            const submitBtn = qs("#password-save-btn");
            window.APP.setButtonLoading(submitBtn, true, "Updating...");

            try {
                const result = await window.UserAPI.updatePassword(token, {
                    current_password: currentPassword,
                    new_password: newPassword,
                });
                passwordForm.reset();
                showPasswordMessage("success", result.message || "Password updated successfully.");
                window.APP.showToast("Password updated", "success");
            } catch (err) {
                const msg = err && err.message ? err.message : "Failed to update password.";
                showPasswordMessage("error", msg);
                window.APP.showToast(msg, "error");
            } finally {
                window.APP.setButtonLoading(submitBtn, false);
            }
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        const page = document.body.dataset.page || "";

        if (page === "register") handleRegister();
        if (page === "login") handleLogin();
        if (page === "dashboard") handleDashboard();
        if (page === "my_profile") handleMyProfile();
    });
})();
