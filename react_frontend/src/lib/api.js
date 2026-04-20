import { buildApiUrl } from "./config";

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
    if (status === 500) return "Server error (500). Please check the backend logs.";
    return `Request failed (${status}).`;
  }

  if (body.kind === "json") {
    const data = body.data;
    if (data && typeof data.detail === "string") return data.detail;
    if (data && Array.isArray(data.detail)) return "Validation error. Please check your input.";
    return `Request failed (${status}).`;
  }

  const text = String(body.data || "").trim();
  if (text) return text.slice(0, 180);
  return `Request failed (${status}).`;
}

async function request(path, { method = "GET", token, headers = {}, body } = {}) {
  const response = await fetch(buildApiUrl(path), {
    method,
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body,
  }).catch(() => {
    throw {
      status: 0,
      message: "Network or CORS error. Check whether the backend is running and reachable.",
    };
  });

  const parsedBody = await readBodySafely(response);

  if (!response.ok) {
    throw {
      status: response.status,
      message: extractMessage(response.status, parsedBody),
      data: parsedBody.kind === "json" ? parsedBody.data : null,
    };
  }

  if (parsedBody.kind === "json") return parsedBody.data;
  if (parsedBody.kind === "text") return parsedBody.data;
  return null;
}

function appendMaybe(body, key, value) {
  if (value === undefined) return;
  if (value === null) {
    body.append(key, "");
    return;
  }

  body.append(key, value);
}

export async function pingApi() {
  return request("/");
}

export async function registerUser(payload) {
  return request("/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function loginUser(email, password) {
  return request("/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: email, password }).toString(),
  });
}

export async function logoutUser(token) {
  return request("/logout", {
    method: "POST",
    token,
  });
}

export async function getProfile(token) {
  return request("/profile", { token });
}

export async function updateProfile(token, { fullName, phone, sessionHours, imageFile, removeImage }) {
  const body = new FormData();
  body.append("full_name", fullName);
  body.append("phone", phone || "");
  body.append(
    "session_hours",
    sessionHours === null || sessionHours === undefined ? "" : String(sessionHours)
  );
  if (imageFile) body.append("image", imageFile);
  if (removeImage) body.append("remove_image", "true");

  return request("/profile", {
    method: "PUT",
    token,
    body,
  });
}

export async function updatePassword(token, payload) {
  return request("/profile/password", {
    method: "PUT",
    token,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function listGroups(
  token,
  { mine = false, explore = false, managed = false, page = 1, size = 20, search = "", role = "" } = {}
) {
  const params = new URLSearchParams({
    mine: String(Boolean(mine)),
    explore: String(Boolean(explore)),
    managed: String(Boolean(managed)),
    page: String(page),
    size: String(size),
  });

  if (search.trim()) params.set("search", search.trim());
  if (role.trim()) params.set("role", role.trim());

  return request(`/groups/?${params.toString()}`, { token });
}

export async function createGroup(
  token,
  {
    name,
    description,
    privacy,
    visible,
    groupImageFile = null,
    coverImageFile = null,
  }
) {
  const body = new FormData();
  appendMaybe(body, "name", name);
  appendMaybe(body, "description", description);
  appendMaybe(body, "privacy", privacy);
  body.append("visible", String(Boolean(visible)));
  if (groupImageFile) body.append("group_image", groupImageFile);
  if (coverImageFile) body.append("cover_image", coverImageFile);

  return request("/groups/", {
    method: "POST",
    token,
    body,
  });
}

export async function getGroup(token, groupId) {
  return request(`/groups/${groupId}`, { token });
}

export async function updateGroup(token, groupId, payload) {
  const body = new FormData();
  appendMaybe(body, "name", payload.name);
  appendMaybe(body, "description", payload.description);
  appendMaybe(body, "privacy", payload.privacy);
  if (payload.visible !== undefined) body.append("visible", String(Boolean(payload.visible)));
  appendMaybe(body, "status", payload.status);
  if (payload.groupImageFile) body.append("group_image", payload.groupImageFile);
  if (payload.coverImageFile) body.append("cover_image", payload.coverImageFile);
  if (payload.removeGroupImage) body.append("remove_group_image", "true");
  if (payload.removeCoverImage) body.append("remove_cover_image", "true");

  return request(`/groups/${groupId}`, {
    method: "PUT",
    token,
    body,
  });
}

export async function closeGroup(token, groupId) {
  return request(`/groups/${groupId}/close`, {
    method: "POST",
    token,
  });
}

export async function joinGroup(token, groupId) {
  return request(`/groups/${groupId}/join`, {
    method: "POST",
    token,
  });
}

export async function listGroupMembers(token, { groupId, role = "", page = 1, size = 20 }) {
  const params = new URLSearchParams({
    group_id: String(groupId),
    page: String(page),
    size: String(size),
  });

  if (role.trim()) params.set("role", role.trim());
  return request(`/group-members/?${params.toString()}`, { token });
}

export async function listCyclesForGroup(token, groupId, { page = 1, size = 20 } = {}) {
  return request(`/cycles/group/${groupId}?page=${page}&size=${size}`, { token });
}

export async function getPaymentSummary(token, cycleId) {
  return request(`/payments/summary/cycle/${cycleId}`, { token });
}

export async function getPayoutSummary(token, cycleId) {
  return request(`/payouts/summary/cycle/${cycleId}`, { token });
}

export async function createJoinRequest(token, payload) {
  return request("/join-requests/", {
    method: "POST",
    token,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function listMyJoinRequests(token) {
  return request("/join-requests/mine", { token });
}

export async function listGroupJoinRequests(token, groupId, status = "") {
  const params = new URLSearchParams();
  if (status.trim()) params.set("status", status.trim());
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return request(`/join-requests/group/${groupId}${suffix}`, { token });
}

export async function listInvites(token, groupId) {
  return request(`/invites/${groupId}`, { token });
}

export async function redeemInvite(token, code) {
  return request("/invites/redeem", {
    method: "POST",
    token,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
}
