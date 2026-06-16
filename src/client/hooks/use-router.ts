import { useState, useEffect, useCallback } from "preact/hooks";
import type { View } from "../types";

export interface RouteState {
  view: View;
  id: string | null;
  fromJobId: number | null;
}

const VIEW_ROUTES: Record<string, View> = {
  "": "landing",
  "landing": "landing",
  "login": "login",
  "forgot-password": "forgot-password",
  "reset-password": "reset-password",
  "profile": "profile",
  "dashboard": "dashboard",
  "schedule": "schedule",
  "jobs": "jobs",
  "customers": "customers",
  "technicians": "technicians",
  "services": "services",
  "invoices": "invoices",
  "materials": "materials",
  "inbox": "inbox",
  "quotes": "quotes",
  "reports": "reports",
  "settings": "settings",
  "ai-activity": "ai-activity",
  "receptionist": "receptionist",
  "supplier-pricing": "supplier-pricing",
};

function parseRoute(fullPath: string): RouteState {
  const [pathPart, queryPart] = fullPath.split("?");
  const clean = pathPart.replace(/^\/+|\/+$/g, "").split("#")[0];
  const segments = clean.split("/");
  const viewKey = segments[0] || "";
  const view = VIEW_ROUTES[viewKey] || "landing";
  const id = segments[1] || null;
  const params = new URLSearchParams(queryPart ?? "");
  const fromJobRaw = params.get("from_job");
  const fromJobId = fromJobRaw ? parseInt(fromJobRaw, 10) || null : null;
  return { view, id, fromJobId };
}

export function useRouter() {
  const [route, setRoute] = useState<RouteState>(() =>
    parseRoute(window.location.pathname + window.location.search)
  );

  const navigate = useCallback((to: string) => {
    window.history.pushState(null, "", to);
    setRoute(parseRoute(to));
  }, []);

  useEffect(() => {
    const handler = () =>
      setRoute(parseRoute(window.location.pathname + window.location.search));
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  return { ...route, navigate };
}
