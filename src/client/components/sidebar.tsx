import { useApp } from "../context";
import { getCurrentRole } from "../auth";
import { CalendarClock, LayoutDashboard, Briefcase, Users, Wrench, Settings, CalendarDays, FileText, Package, Inbox, ClipboardList, BarChart2, X, Cog, Bot, PhoneCall, ShoppingBag, UserCircle } from "lucide-preact";
import type { View } from "../types";

interface NavItem {
  view: View;
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
  ownerOnly?: boolean;
  techOnly?: boolean;
}

const navItems: NavItem[] = [
  { view: "dashboard", path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, ownerOnly: true },
  { view: "schedule", path: "/schedule", label: "Schedule", icon: CalendarDays },
  { view: "jobs", path: "/jobs", label: "Jobs", icon: Briefcase },
  { view: "profile", path: "/profile", label: "My Profile", icon: UserCircle, techOnly: true },
  { view: "customers", path: "/customers", label: "Customers", icon: Users, ownerOnly: true },
  { view: "technicians", path: "/technicians", label: "Technicians", icon: Wrench, ownerOnly: true },
  { view: "invoices", path: "/invoices", label: "Invoices", icon: FileText, ownerOnly: true },
  { view: "quotes", path: "/quotes", label: "Quotes", icon: ClipboardList, ownerOnly: true },
  { view: "reports", path: "/reports", label: "Reports", icon: BarChart2, ownerOnly: true },
  { view: "inbox", path: "/inbox", label: "Inbox", icon: Inbox, ownerOnly: true },
  { view: "receptionist", path: "/receptionist", label: "Receptionist", icon: PhoneCall, ownerOnly: true },
  { view: "ai-activity", path: "/ai-activity", label: "Travis AI", icon: Bot, ownerOnly: true },
  { view: "supplier-pricing", path: "/supplier-pricing", label: "Suppliers", icon: ShoppingBag, ownerOnly: true },
  { view: "materials", path: "/materials", label: "Materials", icon: Package, ownerOnly: true },
  { view: "services", path: "/services", label: "Service Types", icon: Settings, ownerOnly: true },
];

const bottomNavItems: NavItem[] = [
  { view: "settings", path: "/settings", label: "Settings", icon: Cog, ownerOnly: true },
];

interface SidebarProps {
  currentView: View;
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ currentView, isOpen, onClose }: SidebarProps) {
  const { navigate, stats } = useApp();
  const role = getCurrentRole();
  const isTech = role === "tech";

  const visibleNavItems = navItems.filter((item) =>
    isTech ? !item.ownerOnly : !item.techOnly
  );
  const visibleBottomItems = bottomNavItems.filter((item) => !isTech || !item.ownerOnly);

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
          <div class="sidebar-section-title">Navigation</div>
          {visibleNavItems.map((item) => (
            <button
              key={item.view}
              class={`sidebar-item ${currentView === item.view ? "active" : ""}`}
              onClick={() => handleNav(
                item.view === "supplier-pricing" && stats.stale_supplier_prices > 0
                  ? "/supplier-pricing?stale=1"
                  : item.path
              )}
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
              {item.view === "inbox" && stats.inbox_unread > 0 && (
                <span class="sidebar-badge">{stats.inbox_unread}</span>
              )}
              {item.view === "supplier-pricing" && stats.stale_supplier_prices > 0 && (
                <span class="sidebar-badge sidebar-badge--warn">{stats.stale_supplier_prices}</span>
              )}
            </button>
          ))}
        </nav>
        <div class="sidebar-footer">
          {visibleBottomItems.map((item) => (
            <button
              key={item.view}
              class={`sidebar-item${currentView === item.view ? " active" : ""}`}
              onClick={() => handleNav(item.path)}
            >
              <item.icon size={15} />
              <span>{item.label}</span>
            </button>
          ))}
          <div class="sidebar-stats-row">
            <div class="sidebar-stat">
              <span class="sidebar-stat-value">{stats.today_jobs}</span>
              <span class="sidebar-stat-label">Today</span>
            </div>
            <div class="sidebar-stat">
              <span class="sidebar-stat-value">{stats.upcoming_jobs}</span>
              <span class="sidebar-stat-label">Upcoming</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
