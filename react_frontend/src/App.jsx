import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { useRouter } from "./hooks/useRouter";
import { pingApi } from "./lib/api";
import { API_BASE_LABEL } from "./lib/config";
import { routes } from "./lib/routes";
import AddGroupPage from "./pages/AddGroupPage";
import ComingSoonPage from "./pages/ComingSoonPage";
import CycleDetailPage from "./pages/CycleDetailPage";
import CycleMemberDetailPage from "./pages/CycleMemberDetailPage";
import CycleMembersPage from "./pages/CycleMembersPage";
import CyclesPage from "./pages/CyclesPage";
import DashboardPage from "./pages/DashboardPage";
import GroupDetailPage from "./pages/GroupDetailPage";
import GroupMembersPage from "./pages/GroupMembersPage";
import GroupsListPage from "./pages/GroupsListPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import ProfilePage from "./pages/ProfilePage";
import RegisterPage from "./pages/RegisterPage";

const AUTH_ROUTES = new Set([routes.login, routes.register]);
const PRIVATE_ROUTES = new Set([
  routes.dashboard,
  routes.myGroups,
  routes.exploreGroups,
  routes.addGroup,
  routes.profile,
  "/groups/detail",
  "/group-settings",
  "/group-members",
  "/group-review",
  "/join-requests",
  "/invites",
  "/cycles",
  "/cycles/detail",
  "/cycle-members",
  "/cycle-members/detail",
  "/payments",
  "/payouts",
]);

const PLACEHOLDER_ROUTES = {
  "/group-settings": {
    title: "Group Settings",
    description: "Contribution rules, frequency configuration, and operational settings will live here.",
  },
  "/group-members": {
    title: "Group Members",
    description: "Member management and role updates will live here in the React frontend.",
  },
  "/group-review": {
    title: "Group Review",
    description: "This route is reserved for group review and join request moderation flows.",
  },
  "/join-requests": {
    title: "Join Requests",
    description: "Managed join request review is queued to be ported into the React frontend.",
  },
  "/invites": {
    title: "Invites",
    description: "Invite creation and redemption management will appear here.",
  },
  "/cycles": {
    title: "Cycles",
    description: "Cycle management is the next major workspace area to be ported into React.",
  },
  "/cycle-members": {
    title: "Cycle Participants",
    description: "Cycle participant detail is queued next after the group members and cycle workspace pages.",
  },
  "/cycle-members/detail": {
    title: "Cycle Participant",
    description: "Cycle participant detail will appear here in the React workspace.",
  },
  "/payments": {
    title: "Payments",
    description: "Payment workflow screens are still being ported into the React workspace.",
  },
  "/payouts": {
    title: "Payouts",
    description: "Payout workflow screens are still being ported into the React workspace.",
  },
};

function routeRequiresAuth(pathname) {
  return PRIVATE_ROUTES.has(pathname);
}

export default function App() {
  const router = useRouter();
  const auth = useAuth();
  const [health, setHealth] = useState({
    kind: "loading",
    label: "Checking backend",
    message: "",
  });

  useEffect(() => {
    let active = true;

    pingApi()
      .then((payload) => {
        if (!active) return;
        setHealth({
          kind: "ok",
          label: "Backend connected",
          message: payload?.message || "Hagbad API running",
        });
      })
      .catch((error) => {
        if (!active) return;
        setHealth({
          kind: "down",
          label: "Backend unavailable",
          message: error?.message || "Could not reach the backend.",
        });
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (router.pathname === "/groups") {
      router.navigate(routes.myGroups, { replace: true });
    }
  }, [router]);

  useEffect(() => {
    if (routeRequiresAuth(router.pathname) && !auth.isAuthenticated && !auth.bootstrapping) {
      router.navigate(routes.login, { replace: true });
    }
  }, [auth.bootstrapping, auth.isAuthenticated, router]);

  useEffect(() => {
    if (AUTH_ROUTES.has(router.pathname) && auth.isAuthenticated && !auth.bootstrapping) {
      router.navigate(routes.dashboard, { replace: true });
    }
  }, [auth.bootstrapping, auth.isAuthenticated, router]);

  const page = useMemo(() => {
    if (auth.bootstrapping && routeRequiresAuth(router.pathname)) {
      return (
        <ComingSoonPage
          auth={auth}
          navigate={router.navigate}
          title="Restoring Session"
          description="Checking the saved token and loading your workspace profile."
          backTo={routes.home}
        />
      );
    }

    switch (router.pathname) {
      case routes.home:
        return (
          <HomePage
            navigate={router.navigate}
            health={health}
            apiBaseLabel={API_BASE_LABEL}
            isAuthenticated={auth.isAuthenticated}
          />
        );

      case routes.login:
        return <LoginPage auth={auth} navigate={router.navigate} notice={auth.sessionError} />;

      case routes.register:
        return <RegisterPage auth={auth} navigate={router.navigate} />;

      case routes.dashboard:
        return <DashboardPage auth={auth} navigate={router.navigate} />;

      case routes.myGroups:
        return <GroupsListPage auth={auth} navigate={router.navigate} mode="mine" />;

      case routes.exploreGroups:
        return <GroupsListPage auth={auth} navigate={router.navigate} mode="explore" />;

      case routes.addGroup:
        return <AddGroupPage auth={auth} navigate={router.navigate} />;

      case "/groups/detail":
        return <GroupDetailPage auth={auth} navigate={router.navigate} searchParams={router.searchParams} />;

      case "/group-members":
        return <GroupMembersPage auth={auth} navigate={router.navigate} searchParams={router.searchParams} />;

      case "/cycles":
        return <CyclesPage auth={auth} navigate={router.navigate} searchParams={router.searchParams} />;

      case "/cycles/detail":
        return <CycleDetailPage auth={auth} navigate={router.navigate} searchParams={router.searchParams} />;

      case "/cycle-members":
        return <CycleMembersPage auth={auth} navigate={router.navigate} searchParams={router.searchParams} />;

      case "/cycle-members/detail":
        return <CycleMemberDetailPage auth={auth} navigate={router.navigate} searchParams={router.searchParams} />;

      case routes.profile:
        return <ProfilePage auth={auth} navigate={router.navigate} />;

      default: {
        const placeholder = PLACEHOLDER_ROUTES[router.pathname];
        if (placeholder) {
          const cycleId = router.searchParams.get("cycle_id");
          const groupId = router.searchParams.get("group_id");
          const backTo = cycleId
            ? routes.cycleDetail(cycleId, groupId)
            : groupId
              ? routes.groupDetail(groupId)
              : routes.dashboard;
          return (
            <ComingSoonPage
              auth={auth}
              navigate={router.navigate}
              title={placeholder.title}
              description={placeholder.description}
              backTo={backTo}
            />
          );
        }

        return <NotFoundPage navigate={router.navigate} />;
      }
    }
  }, [auth, health, router.navigate, router.pathname, router.searchParams]);

  return page;
}
