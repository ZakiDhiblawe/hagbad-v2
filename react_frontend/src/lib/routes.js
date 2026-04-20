export const routes = {
  home: "/",
  login: "/login",
  register: "/register",
  dashboard: "/dashboard",
  myGroups: "/groups/my",
  exploreGroups: "/groups/explore",
  addGroup: "/groups/new",
  profile: "/profile",
  groupDetail(groupId) {
    return `/groups/detail?id=${groupId}`;
  },
  cycles(groupId) {
    return groupId ? `/cycles?group_id=${groupId}` : "/cycles";
  },
  groupSettings(groupId) {
    return groupId ? `/group-settings?group_id=${groupId}` : "/group-settings";
  },
  groupMembers(groupId) {
    return groupId ? `/group-members?group_id=${groupId}` : "/group-members";
  },
  groupReview(groupId) {
    return groupId ? `/group-review?group_id=${groupId}` : "/group-review";
  },
  joinRequests(groupId) {
    return groupId ? `/join-requests?group_id=${groupId}` : "/join-requests";
  },
  invites(groupId) {
    return groupId ? `/invites?group_id=${groupId}` : "/invites";
  },
};
