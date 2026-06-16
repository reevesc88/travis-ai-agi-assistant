import { useRef, useState } from "preact/hooks";
import { useApp } from "../context";
import { ChevronLeft, ChevronRight, X, Clock, User, Wrench, Maximize2, Play, Check } from "lucide-preact";
import { StatusBadge } from "./status-badge";
import type { Job, JobStatus } from "../types";

interface StatusAction {
  label: string;
  status: JobStatus;
  icon: typeof Play;
}

function getStatusActions(status: JobStatus): StatusAction[] {
  const actions: StatusAction[] = [];
  if (status !== "in_progress" && status !== "completed" && status !== "cancelled") {
    actions.push({ label: "Start", status: "in_progress", icon: Play });
  }
  if (status !== "completed" && status !== "cancelled") {
    actions.push({ label: "Complete", status: "completed", icon: Check });
  }
  return actions;
}

function getDaysInRange(start: string, end: string): string[] {
  const days: string[] = [];
  const d = new Date(start + "T00:00:00");
  const endDate = new Date(end + "T00:00:00");
  while (d <= endDate) {
    days.push(d.toISOString().split("T")[0]);
    d.setDate(d.getDate() + 1);
  }
  return days;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ScheduleView() {
  const { scheduleJobs, scheduleStart, scheduleEnd, setScheduleRange, navigate, updateJob, setError } = useApp();
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const changeStatus = async (job: Job, status: JobStatus) => {
    if (updatingId !== null) return;
    setUpdatingId(job.id);
    try {
      await updateJob(job.id, { status });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUpdatingId(null);
    }
  };

  const days = getDaysInRange(scheduleStart, scheduleEnd);
  const todayStr = new Date().toISOString().split("T")[0];

  const shiftWeek = (delta: number) => {
    const start = new Date(scheduleStart + "T00:00:00");
    start.setDate(start.getDate() + delta * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    setScheduleRange(start.toISOString().split("T")[0], end.toISOString().split("T")[0]);
    setSelectedDay(null);
  };

  const goToday = () => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    setScheduleRange(monday.toISOString().split("T")[0], sunday.toISOString().split("T")[0]);
    setSelectedDay(null);
  };

  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;
    // Horizontal swipe with enough distance and dominant horizontal motion
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      shiftWeek(dx < 0 ? 1 : -1);
    }
  };

  const detailJobs = selectedDay
    ? scheduleJobs.filter((j) => j.scheduled_date === selectedDay)
    : [];

  return (
    <div class="page">
      <div class="page-header">
        <h1>Schedule</h1>
        <div class="page-header-right">
          <button class="btn" onClick={goToday}>Today</button>
          <button class="btn btn-icon" onClick={() => shiftWeek(-1)} aria-label="Previous week"><ChevronLeft size={16} /></button>
          <span style={{ fontSize: 14, fontWeight: 600, minWidth: 200, textAlign: "center" }}>
            {new Date(scheduleStart + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            {" — "}
            {new Date(scheduleEnd + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
          <button class="btn btn-icon" onClick={() => shiftWeek(1)} aria-label="Next week"><ChevronRight size={16} /></button>
        </div>
      </div>

      <p class="schedule-swipe-hint">Swipe left or right to change weeks · tap a day for details</p>

      <div class="schedule-grid" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {days.map((day) => {
          const dayJobs = scheduleJobs.filter((j) => j.scheduled_date === day);
          const dateObj = new Date(day + "T00:00:00");
          const isToday = day === todayStr;
          const isSelected = day === selectedDay;
          return (
            <div key={day} class={`schedule-day ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}`}>
              <button
                class="schedule-day-header"
                onClick={() => setSelectedDay((cur) => (cur === day ? null : day))}
                aria-label={`View jobs for ${dateObj.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`}
                aria-pressed={isSelected}
              >
                <span class="schedule-day-name">{DAY_NAMES[dateObj.getDay()]}</span>
                <span class={`schedule-day-num ${isToday ? "today" : ""}`}>{dateObj.getDate()}</span>
              </button>
              <div class="schedule-day-jobs">
                {dayJobs.map((job) => (
                  <button
                    key={job.id}
                    class="schedule-job"
                    style={{ borderLeftColor: job.technician_color || job.service_type_color || "#16a34a" }}
                    onClick={() => navigate(`/jobs/${job.id}`)}
                  >
                    <div class="schedule-job-time">{job.scheduled_time}</div>
                    <div class="schedule-job-title">{job.customer_name}</div>
                    {job.service_type_name && <div class="schedule-job-service">{job.service_type_name}</div>}
                    {job.technician_name && <div class="schedule-job-tech">{job.technician_name}</div>}
                  </button>
                ))}
                {dayJobs.length === 0 && (
                  <button
                    class="schedule-empty"
                    onClick={() => setSelectedDay((cur) => (cur === day ? null : day))}
                  >
                    No jobs
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedDay && (
        <div class="schedule-detail">
          <div class="schedule-detail-header">
            <h2>
              {new Date(selectedDay + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "long", month: "long", day: "numeric",
              })}
            </h2>
            <div class="schedule-detail-header-actions">
              <button class="btn" onClick={() => navigate(`/schedule/${selectedDay}`)}>
                <Maximize2 size={14} /> Full day
              </button>
              <button class="btn btn-icon" onClick={() => setSelectedDay(null)} aria-label="Close day details">
                <X size={16} />
              </button>
            </div>
          </div>
          {detailJobs.length === 0 ? (
            <div class="schedule-detail-empty">No jobs scheduled for this day.</div>
          ) : (
            <div class="schedule-detail-list">
              {detailJobs.map((job) => {
                const actions = getStatusActions(job.status);
                const isUpdating = updatingId === job.id;
                return (
                  <div
                    key={job.id}
                    class="schedule-detail-job"
                    style={{ borderLeftColor: job.technician_color || job.service_type_color || "#16a34a" }}
                  >
                    <button
                      class="schedule-detail-job-open"
                      onClick={() => navigate(`/jobs/${job.id}`)}
                      aria-label={`Open job for ${job.customer_name}`}
                    >
                      <div class="schedule-detail-job-main">
                        <span class="schedule-detail-job-customer">{job.customer_name}</span>
                        <StatusBadge status={job.status} />
                      </div>
                      <div class="schedule-detail-job-meta">
                        <span><Clock size={13} /> {job.scheduled_time || "—"}</span>
                        {job.service_type_name && <span><Wrench size={13} /> {job.service_type_name}</span>}
                        {job.technician_name && <span><User size={13} /> {job.technician_name}</span>}
                      </div>
                      {job.address && <div class="schedule-detail-job-address">{job.address}</div>}
                    </button>
                    {actions.length > 0 && (
                      <div class="schedule-detail-job-actions">
                        {actions.map((action) => (
                          <button
                            key={action.status}
                            class={`schedule-status-action ${action.status === "completed" ? "complete" : "start"}`}
                            onClick={() => changeStatus(job, action.status)}
                            disabled={isUpdating}
                          >
                            <action.icon size={15} /> {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
