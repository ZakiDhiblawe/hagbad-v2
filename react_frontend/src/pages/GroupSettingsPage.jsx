import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { usePageChrome } from "../hooks/usePageChrome";
import {
  createGroupSettings,
  getGroup,
  getGroupSettings,
  listGroupMembers,
  updateGroup,
  updateGroupSettings,
} from "../lib/api";
import { groupCoverUrl, groupImageUrl, initials } from "../lib/format";
import { buildGroupWorkspaceConfig } from "../lib/groupWorkspace";
import { routes } from "../lib/routes";

const PAGE_SIZE = 100;

function formatDateTime(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
}

function roleLabel(role, isCreator = false) {
  if (isCreator) return "Creator";
  if (role === "admin") return "Admin";
  if (role === "moderator") return "Moderator";
  return "Member";
}

function formatFrequency(value) {
  if (!value) return "Not set";
  if (value === "custom_days") return "Custom days";
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

async function fetchAllGroupMembers(token, groupId) {
  const items = [];
  for (let page = 1; page <= 50; page += 1) {
    const batch = await listGroupMembers(token, { groupId, page, size: PAGE_SIZE });
    items.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return items;
}

function buildPermissions(group, profileId, role) {
  const isCreator = Number(group?.created_by) === Number(profileId);
  const isAdmin = isCreator || role === "admin";
  const isModerator = role === "moderator";

  return {
    isCreator,
    isAdmin,
    isModerator,
    canAccessAdministration: isAdmin || isModerator,
    canEditName: isAdmin,
    canEditDescription: isAdmin || isModerator,
    canEditPrivacy: isAdmin,
    canEditGroupImage: isAdmin,
    canEditCover: isAdmin || isModerator,
    canEditRules: isAdmin || isModerator,
  };
}

function SummaryCard({ tone, iconClass, label, value, description }) {
  return (
    <article className={`members-summary-card ${tone} group-settings-summary-card`}>
      <div className="group-settings-summary-head">
        <span className="group-settings-summary-icon">
          <i className={iconClass}></i>
        </span>
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      <p>{description}</p>
    </article>
  );
}

function ContextChip({ label, tone = "neutral" }) {
  return <span className={`member-context-chip ${tone}`}>{label}</span>;
}

export default function GroupSettingsPage({ auth, navigate, searchParams }) {
  const groupId = Number(searchParams.get("group_id") || searchParams.get("id") || 0);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [busyAction, setBusyAction] = useState("");
  const [identityMessage, setIdentityMessage] = useState({ error: "", success: "" });
  const [privacyMessage, setPrivacyMessage] = useState({ error: "", success: "" });
  const [mediaMessage, setMediaMessage] = useState({ error: "", success: "" });
  const [rulesMessage, setRulesMessage] = useState({ error: "", success: "" });
  const [state, setState] = useState({
    loading: true,
    error: "",
    group: null,
    membershipRole: null,
    settings: null,
  });
  const [identityForm, setIdentityForm] = useState({ name: "", description: "" });
  const [privacyForm, setPrivacyForm] = useState({ privacy: "public", visible: true });
  const [rulesForm, setRulesForm] = useState({
    contribution_amount: "",
    frequency: "weekly",
    custom_days: "",
    allow_late: false,
    late_penalty: "",
    auto_start_cycle: false,
  });
  const [groupImageFile, setGroupImageFile] = useState(null);
  const [coverImageFile, setCoverImageFile] = useState(null);
  const [groupImagePreview, setGroupImagePreview] = useState("");
  const [coverImagePreview, setCoverImagePreview] = useState("");

  const pageTitle = state.group?.name ? `Settings | ${state.group.name} | Hagbad` : "Group Settings | Hagbad";

  usePageChrome({
    title: pageTitle,
    page: "group_settings",
    bodyClassName: "portal-body dashboard-body",
  });

  useEffect(() => {
    let active = true;

    async function load() {
      if (!groupId) {
        setState({
          loading: false,
          error: "Missing group_id. Open this page with /group-settings?group_id=1",
          group: null,
          membershipRole: null,
          settings: null,
        });
        return;
      }

      setState((current) => ({ ...current, loading: true, error: "" }));

      try {
        const group = await getGroup(auth.token, groupId);
        const members = await fetchAllGroupMembers(auth.token, groupId).catch(() => []);
        const membership =
          members.find((item) => Number(item.user_id) === Number(auth.profile?.id)) || null;

        let settings = null;
        try {
          settings = await getGroupSettings(auth.token, groupId);
        } catch (error) {
          if (error?.status !== 404) throw error;
          settings = null;
        }

        if (!active) return;

        setState({
          loading: false,
          error: "",
          group,
          membershipRole: membership?.role || null,
          settings,
        });

        setIdentityForm({
          name: group.name || "",
          description: group.description || "",
        });
        setPrivacyForm({
          privacy: group.privacy || "public",
          visible: Boolean(group.visible),
        });
        setRulesForm({
          contribution_amount: settings?.contribution_amount ?? "",
          frequency: settings?.frequency ?? "weekly",
          custom_days: settings?.custom_days ?? "",
          allow_late: Boolean(settings?.allow_late),
          late_penalty: settings?.late_penalty ?? "",
          auto_start_cycle: Boolean(settings?.auto_start_cycle),
        });
        setGroupImageFile(null);
        setCoverImageFile(null);
      } catch (error) {
        if (!active) return;
        setState({
          loading: false,
          error: error?.message || "Failed to load the group settings page.",
          group: null,
          membershipRole: null,
          settings: null,
        });
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [auth.profile?.id, auth.token, groupId, reloadNonce]);

  useEffect(() => {
    if (!groupImageFile) {
      setGroupImagePreview("");
      return undefined;
    }
    const url = URL.createObjectURL(groupImageFile);
    setGroupImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [groupImageFile]);

  useEffect(() => {
    if (!coverImageFile) {
      setCoverImagePreview("");
      return undefined;
    }
    const url = URL.createObjectURL(coverImageFile);
    setCoverImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverImageFile]);

  const workspace = useMemo(
    () =>
      buildGroupWorkspaceConfig({
        groupId,
        profileId: auth.profile?.id,
        group: state.group,
        membershipRole: state.membershipRole,
        activeKey: "group_settings",
      }),
    [auth.profile?.id, groupId, state.group, state.membershipRole]
  );
  const permissions = useMemo(
    () => buildPermissions(state.group, auth.profile?.id, state.membershipRole),
    [auth.profile?.id, state.group, state.membershipRole]
  );

  const groupImageSrc = groupImagePreview || groupImageUrl(state.group || {});
  const coverImageSrc = coverImagePreview || groupCoverUrl(state.group || {});

  function reload() {
    setReloadNonce((value) => value + 1);
  }

  function clearMessages() {
    setIdentityMessage({ error: "", success: "" });
    setPrivacyMessage({ error: "", success: "" });
    setMediaMessage({ error: "", success: "" });
    setRulesMessage({ error: "", success: "" });
  }

  async function handleIdentitySubmit(event) {
    event.preventDefault();
    setIdentityMessage({ error: "", success: "" });

    if (!(permissions.canEditName || permissions.canEditDescription)) {
      setIdentityMessage({ error: "You do not have permission to update this card.", success: "" });
      return;
    }

    if (permissions.canEditName && identityForm.name.trim().length < 2) {
      setIdentityMessage({ error: "Group name must be at least 2 characters.", success: "" });
      return;
    }

    setBusyAction("identity");
    try {
      const updatedGroup = await updateGroup(auth.token, groupId, {
        name: permissions.canEditName ? identityForm.name.trim() : undefined,
        description: permissions.canEditDescription ? identityForm.description.trim() : undefined,
      });
      setState((current) => ({ ...current, group: updatedGroup }));
      setIdentityForm({
        name: updatedGroup.name || "",
        description: updatedGroup.description || "",
      });
      setIdentityMessage({ error: "", success: "Group name and description saved." });
    } catch (error) {
      setIdentityMessage({ error: error?.message || "Failed to save group details.", success: "" });
    } finally {
      setBusyAction("");
    }
  }

  async function handlePrivacySubmit(event) {
    event.preventDefault();
    setPrivacyMessage({ error: "", success: "" });

    if (!permissions.canEditPrivacy) {
      setPrivacyMessage({ error: "Only admins can update privacy and visibility.", success: "" });
      return;
    }

    setBusyAction("privacy");
    try {
      const updatedGroup = await updateGroup(auth.token, groupId, {
        privacy: privacyForm.privacy,
        visible: privacyForm.visible,
      });
      setState((current) => ({ ...current, group: updatedGroup }));
      setPrivacyForm({
        privacy: updatedGroup.privacy || "public",
        visible: Boolean(updatedGroup.visible),
      });
      setPrivacyMessage({ error: "", success: "Privacy and visibility updated." });
    } catch (error) {
      setPrivacyMessage({ error: error?.message || "Failed to update privacy.", success: "" });
    } finally {
      setBusyAction("");
    }
  }

  async function handleMediaSubmit(event) {
    event.preventDefault();
    setMediaMessage({ error: "", success: "" });

    if ((!permissions.canEditGroupImage || !groupImageFile) && (!permissions.canEditCover || !coverImageFile)) {
      setMediaMessage({ error: "Choose at least one new image to upload.", success: "" });
      return;
    }

    setBusyAction("media");
    try {
      const updatedGroup = await updateGroup(auth.token, groupId, {
        groupImageFile: permissions.canEditGroupImage ? groupImageFile : null,
        coverImageFile: permissions.canEditCover ? coverImageFile : null,
      });
      setState((current) => ({ ...current, group: updatedGroup }));
      setGroupImageFile(null);
      setCoverImageFile(null);
      setMediaMessage({ error: "", success: "Group images updated." });
    } catch (error) {
      setMediaMessage({ error: error?.message || "Failed to update images.", success: "" });
    } finally {
      setBusyAction("");
    }
  }

  async function handleRulesSubmit(event) {
    event.preventDefault();
    setRulesMessage({ error: "", success: "" });

    if (!permissions.canEditRules) {
      setRulesMessage({ error: "Only admins and moderators can update group rules.", success: "" });
      return;
    }

    if (!rulesForm.contribution_amount || Number(rulesForm.contribution_amount) <= 0) {
      setRulesMessage({ error: "Contribution must be greater than 0.", success: "" });
      return;
    }

    if (rulesForm.frequency === "custom_days" && (!rulesForm.custom_days || Number(rulesForm.custom_days) < 1)) {
      setRulesMessage({ error: "Enter a valid custom day count.", success: "" });
      return;
    }

    if (rulesForm.allow_late && rulesForm.late_penalty === "") {
      setRulesMessage({ error: "Late penalty is required when late payments are allowed.", success: "" });
      return;
    }

    const payload = {
      group_id: groupId,
      contribution_amount: rulesForm.contribution_amount,
      frequency: rulesForm.frequency,
      custom_days: rulesForm.frequency === "custom_days" ? Number(rulesForm.custom_days) : null,
      allow_late: Boolean(rulesForm.allow_late),
      late_penalty: rulesForm.allow_late && rulesForm.late_penalty !== "" ? rulesForm.late_penalty : null,
      auto_start_cycle: Boolean(rulesForm.auto_start_cycle),
    };

    setBusyAction("rules");
    try {
      const settings = state.settings
        ? await updateGroupSettings(auth.token, groupId, payload)
        : await createGroupSettings(auth.token, payload);
      setState((current) => ({ ...current, settings }));
      setRulesForm({
        contribution_amount: settings?.contribution_amount ?? "",
        frequency: settings?.frequency ?? "weekly",
        custom_days: settings?.custom_days ?? "",
        allow_late: Boolean(settings?.allow_late),
        late_penalty: settings?.late_penalty ?? "",
        auto_start_cycle: Boolean(settings?.auto_start_cycle),
      });
      setRulesMessage({ error: "", success: "Group rules saved." });
    } catch (error) {
      setRulesMessage({ error: error?.message || "Failed to save group rules.", success: "" });
    } finally {
      setBusyAction("");
    }
  }

  const summaryRoleNote = permissions.isAdmin
    ? "You can manage every group field on this page."
    : permissions.isModerator
      ? "You can update description, cover image, and group rules."
      : "This page is read only for your current role.";

  return (
    <AppShell
      auth={auth}
      navigate={navigate}
      miniTitle="Group workspace"
      title="Settings"
      activeSidebarKey={workspace.activeKey}
      sidebarSections={workspace.sidebarSections}
      brandTo={routes.groupDetail(groupId || 0)}
      brandSubtitle="Group workspace"
    >
      <div className="workspace-legacy-stack group-settings-page">
        <section className="dashboard-panel card members-overview-panel group-settings-hero-panel">
          <div className="card-body">
            <div className="group-inline-meta members-page-heading group-settings-hero-head">
              <div className="group-settings-hero-copy">
                <span className="group-settings-kicker">Group management</span>
                <h2>{state.group?.name || "Loading group settings..."}</h2>
                <p>Manage the group profile, privacy, media, and recurring group rules from one page.</p>
              </div>
              <div className="members-header-actions">
                <button className="btn btn-secondary" type="button" onClick={() => navigate(routes.groupDetail(groupId))}>
                  Back to dashboard
                </button>
              </div>
            </div>

            <div className="group-context-badges" aria-live="polite">
              {state.group ? <ContextChip label={`Group #${state.group.id}`} /> : null}
              {state.group ? (
                <ContextChip
                  label={state.group.privacy === "private" ? "Private group" : "Public group"}
                  tone={state.group.privacy === "private" ? "private" : "member"}
                />
              ) : null}
              {state.group ? (
                <ContextChip
                  label={state.group.visible ? "Visible" : "Hidden"}
                  tone={state.group.visible ? "active" : "private"}
                />
              ) : null}
              {state.group ? (
                <ContextChip
                  label={state.group.status === "closed" ? "Closed" : "Active"}
                  tone={state.group.status === "closed" ? "closed" : "active"}
                />
              ) : null}
              {state.group ? (
                <ContextChip
                  label={`Your role: ${roleLabel(state.membershipRole, permissions.isCreator)}`}
                  tone={permissions.isAdmin ? "admin" : permissions.isModerator ? "moderator" : "member"}
                />
              ) : null}
            </div>

            {state.error ? <div className="form-error">{state.error}</div> : null}
            <div className="dashboard-note members-status" aria-live="polite">
              {state.group
                ? `Created ${formatDateTime(state.group.created_at)}. Admins can rename, change privacy, and update the main photo. Moderators can update the description, cover image, and group rules.`
                : "Loading settings workspace..."}
            </div>

            <div className="members-summary-grid group-settings-summary-grid" aria-label="Settings summary">
              <SummaryCard
                tone="total"
                iconClass="ti ti-user"
                label="Your role"
                value={roleLabel(state.membershipRole, permissions.isCreator)}
                description={summaryRoleNote}
              />
              <SummaryCard
                tone="admin"
                iconClass="ti ti-writing"
                label="Name access"
                value={permissions.canEditName ? "Editable" : "Read only"}
                description="Only admins can rename the group."
              />
              <SummaryCard
                tone="moderator"
                iconClass="ti ti-photo"
                label="Media access"
                value={
                  permissions.canEditGroupImage
                    ? "Full"
                    : permissions.canEditCover
                      ? "Cover only"
                      : "Read only"
                }
                description="Cover updates are broader than the main group photo."
              />
              <SummaryCard
                tone="member"
                iconClass="ti ti-settings"
                label="Rule status"
                value={state.settings ? "Configured" : "Not set"}
                description={
                  state.settings
                    ? `${formatFrequency(state.settings.frequency)} contributions at ${state.settings.contribution_amount}.`
                    : "No recurring group rules have been saved yet."
                }
              />
            </div>
          </div>
        </section>

        <div className="row g-4 align-items-start">
          <div className="col-12 col-xl-6">
            <section className="dashboard-panel card group-settings-card identity-card">
              <div className="card-body">
                <div className="member-role-header group-settings-card-head">
                  <div className="group-settings-card-title">
                    <span className="group-settings-card-icon"><i className="ti ti-writing"></i></span>
                    <div>
                      <h3>Name and Description</h3>
                      <p>Rename the group if you are an admin. Moderators can still keep the description updated.</p>
                    </div>
                  </div>
                  <span
                    className={`member-section-count ${
                      permissions.canEditName ? "success" : permissions.canEditDescription ? "warn" : "neutral"
                    }`}
                  >
                    {permissions.canEditName ? "Admin access" : permissions.canEditDescription ? "Description only" : "Read only"}
                  </span>
                </div>

                <form className="group-settings-form" onSubmit={handleIdentitySubmit} noValidate>
                  {identityMessage.error ? <div className="form-error">{identityMessage.error}</div> : null}
                  {identityMessage.success ? <div className="form-success">{identityMessage.success}</div> : null}

                  <div className="row g-3">
                    <div className="col-12">
                      <label htmlFor="name" className="form-label">Group name</label>
                      <input
                        id="name"
                        className="form-control portal-input"
                        type="text"
                        maxLength="120"
                        placeholder="Enter the group name"
                        disabled={!permissions.canEditName}
                        value={identityForm.name}
                        onChange={(event) => setIdentityForm((current) => ({ ...current, name: event.target.value }))}
                      />
                      <p className="field-hint mb-0">Only admins can change the group name.</p>
                    </div>

                    <div className="col-12">
                      <label htmlFor="description" className="form-label">Description</label>
                      <textarea
                        id="description"
                        className="form-control portal-input"
                        rows="5"
                        maxLength="2000"
                        placeholder="Describe who this group is for and how it should run"
                        disabled={!permissions.canEditDescription}
                        value={identityForm.description}
                        onChange={(event) => setIdentityForm((current) => ({ ...current, description: event.target.value }))}
                      ></textarea>
                      <p className="field-hint mb-0">Admins and moderators can update the description.</p>
                    </div>
                  </div>

                  {permissions.canEditName || permissions.canEditDescription ? (
                    <div className="portal-modal-actions group-settings-card-actions">
                      <button id="identity-submit" className="btn portal-btn-primary" type="submit" disabled={busyAction === "identity"}>
                        {busyAction === "identity" ? "Saving..." : "Save identity"}
                      </button>
                    </div>
                  ) : null}
                </form>
              </div>
            </section>

            <section className="dashboard-panel card group-settings-card privacy-card">
              <div className="card-body">
                <div className="member-role-header group-settings-card-head">
                  <div className="group-settings-card-title">
                    <span className="group-settings-card-icon"><i className="ti ti-lock"></i></span>
                    <div>
                      <h3>Group Privacy</h3>
                      <p>Control whether the group is public or private and whether it is visible in the workspace.</p>
                    </div>
                  </div>
                  <span className={`member-section-count ${permissions.canEditPrivacy ? "success" : "neutral"}`}>
                    {permissions.canEditPrivacy ? "Admin access" : "Read only"}
                  </span>
                </div>

                <form className="group-settings-form" onSubmit={handlePrivacySubmit} noValidate>
                  {privacyMessage.error ? <div className="form-error">{privacyMessage.error}</div> : null}
                  {privacyMessage.success ? <div className="form-success">{privacyMessage.success}</div> : null}

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label htmlFor="privacy" className="form-label">Privacy</label>
                      <select
                        id="privacy"
                        className="form-select portal-input"
                        disabled={!permissions.canEditPrivacy}
                        value={privacyForm.privacy}
                        onChange={(event) => setPrivacyForm((current) => ({ ...current, privacy: event.target.value }))}
                      >
                        <option value="public">Public</option>
                        <option value="private">Private</option>
                      </select>
                      <p className="field-hint mb-0">Public groups allow direct joins. Private groups use requests or codes.</p>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label d-block">Visibility</label>
                      <div className="group-toggle-card">
                        <div className="form-check form-switch m-0">
                          <input
                            id="visible"
                            className="form-check-input"
                            type="checkbox"
                            disabled={!permissions.canEditPrivacy}
                            checked={privacyForm.visible}
                            onChange={(event) => setPrivacyForm((current) => ({ ...current, visible: event.target.checked }))}
                          />
                          <label htmlFor="visible" className="form-check-label">Visible in workspace explore list</label>
                        </div>
                        <p className="field-hint mb-0">Turn this off to hide the group from Explore Groups.</p>
                      </div>
                    </div>
                  </div>

                  {permissions.canEditPrivacy ? (
                    <div className="portal-modal-actions group-settings-card-actions">
                      <button className="btn portal-btn-primary" type="submit" disabled={busyAction === "privacy"}>
                        {busyAction === "privacy" ? "Saving..." : "Save privacy"}
                      </button>
                    </div>
                  ) : null}
                </form>
              </div>
            </section>
          </div>

          <div className="col-12 col-xl-6">
            <section className="dashboard-panel card group-settings-card media-card">
              <div className="card-body">
                <div className="member-role-header group-settings-card-head">
                  <div className="group-settings-card-title">
                    <span className="group-settings-card-icon"><i className="ti ti-photo"></i></span>
                    <div>
                      <h3>Group Images</h3>
                      <p>Admins manage the group photo. Admins and moderators can refresh the cover image.</p>
                    </div>
                  </div>
                  <span
                    className={`member-section-count ${
                      permissions.canEditGroupImage ? "success" : permissions.canEditCover ? "warn" : "neutral"
                    }`}
                  >
                    {permissions.canEditGroupImage ? "Full access" : permissions.canEditCover ? "Cover only" : "Read only"}
                  </span>
                </div>

                <form className="group-settings-form" onSubmit={handleMediaSubmit} noValidate>
                  {mediaMessage.error ? <div className="form-error">{mediaMessage.error}</div> : null}
                  {mediaMessage.success ? <div className="form-success">{mediaMessage.success}</div> : null}

                  <div className="group-settings-media-grid">
                    <div className="group-settings-media-item">
                      <label className="form-label">Group photo</label>
                      <div className="group-settings-photo-shell">
                        <img className="group-settings-photo-preview" src={groupImageSrc} alt="Group photo preview" />
                      </div>
                      <input
                        className="form-control portal-input"
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,.gif,image/*"
                        disabled={!permissions.canEditGroupImage}
                        onChange={(event) => setGroupImageFile(event.target.files?.[0] || null)}
                      />
                      <p className="field-hint mb-0">Square image used around the workspace.</p>
                      <strong className="group-settings-file-name">{groupImageFile ? groupImageFile.name : "No new file selected"}</strong>
                    </div>

                    <div className="group-settings-media-item">
                      <label className="form-label">Cover photo</label>
                      <div
                        className={`group-card-cover group-settings-cover-preview ${coverImageSrc ? "has-image" : "no-image"}`}
                        style={coverImageSrc ? { backgroundImage: `linear-gradient(180deg, rgba(8, 24, 48, 0.08), rgba(8, 24, 48, 0.42)), url("${coverImageSrc}")` } : undefined}
                      >
                        {!coverImageSrc ? <span className="group-card-cover-fallback">{initials(state.group?.name)}</span> : null}
                      </div>
                      <input
                        className="form-control portal-input"
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,.gif,image/*"
                        disabled={!permissions.canEditCover}
                        onChange={(event) => setCoverImageFile(event.target.files?.[0] || null)}
                      />
                      <p className="field-hint mb-0">Wide banner image used on cards and the group header.</p>
                      <strong className="group-settings-file-name">{coverImageFile ? coverImageFile.name : "No new file selected"}</strong>
                    </div>
                  </div>

                  {permissions.canEditGroupImage || permissions.canEditCover ? (
                    <div className="portal-modal-actions group-settings-card-actions">
                      <button className="btn portal-btn-primary" type="submit" disabled={busyAction === "media"}>
                        {busyAction === "media" ? "Saving..." : "Save images"}
                      </button>
                    </div>
                  ) : null}
                </form>
              </div>
            </section>

            <section className="dashboard-panel card group-settings-card rules-card">
              <div className="card-body">
                <div className="member-role-header group-settings-card-head">
                  <div className="group-settings-card-title">
                    <span className="group-settings-card-icon"><i className="ti ti-settings"></i></span>
                    <div>
                      <h3>Group Rules</h3>
                      <p>Create or update the shared contribution rules for this group. Admins and moderators can manage these settings.</p>
                    </div>
                  </div>
                  <span className={`member-section-count ${permissions.canEditRules ? "success" : "neutral"}`}>
                    {permissions.canEditRules ? "Can manage" : "Read only"}
                  </span>
                </div>

                <form className="group-settings-form" onSubmit={handleRulesSubmit} noValidate>
                  {rulesMessage.error ? <div className="form-error">{rulesMessage.error}</div> : null}
                  {rulesMessage.success ? <div className="form-success">{rulesMessage.success}</div> : null}

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label htmlFor="contribution_amount" className="form-label">Contribution amount</label>
                      <input
                        id="contribution_amount"
                        className="form-control portal-input"
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="e.g. 20.00"
                        disabled={!permissions.canEditRules}
                        value={rulesForm.contribution_amount}
                        onChange={(event) => setRulesForm((current) => ({ ...current, contribution_amount: event.target.value }))}
                      />
                    </div>

                    <div className="col-md-6">
                      <label htmlFor="frequency" className="form-label">Frequency</label>
                      <select
                        id="frequency"
                        className="form-select portal-input"
                        disabled={!permissions.canEditRules}
                        value={rulesForm.frequency}
                        onChange={(event) => setRulesForm((current) => ({ ...current, frequency: event.target.value }))}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="custom_days">Custom days</option>
                      </select>
                    </div>

                    {rulesForm.frequency === "custom_days" ? (
                      <div className="col-md-6">
                        <label htmlFor="custom_days" className="form-label">Custom days</label>
                        <input
                          id="custom_days"
                          className="form-control portal-input"
                          type="number"
                          min="1"
                          step="1"
                          placeholder="e.g. 10"
                          disabled={!permissions.canEditRules}
                          value={rulesForm.custom_days}
                          onChange={(event) => setRulesForm((current) => ({ ...current, custom_days: event.target.value }))}
                        />
                      </div>
                    ) : null}

                    <div className="col-md-6">
                      <label className="form-label d-block">Late payments</label>
                      <div className="group-toggle-card">
                        <div className="form-check form-switch m-0">
                          <input
                            id="allow_late"
                            className="form-check-input"
                            type="checkbox"
                            disabled={!permissions.canEditRules}
                            checked={rulesForm.allow_late}
                            onChange={(event) => setRulesForm((current) => ({ ...current, allow_late: event.target.checked }))}
                          />
                          <label htmlFor="allow_late" className="form-check-label">Allow late payments</label>
                        </div>
                        <p className="field-hint mb-0">If enabled, members can pay after the due point with a penalty.</p>
                      </div>
                    </div>

                    {rulesForm.allow_late ? (
                      <div className="col-md-6">
                        <label htmlFor="late_penalty" className="form-label">Late penalty</label>
                        <input
                          id="late_penalty"
                          className="form-control portal-input"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="e.g. 2.00"
                          disabled={!permissions.canEditRules}
                          value={rulesForm.late_penalty}
                          onChange={(event) => setRulesForm((current) => ({ ...current, late_penalty: event.target.value }))}
                        />
                      </div>
                    ) : null}

                    <div className="col-md-6">
                      <label className="form-label d-block">Auto-start cycle</label>
                      <div className="group-toggle-card">
                        <div className="form-check form-switch m-0">
                          <input
                            id="auto_start_cycle"
                            className="form-check-input"
                            type="checkbox"
                            disabled={!permissions.canEditRules}
                            checked={rulesForm.auto_start_cycle}
                            onChange={(event) => setRulesForm((current) => ({ ...current, auto_start_cycle: event.target.checked }))}
                          />
                          <label htmlFor="auto_start_cycle" className="form-check-label">Start the next cycle automatically</label>
                        </div>
                        <p className="field-hint mb-0">Use this when the group should keep rolling without manual restarts.</p>
                      </div>
                    </div>
                  </div>

                  {permissions.canEditRules ? (
                    <div className="portal-modal-actions group-settings-card-actions">
                      <button className="btn portal-btn-primary" type="submit" disabled={busyAction === "rules"}>
                        {busyAction === "rules" ? "Saving..." : "Save rules"}
                      </button>
                    </div>
                  ) : null}
                </form>
              </div>
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
