import * as React from "react";
import { createNewSession, fetchSessionDetail, fetchSessions } from "@/services/api";
import type { SessionDetail, SessionSelection, SessionSummary } from "@/types/telemetry";

export function useSessions() {
  const [sessions, setSessions] = React.useState<SessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = React.useState<SessionSelection>("live");
  const [sessionDetail, setSessionDetail] = React.useState<SessionDetail | null>(null);
  const [isSessionStreaming, setIsSessionStreaming] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const loadSessions = async () => {
      const nextSessions = await fetchSessions();
      if (!cancelled) setSessions(nextSessions);
    };

    loadSessions();
    const interval = window.setInterval(loadSessions, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  React.useEffect(() => {
    if (selectedSessionId === "live") {
      setSessionDetail(null);
      setIsSessionStreaming(false);
      return;
    }

    let cancelled = false;
    setSessionDetail(null);
    setIsSessionStreaming(true);

    fetchSessionDetail(selectedSessionId)
      .then((detail) => {
        if (!cancelled) setSessionDetail(detail);
      })
      .catch((error) => {
        console.warn(`Session load failed: ${error instanceof Error ? error.message : String(error)}`);
        if (!cancelled) setSessionDetail(null);
      })
      .finally(() => {
        if (!cancelled) setIsSessionStreaming(false);
      });

    return () => {
      cancelled = true;
      setIsSessionStreaming(false);
    };
  }, [selectedSessionId]);

  async function startNewSession() {
    const created = await createNewSession();
    const nextSessions = await fetchSessions();
    setSessions(nextSessions);
    setSelectedSessionId(created ? "live" : nextSessions[0]?.id ?? "live");
    return created;
  }

  return { sessions, setSessions, selectedSessionId, setSelectedSessionId, sessionDetail, isSessionStreaming, startNewSession };
}
