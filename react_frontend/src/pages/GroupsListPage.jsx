import { useDeferredValue, useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import GroupCard from "../components/GroupCard";
import RouteLink from "../components/RouteLink";
import { usePageChrome } from "../hooks/usePageChrome";
import {
  createJoinRequest,
  joinGroup,
  listGroups,
  listMyJoinRequests,
  redeemInvite,
} from "../lib/api";
import { routes } from "../lib/routes";

const PAGE_SIZE = 20;

export default function GroupsListPage({ auth, navigate, mode }) {
  const isExplore = mode === "explore";

  usePageChrome({
    title: isExplore ? "Explore Groups | Hagbad" : "My Groups | Hagbad",
    page: isExplore ? "explore_groups" : "my_groups",
    bodyClassName: "portal-body dashboard-body",
  });

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [managed, setManaged] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [busyAction, setBusyAction] = useState("");
  const [pendingRequestGroupIds, setPendingRequestGroupIds] = useState(new Set());
  const [joinCodeModalOpen, setJoinCodeModalOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinCodeError, setJoinCodeError] = useState("");
  const [state, setState] = useState({
    loading: true,
    error: "",
    items: [],
  });

  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, managed, isExplore]);

  useEffect(() => {
    let active = true;

    async function loadGroups() {
      setState((current) => ({
        ...current,
        loading: true,
        error: "",
      }));

      try {
        let pendingIds = new Set();
        if (isExplore) {
          try {
            const requests = await listMyJoinRequests(auth.token);
            pendingIds = new Set(
              requests
                .filter((item) => item.status === "pending")
                .map((item) => Number(item.group_id))
            );
          } catch {
            pendingIds = new Set();
          }
        }

        const items = await listGroups(auth.token, {
          mine: !isExplore,
          explore: isExplore,
          page,
          size: PAGE_SIZE,
          search: deferredSearch.trim(),
          managed: !isExplore && managed,
        });

        if (!active) return;
        setPendingRequestGroupIds(pendingIds);
        setState({
          loading: false,
          error: "",
          items,
        });
      } catch (error) {
        if (!active) return;
        setState({
          loading: false,
          error: error?.message || "Failed to load groups.",
          items: [],
        });
      }
    }

    loadGroups();
    return () => {
      active = false;
    };
  }, [auth.token, deferredSearch, isExplore, managed, page, refreshNonce]);

  const statusChipClass = state.loading ? "status-loading" : state.error ? "status-down" : "status-ok";
  const statusChipLabel = isExplore ? "Explore Groups" : "My Groups";
  const countLabel = useMemo(() => {
    if (state.loading) return "Loading groups...";
    if (!state.items.length) {
      return deferredSearch.trim() || managed ? "No matching groups" : "No groups on this page";
    }
    return `${state.items.length} ${deferredSearch.trim() || managed ? "matching " : ""}group${state.items.length === 1 ? "" : "s"} on this page`;
  }, [deferredSearch, managed, state.items.length, state.loading]);

  async function handlePublicJoin(group) {
    const actionKey = `join-${group.id}`;
    setBusyAction(actionKey);
    try {
      await joinGroup(auth.token, group.id);
      setRefreshNonce((value) => value + 1);
      if (page > 1 && state.items.length === 1) {
        setPage((current) => Math.max(1, current - 1));
      }
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error?.message || "Failed to join group.",
      }));
    } finally {
      setBusyAction("");
    }
  }

  async function handlePrivateRequest(group) {
    const actionKey = `request-${group.id}`;
    setBusyAction(actionKey);
    try {
      await createJoinRequest(auth.token, { group_id: group.id });
      setPendingRequestGroupIds((current) => {
        const next = new Set(current);
        next.add(Number(group.id));
        return next;
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error?.message || "Failed to send join request.",
      }));
    } finally {
      setBusyAction("");
    }
  }

  async function handleJoinCodeSubmit(event) {
    event.preventDefault();
    setJoinCodeError("");

    if (!joinCode.trim()) {
      setJoinCodeError("Please paste an active invite code.");
      return;
    }

    setBusyAction("join-code");
    try {
      await redeemInvite(auth.token, joinCode.trim());
      setJoinCode("");
      setJoinCodeModalOpen(false);
      setRefreshNonce((value) => value + 1);
    } catch (error) {
      setJoinCodeError(error?.message || "Failed to join with this code.");
    } finally {
      setBusyAction("");
    }
  }

  function renderActions(group) {
    if (!isExplore) {
      return [
        <RouteLink
          key={`view-${group.id}`}
          className="btn portal-btn-secondary group-card-btn"
          to={routes.groupDetail(group.id)}
          navigate={navigate}
        >
          View
        </RouteLink>,
      ];
    }

    if (group.status !== "active") {
      return [
        <button key={`closed-${group.id}`} type="button" className="btn portal-btn-secondary group-card-btn" disabled>
          Closed
        </button>,
      ];
    }

    if (group.privacy === "public") {
      return [
        <button
          key={`join-${group.id}`}
          type="button"
          className="btn portal-btn-primary group-card-btn"
          disabled={busyAction === `join-${group.id}`}
          onClick={() => handlePublicJoin(group)}
        >
          {busyAction === `join-${group.id}` ? "Joining..." : "Join"}
        </button>,
      ];
    }

    if (pendingRequestGroupIds.has(Number(group.id))) {
      return [
        <button key={`pending-${group.id}`} type="button" className="btn portal-btn-secondary group-card-btn" disabled>
          Request pending
        </button>,
      ];
    }

    return [
      <button
        key={`request-${group.id}`}
        type="button"
        className="btn portal-btn-primary group-card-btn"
        disabled={busyAction === `request-${group.id}`}
        onClick={() => handlePrivateRequest(group)}
      >
        {busyAction === `request-${group.id}` ? "Sending..." : "Request to Join"}
      </button>,
    ];
  }

  function renderMetaText(group) {
    if (isExplore) {
      return group.privacy === "private"
        ? "Visible private group. Request approval to join."
        : "Visible public group. Join instantly.";
    }

    if (Number(group.created_by) === Number(auth.profile?.id)) {
      return "You created this group and manage it.";
    }
    if (managed) {
      return "You manage this group as an admin or moderator.";
    }
    return "You already belong to this group.";
  }

  const sidebarKey = isExplore ? "explore_groups" : "my_groups";

  return (
    <AppShell
      auth={auth}
      navigate={navigate}
      miniTitle="Hagbad workspace"
      title={isExplore ? "Explore Groups" : "My Groups"}
      activeSidebarKey={sidebarKey}
    >
      <section className="dashboard-hero groups-hero groups-page-hero">
        <div>
          <span className="eyebrow text-white mb-3">{isExplore ? "Discovery" : "Workspace groups"}</span>
          <h2>{isExplore ? "Find visible public and private groups." : "Your joined groups in one place."}</h2>
          <p>
            {isExplore
              ? "Public groups can be joined instantly. Visible private groups accept join requests and stay discoverable without exposing hidden groups."
              : "Review the groups you created or joined, then open each one for members, settings, contributions, and cycle work."}
          </p>
        </div>
      </section>

      <section className="dashboard-panel card group-list-panel mt-4">
        <div className="card-body">
          <div className="dashboard-panel-title align-items-center">
            <div>
              <h3>{isExplore ? "Explore Groups" : "My Groups"}</h3>
              <p>{isExplore ? "Visible groups outside your memberships." : "Groups you created or already joined."}</p>
            </div>
            {!isExplore ? (
              <button
                id="open-join-code-modal"
                className="btn portal-btn-secondary"
                type="button"
                onClick={() => {
                  setJoinCodeError("");
                  setJoinCodeModalOpen(true);
                }}
              >
                Join with Code
              </button>
            ) : null}
          </div>

          <form className={`group-filter-bar ${isExplore ? "group-filter-bar-explore" : "group-filter-bar-my"}`} onSubmit={(event) => event.preventDefault()}>
            <div className={`group-search-shell${isExplore ? " group-search-shell-wide" : ""}`}>
              <label htmlFor="groups-search" className="visually-hidden">
                {isExplore ? "Search explore groups" : "Search my groups"}
              </label>
              <input
                id="groups-search"
                className="form-control portal-input group-search-input"
                type="search"
                placeholder="Search group name"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            {!isExplore ? (
              <div className="group-filter-check">
                <label className="group-inline-check" htmlFor="groups-managed-toggle">
                  <input
                    id="groups-managed-toggle"
                    type="checkbox"
                    checked={managed}
                    onChange={(event) => setManaged(event.target.checked)}
                  />
                  <span>Mine</span>
                </label>
              </div>
            ) : null}
          </form>

          <div className="group-inline-meta">
            <span className={`status-chip ${statusChipClass}`}>{statusChipLabel}</span>
            <span className="dashboard-note">{countLabel}</span>
          </div>

          <div className="dashboard-note mb-3" aria-live="polite">
            {state.error
              ? state.error
              : state.loading
                ? isExplore
                  ? "Loading explore groups..."
                  : "Loading your groups..."
                : state.items.length
                  ? `Loaded ${state.items.length} group${state.items.length === 1 ? "" : "s"}.`
                  : "Nothing to show on this page."}
          </div>

          <div className="group-card-grid" aria-label={isExplore ? "Explore groups" : "My groups"}>
            {state.items.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                metaText={renderMetaText(group)}
                actions={renderActions(group)}
              />
            ))}
          </div>

          {!state.loading && !state.items.length ? (
            <div className="group-empty-state">
              <h4>{search.trim() ? "No groups match this search." : isExplore ? "No groups to explore." : "No groups yet."}</h4>
              <p>
                {isExplore
                  ? "Visible groups outside your memberships will appear here."
                  : managed
                    ? "Try turning off Mine or changing the search text."
                    : "Groups you create or join will appear here."}
              </p>
            </div>
          ) : null}

          <div className="groups-pager">
            <span className="dashboard-note">Page {page}</span>
            <div className="d-flex gap-2">
              <button
                className="btn portal-btn-secondary pager-btn"
                type="button"
                disabled={page <= 1 || state.loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Prev
              </button>
              <button
                className="btn portal-btn-secondary pager-btn"
                type="button"
                disabled={state.loading || state.items.length < PAGE_SIZE}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </section>

      {!isExplore ? (
        <>
          <div
            className="portal-modal-overlay"
            hidden={!joinCodeModalOpen}
            onClick={() => setJoinCodeModalOpen(false)}
          ></div>
          <div className="portal-modal" hidden={!joinCodeModalOpen}>
            <div className="portal-modal-shell join-code-modal-shell">
              <div className="portal-modal-header">
                <div>
                  <h2>Join Group by Code</h2>
                  <p>Paste the active code shared for a hidden private group to join it immediately.</p>
                </div>
                <button
                  className="portal-modal-close"
                  type="button"
                  aria-label="Close join code modal"
                  onClick={() => setJoinCodeModalOpen(false)}
                >
                  <span>&times;</span>
                </button>
              </div>

              {joinCodeError ? <div className="form-error">{joinCodeError}</div> : null}

              <form onSubmit={handleJoinCodeSubmit} noValidate>
                <div className="field">
                  <label htmlFor="join-group-code">Invite code</label>
                  <input
                    id="join-group-code"
                    type="text"
                    placeholder="Paste active invite code"
                    autoComplete="off"
                    value={joinCode}
                    onChange={(event) => setJoinCode(event.target.value)}
                  />
                  <p className="helper-text mb-0">Only active codes from hidden private groups can be used here.</p>
                </div>

                <div className="portal-modal-actions">
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => setJoinCodeModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button className="btn" type="submit" disabled={busyAction === "join-code"}>
                    {busyAction === "join-code" ? "Joining..." : "Join Group"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
