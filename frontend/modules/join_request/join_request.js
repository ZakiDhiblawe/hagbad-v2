(function () {
    function qs(sel) {
        return document.querySelector(sel);
    }

    function text(el, value) {
        if (el) el.textContent = value || "";
    }

    function show(el, yes) {
        if (!el) return;
        el.hidden = !yes;
    }

    function empty(el) {
        if (el) el.innerHTML = "";
    }

    function qparam(name) {
        return new URL(window.location.href).searchParams.get(name);
    }

    function formatDate(value) {
        if (!value) return "-";
        const dt = new Date(value);
        if (Number.isNaN(dt.getTime())) return String(value);
        return dt.toLocaleString();
    }

    function setInlineButtonLoading(btn, loading, label) {
        if (!btn) return;
        if (loading) {
            btn.dataset.originalHtml = btn.innerHTML;
            btn.innerHTML = `<span>${label}</span>`;
            btn.disabled = true;
            return;
        }
        btn.innerHTML = btn.dataset.originalHtml || btn.innerHTML;
        btn.disabled = false;
    }

    function makeEmptyState(message) {
        const div = document.createElement("div");
        div.className = "member-empty-state";
        div.textContent = message;
        return div;
    }

    function setBox(id, message) {
        const el = qs(id);
        if (!el) return;
        el.hidden = !message;
        el.textContent = message || "";
    }

    function mountWorkspaceMenu(profile) {
        const mount = qs("#workspace-user-menu");
        if (!mount || !profile) return;
        APP.mountUserMenu(mount, profile, { compact: false });
    }

    function handleAuthError(err) {
        if (err && err.status === 401) {
            APP.clearToken();
            APP.showToast("Session expired. Please log in again.", "info");
            APP.navigate("../pages/login.html");
            return true;
        }
        return false;
    }

    async function ensureWorkspaceProfile() {
        try {
            return await APP.fetchCurrentUser(true);
        } catch (err) {
            if (handleAuthError(err)) return null;
            throw err;
        }
    }

    async function safeFetchGroup(groupId) {
        const res = await fetch(`${APP.getApiBase()}/groups/${groupId}`, {
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${APP.getToken()}`,
            },
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
            const message =
                data && typeof data.detail === "string"
                    ? data.detail
                    : `Failed to load group (${res.status})`;
            throw { status: res.status, message };
        }

        return data;
    }

    async function myRole(groupId, myId) {
        for (let page = 1; page <= 25; page += 1) {
            const params = new URLSearchParams({ group_id: String(groupId), page: String(page), size: "100" });
            const res = await fetch(`${APP.getApiBase()}/group-members/?${params.toString()}`, {
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${APP.getToken()}`,
                },
            });
            if (!res.ok) return null;
            const items = await res.json().catch(() => []);
            const me = (items || []).find((member) => Number(member.user_id) === Number(myId));
            if (me) return me.role;
            if (!Array.isArray(items) || items.length < 100) break;
        }
        return null;
    }

    function applyGroupWorkspace(profile, group, role, pageTitle) {
        if (!group || !profile) return;
        mountWorkspaceMenu(profile);
        APP.applyGroupWorkspaceNav({
            groupId: group.id,
            activeKey: "requests",
            pageTitle,
            canUpdateGroup: Number(group.created_by) === Number(profile.id),
            canCreateCycle: Number(group.created_by) === Number(profile.id) || role === "admin",
            canAccessAdministration:
                Number(group.created_by) === Number(profile.id) || role === "admin" || role === "moderator",
            showJoinRequests: group.privacy !== "public",
        });
    }

    function createBadge(label, tone = "info") {
        const badge = document.createElement("span");
        badge.className = `badge ${tone}`;
        badge.textContent = label;
        return badge;
    }

    function createContextChip(label, tone = "neutral") {
        const chip = document.createElement("span");
        chip.className = `member-context-chip ${tone}`;
        chip.textContent = label;
        return chip;
    }

    function isExpired(expiresAt) {
        if (!expiresAt) return false;
        const dt = new Date(expiresAt);
        return Number.isFinite(dt.getTime()) && dt.getTime() <= Date.now();
    }

    function isActiveInvite(invite) {
        return Boolean(invite) && !invite.used && !isExpired(invite.expires_at);
    }

    function activeInvite(invites) {
        return (invites || []).find((invite) => isActiveInvite(invite)) || null;
    }

    function copyToClipboard(value) {
        if (!navigator.clipboard) {
            APP.showToast("Clipboard is not available in this browser.", "error");
            return;
        }
        navigator.clipboard.writeText(value)
            .then(() => APP.showToast("Code copied", "success"))
            .catch(() => APP.showToast("Failed to copy code", "error"));
    }

    function renderMyRequests(items) {
        const mount = qs("#my-request-list");
        if (!mount) return;
        empty(mount);

        if (!Array.isArray(items) || items.length === 0) {
            mount.appendChild(makeEmptyState("You do not have any join requests yet."));
            return;
        }

        items.forEach((item) => {
            const card = document.createElement("div");
            card.className = "request-card";

            const top = document.createElement("div");
            top.className = "request-top";

            const left = document.createElement("div");
            left.style.flex = "1";

            const title = document.createElement("div");
            title.className = "request-title";
            title.textContent = `Group #${item.group_id}`;

            const meta = document.createElement("div");
            meta.className = "request-meta";

            const badges = document.createElement("div");
            badges.className = "badge-row";
            badges.appendChild(createBadge(item.status === "approved" ? "Approved" : item.status === "rejected" ? "Rejected" : "Pending",
                item.status === "approved" ? "ok" : item.status === "rejected" ? "bad" : "warn"));
            badges.appendChild(createBadge(`Request #${item.id}`, "info"));

            const requestedAt = document.createElement("div");
            requestedAt.textContent = `Requested: ${formatDate(item.requested_at)}`;

            meta.appendChild(badges);
            meta.appendChild(requestedAt);
            left.appendChild(title);
            left.appendChild(meta);

            const actions = document.createElement("div");
            actions.className = "request-actions";

            if (item.status === "pending") {
                const cancelBtn = document.createElement("button");
                cancelBtn.type = "button";
                cancelBtn.className = "btn btn-danger";
                cancelBtn.textContent = "Cancel";
                cancelBtn.addEventListener("click", async () => {
                    if (!window.confirm("Cancel this join request?")) return;
                    APP.setButtonLoading(cancelBtn, true, "Cancelling...");
                    try {
                        await JoinRequestAPI.cancelJoinRequest(item.id);
                        APP.showToast("Join request cancelled", "success");
                        await loadMyRequests();
                    } catch (err) {
                        if (!handleAuthError(err)) {
                            APP.showToast(err.message || "Failed to cancel request.", "error");
                        }
                    } finally {
                        APP.setButtonLoading(cancelBtn, false);
                    }
                });
                actions.appendChild(cancelBtn);
            }

            const openBtn = document.createElement("button");
            openBtn.type = "button";
            openBtn.className = "btn btn-secondary";
            openBtn.textContent = "Open Group";
            openBtn.addEventListener("click", () => {
                APP.navigate(`../pages/group_detail.html?id=${item.group_id}`);
            });
            actions.appendChild(openBtn);

            top.appendChild(left);
            top.appendChild(actions);
            card.appendChild(top);
            mount.appendChild(card);
        });
    }

    async function loadMyRequests() {
        if (!qs("#my-request-list")) return;
        setBox("#my-error", "");
        try {
            const items = await JoinRequestAPI.listMyJoinRequests();
            renderMyRequests(items);
        } catch (err) {
            if (handleAuthError(err)) return;
            setBox("#my-error", err.message || "Failed to load your join requests.");
            renderMyRequests([]);
        }
    }

    async function handleCreateJoinRequest(event) {
        event.preventDefault();
        setBox("#my-error", "");
        setBox("#my-success", "");

        const groupId = Number(qs("#group_id").value);
        const btn = qs("#create-request-btn");

        if (!groupId || groupId < 1) {
            setBox("#my-error", "Please enter a valid group id.");
            return;
        }

        APP.setButtonLoading(btn, true, "Sending...");
        try {
            await JoinRequestAPI.createJoinRequest({ group_id: groupId });
            setBox("#my-success", "Join request sent successfully.");
            APP.showToast("Join request sent", "success");
            await loadMyRequests();
        } catch (err) {
            if (!handleAuthError(err)) {
                setBox("#my-error", err.message || "Failed to send join request.");
                APP.showToast(err.message || "Failed to send join request.", "error");
            }
        } finally {
            APP.setButtonLoading(btn, false);
        }
    }

    function hasGroupReviewUI() {
        return !!qs("#review-group-name") && !!qs("#group-request-list");
    }

    function renderReviewBadges(group, role, isCreator) {
        const mount = qs("#review-badges");
        empty(mount);
        if (!mount) return;

        const badges = [
            createContextChip(`Group #${group.id}`, "neutral"),
            createContextChip(group.privacy === "private" ? "Private group" : "Public group", group.privacy),
            createContextChip(group.visible ? "Visible" : "Hidden", group.visible ? "active" : "neutral"),
        ];

        if (isCreator) {
            badges.push(createContextChip("Creator view", "admin"));
        } else if (role) {
            badges.push(createContextChip(`Your role: ${role === "moderator" ? "Moderator" : "Admin"}`, role));
        }

        badges.forEach((badge) => mount.appendChild(badge));
    }

    function renderRequestSummary(requests, activeCode, group) {
        const counts = (requests || []).reduce((acc, item) => {
            acc.total += 1;
            if (item.status === "pending") acc.pending += 1;
            else if (item.status === "approved") acc.approved += 1;
            else if (item.status === "rejected") acc.rejected += 1;
            return acc;
        }, { total: 0, pending: 0, approved: 0, rejected: 0 });

        text(qs("#summary-total-requests"), String(counts.total));
        text(qs("#summary-pending-requests"), String(counts.pending));
        text(qs("#summary-approved-requests"), String(counts.approved));
        text(qs("#summary-active-code"), activeCode ? "Ready" : "None");

        const note = qs("#summary-mode-note");
        if (!note) return;

        if (group.privacy === "public") {
            note.textContent = "Public groups do not use join requests or hidden invite codes.";
        } else if (group.visible) {
            note.textContent = "Visible private groups accept membership requests from discovery.";
        } else {
            note.textContent = activeCode
                ? "Hidden private group. Share the active code to let members join directly."
                : "Hidden private group. Generate one active code to allow direct joining.";
        }
    }

    function renderRequestList(group, requests, permissions) {
        const mount = qs("#group-request-list");
        empty(mount);
        if (!mount) return;

        const pending = (requests || []).filter((item) => item.status === "pending");
        text(qs("#pending-count-label"), `${pending.length} pending`);

        if (group.privacy === "public") {
            mount.appendChild(makeEmptyState("Public groups do not use join requests."));
            return;
        }

        if (!group.visible) {
            mount.appendChild(makeEmptyState("Hidden private groups do not collect join requests. Use the active code below instead."));
            return;
        }

        if (!pending.length) {
            mount.appendChild(makeEmptyState("No pending requests right now."));
            return;
        }

        pending.forEach((item) => {
            const article = document.createElement("article");
            article.className = "group-member-card tone-member";

            const main = document.createElement("div");
            main.className = "group-member-main";

            const avatarShell = document.createElement("div");
            avatarShell.className = "group-member-avatar-shell tone-member";

            const avatar = document.createElement("img");
            avatar.className = "group-member-avatar";
            avatar.src = APP.getProfileImageUrl({ profile_image: item.profile_image });
            avatar.alt = `${item.full_name || `User #${item.user_id}`} profile image`;
            avatar.onerror = () => {
                avatar.onerror = null;
                avatar.src = APP.getDefaultProfileImage();
            };

            avatarShell.appendChild(avatar);

            const copy = document.createElement("div");
            copy.className = "group-member-copy";

            const heading = document.createElement("div");
            heading.className = "group-member-heading";

            const title = document.createElement("h4");
            title.className = "group-member-name";
            title.textContent = item.full_name || `User #${item.user_id}`;

            const badges = document.createElement("div");
            badges.className = "badge-row";
            badges.appendChild(createBadge("Pending", "warn"));
            badges.appendChild(createBadge(`User #${item.user_id}`, "info"));

            const meta = document.createElement("p");
            meta.className = "group-member-meta";
            meta.textContent = `Requested ${formatDate(item.requested_at)}`;

            heading.appendChild(title);
            heading.appendChild(badges);
            copy.appendChild(heading);
            copy.appendChild(meta);

            main.appendChild(avatarShell);
            main.appendChild(copy);
            article.appendChild(main);

            const actions = document.createElement("div");
            actions.className = "group-member-actions";

            if (permissions.canApprove) {
                const approveBtn = document.createElement("button");
                approveBtn.type = "button";
                approveBtn.className = "member-action-btn primary";
                approveBtn.innerHTML = `<i class="ti ti-check"></i><span>Accept</span>`;
                approveBtn.addEventListener("click", async () => {
                    setInlineButtonLoading(approveBtn, true, "Accepting...");
                    try {
                        await JoinRequestAPI.decideJoinRequest(item.id, "approve");
                        APP.showToast("Request accepted", "success");
                        await permissions.reload();
                    } catch (err) {
                        if (!handleAuthError(err)) {
                            APP.showToast(err.message || "Failed to accept request.", "error");
                        }
                    } finally {
                        setInlineButtonLoading(approveBtn, false);
                    }
                });
                actions.appendChild(approveBtn);
            }

            if (permissions.canReject) {
                const rejectBtn = document.createElement("button");
                rejectBtn.type = "button";
                rejectBtn.className = "member-action-btn danger";
                rejectBtn.innerHTML = `<i class="ti ti-x"></i><span>Reject</span>`;
                rejectBtn.addEventListener("click", async () => {
                    setInlineButtonLoading(rejectBtn, true, "Rejecting...");
                    try {
                        await JoinRequestAPI.decideJoinRequest(item.id, "reject");
                        APP.showToast("Request rejected", "success");
                        await permissions.reload();
                    } catch (err) {
                        if (!handleAuthError(err)) {
                            APP.showToast(err.message || "Failed to reject request.", "error");
                        }
                    } finally {
                        setInlineButtonLoading(rejectBtn, false);
                    }
                });
                actions.appendChild(rejectBtn);
            }

            article.appendChild(actions);
            mount.appendChild(article);
        });
    }

    function renderInvitePanel(group, invites, permissions) {
        const panel = qs("#invite-code-panel");
        const generateBtn = qs("#generate-code-btn");
        const copyBtn = qs("#copy-code-btn");
        const deactivateBtn = qs("#deactivate-code-btn");
        const stateLabel = qs("#invite-panel-state");
        const codeValue = qs("#invite-code-value");
        const codeMeta = qs("#invite-code-meta");

        const isHiddenPrivate = group.privacy === "private" && !group.visible;
        show(panel, isHiddenPrivate);
        if (!isHiddenPrivate) return;

        const currentInvite = activeInvite(invites);
        const hasActiveCode = Boolean(currentInvite);

        text(stateLabel, hasActiveCode ? "Active code ready" : "No active code");
        text(codeValue, hasActiveCode ? currentInvite.code : "No active code");
        text(
            codeMeta,
            hasActiveCode
                ? `Created ${formatDate(currentInvite.created_at)}${currentInvite.expires_at ? ` • Expires ${formatDate(currentInvite.expires_at)}` : " • No expiry"}`
                : "Generate one reusable code for this hidden private group."
        );

        show(copyBtn, hasActiveCode);
        show(deactivateBtn, hasActiveCode && permissions.canDeactivateCode);
        if (generateBtn) generateBtn.disabled = hasActiveCode || !permissions.canGenerateCode;

        if (generateBtn) {
            generateBtn.onclick = async () => {
                setInlineButtonLoading(generateBtn, true, "Generating...");
                try {
                    await InviteAPI.createInvite({ group_id: group.id });
                    APP.showToast("Invite code generated", "success");
                    await permissions.reload();
                } catch (err) {
                    if (!handleAuthError(err)) {
                        APP.showToast(err.message || "Failed to generate code.", "error");
                    }
                } finally {
                    setInlineButtonLoading(generateBtn, false);
                }
            };
        }

        if (copyBtn) {
            copyBtn.onclick = () => {
                if (currentInvite) copyToClipboard(currentInvite.code);
            };
        }

        if (deactivateBtn) {
            deactivateBtn.onclick = async () => {
                if (!permissions.canDeactivateCode || !currentInvite) return;
                setInlineButtonLoading(deactivateBtn, true, "Deactivating...");
                try {
                    await InviteAPI.deleteInvite(currentInvite.id);
                    APP.showToast("Invite code deactivated", "success");
                    await permissions.reload();
                } catch (err) {
                    if (!handleAuthError(err)) {
                        APP.showToast(err.message || "Failed to deactivate code.", "error");
                    }
                } finally {
                    setInlineButtonLoading(deactivateBtn, false);
                }
            };
        }
    }

    async function initGroupReviewPage() {
        const token = APP.requireAuthOrRedirect();
        if (!token) return;

        const groupId = Number(qparam("group_id") || "");
        if (!groupId || groupId < 1) {
            setBox("#admin-error", "Missing group_id. Open this page from a group workspace.");
            return;
        }

        let profile;
        try {
            profile = await ensureWorkspaceProfile();
            if (!profile) return;
        } catch (err) {
            setBox("#admin-error", err.message || "Failed to load your profile.");
            return;
        }

        let currentGroup = null;
        let currentRole = null;

        const reload = async () => {
            setBox("#admin-error", "");
            setBox("#admin-success", "");
            text(qs("#admin-info"), "Loading join review...");

            try {
                currentGroup = await safeFetchGroup(groupId);
                currentRole = await myRole(groupId, profile.id).catch(() => null);

                const isCreator = Number(currentGroup.created_by) === Number(profile.id);
                const canApprove = isCreator || currentRole === "admin" || currentRole === "moderator";
                const canReject = isCreator || currentRole === "admin";
                const canGenerateCode = canApprove;
                const canDeactivateCode = isCreator || currentRole === "admin";

                applyGroupWorkspace(profile, currentGroup, currentRole, "Join Requests");
                text(qs("#review-group-name"), currentGroup.name);
                text(
                    qs("#review-subtitle"),
                    currentGroup.privacy === "public"
                        ? "Public groups do not use join requests."
                        : currentGroup.visible
                            ? "Review incoming requests from visible private groups."
                            : "Manage the active code used to join this hidden private group."
                );
                renderReviewBadges(currentGroup, currentRole, isCreator);

                const requests = currentGroup.privacy === "private" && currentGroup.visible
                    ? await JoinRequestAPI.listGroupJoinRequests(groupId, "")
                    : [];
                const invites = currentGroup.privacy === "private" && !currentGroup.visible && window.InviteAPI
                    ? await InviteAPI.listInvites(groupId)
                    : [];

                renderRequestSummary(requests, activeInvite(invites), currentGroup);
                renderRequestList(currentGroup, requests, { canApprove, canReject, reload });
                renderInvitePanel(currentGroup, invites, { canGenerateCode, canDeactivateCode, reload });

                text(
                    qs("#admin-info"),
                    currentGroup.privacy === "public"
                        ? "Public groups skip join requests."
                        : currentGroup.visible
                        ? "Visible private group: moderators/admins can review join requests here."
                            : canDeactivateCode
                                ? "Hidden private group: generate, copy, or deactivate the single active invite code."
                                : "Hidden private group: moderators can generate a code only when none is active."
                );
            } catch (err) {
                if (handleAuthError(err)) return;
                setBox("#admin-error", err.message || "Failed to load join review.");
                empty(qs("#group-request-list"));
                qs("#group-request-list")?.appendChild(makeEmptyState("Could not load this group review page."));
                show(qs("#invite-code-panel"), false);
            }
        };

        const backBtn = qs("#back-to-groups");
        if (backBtn) {
            backBtn.addEventListener("click", () => {
                APP.navigate("../pages/my_groups.html");
            });
        }

        const refreshBtn = qs("#refresh-page");
        if (refreshBtn) {
            refreshBtn.addEventListener("click", () => {
                reload();
            });
        }

        await reload();
    }

    function initMyRequestsPage() {
        const token = APP.requireAuthOrRedirect();
        if (!token) return;

        const backBtn = qs("#back-to-groups");
        if (backBtn) {
            backBtn.addEventListener("click", () => {
                APP.navigate("../pages/my_groups.html");
            });
        }

        const refreshBtn = qs("#refresh-page");
        if (refreshBtn) {
            refreshBtn.addEventListener("click", () => {
                loadMyRequests();
            });
        }

        const createForm = qs("#create-request-form");
        if (createForm) {
            createForm.addEventListener("submit", handleCreateJoinRequest);
        }

        const groupIdFromUrl = Number(qparam("group_id") || "");
        const groupIdInput = qs("#group_id");
        if (groupIdInput && groupIdFromUrl > 0) {
            groupIdInput.value = groupIdFromUrl;
        }

        loadMyRequests();
    }

    document.addEventListener("DOMContentLoaded", () => {
        const page = document.body.dataset.page || "";
        if (page === "group_review") initGroupReviewPage();
        if (page === "join_requests") initMyRequestsPage();
    });
})();
