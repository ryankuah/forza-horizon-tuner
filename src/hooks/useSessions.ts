import * as React from "react";
import { fetchRunDetail, fetchSessions } from "@/services/api";
import type { RunDetail, RunSelection, SessionWithRuns } from "@/types/telemetry";

export function useSessions() {
  const [sessions, setSessions] = React.useState<SessionWithRuns[]>([]);
  const [selectedRunId, setSelectedRunId] = React.useState<RunSelection>("live");
  const [runDetail, setRunDetail] = React.useState<RunDetail | null>(null);
  const [isRunStreaming, setIsRunStreaming] = React.useState(false);

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
    if (selectedRunId === "live") {
      setRunDetail(null);
      setIsRunStreaming(false);
      return;
    }

    let cancelled = false;
    setRunDetail(null);
    setIsRunStreaming(true);

    fetchRunDetail(selectedRunId)
      .then((detail) => {
        if (!cancelled) setRunDetail(detail);
      })
      .catch((error) => {
        console.warn(`Run load failed: ${error instanceof Error ? error.message : String(error)}`);
        if (!cancelled) setRunDetail(null);
      })
      .finally(() => {
        if (!cancelled) setIsRunStreaming(false);
      });

    return () => {
      cancelled = true;
      setIsRunStreaming(false);
    };
  }, [selectedRunId]);

  return {
    sessions,
    setSessions,
    selectedRunId,
    setSelectedRunId,
    runDetail,
    isRunStreaming
  };
}
