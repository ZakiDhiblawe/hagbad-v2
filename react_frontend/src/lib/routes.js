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
  cycleDetail(cycleId, groupId) {
    const params = new URLSearchParams();
    if (cycleId !== undefined && cycleId !== null) params.set("cycle_id", String(cycleId));
    if (groupId !== undefined && groupId !== null) params.set("group_id", String(groupId));
    const query = params.toString();
    return query ? `/cycles/detail?${query}` : "/cycles/detail";
  },
  cycles(groupId) {
    return groupId ? `/cycles?group_id=${groupId}` : "/cycles";
  },
  cycleMembers(cycleId, groupId) {
    const params = new URLSearchParams();
    if (cycleId !== undefined && cycleId !== null) params.set("cycle_id", String(cycleId));
    if (groupId !== undefined && groupId !== null) params.set("group_id", String(groupId));
    const query = params.toString();
    return query ? `/cycle-members?${query}` : "/cycle-members";
  },
  cycleMemberDetail(memberId, cycleId, groupId) {
    const params = new URLSearchParams();
    if (memberId !== undefined && memberId !== null) params.set("member_id", String(memberId));
    if (cycleId !== undefined && cycleId !== null) params.set("cycle_id", String(cycleId));
    if (groupId !== undefined && groupId !== null) params.set("group_id", String(groupId));
    const query = params.toString();
    return query ? `/cycle-members/detail?${query}` : "/cycle-members/detail";
  },
  payments(cycleId, cycleMemberId = null, groupId = null) {
    const params = new URLSearchParams();
    if (cycleId !== undefined && cycleId !== null) params.set("cycle_id", String(cycleId));
    if (cycleMemberId !== undefined && cycleMemberId !== null) params.set("cycle_member_id", String(cycleMemberId));
    if (groupId !== undefined && groupId !== null) params.set("group_id", String(groupId));
    const query = params.toString();
    return query ? `/payments?${query}` : "/payments";
  },
  paymentDetail(paymentId, cycleId = null, cycleMemberId = null, groupId = null) {
    const params = new URLSearchParams();
    if (paymentId !== undefined && paymentId !== null) params.set("payment_id", String(paymentId));
    if (cycleId !== undefined && cycleId !== null) params.set("cycle_id", String(cycleId));
    if (cycleMemberId !== undefined && cycleMemberId !== null) params.set("cycle_member_id", String(cycleMemberId));
    if (groupId !== undefined && groupId !== null) params.set("group_id", String(groupId));
    const query = params.toString();
    return query ? `/payments/detail?${query}` : "/payments/detail";
  },
  payouts(cycleId, cycleMemberId = null, groupId = null) {
    const params = new URLSearchParams();
    if (cycleId !== undefined && cycleId !== null) params.set("cycle_id", String(cycleId));
    if (cycleMemberId !== undefined && cycleMemberId !== null) params.set("cycle_member_id", String(cycleMemberId));
    if (groupId !== undefined && groupId !== null) params.set("group_id", String(groupId));
    const query = params.toString();
    return query ? `/payouts?${query}` : "/payouts";
  },
  payoutDetail(payoutId, cycleId = null, cycleMemberId = null, groupId = null) {
    const params = new URLSearchParams();
    if (payoutId !== undefined && payoutId !== null) params.set("payout_id", String(payoutId));
    if (cycleId !== undefined && cycleId !== null) params.set("cycle_id", String(cycleId));
    if (cycleMemberId !== undefined && cycleMemberId !== null) params.set("cycle_member_id", String(cycleMemberId));
    if (groupId !== undefined && groupId !== null) params.set("group_id", String(groupId));
    const query = params.toString();
    return query ? `/payouts/detail?${query}` : "/payouts/detail";
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
