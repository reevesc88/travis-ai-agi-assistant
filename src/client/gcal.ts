export function gcalEventUrl(eventId: string): string | null {
  try {
    const encoded = btoa(eventId);
    return `https://calendar.google.com/calendar/event?eid=${encoded}`;
  } catch {
    return null;
  }
}
