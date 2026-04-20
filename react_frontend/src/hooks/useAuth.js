import { useEffect, useEffectEvent, useState } from "react";
import {
  getProfile,
  loginUser,
  logoutUser,
  registerUser,
  updatePassword,
  updateProfile,
} from "../lib/api";

const TOKEN_KEY = "hagbad_access_token";
const PROFILE_KEY = "hagbad_current_profile";

function localStorageAvailable() {
  try {
    const key = "__hagbad_react_test__";
    window.localStorage.setItem(key, "1");
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function readToken() {
  if (!localStorageAvailable()) return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

function readProfile() {
  if (!localStorageAvailable()) return null;
  const raw = window.localStorage.getItem(PROFILE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    window.localStorage.removeItem(PROFILE_KEY);
    return null;
  }
}

function writeSession(token, profile) {
  if (!localStorageAvailable()) return;

  if (!token) {
    window.localStorage.removeItem(TOKEN_KEY);
  } else {
    window.localStorage.setItem(TOKEN_KEY, token);
  }

  if (!profile) {
    window.localStorage.removeItem(PROFILE_KEY);
  } else {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }
}

export function useAuth() {
  const [token, setToken] = useState(() => readToken());
  const [profile, setProfile] = useState(() => readProfile());
  const [bootstrapping, setBootstrapping] = useState(() => Boolean(readToken()));
  const [sessionError, setSessionError] = useState("");

  function persist(nextToken, nextProfile) {
    setToken(nextToken);
    setProfile(nextProfile);
    writeSession(nextToken, nextProfile);
  }

  function clearSession() {
    setSessionError("");
    setBootstrapping(false);
    persist(null, null);
  }

  const syncFromStorage = useEffectEvent(() => {
    const nextToken = readToken();
    const nextProfile = readProfile();
    setToken(nextToken);
    setProfile(nextProfile);
    setBootstrapping(Boolean(nextToken));
  });

  useEffect(() => {
    window.addEventListener("storage", syncFromStorage);
    return () => window.removeEventListener("storage", syncFromStorage);
  }, [syncFromStorage]);

  useEffect(() => {
    if (!token) {
      setBootstrapping(false);
      return;
    }

    let active = true;
    setBootstrapping(true);

    getProfile(token)
      .then((freshProfile) => {
        if (!active) return;
        setSessionError("");
        persist(token, freshProfile);
      })
      .catch((error) => {
        if (!active) return;
        clearSession();
        setSessionError(error?.message || "Failed to restore your session.");
      })
      .finally(() => {
        if (active) setBootstrapping(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  async function signIn(email, password) {
    const tokenResponse = await loginUser(email, password);
    const nextToken = tokenResponse.access_token;
    const freshProfile = await getProfile(nextToken);

    persist(nextToken, freshProfile);
    setBootstrapping(false);
    setSessionError("");
    return freshProfile;
  }

  async function signUp(payload) {
    await registerUser(payload);
    return signIn(payload.email, payload.password);
  }

  async function signOut() {
    try {
      if (token) {
        await logoutUser(token);
      }
    } catch {
      // Best effort logout only.
    }

    clearSession();
  }

  async function refreshProfile() {
    if (!token) return null;
    const freshProfile = await getProfile(token);
    persist(token, freshProfile);
    return freshProfile;
  }

  async function saveProfile(payload) {
    if (!token) {
      throw { status: 401, message: "Please sign in again." };
    }

    const freshProfile = await updateProfile(token, payload);
    persist(token, freshProfile);
    return freshProfile;
  }

  async function changePassword(payload) {
    if (!token) {
      throw { status: 401, message: "Please sign in again." };
    }

    return updatePassword(token, payload);
  }

  return {
    token,
    profile,
    isAuthenticated: Boolean(token),
    bootstrapping,
    sessionError,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    saveProfile,
    changePassword,
    clearSession,
  };
}
