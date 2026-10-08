import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { ApiError } from "../lib/api";
import {
  adminTokenStorageKey,
  changeAdministratorPassword,
  getAdministratorProfile,
  getDashboardStatistics,
  loginAdministrator,
} from "./api";
import "./admin.css";
import { GuestManagement } from "./GuestManagement";
import { RSVPManagement } from "./RSVPManagement";
import { ContentManagement } from "./ContentManagement";
import type { AdminProfile, DashboardStatistics } from "./types";

function friendlyRole(role: AdminProfile["role"]): string {
  return role.replace("_", " ");
}

export function AdminApp() {
  const [accessToken, setAccessToken] = useState<string | null>(() =>
    sessionStorage.getItem(adminTokenStorageKey),
  );
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(Boolean(accessToken));
  const navigate = useNavigate();

  const signOut = useCallback(() => {
    sessionStorage.removeItem(adminTokenStorageKey);
    setAccessToken(null);
    setProfile(null);
    navigate("/admin/login", { replace: true });
  }, [navigate]);

  useEffect(() => {
    if (!accessToken) {
      setIsRestoringSession(false);
      return;
    }

    let isActive = true;
    setIsRestoringSession(true);

    getAdministratorProfile(accessToken)
      .then((administrator) => {
        if (!isActive) return;
        setProfile(administrator);
      })
      .catch(() => {
        if (!isActive) return;
        sessionStorage.removeItem(adminTokenStorageKey);
        setAccessToken(null);
        setProfile(null);
      })
      .finally(() => {
        if (isActive) setIsRestoringSession(false);
      });

    return () => {
      isActive = false;
    };
  }, [accessToken]);

  function handleAuthenticated(token: string): void {
    sessionStorage.setItem(adminTokenStorageKey, token);
    setAccessToken(token);
  }

  if (isRestoringSession) {
    return (
      <main className="admin-auth-page">
        <div className="admin-loading" role="status">
          <span />
          Restoring your secure session...
        </div>
      </main>
    );
  }

  return (
    <Routes>
      <Route
        path="/admin/login"
        element={
          accessToken && profile ? (
            <Navigate
              to={
                profile.is_password_change_required
                  ? "/admin/change-password"
                  : "/admin"
              }
              replace
            />
          ) : (
            <AdminLogin onAuthenticated={handleAuthenticated} />
          )
        }
      />
      <Route
        path="/admin/change-password"
        element={
          accessToken && profile ? (
            <AdminPasswordChange
              accessToken={accessToken}
              profile={profile}
              onPasswordChanged={signOut}
            />
          ) : (
            <Navigate to="/admin/login" replace />
          )
        }
      />
      <Route
        path="/admin/*"
        element={
          accessToken && profile ? (
            profile.is_password_change_required ? (
              <Navigate to="/admin/change-password" replace />
            ) : (
              <AdminLayout
                accessToken={accessToken}
                profile={profile}
                onSignOut={signOut}
              />
            )
          ) : (
            <Navigate to="/admin/login" replace />
          )
        }
      />
    </Routes>
  );
}

function AdminLogin({
  onAuthenticated,
}: {
  onAuthenticated: (token: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await loginAdministrator(username.trim(), password);
      onAuthenticated(response.access_token);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "Unable to sign in right now. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="admin-auth-page">
      <section className="admin-auth-card" aria-labelledby="admin-login-title">
        <a className="admin-back-link" href="/">
          Back to wedding website
        </a>
        <p className="admin-eyebrow">John Paul & Joyce</p>
        <h1 id="admin-login-title">Management dashboard</h1>
        <p className="admin-intro">
          Sign in with your administrator account to manage the wedding RSVP.
        </p>

        <form className="admin-form" onSubmit={handleSubmit}>
          <label htmlFor="admin-username">Username or email</label>
          <input
            id="admin-username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            disabled={isSubmitting}
            minLength={3}
            maxLength={100}
            required
          />

          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isSubmitting}
            minLength={8}
            maxLength={128}
            required
          />

          {errorMessage ? <p className="admin-error" role="alert">{errorMessage}</p> : null}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}

function AdminPasswordChange({
  accessToken,
  profile,
  onPasswordChanged,
}: {
  accessToken: string;
  profile: AdminProfile;
  onPasswordChanged: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmedPassword, setConfirmedPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newPassword !== confirmedPassword) {
      setErrorMessage("The new passwords do not match.");
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      await changeAdministratorPassword(accessToken, currentPassword, newPassword);
      onPasswordChanged();
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "Unable to change your password right now.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="admin-auth-page">
      <section className="admin-auth-card" aria-labelledby="password-title">
        <p className="admin-eyebrow">Secure your account</p>
        <h1 id="password-title">Change your password</h1>
        <p className="admin-intro">
          Welcome, {profile.first_name}. Create a private password before
          entering the dashboard. You'll sign in again when it's saved.
        </p>

        <form className="admin-form" onSubmit={handleSubmit}>
          <label htmlFor="current-password">Current password</label>
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            disabled={isSubmitting}
            required
          />

          <label htmlFor="new-password">New password</label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            disabled={isSubmitting}
            minLength={12}
            maxLength={128}
            required
          />
          <small>Use at least 12 characters.</small>

          <label htmlFor="confirm-password">Confirm new password</label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmedPassword}
            onChange={(event) => setConfirmedPassword(event.target.value)}
            disabled={isSubmitting}
            minLength={12}
            maxLength={128}
            required
          />

          {errorMessage ? <p className="admin-error" role="alert">{errorMessage}</p> : null}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save password"}
          </button>
        </form>
      </section>
    </main>
  );
}

