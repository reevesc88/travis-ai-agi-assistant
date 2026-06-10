import { useApp } from "../context";
import { StatusBadge } from "./status-badge";
import { Trash2 } from "lucide-preact";
import type { Job } from "../types";

export function JobRow({ job }: { job: Job }) {
  const { navigate, deleteJob, isAgent } = useApp();

  return (
    <tr class="table-row clickable" onClick={() => navigate(`/jobs/${job.id}`)}>
      <td><span class="identifier">{job.identifier}</span></td>
      <td>{job.scheduled_date}</td>
      <td class="text-muted">{job.scheduled_time}</td>
      <td>{job.customer_name || "—"}</td>
      <td>
        {job.service_type_name ? (
          <span class="service-pill" style={{ borderColor: job.service_type_color ? `${job.service_type_color}50` : "rgba(255,255,255,0.12)", color: job.service_type_color || "#94a3b8" }}>
            <span class="service-dot" style={{ background: job.service_type_color || "#64748b" }} />
            {job.service_type_name}
          </span>
        ) : (
          <span class="text-muted">—</span>
        )}
      </td>
      <td>
        {job.technician_name ? (
          <span class="tech-pill" style={{ borderColor: job.technician_color ? `${job.technician_color}50` : "rgba(255,255,255,0.12)", color: job.technician_color || "#94a3b8" }}>
            <span class="tech-dot" style={{ background: job.technician_color || "#64748b" }} />
            {job.technician_name}
          </span>
        ) : (
          <span class="text-muted">Unassigned</span>
        )}
      </td>
      <td><StatusBadge status={job.status} /></td>
      <td class="text-right">${job.price.toFixed(2)}</td>
      {isAgent && (
        <td>
          <button
            class="btn-icon danger"
            onClick={(e) => { e.stopPropagation(); deleteJob(job.id); }}
          >
            <Trash2 size={14} />
          </button>
        </td>
      )}
    </tr>
  );
}
