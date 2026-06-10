import { useApp } from "../context";
import { CalendarClock, LayoutDashboard, Briefcase, Users, Wrench, Settings, CalendarDays, FileText, Package, FileSignature, X, Sparkles, PhoneCall, Inbox, Truck, BarChart3, Cog } from "lucide-preact";
import type { View } from "../types";

interface NavItem { view: View; path: string; label: string; icon: typeof LayoutDashboard }

const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: "Operations",
    items: [
      { view: "dashboard", path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { view: "schedule", path: "/schedule", label: "Schedule", icon: CalendarDays },
      { view: "jobs", path: "/jobs", label: "Jobs", icon: Briefcase },
      { view: "quotes", path: "/quotes", label: "Quotes", icon: FileSignature },
      { view: "customers", path: "/customers", label: "Customers", icon: Users },
      { view: "invoices", path: "/invoices", label: "Invoices", icon: FileText },
    ],
  },
  {
    title: "Travis AI",
    items: [
      { view: "assistant", path: "/assistant", label: "AI Assistant", icon: Sparkles },
      { view: "receptionist", path: "/receptionist", label: "Receptionist", icon: PhoneCall },
      { view: "inbox", path: "/inbox", label: "Inbox", icon: Inbox },
    ],
  },
  {
    title: "Business",
    items: [
      { view: "suppliers", path: "/suppliers", label: "Suppliers", icon: Truck },
      { view: "reports", path: "/reports", label: "Reports", icon: BarChart3 },
      { view: "technicians", path: "/technicians", label: "Technicians", icon: Wrench },
      { view: "materials", path: "/materials", label: "Materials", icon: Package },
      { view: "services", path: "/services", label: "Service Types", icon: Settings },
      { view: "settings", path: "/settings", label: "Settings", icon: Cog },
    ],
  },
];

interface SidebarProps {
  currentView: View;
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ currentView, isOpen, onClose }: SidebarProps) {
  const { navigate, stats } = useApp();

  const handleNav = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <>
      {isOpen && <div class="sidebar-overlay" onClick={onClose} />}
      <aside class={`sidebar ${isOpen ? "sidebar-open" : ""}`}>
        <div class="sidebar-brand">
          <div class="sidebar-brand-icon">
            <CalendarClock size={16} />
          </div>
          <div class="sidebar-brand-text">
            <span class="sidebar-brand-name">FieldScheduler</span>
            <span class="sidebar-brand-sub">Operations Platform</span>
          </div>
          <button class="sidebar-close-btn" onClick={onClose} aria-label="Close menu">
            <X size={16} />
          </button>
        </div>
        <nav class="sidebar-nav">
          {navSections.map((section) => (
            <div key={section.title}>
              <div class="sidebar-section-title">{section.title}</div>
              {section.items.map((item) => (
                <button
                  key={item.view}
                  class={`sidebar-item ${currentView === item.view ? "active" : ""}`}
                  onClick={() => handleNav(item.path)}
                >
                  <item.icon size={15} />
                  <span>{item.label}</span>
                  {item.view === "jobs" && stats.jobs > 0 && (
                    <span class="sidebar-badge">{stats.jobs}</span>
                  )}
                  {item.view === "customers" && stats.customers > 0 && (
                    <span class="sidebar-badge">{stats.customers}</span>
                  )}
                  {item.view === "invoices" && stats.invoices_outstanding > 0 && (
                    <span class="sidebar-badge">{stats.invoices_outstanding}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div class="sidebar-footer">
          <div class="sidebar-stat">
            <span class="sidebar-stat-value">{stats.today_jobs}</span>
            <span class="sidebar-stat-label">Today</span>
          </div>
          <div class="sidebar-stat">
            <span class="sidebar-stat-value">{stats.upcoming_jobs}</span>
            <span class="sidebar-stat-label">Upcoming</span>
          </div>
        </div>
      </aside>
    </>
  );
}
