import { useEffect, useMemo, useState } from "preact/hooks";
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
import { AIAssistant } from "./components/ai-assistant";
import { Receptionist } from "./components/receptionist";
import { InboxView } from "./components/inbox-view";
import { Suppliers } from "./components/suppliers";
import { Reports } from "./components/reports";
import { SettingsView } from "./components/settings-view";
import { ErrorBanner } from "./components/error-banner";
import { Search, Bell, Settings, Menu, Sun, Moon } from "lucide-preact";

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

  const { view, id, navigate } = useRouter();

  if (view === "landing") {
    return <LandingPage navigate={navigate} />;
  }

  return <AppShell view={view} id={id} navigate={navigate} isAgent={isAgent} />;
}

interface AppShellProps {
  view: View;
  id: string | null;
  navigate: (to: string) => void;
  isAgent: boolean;
}

function AppShell({ view, id, navigate, isAgent }: AppShellProps) {
  const appState = useAppState(isAgent, navigate);
  const [topSearch, setTopSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, toggle: toggleTheme } = useTheme();

  // Load detail when URL has an ID
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

  const renderMain = () => {
    if (view === "jobs" && id && appState.selectedJob) return <JobDetail />;
    if (view === "customers" && id && appState.selectedCustomer) return <CustomerDetail />;
    if (view === "invoices" && id && appState.selectedInvoice) return <InvoiceDetail />;
    if (view === "quotes" && id && appState.selectedQuote) return <QuoteDetail />;
    if (view === "schedule" && id) return <DayScheduleView date={id} />;
    switch (view) {
      case "schedule": return <ScheduleView />;
      case "jobs": return <JobList />;
      case "customers": return <CustomerList />;
      case "technicians": return <TechnicianList />;
      case "services": return <ServiceTypeList />;
      case "materials": return <MaterialList />;
      case "invoices": return <InvoiceList />;
      case "quotes": return <QuoteList />;
      case "assistant": return <AIAssistant />;
      case "receptionist": return <Receptionist />;
      case "inbox": return <InboxView />;
      case "suppliers": return <Suppliers />;
      case "reports": return <Reports />;
      case "settings": return <SettingsView />;
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
            </div>
          </div>
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
    </AppContext.Provider>
  );
}