function AdminLayout({
  accessToken,
  profile,
  onSignOut,
}: {
  accessToken: string;
  profile: AdminProfile;
  onSignOut: () => void;
}) {
  const location = useLocation();
  const [statistics, setStatistics] = useState<DashboardStatistics | null>(null);
  const [statisticsError, setStatisticsError] = useState("");

  useEffect(() => {
    let isActive = true;

    getDashboardStatistics(accessToken)
      .then((response) => {
        if (!isActive) return;
        setStatistics(response);
        setStatisticsError("");
      })
      .catch((error) => {
        if (!isActive) return;
        setStatisticsError(
          error instanceof ApiError
            ? error.message
            : "Dashboard statistics could not be loaded.",
        );
      });

    return () => {
      isActive = false;
    };
  }, [accessToken]);

  const statisticCards = statistics
    ? [
        { label: "Total guests", value: statistics.total_guests },
        { label: "Allocated seats", value: statistics.allocated_seats },
        { label: "RSVP responses", value: statistics.rsvp_responses },
        { label: "Attending", value: statistics.attending },
        { label: "Declined", value: statistics.declined },
        { label: "Pending", value: statistics.pending },
        { label: "Adults", value: statistics.adults },
        { label: "Children", value: statistics.children },
      ]
    : [];

  return (
    <div className="admin-dashboard">
      <aside className="admin-sidebar">
        <div>
          <p className="admin-eyebrow">John Paul & Joyce</p>
          <strong>Wedding manager</strong>
        </div>
        <nav aria-label="Administrator navigation">
          <a
            className={location.pathname === "/admin" ? "is-active" : ""}
            href="/admin"
          >
            Overview
          </a>
          <a
            className={location.pathname.startsWith("/admin/guests") ? "is-active" : ""}
            href="/admin/guests"
          >
            Guests
          </a>
          <a
            className={location.pathname.startsWith("/admin/rsvps") ? "is-active" : ""}
            href="/admin/rsvps"
          >
            RSVPs
          </a>
          <a
            className={location.pathname.startsWith("/admin/content") ? "is-active" : ""}
            href="/admin/content"
          >
            Content
          </a>
        </nav>
        <button className="admin-signout" type="button" onClick={onSignOut}>
          Sign out
        </button>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <p className="admin-eyebrow">Administrator dashboard</p>
            <h1>Welcome, {profile.first_name}</h1>
          </div>
          <div className="admin-account">
            <span>{profile.first_name} {profile.last_name}</span>
            <small>{friendlyRole(profile.role)}</small>
          </div>
        </header>

        {location.pathname.startsWith("/admin/guests") ? (
          <GuestManagement accessToken={accessToken} role={profile.role} />
        ) : location.pathname.startsWith("/admin/rsvps") ? (
          <RSVPManagement accessToken={accessToken} role={profile.role} />
        ) : location.pathname.startsWith("/admin/content") ? (
          <ContentManagement accessToken={accessToken} role={profile.role} />
        ) : (
          <>
            <section className="admin-overview-heading" aria-labelledby="overview-title">
          <div>
            <p className="admin-status-label">Live RSVP overview</p>
            <h2 id="overview-title">Guest and response summary</h2>
            <p>Current totals from the wedding guest list and RSVP responses.</p>
          </div>
          <a href="/">View wedding website</a>
        </section>

        {statisticsError ? (
          <p className="admin-error admin-statistics-error" role="alert">
            {statisticsError}
          </p>
        ) : null}

        {!statistics && !statisticsError ? (
          <div className="admin-statistics-loading" role="status">
            <span />
            Loading dashboard statistics...
          </div>
        ) : null}

            {statistics ? (
              <section className="admin-statistics" aria-label="RSVP statistics">
                {statisticCards.map((card) => (
                  <article className="admin-statistic-card" key={card.label}>
                    <p>{card.label}</p>
                    <strong>{card.value ?? "N/A"}</strong>
                  </article>
                ))}
              </section>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
