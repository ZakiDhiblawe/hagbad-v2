(function () {
    const DEFAULT_API_BASE = "http://localhost:8000";
    const TOKEN_KEY = "hagbad_access_token";
    const PROFILE_KEY = "hagbad_current_profile";

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
        if (window.HAGBAD_CONFIG && typeof window.HAGBAD_CONFIG.apiBaseUrl === "string") {
            return window.HAGBAD_CONFIG.apiBaseUrl.trim();
        }

        // Legacy fallback: <meta name="api-base" content="http://localhost:8000">
        const meta = document.querySelector('meta[name="api-base"]');
        if (meta && typeof meta.content === "string") {
            return meta.content.trim();
        }

        return DEFAULT_API_BASE;
    }

    function buildApiUrl(path) {
        if (!path) return "";
        if (/^https?:\/\//i.test(path)) return path;
        const base = getApiBase().replace(/\/+$/, "");
        const suffix = String(path).startsWith("/") ? path : `/${path}`;
        return `${base}${suffix}`;
    }

    function getToken() {
        if (!localStorageAvailable()) return null;
        return window.localStorage.getItem(TOKEN_KEY);
    }

    function setToken(token) {
        if (!localStorageAvailable()) return;
        window.localStorage.setItem(TOKEN_KEY, token);
    }

    function getStoredProfile() {
        if (!localStorageAvailable()) return null;
        const raw = window.localStorage.getItem(PROFILE_KEY);
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch {
            window.localStorage.removeItem(PROFILE_KEY);
            return null;
        }
    }

    function setStoredProfile(profile) {
        if (!localStorageAvailable()) return;
        if (!profile) {
            window.localStorage.removeItem(PROFILE_KEY);
            return;
        }
        window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    }

    function clearToken() {
        if (!localStorageAvailable()) return;
        window.localStorage.removeItem(TOKEN_KEY);
        window.localStorage.removeItem(PROFILE_KEY);
    }

    function isAuthed() {
        return !!getToken();
    }

    function getRootPrefix() {
        return document.body.dataset.root === "true" ? "" : "../";
    }

    function getDefaultProfileImage() {
        return `${getRootPrefix()}assets/images/profile/user.png`;
    }

    function getProfileImageUrl(profile) {
        if (profile && profile.profile_image) {
            return buildApiUrl(profile.profile_image);
        }
        return getDefaultProfileImage();
    }

    function getDisplayName(profile) {
        return profile && profile.full_name ? profile.full_name : "User";
    }

    async function fetchCurrentUser(force = false) {
        const token = getToken();
        if (!token) return null;

        if (!force) {
            const cached = getStoredProfile();
            if (cached) return cached;
        }

        let response;
        try {
            response = await fetch(buildApiUrl("/profile"), {
                method: "GET",
                headers: {
                    "Accept": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
            });
        } catch {
            throw {
                status: 0,
                message: "Could not load your profile. Check backend connectivity.",
            };
        }

        if (response.status === 401) {
            clearToken();
            throw {
                status: 401,
                message: "Session expired. Please log in again.",
            };
        }

        if (!response.ok) {
            throw {
                status: response.status,
                message: `Failed to load profile (${response.status}).`,
            };
        }

        const profile = await response.json();
        setStoredProfile(profile);
        return profile;
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

    async function logout() {
        const token = getToken();
        if (token) {
            try {
                await fetch(buildApiUrl("/logout"), {
                    method: "POST",
                    headers: {
                        "Accept": "application/json",
                        "Authorization": `Bearer ${token}`,
                    },
                });
            } catch {
                // Best-effort logout. If the backend is unavailable we still clear local state.
            }
        }

        clearToken();
    }

    function buildUserMenu(profile, { compact = false } = {}) {
        const rootPrefix = getRootPrefix();
        const wrapper = document.createElement("details");
        wrapper.className = `user-menu${compact ? " compact" : ""}`;

        const summary = document.createElement("summary");
        summary.className = "user-menu-toggle";

        const avatar = document.createElement("img");
        avatar.className = "user-menu-avatar";
        avatar.src = getProfileImageUrl(profile);
        avatar.alt = `${getDisplayName(profile)} profile image`;
        avatar.onerror = () => {
            avatar.onerror = null;
            avatar.src = getDefaultProfileImage();
        };

        const summaryCopy = document.createElement("span");
        summaryCopy.className = "user-menu-copy";

        const summaryName = document.createElement("span");
        summaryName.className = "user-menu-name";
        summaryName.textContent = getDisplayName(profile);

        summaryCopy.appendChild(summaryName);
        if (!compact) {
            const summaryMeta = document.createElement("span");
            summaryMeta.className = "user-menu-meta";
            summaryMeta.textContent = "Workspace member";
            summaryCopy.appendChild(summaryMeta);
        }

        const chevron = document.createElement("span");
        chevron.className = "user-menu-chevron";
        chevron.innerHTML = "&#9662;";

        summary.appendChild(avatar);
        if (!compact) summary.appendChild(summaryCopy);
        summary.appendChild(chevron);

        const panel = document.createElement("div");
        panel.className = "user-menu-panel";

        const label = document.createElement("div");
        label.className = "user-menu-label";
        label.textContent = getDisplayName(profile);

        const profileLink = document.createElement("a");
        profileLink.className = "user-menu-link";
        profileLink.href = `${rootPrefix}pages/my_profile.html`;
        profileLink.textContent = "My Profile";

        const logoutBtn = document.createElement("button");
        logoutBtn.type = "button";
        logoutBtn.className = "user-menu-link primary-action";
        logoutBtn.textContent = "Logout";
        logoutBtn.addEventListener("click", async () => {
            await logout();
            showToast("Logged out", "info");
            navigate(`${rootPrefix}index.html`);
        });

        panel.appendChild(label);
        panel.appendChild(profileLink);
        panel.appendChild(logoutBtn);

        wrapper.appendChild(summary);
        wrapper.appendChild(panel);
        return wrapper;
    }

    function mountUserMenu(target, profile, options = {}) {
        if (!target) return;
        while (target.firstChild) target.removeChild(target.firstChild);
        target.appendChild(buildUserMenu(profile, options));
    }

    function resolveNode(target) {
        if (!target) return null;
        if (typeof target === "string") return document.querySelector(target);
        return target;
    }

    function setTextContent(target, value) {
        const node = resolveNode(target);
        if (!node) return;
        node.textContent = value || "";
    }

    function setHref(target, href) {
        const node = resolveNode(target);
        if (!node) return;
        node.setAttribute("href", href);
    }

    function setHidden(target, hidden) {
        const node = resolveNode(target);
        if (!node) return;
        node.hidden = !!hidden;
    }

    function findClosestListItem(target) {
        const node = resolveNode(target);
        return node ? node.closest("li") : null;
    }

    function updateSidebarLink(target, { label, iconClass } = {}) {
        const node = resolveNode(target);
        if (!node) return;

        if (iconClass) {
            const icon = node.querySelector("i");
            if (icon) icon.className = iconClass;
        }

        if (label) {
            const labelNode = node.querySelector(".hide-menu") || node.querySelector("span");
            if (labelNode) labelNode.textContent = label;
        }
    }

    function ensureSidebarItem(sideNav, itemId, { href = "#", label = "", iconClass = "" } = {}) {
        if (!sideNav) return null;

        let item = resolveNode(`#${itemId}`);
        if (!item) {
            item = document.createElement("li");
            item.className = "sidebar-item";
            item.id = itemId;

            const link = document.createElement("a");
            link.className = "sidebar-link primary-hover-bg";
            link.href = href;
            link.setAttribute("aria-expanded", "false");

            const icon = document.createElement("i");
            icon.className = iconClass;

            const span = document.createElement("span");
            span.className = "hide-menu";
            span.textContent = label;

            link.appendChild(icon);
            link.appendChild(span);
            item.appendChild(link);
            sideNav.appendChild(item);
            return item;
        }

        const link = item.querySelector("a");
        if (link) {
            link.href = href;
            updateSidebarLink(link, { label, iconClass });
        }
        return item;
    }

    function applyGroupWorkspaceNav({
        groupId,
        activeKey = "",
        pageTitle = "",
        pageLabel = "Group workspace",
        canUpdateGroup = false,
        canCreateCycle = false,
        canAccessAdministration = false,
        showJoinRequests = true,
    } = {}) {
        if (!groupId) return null;

        const normalizedActiveKey = ["profile", "update"].includes(activeKey) ? "settings" : activeKey;

        const links = {
            dashboard: `group_detail.html?id=${groupId}`,
            cycles: `cycles.html?group_id=${groupId}`,
            members: `group_members.html?group_id=${groupId}`,
            update: `group_settings.html?group_id=${groupId}`,
            requests: `group_review.html?group_id=${groupId}`,
            settings: `group_settings.html?group_id=${groupId}`,
            back_groups: "my_groups.html",
            invites: `invites.html?group_id=${groupId}`,
            add_cycle: `cycles.html?group_id=${groupId}&open=create`,
        };

        const navSelectors = {
            dashboard: "#group-nav-dashboard",
            cycles: "#group-nav-cycles",
            members: "#group-nav-members",
            update: "#group-nav-update",
            requests: "#group-nav-requests",
            settings: "#group-nav-settings",
        };

        updateSidebarLink("#group-nav-dashboard", {
            label: "Dashboard",
            iconClass: "ti ti-layout-dashboard",
        });
        updateSidebarLink("#group-nav-cycles", {
            label: "Cycle",
            iconClass: "ti ti-refresh",
        });
        updateSidebarLink("#group-nav-members", {
            label: "Members",
            iconClass: "ti ti-users",
        });
        updateSidebarLink("#group-nav-update", {
            label: "Setting",
            iconClass: "ti ti-adjustments-horizontal",
        });
        updateSidebarLink("#group-nav-requests", {
            label: "Join Requests",
            iconClass: "ti ti-user-plus",
        });
        updateSidebarLink("#group-nav-settings", {
            label: "Setting",
            iconClass: "ti ti-adjustments-horizontal",
        });

        const sideNav = resolveNode("#sidebarnav");
        const caps = sideNav ? Array.from(sideNav.querySelectorAll(".nav-small-cap")) : [];
        const mainCap = caps.find((node) => node.id !== "group-admin-cap") || null;
        const adminCap = resolveNode("#group-admin-cap");
        const backGroupsItem = ensureSidebarItem(sideNav, "group-nav-back-groups-item", {
            href: links.back_groups,
            label: "Back to Groups",
            iconClass: "ti ti-arrow-left",
        });
        if (mainCap) {
            const capLabel = mainCap.querySelector(".hide-menu") || mainCap;
            capLabel.textContent = "Main";
        }
        if (adminCap) {
            const capLabel = adminCap.querySelector(".hide-menu") || adminCap;
            capLabel.textContent = "Administration";
            adminCap.hidden = !canAccessAdministration;
        }

        const dashboardItem = findClosestListItem("#group-nav-dashboard");
        const cyclesItem = findClosestListItem("#group-nav-cycles");
        const membersItem = findClosestListItem("#group-nav-members");
        const profileItem = resolveNode("#group-nav-update-item") || findClosestListItem("#group-nav-update");
        const requestsItem = findClosestListItem("#group-nav-requests");
        const settingsItem = findClosestListItem("#group-nav-settings");
        const invitesItem = findClosestListItem("#group-nav-invites");
        const addCycleItem = resolveNode("#group-nav-add-cycle-item") || findClosestListItem("#group-nav-add-cycle");

        if (profileItem) profileItem.hidden = true;
        if (requestsItem) requestsItem.hidden = !canAccessAdministration || !showJoinRequests;
        if (settingsItem) settingsItem.hidden = !canAccessAdministration;
        if (invitesItem) invitesItem.hidden = true;
        if (addCycleItem) addCycleItem.hidden = !canCreateCycle;
        if (backGroupsItem) backGroupsItem.hidden = false;

        if (sideNav) {
            [
                mainCap,
                dashboardItem,
                cyclesItem,
                membersItem,
                adminCap,
                profileItem,
                requestsItem,
                settingsItem,
                invitesItem,
                addCycleItem,
                backGroupsItem,
            ].filter(Boolean).forEach((node) => sideNav.appendChild(node));
        }

        Object.entries(navSelectors).forEach(([key, selector]) => {
            const node = resolveNode(selector);
            if (!node) return;
            setHref(node, links[key]);
            const isActive = key === normalizedActiveKey;
            node.classList.toggle("active", isActive);
            if (isActive) {
                node.setAttribute("aria-current", "page");
            } else {
                node.removeAttribute("aria-current");
            }
        });

        setHref("#group-brand-link", links.dashboard);
        setTextContent("#page-title-label", pageLabel);
        if (pageTitle) {
            const heading = resolveNode("#page-title-heading") || resolveNode("#page-title");
            if (heading) heading.textContent = pageTitle;
        }

        return links;
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
        const myGroupsHref = `${rootPrefix}pages/my_groups.html`;

        nav.appendChild(navLink("Home", indexHref, activePage === "home"));

        if (isAuthed()) {
            nav.appendChild(navLink("Dashboard", dashHref, activePage === "dashboard"));
            nav.appendChild(
                navLink(
                    "Groups",
                    myGroupsHref,
                    ["groups", "my_groups", "explore_groups", "add_group", "group_detail", "group_members", "group_member_detail", "cycles", "cycle_detail", "cycle_members", "cycle_member_detail", "payments", "payment_detail", "payouts", "payout_detail"].includes(activePage)
                )
            );
            nav.appendChild(
                navLink("Settings", `${rootPrefix}pages/group_settings.html`,
                    ["group_settings", "group_settings_detail"].includes(activePage))
            );

            nav.appendChild(
                navLink(
                    "Group Review",
                    `${rootPrefix}pages/group_review.html`,
                    activePage === "group_review"
                )
            );

            nav.appendChild(
                navLink(
                    "Join Requests",
                    `${rootPrefix}pages/join_requests.html`,
                    activePage === "join_requests"
                )
            );
            const menuMount = document.createElement("div");
            menuMount.className = "nav-user-mount";
            nav.appendChild(menuMount);

            const cachedProfile = getStoredProfile();
            mountUserMenu(menuMount, cachedProfile, { compact: false });
            fetchCurrentUser()
                .then((profile) => mountUserMenu(menuMount, profile, { compact: false }))
                .catch(() => {
                    if (!cachedProfile) mountUserMenu(menuMount, null, { compact: false });
                });
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
        buildApiUrl,
        getToken,
        setToken,
        clearToken,
        isAuthed,
        getRootPrefix,
        getDefaultProfileImage,
        getProfileImageUrl,
        getDisplayName,
        fetchCurrentUser,
        getStoredProfile,
        setStoredProfile,
        mountUserMenu,
        applyGroupWorkspaceNav,
        navigate,
        showToast,
        setButtonLoading,
        setFieldError,
        clearFieldError,
        logout,
        renderHeader,
        requireAuthOrRedirect,
    };

    // Auto-render header once DOM is ready
    document.addEventListener("DOMContentLoaded", () => {
        const page = document.body.dataset.page || "";
        renderHeader(page);
    });
})();
