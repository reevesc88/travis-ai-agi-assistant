import { parseTokenPayload } from "../auth";

interface ProfileViewProps {
  navigate: (to: string) => void;
}

function initialsFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const segments = local.split(/[._-]+/).filter(Boolean);
  if (segments.length >= 2) return (segments[0][0] + segments[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase() || "?";
}

export function ProfileView({ navigate }: ProfileViewProps) {
  const claims = parseTokenPayload();
  const email = claims?.email ?? "Unknown";
  const role = claims?.role ?? "unknown";
  const initials = initialsFromEmail(email);

  const signOut = () => {
    localStorage.removeItem("travis_token");
    navigate("/login");
  };

  return (
    <div class="profile-view">
      <div class="profile-card">
        <div class="profile-avatar">{initials}</div>
        <h2 class="profile-email">{email}</h2>
        <span class="profile-role-badge">{role}</span>
        <div class="profile-actions">
          <button
            class="btn btn-secondary"
            onClick={() => navigate("/forgot-password")}
          >
            Change password
          </button>
          <button class="btn btn-danger" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
