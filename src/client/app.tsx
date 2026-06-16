import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { View } from "./types";
import { AppContext } from "./context";
import { useAppState } from "./hooks/use-app";
import { useRouter } from "./hooks/use-router";
import { Sidebar } from "./components/sidebar";
import { BottomNav } from "./components/bottom-nav";
import { LandingPage } from "./components/landing-page";
import { Dashboard } from "./components/dashboard";
import { ScheduleView } from "./components/schedule-view";
import { DayScheduleView } from "./components/day-schedule-view";
import { JobList } from "./components/job-list";
import { JobDetail } from "./components/job-detail";
import { CustomerList } from "./components/customer-list";
import { CustomerDetail } from "./components/customer-detail";
import { TechnicianList } from "./components/technician-list";
import { ServiceTypeList } from "./components/service-type-list";
import { MaterialList } from "./components/material-list";
import { InvoiceList } from "./components/invoice-list";
import { InvoiceDetail } from "./components/invoice-detail";
import { QuoteList } from "./components/quote-list";
import { QuoteDetail } from "./components/quote-detail";
import { InboxView } from "./views/InboxView";
import { ReportsView } from "./views/ReportsView";
import { SettingsView } from "./views/SettingsView";
import { AIAssistantView } from "./views/AIAssistantView";
import { ReceptionistView } from "./views/ReceptionistView";
import { SupplierPricingView } from "./views/SupplierPricingView";
import { ErrorBanner } from "./components/error-banner";
import { TrialExpiredModal } from "./components/trial-expired-modal";
import { TrialWarningBanner } from "./components/trial-warning-banner";
import { Search, Bell, Settings, Menu, Sun, Moon, LogOut, ChevronDown } from "lucide-preact";
import { LoginView } from "./views/LoginView";
import { ForgotPasswordView } from "./views/ForgotPasswordView";
import { ResetPasswordView } from "./views/ResetPasswordView";
import { api } from "./api";
import { parseTokenPayload, isTech } from "./auth";
import { ProfileView } from "./views/ProfileView";

function isAuthenticated(): boolean {
  const payload = parseTokenPayload();
  if (!payload) return false;
  if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) return false;
  return true;
}

function initialsFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const segments = local.split(/[._-]+/).filter(Boolean);
  if (segments.length >= 2) return (segments[0][0] + segments[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase() || "?";
}

function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") return stored;
    return "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return { theme, toggle };
}

export function App() {
  const isAgent = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has("agent") || params.get("mode") === "agent";
  }, []);

  useEffect(() => {
    if (isAgent) {
      document.documentElement.setAttribute("data-agent", "");
    }
  }, [isAgent]);

  const { view, id, fromJobId, navigate } = useRouter();

  const auth = isAuthenticated();
  const isPublicView = view === "landing" || view === "login" || view === "forgot-password" || view === "reset-password";

  useEffect(() => {
    if (!auth && !isPublicView) navigate("/login");
  }, [auth, isPublicView]); // eslint-disable-line react-hooks/exhaustive-deps

  if (view === "landing") {
    return <LandingPage navigate={navigate} />;
  }

  if (view === "forgot-password") {
    return <ForgotPasswordView navigate={navigate} />;
  }

  if (view === "reset-password") {
    return <ResetPasswordView token={id ?? ""} navigate={navigate} />;
  }

  if (view === "login" || !auth) {
    return <LoginView navigate={navigate} />;
  }

  return <AppShell view={view} id={id} fromJobId={fromJobId} navigate={navigate} isAgent={isAgent} />;
}

interface AppShellProps {
  view: View;
  id: string | null;
  fromJobId: number | null;
  navigate: (to: string) => void;
  isAgent: boolean;
}

