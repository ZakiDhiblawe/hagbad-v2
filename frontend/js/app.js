(function () {
    const DEFAULT_API_BASE = "http://localhost:8000";
    const TOKEN_KEY = "hagbad_access_token";

    function localStorageAvailable() {
        try {
            const k = "__hagbad_test__";
            window.localStorage.setItem(k, "1");
            window.localStorage.removeItem(k);
            return true;
        } catch {
            return false;
        }
    }

    function getApiBase() {
        // Optional override: <meta name="api-base" content="http://localhost:8000">
        const meta = document.querySelector('meta[name="api-base"]');
        const fromMeta = meta && meta.content ? meta.content.trim() : "";
        return fromMeta || DEFAULT_API_BASE;
    }

    function getToken() {
        if (!localStorageAvailable()) return null;
        return window.localStorage.getItem(TOKEN_KEY);
    }

    function setToken(token) {
        if (!localStorageAvailable()) return;
        window.localStorage.setItem(TOKEN_KEY, token);
    }

    function clearToken() {
        if (!localStorageAvailable()) return;
        window.localStorage.removeItem(TOKEN_KEY);
    }

    function isAuthed() {
        return !!getToken();
    }

    function navigate(path) {
        window.location.href = path;
    }

    function showToast(message, type = "info", timeoutMs = 2600) {
        const toast = document.getElementById("toast");
        if (!toast) return;

        toast.className = `toast show ${type}`;
        toast.textContent = message;

        window.setTimeout(() => {
            toast.className = "toast";
            toast.textContent = "";
        }, timeoutMs);
    }

    function setButtonLoading(btn, loading, loadingText = "Please wait...") {
        if (!btn) return;
        if (loading) {
            btn.dataset.originalText = btn.textContent;
            btn.textContent = loadingText;
            btn.disabled = true;
        } else {
            btn.textContent = btn.dataset.originalText || btn.textContent;
            btn.disabled = false;
        }
    }

    function setFieldError(input, msg) {
        if (!input) return;
        const id = input.getAttribute("id");
        if (!id) return;
        const err = document.getElementById(`${id}-error`);
        if (err) err.textContent = msg || "";
        input.setAttribute("aria-invalid", msg ? "true" : "false");
    }

    function clearFieldError(input) {
        setFieldError(input, "");
    }

    function renderHeader(activePage = "") {
        const mount = document.getElementById("app-header");
        if (!mount) return;

        // Clear existing
        while (mount.firstChild) mount.removeChild(mount.firstChild);

        const header = document.createElement("header");
        header.className = "app-header";

        const inner = document.createElement("div");
        inner.className = "header-inner";

        const brandLink = document.createElement("a");
        brandLink.href = "../index.html";
        // If already in root, this path will be wrong. We'll fix per page below.
        // Pages will override via data-root attribute.
        if (document.body.dataset.root === "true") {
            brandLink.href = "index.html";
        }

        brandLink.className = "brand";

        const badge = document.createElement("div");
        badge.className = "brand-badge";

        const brandText = document.createElement("div");
        brandText.textContent = "Hagbad";

        brandLink.appendChild(badge);
        brandLink.appendChild(brandText);

        const nav = document.createElement("nav");
        nav.className = "nav";

        function navLink(label, href, isActive) {
            const a = document.createElement("a");
            a.href = href;
            a.textContent = label;
            if (isActive) a.classList.add("active");
            return a;
        }

        const rootPrefix = document.body.dataset.root === "true" ? "" : "../";
        const indexHref = `${rootPrefix}index.html`;
        const loginHref = `${rootPrefix}pages/login.html`;
        const registerHref = `${rootPrefix}pages/register.html`;
        const dashHref = `${rootPrefix}pages/dashboard.html`;

        nav.appendChild(navLink("Home", indexHref, activePage === "home"));

        if (isAuthed()) {
            nav.appendChild(navLink("Dashboard", dashHref, activePage === "dashboard"));
            nav.appendChild(
                navLink(
                    "Groups",
                    `${rootPrefix}pages/groups.html`,
                    ["groups", "group_detail", "group_members", "group_member_detail"].includes(activePage)
                )
            );

            const logoutBtn = document.createElement("button");
            logoutBtn.type = "button";
            logoutBtn.textContent = "Logout";
            logoutBtn.className = "btn-secondary";
            logoutBtn.style.padding = "9px 12px";
            logoutBtn.style.borderRadius = "10px";
            logoutBtn.addEventListener("click", () => {
                clearToken();
                showToast("Logged out", "info");
                navigate(loginHref);
            });
            nav.appendChild(logoutBtn);
        } else {
            nav.appendChild(navLink("Login", loginHref, activePage === "login"));
            nav.appendChild(navLink("Register", registerHref, activePage === "register"));
        }

        inner.appendChild(brandLink);
        inner.appendChild(nav);
        header.appendChild(inner);
        mount.appendChild(header);
    }

    function requireAuthOrRedirect() {
        const token = getToken();
        if (!token) {
            showToast("Please log in to continue", "info");
            const rootPrefix = document.body.dataset.root === "true" ? "" : "../";
            navigate(`${rootPrefix}pages/login.html`);
            return null;
        }
        return token;
    }

    window.APP = {
        TOKEN_KEY,
        getApiBase,
        getToken,
        setToken,
        clearToken,
        isAuthed,
        navigate,
        showToast,
        setButtonLoading,
        setFieldError,
        clearFieldError,
        renderHeader,
        requireAuthOrRedirect,
    };

    // Auto-render header once DOM is ready
    document.addEventListener("DOMContentLoaded", () => {
        const page = document.body.dataset.page || "";
        renderHeader(page);
    });
})();
