import { routes } from "./routes";

export function buildGroupWorkspaceConfig({ groupId, profileId, group, membershipRole, activeKey }) {
  if (!groupId) {
    return {
      activeKey,
      isCreator: false,
      isAdmin: false,
      isModerator: false,
      canManageGroup: false,
      canManageCycles: false,
      canAccessAdministration: false,
      showJoinRequests: false,
      sidebarSections: undefined,
    };
  }

  const isCreator = Number(group?.created_by) === Number(profileId);
  const isAdmin = membershipRole === "admin";
  const isModerator = membershipRole === "moderator";
  const canManageGroup = isCreator || isAdmin;
  const canManageCycles = isCreator || isAdmin || isModerator;
  const canAccessAdministration = isCreator || isAdmin || isModerator;
  const showJoinRequests = group ? group.privacy !== "public" : false;

  return {
    activeKey,
    isCreator,
    isAdmin,
    isModerator,
    canManageGroup,
    canManageCycles,
    canAccessAdministration,
    showJoinRequests,
    sidebarSections: [
      {
        label: "Main",
        items: [
          {
            key: "group_dashboard",
            label: "Dashboard",
            iconClass: "ti ti-layout-dashboard",
            to: routes.groupDetail(groupId),
          },
          {
            key: "group_cycles",
            label: "My Cycles",
            iconClass: "ti ti-refresh",
            to: routes.cycles(groupId),
          },
          {
            key: "group_members",
            label: "Members",
            iconClass: "ti ti-users",
            to: routes.groupMembers(groupId),
          },
          {
            key: "group_back_groups",
            label: "Back to Groups",
            iconClass: "ti ti-arrow-left",
            to: routes.myGroups,
          },
        ],
      },
      {
        label: "Administration",
        items: [
          {
            key: "group_settings",
            label: "Settings",
            iconClass: "ti ti-adjustments-horizontal",
            to: routes.groupSettings(groupId),
            hidden: !canAccessAdministration,
          },
          {
            key: "group_requests",
            label: "Join Requests",
            iconClass: "ti ti-user-question",
            to: routes.groupReview(groupId),
            hidden: !canAccessAdministration || !showJoinRequests,
          },
          {
            key: "group_add_cycle",
            label: "Add New Cycle",
            iconClass: "ti ti-plus",
            to: `${routes.cycles(groupId)}&open=create`,
            hidden: !canAccessAdministration || !canManageCycles,
          },
        ],
      },
    ],
  };
}