function UserMenu({ navigate }: { navigate: (to: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const claims = useMemo(() => parseTokenPayload(), []);
  const email = claims?.email ?? "Signed in";
  const role = claims?.role;
  const initials = claims?.email ? initialsFromEmail(claims.email) : "?";

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const signOut = async () => {
    try { await api<{ ok: boolean }>("POST", "/api/auth/logout", {}); } catch {}
    localStorage.removeItem("travis_token");
    navigate("/login");
  };

  return (
    <div class="user-menu" ref={ref}>
      <button
        class="user-menu-trigger"
        title={email}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span class="user-menu-avatar">{initials}</span>
        <span class="user-menu-email">{email}</span>
        <ChevronDown size={14} class="user-menu-chevron" />
      </button>
      {open && (
        <div class="user-menu-dropdown" role="menu">
          <div class="user-menu-info">
            <span class="user-menu-info-email">{email}</span>
            {role && <span class="user-menu-info-role">{role}</span>}
          </div>
          <button class="user-menu-signout" role="menuitem" onClick={signOut}>
            <LogOut size={15} />
            <span>Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
}

function AppShell({ view, id, fromJobId, navigate, isAgent }: AppShellProps) {
  const appState = useAppState(isAgent, navigate);
  const [topSearch, setTopSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [trialExpired, setTrialExpired] = useState<string | null>(null);
  const { theme, toggle: toggleTheme } = useTheme();

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ message?: string }>).detail;
      setTrialExpired(detail?.message || "Your trial has ended — upgrade to keep using Travis.");
    };
    window.addEventListener("travis:trial-expired", handler);
    return () => window.removeEventListener("travis:trial-expired", handler);
  }, []);

  useEffect(() => {
    if (view === "jobs" && id) {
      appState.selectJob(parseInt(id, 10));
    } else if (view === "customers" && id) {
      appState.selectCustomer(parseInt(id, 10));
    } else if (view === "invoices" && id) {
      appState.selectInvoice(parseInt(id, 10));
    } else if (view === "quotes" && id) {
      appState.selectQuote(parseInt(id, 10));
    }
  }, [view, id]); // eslint-disable-line react-hooks/exhaustive-deps

  const techUser = isTech();

  const OWNER_ONLY_VIEWS: View[] = [
    "dashboard",
    "customers", "technicians", "services", "materials", "invoices",
    "inbox", "quotes", "reports", "settings", "ai-activity",
    "receptionist", "supplier-pricing",
  ];

  const renderMain = () => {
    if (techUser && OWNER_ONLY_VIEWS.includes(view)) {
      return (
        <div class="not-authorised">
          <div class="not-authorised-icon">🔒</div>
          <h2 class="not-authorised-title">Not authorised</h2>
          <p class="not-authorised-body">
            This section is only available to account owners.
          </p>
          <button class="btn btn-primary" onClick={() => navigate("/jobs")}>
            Go to Jobs
          </button>
        </div>
      );
    }
    if (view === "profile") return <ProfileView navigate={navigate} />;
    if (view === "jobs" && id && appState.selectedJob) return <JobDetail />;
    if (view === "customers" && id && appState.selectedCustomer) return <CustomerDetail />;
    if (view === "invoices" && id && appState.selectedInvoice) return <InvoiceDetail />;
    if (view === "quotes" && id && appState.selectedQuote) return <QuoteDetail fromJobId={fromJobId ?? undefined} />;
    if (view === "schedule" && id) return <DayScheduleView date={id} />;
    switch (view) {
      case "schedule": return <ScheduleView />;
      case "jobs": return <JobList />;
      case "customers": return <CustomerList />;
      case "technicians": return <TechnicianList />;
      case "services": return <ServiceTypeList />;
      case "materials": return <MaterialList />;
      case "invoices": return <InvoiceList />;
      case "inbox": return <InboxView />;
      case "quotes": return <QuoteList fromJobId={fromJobId ?? undefined} />;
      case "reports": return <ReportsView />;
      case "settings": return <SettingsView />;
      case "ai-activity": return <AIAssistantView />;
      case "receptionist": return <ReceptionistView navigate={navigate} />;
      case "supplier-pricing": return <SupplierPricingView />;
      default: return <Dashboard />;
    }
  };

  return (
    <AppContext.Provider value={appState}>
      <div class="layout">
        <Sidebar
          currentView={view}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main class="main-content">
          <div class="topbar">
            <button
              class="topbar-hamburger"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>
            <div class="topbar-search">
              <Search size={14} class="topbar-search-icon" />
              <input
                type="text"
                placeholder="Search..."
                value={topSearch}
                onInput={(e) => setTopSearch((e.target as HTMLInputElement).value)}
              />
            </div>
            <div class="topbar-actions">
              <button
                class="topbar-icon-btn"
                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                onClick={toggleTheme}
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
              </button>
              <button class="topbar-icon-btn" title="Notifications">
                <Bell size={15} />
              </button>
              <button class="topbar-icon-btn" title="Settings">
                <Settings size={15} />
              </button>
              <UserMenu navigate={navigate} />
            </div>
          </div>
          <TrialWarningBanner navigate={navigate} />
          {appState.loading ? (
            <div class="loading-text">Loading...</div>
          ) : (
            <div key={`${view}-${id ?? ""}`} class="page-transition">
              {renderMain()}
            </div>
          )}
        </main>
        <BottomNav currentView={view} />
      </div>
      <ErrorBanner />
      {trialExpired && (
        <TrialExpiredModal
          message={trialExpired}
          navigate={navigate}
          onClose={() => setTrialExpired(null)}
        />
      )}
    </AppContext.Provider>
  );
}
