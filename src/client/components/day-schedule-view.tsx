import { useEffect, useRef, useState } from "preact/hooks";
import { useApp } from "../context";
import { api } from "../api";
import type { Job } from "../types";
import { ChevronLeft, ChevronRight, CalendarDays, Clock, User, Wrench } from "lucide-preact";
import { StatusBadge } from "./status-badge";

function shiftDate(date: string, delta: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return d.toISOString().split("T")[0];
}

function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(date + "T00:00:00");
  return !isNaN(d.getTime()) && d.toISOString().split("T")[0] === date;
}

interface DayScheduleViewProps {
  date: string;
}

export function DayScheduleView({ date }: DayScheduleViewProps) {
  const { navigate } = useApp();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const valid = isValidDate(date);
  const todayStr = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!valid) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    api<{ jobs: Job[] }>("GET", `/api/schedule?start=${date}&end=${date}`)
      .then((data) => {
        if (active) setJobs(data.jobs);
      })
      .catch((err) => {
        if (active) setError((err as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [date, valid]);

  const goToDay = (target: string) => navigate(`/schedule/${target}`);

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
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      goToDay(shiftDate(date, dx < 0 ? 1 : -1));
    }
  };

  if (!valid) {
    return (
      <div class="page">
        <div class="page-header">
          <h1>Day Schedule</h1>
        </div>
        <div class="schedule-detail-empty">
          "{date}" is not a valid date.
          <div style={{ marginTop: 12 }}>
            <button class="btn" onClick={() => navigate("/schedule")}>Back to week</button>
          </div>
        </div>
      </div>
    );
  }

  const dateObj = new Date(date + "T00:00:00");
  const isToday = date === todayStr;
  const sortedJobs = [...jobs].sort((a, b) => (a.scheduled_time || "").localeCompare(b.scheduled_time || ""));

  return (
    <div class="page">
      <div class="page-header">
        <div class="day-schedule-title">
          <h1>{dateObj.toLocaleDateString("en-US", { weekday: "long" })}</h1>
          <span class={`day-schedule-date ${isToday ? "today" : ""}`}>
            {dateObj.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            {isToday && <span class="day-schedule-today-pill">Today</span>}
          </span>
        </div>
        <div class="page-header-right">
          <button class="btn" onClick={() => navigate("/schedule")}>
            <CalendarDays size={15} /> Week
          </button>
          <button class="btn btn-icon" onClick={() => goToDay(shiftDate(date, -1))} aria-label="Previous day">
            <ChevronLeft size={16} />
          </button>
          <button class="btn btn-icon" onClick={() => goToDay(shiftDate(date, 1))} aria-label="Next day">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <p class="schedule-swipe-hint">Swipe left or right to change days</p>

      <div class="day-schedule-body" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {loading ? (
          <div class="schedule-detail-empty">Loading...</div>
        ) : error ? (
          <div class="schedule-detail-empty">{error}</div>
        ) : sortedJobs.length === 0 ? (
          <div class="schedule-detail-empty">No jobs scheduled for this day.</div>
        ) : (
          <div class="schedule-detail-list">
            {sortedJobs.map((job) => (
              <button
                key={job.id}
                class="schedule-detail-job"
                style={{ borderLeftColor: job.technician_color || job.service_type_color || "#16a34a" }}
                onClick={() => navigate(`/jobs/${job.id}`)}
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
