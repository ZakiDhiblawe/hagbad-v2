(function () {
    function qs(sel) {
        return document.querySelector(sel);
    }

    function qparam(name) {
        return new URL(window.location.href).searchParams.get(name);
    }

    function text(el, value) {
        if (el) el.textContent = value;
    }

    function show(el, yes) {
        if (!el) return;
        el.hidden = !yes;
    }

    function setBox(id, message) {
        const el = qs(id);
        if (!el) return;
        el.hidden = !message;
        el.textContent = message || "";
    }

    function clearMessages() {
        setBox("#my-error", "");
        setBox("#my-success", "");
        setBox("#admin-error", "");
        setBox("#admin-success", "");
        setBox("#admin-info", "");
    }

    function badgeForStatus(status) {
        if (status === "approved") return { label: "Approved", cls: "ok" };
        if (status === "rejected") return { label: "Rejected", cls: "bad" };
        return { label: "Pending", cls: "warn" };
    }

    function formatDate(value) {
        if (!value) return "-";
        const dt = new Date(value);
        if (Number.isNaN(dt.getTime())) return value;
        return dt.toLocaleString();
    }

    function makeEmptyState(message) {
        const div = document.createElement("div");
        div.className = "empty-state";
        div.textContent = message;
        return div;
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

    async function safeFetchGroup(groupId) {
        const res = await fetch(`${APP.getApiBase()}/groups/${groupId}`, {
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${APP.getToken()}`,
            },
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
            const msg =
                data && typeof data.detail === "string"
                    ? data.detail
                    : `Failed to load group (${res.status})`;
            throw { status: res.status, message: msg };
        }

        return data;
    }

    function renderMyRequests(items) {
        const mount = qs("#my-request-list");
        if (!mount) return;

        mount.innerHTML = "";

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

            const badgeRow = document.createElement("div");
            badgeRow.className = "badge-row";

            const statusData = badgeForStatus(item.status);
            const statusBadge = document.createElement("span");
            statusBadge.className = `badge ${statusData.cls}`;
            statusBadge.textContent = statusData.label;

            const idBadge = document.createElement("span");
            idBadge.className = "badge info";
            idBadge.textContent = `Request #${item.id}`;

            badgeRow.appendChild(statusBadge);
            badgeRow.appendChild(idBadge);

            const requestedAt = document.createElement("div");
            requestedAt.textContent = `Requested: ${formatDate(item.requested_at)}`;

            const handledBy = document.createElement("div");
            handledBy.textContent = `Handled by: ${item.handled_by ?? "-"}`;

            meta.appendChild(badgeRow);
            meta.appendChild(requestedAt);
            meta.appendChild(handledBy);

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
                    const ok = window.confirm("Cancel this join request?");
                    if (!ok) return;

                    APP.setButtonLoading(cancelBtn, true, "Cancelling...");
                    try {
                        await JoinRequestAPI.cancelJoinRequest(item.id);
                        APP.showToast("Join request cancelled", "success");
                        setBox("#my-success", "Join request cancelled.");
                        await loadMyRequests();
                    } catch (err) {
                        if (handleAuthError(err)) return;
                        const msg = err.message || "Failed to cancel request.";
                        setBox("#my-error", msg);
                        APP.showToast(msg, "error");
                    } finally {
                        APP.setButtonLoading(cancelBtn, false);
                    }
                });

                actions.appendChild(cancelBtn);
            }

            const openGroupBtn = document.createElement("button");
            openGroupBtn.type = "button";
            openGroupBtn.className = "btn btn-secondary";
            openGroupBtn.textContent = "Open Group";

            openGroupBtn.addEventListener("click", () => {
                APP.navigate(`../pages/group_detail.html?id=${item.group_id}`);
            });

            actions.appendChild(openGroupBtn);

            top.appendChild(left);
            top.appendChild(actions);
            card.appendChild(top);
            mount.appendChild(card);
        });
    }

    function renderGroupRequests(items, groupId) {
        const mount = qs("#group-request-list");
        if (!mount) return;

        mount.innerHTML = "";

        if (!Array.isArray(items) || items.length === 0) {
            mount.appendChild(makeEmptyState("No join requests found for this group."));
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
            title.textContent = `User #${item.user_id} wants to join Group #${item.group_id}`;

            const meta = document.createElement("div");
            meta.className = "request-meta";

            const badgeRow = document.createElement("div");
            badgeRow.className = "badge-row";

            const statusData = badgeForStatus(item.status);
            const statusBadge = document.createElement("span");
            statusBadge.className = `badge ${statusData.cls}`;
            statusBadge.textContent = statusData.label;

            const idBadge = document.createElement("span");
            idBadge.className = "badge info";
            idBadge.textContent = `Request #${item.id}`;

            badgeRow.appendChild(statusBadge);
            badgeRow.appendChild(idBadge);

            const requestedAt = document.createElement("div");
            requestedAt.textContent = `Requested: ${formatDate(item.requested_at)}`;

            const handledBy = document.createElement("div");
            handledBy.textContent = `Handled by: ${item.handled_by ?? "-"}`;

            meta.appendChild(badgeRow);
            meta.appendChild(requestedAt);
            meta.appendChild(handledBy);

            left.appendChild(title);
            left.appendChild(meta);

            const actions = document.createElement("div");
            actions.className = "request-actions";

            if (item.status === "pending") {
                const approveBtn = document.createElement("button");
                approveBtn.type = "button";
                approveBtn.className = "btn btn-success";
                approveBtn.textContent = "Approve";

                approveBtn.addEventListener("click", async () => {
                    APP.setButtonLoading(approveBtn, true, "Approving...");
                    try {
                        await JoinRequestAPI.decideJoinRequest(item.id, "approve");
                        APP.showToast("Request approved", "success");
                        setBox("#admin-success", "Join request approved.");
                        await loadGroupRequests(groupId);
                    } catch (err) {
                        if (handleAuthError(err)) return;
                        const msg = err.message || "Failed to approve request.";
                        setBox("#admin-error", msg);
                        APP.showToast(msg, "error");
                    } finally {
                        APP.setButtonLoading(approveBtn, false);
                    }
                });

                const rejectBtn = document.createElement("button");
                rejectBtn.type = "button";
                rejectBtn.className = "btn btn-danger";
                rejectBtn.textContent = "Reject";

                rejectBtn.addEventListener("click", async () => {
                    APP.setButtonLoading(rejectBtn, true, "Rejecting...");
                    try {
                        await JoinRequestAPI.decideJoinRequest(item.id, "reject");
                        APP.showToast("Request rejected", "success");
                        setBox("#admin-success", "Join request rejected.");
                        await loadGroupRequests(groupId);
                    } catch (err) {
                        if (handleAuthError(err)) return;
                        const msg = err.message || "Failed to reject request.";
                        setBox("#admin-error", msg);
                        APP.showToast(msg, "error");
                    } finally {
                        APP.setButtonLoading(rejectBtn, false);
                    }
                });

                actions.appendChild(approveBtn);
                actions.appendChild(rejectBtn);
            }

            const membersBtn = document.createElement("button");
            membersBtn.type = "button";
            membersBtn.className = "btn btn-secondary";
            membersBtn.textContent = "Members";

            membersBtn.addEventListener("click", () => {
                APP.navigate(`../pages/group_members.html?group_id=${item.group_id}`);
            });

            actions.appendChild(membersBtn);

            top.appendChild(left);
            top.appendChild(actions);
            card.appendChild(top);
            mount.appendChild(card);
        });
    }

    async function loadMyRequests() {
        setBox("#my-error", "");
        try {
            const items = await JoinRequestAPI.listMyJoinRequests();
            renderMyRequests(items);
        } catch (err) {
            if (handleAuthError(err)) return;
            const msg = err.message || "Failed to load your join requests.";
            setBox("#my-error", msg);
            APP.showToast(msg, "error");
            renderMyRequests([]);
        }
    }

    async function loadGroupRequests(groupId) {
        if (!groupId || groupId < 1) {
            qs("#group-request-list").innerHTML = "";
            qs("#group-request-list").appendChild(makeEmptyState("Enter a valid group id to review requests."));
            return;
        }

        setBox("#admin-error", "");
        setBox("#admin-success", "");
        setBox("#admin-info", "Loading group requests...");

        const statusValue = qs("#status_filter").value;

        try {
            const group = await safeFetchGroup(groupId);
            setBox("#admin-info", `Reviewing join requests for: ${group.name} (Group #${group.id})`);

            const items = await JoinRequestAPI.listGroupJoinRequests(groupId, statusValue);
            renderGroupRequests(items, groupId);
        } catch (err) {
            if (handleAuthError(err)) return;

            const msg = err.message || "Failed to load group join requests.";
            setBox("#admin-error", msg);
            setBox("#admin-info", "");
            APP.showToast(msg, "error");

            const mount = qs("#group-request-list");
            mount.innerHTML = "";
            mount.appendChild(makeEmptyState("Could not load group requests."));
        }
    }

    async function handleCreateJoinRequest(event) {
        event.preventDefault();
        clearMessages();

        const groupIdInput = qs("#group_id");
        const btn = qs("#create-request-btn");

        const groupId = Number(groupIdInput.value);

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
            if (handleAuthError(err)) return;
            const msg = err.message || "Failed to send join request.";
            setBox("#my-error", msg);
            APP.showToast(msg, "error");
        } finally {
            APP.setButtonLoading(btn, false);
        }
    }

    function wireButtons() {
        qs("#back-to-groups").addEventListener("click", () => {
            APP.navigate("../pages/groups.html");
        });

        qs("#refresh-page").addEventListener("click", () => {
            window.location.reload();
        });

        qs("#reload-my-requests").addEventListener("click", () => {
            loadMyRequests();
        });

        qs("#load-group-requests-btn").addEventListener("click", () => {
            const groupId = Number(qs("#admin_group_id").value);
            loadGroupRequests(groupId);
        });
    }

    function init() {
        const token = APP.requireAuthOrRedirect();
        if (!token) return;

        wireButtons();

        const groupIdFromUrl = Number(qparam("group_id") || "");
        const groupIdInput = qs("#group_id");
        const adminGroupIdInput = qs("#admin_group_id");

        if (groupIdFromUrl && groupIdFromUrl > 0) {
            groupIdInput.value = groupIdFromUrl;
            adminGroupIdInput.value = groupIdFromUrl;
            setBox("#admin-info", `Group #${groupIdFromUrl} loaded from URL.`);
            loadGroupRequests(groupIdFromUrl);
        }

        qs("#create-request-form").addEventListener("submit", handleCreateJoinRequest);

        loadMyRequests();
    }

    document.addEventListener("DOMContentLoaded", init);
})();