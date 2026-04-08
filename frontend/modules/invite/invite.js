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
        setBox("#manage-error", "");
        setBox("#manage-success", "");
        setBox("#redeem-error", "");
        setBox("#redeem-success", "");
        show(qs("#redeem-result"), false);
    }

    function toIsoOrNull(datetimeLocalValue) {
        if (!datetimeLocalValue) return null;
        const dt = new Date(datetimeLocalValue);
        if (Number.isNaN(dt.getTime())) return null;
        return dt.toISOString();
    }

    function formatDate(value) {
        if (!value) return "No expiry";
        const dt = new Date(value);
        if (Number.isNaN(dt.getTime())) return value;
        return dt.toLocaleString();
    }

    function isExpired(expiresAt) {
        if (!expiresAt) return false;
        return new Date(expiresAt).getTime() <= Date.now();
    }

    function copyToClipboard(value) {
        if (!navigator.clipboard) {
            APP.showToast("Clipboard not supported in this browser", "error");
            return;
        }
        navigator.clipboard.writeText(value)
            .then(() => APP.showToast("Invite code copied", "success"))
            .catch(() => APP.showToast("Failed to copy code", "error"));
    }

    function inviteBadge(invite) {
        if (invite.used) return { label: "Used", cls: "bad" };
        if (isExpired(invite.expires_at)) return { label: "Expired", cls: "warn" };
        return { label: "Active", cls: "ok" };
    }

    function renderInvites(invites, groupId) {
        const list = qs("#invite-list");
        if (!list) return;

        list.innerHTML = "";

        if (!Array.isArray(invites) || invites.length === 0) {
            const empty = document.createElement("div");
            empty.className = "empty-state";
            empty.textContent = groupId
                ? "No invites found for this group yet."
                : "Open this page with a group_id to manage invites.";
            list.appendChild(empty);
            return;
        }

        invites.forEach((invite) => {
            const card = document.createElement("div");
            card.className = "invite-card";

            const top = document.createElement("div");
            top.className = "invite-card-top";

            const left = document.createElement("div");
            left.style.flex = "1";

            const code = document.createElement("div");
            code.className = "invite-code";
            code.textContent = invite.code;

            const meta = document.createElement("div");
            meta.className = "invite-meta";

            const badgeRow = document.createElement("div");
            badgeRow.className = "badge-row";

            const state = inviteBadge(invite);

            const badge = document.createElement("span");
            badge.className = `badge ${state.cls}`;
            badge.textContent = state.label;

            const groupBadge = document.createElement("span");
            groupBadge.className = "badge info";
            groupBadge.textContent = `Group #${invite.group_id}`;

            badgeRow.appendChild(badge);
            badgeRow.appendChild(groupBadge);

            const created = document.createElement("div");
            created.textContent = `Created: ${formatDate(invite.created_at)}`;

            const expires = document.createElement("div");
            expires.textContent = `Expires: ${formatDate(invite.expires_at)}`;

            const creator = document.createElement("div");
            creator.textContent = `Created by user #${invite.created_by}`;

            meta.appendChild(badgeRow);
            meta.appendChild(created);
            meta.appendChild(expires);
            meta.appendChild(creator);

            left.appendChild(code);
            left.appendChild(meta);

            const actions = document.createElement("div");
            actions.className = "btn-row";
            actions.style.justifyContent = "flex-end";

            const copyBtn = document.createElement("button");
            copyBtn.type = "button";
            copyBtn.className = "btn btn-secondary";
            copyBtn.textContent = "Copy";
            copyBtn.addEventListener("click", () => copyToClipboard(invite.code));

            const deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.className = "btn btn-danger";
            deleteBtn.textContent = "Delete";
            deleteBtn.disabled = invite.used;
            deleteBtn.title = invite.used ? "Used invite cannot be deleted here" : "Delete invite";

            deleteBtn.addEventListener("click", async () => {
                const ok = window.confirm("Delete this invite?");
                if (!ok) return;

                APP.setButtonLoading(deleteBtn, true, "Deleting...");
                try {
                    await InviteAPI.deleteInvite(invite.id);
                    APP.showToast("Invite deleted", "success");
                    await loadInvites(groupId);
                } catch (err) {
                    if (err.status === 401) {
                        APP.clearToken();
                        APP.navigate("../pages/login.html");
                        return;
                    }
                    const msg = err.message || "Failed to delete invite.";
                    APP.showToast(msg, "error");
                    setBox("#manage-error", msg);
                } finally {
                    APP.setButtonLoading(deleteBtn, false);
                }
            });

            actions.appendChild(copyBtn);
            actions.appendChild(deleteBtn);

            top.appendChild(left);
            top.appendChild(actions);
            card.appendChild(top);
            list.appendChild(card);
        });
    }

    async function loadInvites(groupId) {
        if (!groupId) {
            renderInvites([], null);
            return;
        }

        setBox("#manage-error", "");
        const info = qs("#manage-info");
        text(info, `Loading invites for group #${groupId}...`);

        try {
            const invites = await InviteAPI.listInvites(groupId);
            renderInvites(invites, groupId);
            text(info, `Showing invites for group #${groupId}`);
            setBox("#manage-note", "Create, copy, and delete invite codes for this group.");
        } catch (err) {
            if (err.status === 401) {
                APP.clearToken();
                APP.showToast("Session expired. Please log in again.", "info");
                APP.navigate("../pages/login.html");
                return;
            }

            if (err.status === 403) {
                setBox("#manage-error", "Only group creator or admin can manage invites for this group.");
                text(info, `Access denied for group #${groupId}`);
            } else if (err.status === 404) {
                setBox("#manage-error", "Group not found.");
                text(info, "Could not load invites");
            } else {
                setBox("#manage-error", err.message || "Failed to load invites.");
                text(info, "Could not load invites");
            }

            renderInvites([], groupId);
        }
    }

    async function handleCreateInvite(event) {
        event.preventDefault();
        clearMessages();

        const groupIdInput = qs("#group_id");
        const expiresInput = qs("#expires_at");
        const btn = qs("#create-invite-btn");

        const groupId = Number(groupIdInput.value);

        if (!groupId || groupId < 1) {
            setBox("#manage-error", "Please enter a valid group id.");
            return;
        }

        const payload = {
            group_id: groupId,
        };

        const expiresAt = toIsoOrNull(expiresInput.value);
        if (expiresInput.value && !expiresAt) {
            setBox("#manage-error", "Please enter a valid expiry date.");
            return;
        }
        if (expiresAt) payload.expires_at = expiresAt;

        APP.setButtonLoading(btn, true, "Creating...");

        try {
            const invite = await InviteAPI.createInvite(payload);
            setBox("#manage-success", `Invite created: ${invite.code}`);
            APP.showToast("Invite created", "success");
            await loadInvites(groupId);
        } catch (err) {
            if (err.status === 401) {
                APP.clearToken();
                APP.showToast("Session expired. Please log in again.", "info");
                APP.navigate("../pages/login.html");
                return;
            }

            const msg = err.message || "Failed to create invite.";
            setBox("#manage-error", msg);
            APP.showToast(msg, "error");
        } finally {
            APP.setButtonLoading(btn, false);
        }
    }

    async function handleRedeemInvite(event) {
        event.preventDefault();
        clearMessages();

        const input = qs("#invite_code");
        const btn = qs("#redeem-btn");
        const openMembersBtn = qs("#open-members-btn");
        const code = input.value.trim();

        if (!code) {
            setBox("#redeem-error", "Please paste an invite code.");
            return;
        }

        APP.setButtonLoading(btn, true, "Redeeming...");
        show(openMembersBtn, false);

        try {
            const result = await InviteAPI.redeemInvite(code);

            setBox("#redeem-success", "Invite redeemed successfully.");
            const resultBox = qs("#redeem-result");
            resultBox.hidden = false;
            resultBox.textContent = `Joined group #${result.group_id} as ${result.role}.`;

            openMembersBtn.hidden = false;
            openMembersBtn.onclick = function () {
                APP.navigate(`../pages/group_members.html?group_id=${result.group_id}`);
            };

            APP.showToast("Invite redeemed", "success");
            input.value = "";
        } catch (err) {
            if (err.status === 401) {
                APP.clearToken();
                APP.showToast("Session expired. Please log in again.", "info");
                APP.navigate("../pages/login.html");
                return;
            }

            const msg = err.message || "Failed to redeem invite.";
            setBox("#redeem-error", msg);
            APP.showToast(msg, "error");
        } finally {
            APP.setButtonLoading(btn, false);
        }
    }

    function wireButtons() {
        const backBtn = qs("#back-to-groups");
        const refreshBtn = qs("#refresh-page");

        backBtn.addEventListener("click", () => {
            APP.navigate("../pages/groups.html");
        });

        refreshBtn.addEventListener("click", () => {
            window.location.reload();
        });
    }

    function init() {
        const token = APP.requireAuthOrRedirect();
        if (!token) return;

        wireButtons();

        const groupIdFromUrl = Number(qparam("group_id") || "");
        const groupIdInput = qs("#group_id");

        if (groupIdFromUrl && groupIdFromUrl > 0) {
            groupIdInput.value = groupIdFromUrl;
            text(qs("#manage-info"), `Managing invites for group #${groupIdFromUrl}`);
            setBox("#manage-note", "You are in group-manage mode because this page was opened with a group_id.");
            loadInvites(groupIdFromUrl);
        } else {
            text(qs("#manage-info"), "No group selected yet.");
            setBox("#manage-note", "To manage group invites, open this page using a URL like invites.html?group_id=1");
            renderInvites([], null);
        }

        qs("#create-invite-form").addEventListener("submit", handleCreateInvite);
        qs("#redeem-form").addEventListener("submit", handleRedeemInvite);
    }

    document.addEventListener("DOMContentLoaded", init);
})();