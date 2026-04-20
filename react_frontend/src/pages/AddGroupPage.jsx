import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import RouteLink from "../components/RouteLink";
import { usePageChrome } from "../hooks/usePageChrome";
import { createGroup } from "../lib/api";
import { groupImageUrl, initials } from "../lib/format";
import { routes } from "../lib/routes";

function previewMeta(privacy, visible) {
  if (privacy === "private" && visible) {
    return "Visible private group. Members can request access after they discover it.";
  }
  if (privacy === "private") {
    return "Hidden private group. Only invited or directly managed members can reach it.";
  }
  if (visible) {
    return "Visible public group. Members can join immediately from Explore Groups.";
  }
  return "Hidden public group. It stays out of Explore Groups until you make it visible.";
}

export default function AddGroupPage({ auth, navigate }) {
  usePageChrome({
    title: "Add New Group | Hagbad",
    page: "add_group",
    bodyClassName: "portal-body dashboard-body",
  });

  const [form, setForm] = useState({
    name: "",
    description: "",
    privacy: "public",
    visible: true,
    groupImageFile: null,
    coverImageFile: null,
  });
  const [message, setMessage] = useState({ kind: "", text: "" });
  const [nameError, setNameError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const groupImagePreview = useMemo(
    () => (form.groupImageFile ? URL.createObjectURL(form.groupImageFile) : ""),
    [form.groupImageFile]
  );
  const coverImagePreview = useMemo(
    () => (form.coverImageFile ? URL.createObjectURL(form.coverImageFile) : ""),
    [form.coverImageFile]
  );

  useEffect(() => {
    if (!groupImagePreview) return undefined;
    return () => URL.revokeObjectURL(groupImagePreview);
  }, [groupImagePreview]);

  useEffect(() => {
    if (!coverImagePreview) return undefined;
    return () => URL.revokeObjectURL(coverImagePreview);
  }, [coverImagePreview]);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage({ kind: "", text: "" });
    setNameError("");

    if (form.name.trim().length < 2) {
      setNameError("Name must be at least 2 characters.");
      setMessage({ kind: "error", text: "Please fix the highlighted field." });
      return;
    }

    setSubmitting(true);
    try {
      const created = await createGroup(auth.token, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        privacy: form.privacy,
        visible: form.visible,
        groupImageFile: form.groupImageFile,
        coverImageFile: form.coverImageFile,
      });

      setMessage({
        kind: "success",
        text: `"${created.name}" was created. Redirecting to My Groups...`,
      });

      window.setTimeout(() => {
        navigate(routes.myGroups);
      }, 900);
    } catch (error) {
      setMessage({ kind: "error", text: error?.message || "Failed to create group." });
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setForm({
      name: "",
      description: "",
      privacy: "public",
      visible: true,
      groupImageFile: null,
      coverImageFile: null,
    });
    setMessage({ kind: "", text: "" });
    setNameError("");
  }

  const coverStyle = coverImagePreview
    ? {
        backgroundImage: `linear-gradient(180deg, rgba(8, 24, 48, 0.08), rgba(8, 24, 48, 0.42)), url("${coverImagePreview}")`,
      }
    : undefined;

  return (
    <AppShell
      auth={auth}
      navigate={navigate}
      miniTitle="Hagbad workspace"
      title="Add New Group"
      activeSidebarKey="add_group"
    >
      <section className="dashboard-hero groups-hero groups-page-hero">
        <div>
          <span className="eyebrow text-white mb-3">Create a group</span>
          <h2>Set the look, privacy, and visibility before you launch.</h2>
          <p>
            Upload a group photo and a cover photo, review the live preview, and create the group
            with yourself added as the admin member automatically.
          </p>
        </div>
        <div className="groups-hero-actions">
          <RouteLink className="btn portal-btn-secondary" to={routes.myGroups} navigate={navigate}>
            Back to My Groups
          </RouteLink>
          <RouteLink className="btn portal-btn-secondary" to={routes.exploreGroups} navigate={navigate}>
            Explore Groups
          </RouteLink>
        </div>
      </section>

      <div className="row g-4 mt-1 align-items-start">
        <div className="col-12 col-xl-7">
          <section className="dashboard-panel card group-create-page-panel">
            <div className="card-body">
              <div className="dashboard-panel-title">
                <div>
                  <h3>Group setup</h3>
                  <p>Choose how the group appears in the workspace before members arrive.</p>
                </div>
              </div>

              <form className="group-create-form" onSubmit={handleSubmit} onReset={resetForm} noValidate>
                {message.text ? (
                  <div className={message.kind === "success" ? "form-success" : "form-error"} role="status">
                    {message.text}
                  </div>
                ) : null}

                <div className="row g-3">
                  <div className="col-12">
                    <label htmlFor="name" className="form-label">Group name</label>
                    <input
                      id="name"
                      className="form-control portal-input"
                      type="text"
                      maxLength="120"
                      placeholder="Enter the group name"
                      value={form.name}
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    />
                    <p className="field-error" role="alert">{nameError}</p>
                  </div>

                  <div className="col-md-6">
                    <label htmlFor="privacy" className="form-label">Privacy</label>
                    <select
                      id="privacy"
                      className="form-select portal-input"
                      value={form.privacy}
                      onChange={(event) => setForm((current) => ({ ...current, privacy: event.target.value }))}
                    >
                      <option value="public">Public</option>
                      <option value="private">Private</option>
                    </select>
                    <p className="field-hint">Public groups allow direct joins. Private groups use join requests.</p>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label d-block">Visibility</label>
                    <div className="group-toggle-card">
                      <div className="form-check form-switch m-0">
                        <input
                          id="visible"
                          className="form-check-input"
                          type="checkbox"
                          checked={form.visible}
                          onChange={(event) => setForm((current) => ({ ...current, visible: event.target.checked }))}
                        />
                        <label htmlFor="visible" className="form-check-label">Visible in workspace explore list</label>
                      </div>
                      <p className="field-hint mb-0">Turn this off to keep the group out of Explore Groups.</p>
                    </div>
                  </div>

                  <div className="col-12">
                    <label htmlFor="description" className="form-label">Description</label>
                    <textarea
                      id="description"
                      className="form-control portal-input"
                      rows="4"
                      maxLength="2000"
                      placeholder="Describe who the group is for and how it works"
                      value={form.description}
                      onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                    ></textarea>
                  </div>

                  <div className="col-md-6">
                    <label htmlFor="group_image" className="form-label">Group photo</label>
                    <input
                      id="group_image"
                      className="form-control portal-input"
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.gif,image/*"
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          groupImageFile: event.target.files?.[0] || null,
                        }))
                      }
                    />
                    <p className="field-hint">Used as the main square image across the workspace.</p>
                  </div>

                  <div className="col-md-6">
                    <label htmlFor="cover_image" className="form-label">Cover photo</label>
                    <input
                      id="cover_image"
                      className="form-control portal-input"
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.gif,image/*"
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          coverImageFile: event.target.files?.[0] || null,
                        }))
                      }
                    />
                    <p className="field-hint">Used as the wide banner image on group cards.</p>
                  </div>
                </div>

                <div className="portal-modal-actions">
                  <button id="create-submit" className="btn portal-btn-primary" type="submit" disabled={submitting}>
                    {submitting ? "Creating..." : "Create group"}
                  </button>
                  <button id="create-reset" className="btn portal-btn-secondary" type="reset">
                    Clear form
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>

        <div className="col-12 col-xl-5">
          <section className="dashboard-panel card group-preview-panel">
            <div className="card-body">
              <div className="dashboard-panel-title">
                <div>
                  <h3>Live preview</h3>
                  <p>Uploaded images and group details update here as you edit the form.</p>
                </div>
              </div>

              <article className="group-card group-preview-card">
                <div
                  className={`group-card-cover${coverStyle ? " has-image" : " no-image"}`}
                  style={coverStyle}
                >
                  {!coverStyle ? (
                    <span className="group-card-cover-fallback">{initials(form.name || "Hagbad Group")}</span>
                  ) : null}
                </div>

                <img
                  className="group-card-avatar"
                  src={groupImagePreview || groupImageUrl({})}
                  alt="Group image preview"
                />

                <div className="group-card-body">
                  <div className="group-card-top">
                    <h3 className="group-card-title">{form.name.trim() || "New group name"}</h3>
                    <span className="group-card-date">Preview</span>
                  </div>

                  <p className="group-card-description">
                    {form.description.trim() || "Add a short group description to help members understand the purpose."}
                  </p>

                  <div className="group-card-badges">
                    <span className={`group-card-badge ${form.privacy === "private" ? "private" : "public"}`}>
                      {form.privacy === "private" ? "Private" : "Public"}
                    </span>
                    <span className={`group-card-badge ${form.visible ? "visible" : "hidden"}`}>
                      {form.visible ? "Visible" : "Hidden"}
                    </span>
                    <span className="group-card-badge active">Active</span>
                  </div>

                  <div className="group-card-meta">{previewMeta(form.privacy, form.visible)}</div>
                </div>
              </article>

              <div className="group-upload-meta-grid">
                <div className="group-upload-meta-card">
                  <span>Group photo</span>
                  <strong>{form.groupImageFile ? form.groupImageFile.name : "No file selected"}</strong>
                </div>
                <div className="group-upload-meta-card">
                  <span>Cover photo</span>
                  <strong>{form.coverImageFile ? form.coverImageFile.name : "No file selected"}</strong>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
