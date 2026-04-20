import { buildApiUrl } from "./config";

const DEFAULT_PROFILE_IMAGE = "/assets/images/profile/user.png";
const DEFAULT_GROUP_IMAGE = "/assets/images/logos/favicon.png";

export function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export function formatStatus(value) {
  if (!value) return "Unknown";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function capitalize(value) {
  const text = String(value || "").trim();
  if (!text) return "-";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatSessionHours(value) {
  if (value === null || value === undefined || value === "") {
    return "No automatic expiry";
  }

  const hours = Number(value);
  if (!Number.isFinite(hours)) return "No automatic expiry";
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

export function initials(input) {
  const words = String(input || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!words.length) return "H";
  return words.map((word) => word[0].toUpperCase()).join("");
}

export function profileImageUrl(profile) {
  if (profile?.profile_image) return buildApiUrl(profile.profile_image);
  return DEFAULT_PROFILE_IMAGE;
}

export function groupImageUrl(group) {
  if (group?.group_image) return buildApiUrl(group.group_image);
  return DEFAULT_GROUP_IMAGE;
}

export function groupCoverUrl(group) {
  if (group?.cover_image) return buildApiUrl(group.cover_image);
  return "";
}

export function groupCoverStyle(group) {
  const url = groupCoverUrl(group);
  if (!url) return undefined;

  return {
    backgroundImage: `linear-gradient(180deg, rgba(8, 24, 48, 0.08), rgba(8, 24, 48, 0.42)), url("${url}")`,
  };
}

export function badgeTone(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "private") return "private";
  if (normalized === "public") return "public";
  if (normalized === "visible") return "visible";
  if (normalized === "hidden") return "hidden";
  if (normalized === "closed") return "closed";
  return "active";
}
