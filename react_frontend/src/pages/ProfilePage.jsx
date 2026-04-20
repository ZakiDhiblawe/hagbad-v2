import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import RouteLink from "../components/RouteLink";
import { usePageChrome } from "../hooks/usePageChrome";
import { capitalize, formatDateTime, profileImageUrl } from "../lib/format";
import { routes } from "../lib/routes";

function parseSessionHours(value) {
  const text = String(value || "").trim();
  if (!text) return { ok: true, value: null };
  if (!/^\d+$/.test(text)) return { ok: false, value: null };

  const hours = Number(text);
  if (!Number.isInteger(hours) || hours < 1 || hours > 720) {
    return { ok: false, value: null };
  }

  return { ok: true, value: hours };
}

export default function ProfilePage({ auth, navigate }) {
  usePageChrome({
    title: "My Profile | Hagbad",
    page: "my_profile",
    bodyClassName: "portal-body dashboard-body",
  });

  const profile = auth.profile;
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const [profileForm, setProfileForm] = useState({
    full_name: "",
    phone: "",
    session_hours: "",
    imageFile: null,
    remove_image: false,
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_new_password: "",
  });
  const [profileMessage, setProfileMessage] = useState({ kind: "", text: "" });
  const [passwordMessage, setPasswordMessage] = useState({ kind: "", text: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    setProfileForm({
      full_name: profile?.full_name || "",
      phone: profile?.phone || "",
      session_hours: profile?.session_hours ?? "",
      imageFile: null,
      remove_image: false,
    });
  }, [profile]);

  const previewUrl = useMemo(() => {
    if (profileForm.imageFile) return URL.createObjectURL(profileForm.imageFile);
    if (profileForm.remove_image) return "/assets/images/profile/user.png";
    return profileImageUrl(profile);
  }, [profile, profileForm.imageFile, profileForm.remove_image]);

  useEffect(() => {
    if (!profileForm.imageFile) return undefined;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl, profileForm.imageFile]);

  async function handleProfileSubmit(event) {
    event.preventDefault();
    setProfileMessage({ kind: "", text: "" });

    if (profileForm.full_name.trim().length < 2) {
      setProfileMessage({ kind: "error", text: "Full name must be at least 2 characters." });
      return;
    }

    const parsedSessionHours = parseSessionHours(profileForm.session_hours);
    if (!parsedSessionHours.ok) {
      setProfileMessage({ kind: "error", text: "Session hours must be blank or a whole number from 1 to 720." });
      return;
    }

    setSavingProfile(true);
    try {
      await auth.saveProfile({
        fullName: profileForm.full_name.trim(),
        phone: profileForm.phone.trim() || null,
        sessionHours: parsedSessionHours.value,
        imageFile: profileForm.imageFile,
        removeImage: profileForm.remove_image,
      });
      setProfileMessage({ kind: "success", text: "Profile updated successfully." });
    } catch (error) {
      setProfileMessage({ kind: "error", text: error?.message || "Failed to update profile." });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    setPasswordMessage({ kind: "", text: "" });

    if (passwordForm.new_password.length < 6) {
      setPasswordMessage({ kind: "error", text: "New password must be at least 6 characters." });
      return;
    }

    if (passwordForm.new_password !== passwordForm.confirm_new_password) {
      setPasswordMessage({ kind: "error", text: "New password and confirmation do not match." });
      return;
    }

    setSavingPassword(true);
    try {
      const result = await auth.changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setPasswordForm({
        current_password: "",
        new_password: "",
        confirm_new_password: "",
      });
      setPasswordMessage({
        kind: "success",
        text: result?.message || "Password updated successfully.",
      });
    } catch (error) {
      setPasswordMessage({ kind: "error", text: error?.message || "Failed to update password." });
    } finally {
      setSavingPassword(false);
    }
  }

  const statusClass =
    profile?.status === "active"
      ? "status-active"
      : profile?.status === "banned"
        ? "status-banned"
        : "status-unknown";

  return (
    <AppShell auth={auth} navigate={navigate} miniTitle="Workspace settings" title="My Profile">
      <div className="row g-4 align-items-start profile-page-row">
        <div className="col-12 col-xl-4">
          <section className="dashboard-panel card profile-summary-card">
            <div className="card-body text-center">
              <img className="profile-avatar-preview" src={previewUrl} alt="Profile image preview" />
              <h3 className="mt-3 mb-1">{profile?.full_name || "User"}</h3>
              <p className="dashboard-note mb-0">{profile?.email || "Loading..."}</p>

              <div className="profile-summary-stats">
                <div className="profile-summary-stat">
                  <span>Status</span>
                  <strong className={`profile-status-badge ${statusClass}`}>{capitalize(profile?.status)}</strong>
                </div>
                <div className="profile-summary-stat">
                  <span>Created</span>
                  <strong>{formatDateTime(profile?.created_at)}</strong>
                </div>
              </div>

              <p className="dashboard-note profile-summary-note mb-0">
                Your profile image appears in the workspace menu at the top right corner.
              </p>
            </div>
          </section>
        </div>

        <div className="col-12 col-xl-8">
          <section className="dashboard-panel card mb-4">
            <div className="card-body">
              <div className="dashboard-panel-title">
                <div>
                  <h3>Profile details</h3>
                  <p>Update your name and profile image. Email stays fixed as your login identity.</p>
                </div>
              </div>

              <form onSubmit={handleProfileSubmit} noValidate>
                {profileMessage.text ? (
                  <div className={profileMessage.kind === "success" ? "form-success" : "form-error"}>
                    {profileMessage.text}
                  </div>
                ) : null}

                <div className="row g-3">
                  <div className="col-md-6">
                    <label htmlFor="profile_full_name" className="form-label">Full name</label>
                    <input
                      id="profile_full_name"
                      className="form-control portal-input"
                      type="text"
                      placeholder="Enter your full name"
                      value={profileForm.full_name}
                      onChange={(event) =>
                        setProfileForm((current) => ({ ...current, full_name: event.target.value }))
                      }
                    />
                  </div>

                  <div className="col-md-6">
                    <label htmlFor="profile_email" className="form-label">Email address</label>
                    <input
                      id="profile_email"
                      className="form-control portal-input"
                      type="email"
                      value={profile?.email || ""}
                      disabled
                    />
                    <p className="field-hint">Email cannot be changed here.</p>
                  </div>

                  <div className="col-md-6">
                    <label htmlFor="profile_phone" className="form-label">Phone number</label>
                    <input
                      id="profile_phone"
                      className="form-control portal-input"
                      type="text"
                      placeholder="Enter your phone number"
                      value={profileForm.phone}
                      onChange={(event) =>
                        setProfileForm((current) => ({ ...current, phone: event.target.value }))
                      }
                    />
                  </div>

                  <div className="col-md-6">
                    <label htmlFor="profile_session_hours" className="form-label">Session hours</label>
                    <input
                      id="profile_session_hours"
                      className="form-control portal-input"
                      type="number"
                      min="1"
                      max="720"
                      step="1"
                      placeholder="Leave blank for no expiry"
                      value={profileForm.session_hours}
                      onChange={(event) =>
                        setProfileForm((current) => ({ ...current, session_hours: event.target.value }))
                      }
                    />
                    <p className="field-hint">Blank means stay signed in until logout or a new login on another session.</p>
                  </div>

                  <div className="col-md-6">
                    <label htmlFor="profile_image" className="form-label">Profile image</label>
                    <input
                      id="profile_image"
                      className="form-control portal-input"
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.gif,image/*"
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          imageFile: event.target.files?.[0] || null,
                          remove_image: false,
                        }))
                      }
                    />
                    <p className="field-hint">Upload a clear square photo for the workspace menu.</p>
                    <div className="form-check mt-2">
                      <input
                        id="remove_profile_image"
                        className="form-check-input"
                        type="checkbox"
                        checked={profileForm.remove_image}
                        onChange={(event) =>
                          setProfileForm((current) => ({
                            ...current,
                            remove_image: event.target.checked,
                            imageFile: event.target.checked ? null : current.imageFile,
                          }))
                        }
                      />
                      <label htmlFor="remove_profile_image" className="form-check-label">Remove current image</label>
                    </div>
                  </div>
                </div>

                <div className="d-flex flex-wrap gap-3 mt-4 profile-actions">
                  <button className="btn portal-btn-primary" type="submit" disabled={savingProfile}>
                    {savingProfile ? "Saving profile..." : "Save profile"}
                  </button>
                  <RouteLink className="btn portal-btn-secondary" to={routes.dashboard} navigate={navigate}>
                    Back to dashboard
                  </RouteLink>
                </div>
              </form>
            </div>
          </section>
        </div>

        <div className="col-12">
          <section className="dashboard-panel card password-panel">
            <div className="card-body password-panel-body">
              <div className="dashboard-panel-title">
                <div>
                  <h3>Password</h3>
                  <p>Change your password without changing your email address.</p>
                </div>
              </div>

              <form onSubmit={handlePasswordSubmit} noValidate>
                {passwordMessage.text ? (
                  <div className={passwordMessage.kind === "success" ? "form-success" : "form-error"}>
                    {passwordMessage.text}
                  </div>
                ) : null}

                <div className="password-grid">
                  <div className="password-field">
                    <label htmlFor="current_password" className="form-label">Current password</label>
                    <div className="input-group">
                      <input
                        id="current_password"
                        className="form-control portal-input"
                        type={showPasswords.current ? "text" : "password"}
                        autoComplete="current-password"
                        value={passwordForm.current_password}
                        onChange={(event) =>
                          setPasswordForm((current) => ({ ...current, current_password: event.target.value }))
                        }
                      />
                      <button
                        type="button"
                        className="btn portal-toggle"
                        onClick={() =>
                          setShowPasswords((current) => ({ ...current, current: !current.current }))
                        }
                      >
                        {showPasswords.current ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>

                  <div className="password-field">
                    <label htmlFor="new_password" className="form-label">New password</label>
                    <div className="input-group">
                      <input
                        id="new_password"
                        className="form-control portal-input"
                        type={showPasswords.next ? "text" : "password"}
                        autoComplete="new-password"
                        value={passwordForm.new_password}
                        onChange={(event) =>
                          setPasswordForm((current) => ({ ...current, new_password: event.target.value }))
                        }
                      />
                      <button
                        type="button"
                        className="btn portal-toggle"
                        onClick={() =>
                          setShowPasswords((current) => ({ ...current, next: !current.next }))
                        }
                      >
                        {showPasswords.next ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>

                  <div className="password-field">
                    <label htmlFor="confirm_new_password" className="form-label">Confirm new password</label>
                    <div className="input-group">
                      <input
                        id="confirm_new_password"
                        className="form-control portal-input"
                        type={showPasswords.confirm ? "text" : "password"}
                        autoComplete="new-password"
                        value={passwordForm.confirm_new_password}
                        onChange={(event) =>
                          setPasswordForm((current) => ({
                            ...current,
                            confirm_new_password: event.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="btn portal-toggle"
                        onClick={() =>
                          setShowPasswords((current) => ({ ...current, confirm: !current.confirm }))
                        }
                      >
                        {showPasswords.confirm ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>

                  <div className="password-action">
                    <button className="btn portal-btn-primary password-save-btn" type="submit" disabled={savingPassword}>
                      {savingPassword ? "Updating password..." : "Update password"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
