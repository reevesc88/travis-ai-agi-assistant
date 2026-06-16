import { useApp } from "../context";
import { getCurrentRole } from "../auth";
import { LayoutDashboard, Briefcase, CalendarDays, Users, FileText, UserCircle } from "lucide-preact";
import type { View } from "../types";

interface NavItem {
  view: View;
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
  ownerOnly?: boolean;
  techOnly?: boolean;
}

const bottomNavItems: NavItem[] = [
  { view: "dashboard", path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, ownerOnly: true },
  { view: "jobs", path: "/jobs", label: "Jobs", icon: Briefcase },
  { view: "schedule", path: "/schedule", label: "Schedule", icon: CalendarDays },
  { view: "profile", path: "/profile", label: "Profile", icon: UserCircle, techOnly: true },
  { view: "customers", path: "/customers", label: "Customers", icon: Users, ownerOnly: true },
  { view: "invoices", path: "/invoices", label: "Invoices", icon: FileText, ownerOnly: true },
];

interface BottomNavProps {
  currentView: View;
}

export function BottomNav({ currentView }: BottomNavProps) {
  const { navigate, stats } = useApp();
  const isTech = getCurrentRole() === "tech";
  const visibleItems = bottomNavItems.filter((item) =>
    isTech ? !item.ownerOnly : !item.techOnly
  );

  return (
    <nav class="bottom-nav" aria-label="Primary">
      {visibleItems.map((item) => (
        <button
          key={item.view}
          class={`bottom-nav-item ${currentView === item.view ? "active" : ""}`}
          onClick={() => navigate(item.path)}
          aria-label={item.label}
          aria-current={currentView === item.view ? "page" : undefined}
        >
          <span class="bottom-nav-icon">
            <item.icon size={20} />
            {item.view === "jobs" && stats.jobs > 0 && (
              <span class="bottom-nav-badge">{stats.jobs}</span>
            )}
            {item.view === "customers" && stats.customers > 0 && (
              <span class="bottom-nav-badge">{stats.customers}</span>
            )}
            {item.view === "invoices" && stats.invoices_outstanding > 0 && (
              <span class="bottom-nav-badge">{stats.invoices_outstanding}</span>
            )}
          </span>
          <span class="bottom-nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
