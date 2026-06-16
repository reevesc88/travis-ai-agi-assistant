import type { JobStatus, Priority } from "../types";

const STATUS_COLORS: Record<JobStatus, string> = {
  scheduled: "#60a5fa",
  confirmed: "#a78bfa",
  in_progress: "#fbbf24",
  completed: "#34d399",
  cancelled: "#6b7280",
};

const STATUS_LABELS: Record<JobStatus, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const PRIORITY_COLORS: Record<Priority, string> = {
  low: "#64748b",
  normal: "#60a5fa",
  high: "#fbbf24",
  urgent: "#f87171",
};

export function StatusBadge({ status }: { status: JobStatus }) {
  const color = STATUS_COLORS[status] || "#64748b";
  return (
    <span class="status-badge" style={{ background: `${color}18`, color, borderColor: `${color}35` }}>
      <span class="status-dot" style={{ background: color }} />
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const color = PRIORITY_COLORS[priority] || "#64748b";
  return (
    <span class="priority-badge" style={{ color }}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );
}
